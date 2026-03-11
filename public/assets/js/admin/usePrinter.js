// Exportamos un nuevo módulo dedicado a la impresión profesional
export function usePrinter(settings) {
    
    // Configuración guardada en el navegador
    // idealmente esto se selecciona en la vista de "Configuración"
    const getPrinterConfig = () => {
        return {
            mode: localStorage.getItem('fudi_printer_mode') || 'qz', // 'qz', 'webusb', 'browser'
            printerName: localStorage.getItem('fudi_printer_name') || 'POS-58' // Nombre de la impresora en Windows
        };
    };

    // ==========================================
    // MÉTODO 1: QZ TRAY (EL ESTÁNDAR PARA PC/WINDOWS/MAC)
    // ==========================================
    const printWithQZ = async (ticketData, printerName) => {
        try {
            // 1. CONFIGURACIÓN EXPLÍCITA ANÓNIMA Y DOMINIO
            // Desactivamos firmas digitales
            if (typeof qz.security.setCertificatePromise === 'function') {
                qz.security.setCertificatePromise((resolve, reject) => resolve());
                qz.security.setSignaturePromise((toSign) => (resolve, reject) => resolve());
            }

            // 2. Intentar conectar forzando el dominio y localhost
            if (!qz.websocket.isActive()) {
                await qz.websocket.connect({ 
                    retries: 5, 
                    delay: 2,
                    host: ['localhost', 'app.fudipos.shop'] // Intentará ambas rutas explícitamente
                });
            }

            const config = qz.configs.create(printerName, {
                encoding: 'ISO-8859-1',
                legacy: true
            });


            // 3. Generar comandos ESC/POS puros
            const data = [
                '\x1B\x40',          // Inicializar
                '\x1B\x61\x01',      // Centrar
                '\x1B\x21\x10',      // Tamaño doble
                `${settings.settings.value.appName || 'TengoHambre'}\n`,
                `${settings.settings.value.address || 'Monterrey NL'}\n`,
                `Tel: ${settings.settings.value.phone || '00 000 000 000'}\n`,
                '\x1B\x21\x00',      // Tamaño normal
                'Ticket de Venta\n',
                '--------------------------------\n',
                '\x1B\x61\x00',      // Alinear Izquierda
                `Fecha: ${new Date().toLocaleString()}\n`,
                `Folio: #${ticketData._id.toString().slice(-4) || '000'}\n`,
                `Cliente: ${ticketData.customerName || 'General'}\n`,
                '--------------------------------\n'
            ];

            // Productos
            ticketData.items.forEach(item => {
                let line = `${item.quantity} x ${item.name}`;
                if (line.length > 20) line = line.substring(0, 20);
                let price = `$${(item.price * item.quantity).toFixed(2)}`;
                let spaces = 32 - line.length - price.length;
                data.push(`${line}${' '.repeat(spaces > 0 ? spaces : 1)}${price}\n`);
            });

            // Totales
            data.push('--------------------------------\n');
            data.push('\x1B\x61\x02'); // Alinear Derecha
            data.push('\x1B\x21\x08'); // Negrita
            data.push(`Subtotal: $${ticketData.subtotal.toFixed(2)}\n`);
            data.push(`IVA: $${ticketData.tax.toFixed(2)}\n`);
            // Verificamos si hubo descuento
            if (ticketData.discount > 0) {
                data.push(`Descuento: -$${ticketData.discount.toFixed(2)}\n`);
                data.push(`TOTAL: $${(ticketData.total - ticketData.discount).toFixed(2)}\n`);
            }else {
                data.push(`TOTAL: $${ticketData.total.toFixed(2)}\n`);
            }

            data.push('\x1B\x21\x00'); // Normal
            data.push('\x1B\x61\x01'); // Centrar
            data.push(`\n\nMetodo: ${ticketData?.paymentMethod}\n`);
            data.push('Gracias por su compra\n');
            data.push('Software: Tengo Hambre\n\n\n\n\n');
            data.push('\x1B\x69');     // Comando de Corte de papel (Cut)
            // 4. Mandar a imprimir! (Silencioso y en milisegundos)
            await qz.print(config, data);
            
            if(window.toastr) window.toastr.success('Ticket impreso (QZ Tray)');

        } catch (error) {
             console.error('Error detallado QZ:', error);
            
            // --- DETECCIÓN INTELIGENTE DEL ERROR ---
            const errorMsg = error.message || String(error);
            
            // Si el error menciona certificados o problemas de conexión WSS
            if (errorMsg.includes('cert') || errorMsg.includes('connection refused') || errorMsg.includes('offline') || errorMsg.includes('8181')) {
                
                // Mostrar un SweetAlert amigable guiando al usuario
                if (window.Swal) {
                    window.Swal.fire({
                        title: 'Conexión Bloqueada por Seguridad',
                        html: `
                            <div style="text-align: left; font-size: 14px;">
                                <p>Tu navegador está bloqueando la comunicación con la impresora por seguridad (HTTPS).</p>
                                <p><strong>Para solucionarlo en un clic:</strong></p>
                                <ol style="margin-left: 20px; margin-top: 10px; margin-bottom: 10px;">
                                    <li>Haz clic en el botón azul de abajo. Se abrirá una ventana nueva.</li>
                                    <li>En esa ventana, si ves una advertencia, haz clic en <b>"Avanzado"</b> y luego en <b>"Aceptar el riesgo / Continuar"</b>.</li>
                                    <li>Vuelve a esta pestaña y presiona "Imprimir" de nuevo.</li>
                                </ol>
                            </div>
                        `,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#4f46e5', // brand
                        cancelButtonColor: '#64748b',
                        confirmButtonText: 'Desbloquear Conexión <i class="fa-solid fa-external-link-alt ml-1"></i>',
                        cancelButtonText: 'Cerrar'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            // Abrimos la URL conflictiva en una pestaña nueva para que el usuario acepte el certificado
                            window.open('https://localhost:8181', '_blank');
                        }
                    });
                } else {
                    alert("Por favor abre https://localhost:8181 en una nueva pestaña y acepta el riesgo de seguridad.");
                }
            } else {
                // Otro error (ej. impresora apagada, nombre incorrecto)
                if(window.toastr) window.toastr.error('Error de impresión. Verifica que QZ Tray esté abierto y la impresora encendida.');
            }
            
            // Forzamos el fallback de todos modos para que el cliente no se quede sin ticket
            throw error; 
        }
    };

    // ==========================================
    // MÉTODO 2: NATIVE WEB USB (PARA ANDROID/TABLETS SIN APPS EXTRA)
    // Funciona en Chrome conectando la impresora térmica por cable OTG
    // ==========================================
    const printWithWebUSB = async (ticketData) => {
        try {
            // Solicitar permiso al usuario para conectar la impresora USB
            const device = await navigator.usb.requestDevice({ 
                filters: [{ classCode: 7 }] // Código 7 es clase de Impresora USB
            });
            
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);

            // Generamos el texto crudo igual que el método QZ
            const printData = [
                '\x1B\x40',          // Inicializar
                '\x1B\x61\x01',      // Centrar
                '\x1B\x21\x10',      // Tamaño doble
                `${settings.settings.value.appName || 'TengoHambre'}\n`,
                `${settings.settings.value.address || 'Monterrey NL'}\n`,
                `Tel: ${settings.settings.value.phone || '00 000 000 000'}\n`,
                '\x1B\x21\x00',      // Tamaño normal
                'Ticket de Venta\n',
                '--------------------------------\n',
                '\x1B\x61\x00',      // Alinear Izquierda
                `Fecha: ${new Date().toLocaleString()}\n`,
                `Folio: #${ticketData._id.toString().slice(-4) || '000'}\n`,
                `Cliente: ${ticketData.customerName || 'General'}\n`,
                '--------------------------------\n'
            ];

            // Productos
            ticketData.items.forEach(item => {
                let line = `${item.quantity} x ${item.name}`;
                if (line.length > 20) line = line.substring(0, 20);
                let price = `$${(item.price * item.quantity).toFixed(2)}`;
                let spaces = 32 - line.length - price.length;
                printData.push(`${line}${' '.repeat(spaces > 0 ? spaces : 1)}${price}\n`);
            });

            // Totales
            printData.push('--------------------------------\n');
            printData.push('\x1B\x61\x02'); // Alinear Derecha
            printData.push('\x1B\x21\x08'); // Negrita
            printData.push(`Subtotal: $${ticketData.subtotal.toFixed(2)}\n`);
            printData.push(`IVA: $${ticketData.tax.toFixed(2)}\n`);
            // Verificamos si hubo descuento
            if (ticketData.discount > 0) {
                printData.push(`Descuento: -$${ticketData.discount.toFixed(2)}\n`);
                printData.push(`TOTAL: $${(ticketData.total - ticketData.discount).toFixed(2)}\n`);
            }else {
                printData.push(`TOTAL: $${ticketData.total.toFixed(2)}\n`);
            }

            printData.push('\x1B\x21\x00'); // Normal
            printData.push('\x1B\x61\x01'); // Centrar
            printData.push(`\n\nMetodo: ${ticketData?.paymentMethod}\n`);
            printData.push('Gracias por su compra\n');
            printData.push('Software: Tengo Hambre\n\n\n\n\n');
            printData.push('\x1B\x69');     // Comando de Corte de papel (Cut)

            let printContent = printData.join('');

            const encoder = new TextEncoder();
            const data = encoder.encode(printContent);

            // Enviar datos al "Endpoint" de la impresora
            // Usualmente las impresoras tienen su salida de datos en el endpoint 1 o 2
            await device.transferOut(1, data); 
            
            if(window.toastr) window.toastr.success('Ticket impreso (WebUSB)');

        } catch (error) {
            console.error('Error WebUSB:', error);
            throw error;
        }
    };

    // ==========================================
    // MÉTODO 3: FALLBACK AL NAVEGADOR
    // ==========================================
    const printViaBrowser = (ticketData) => {
        let iframe = document.getElementById('print-frame');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-frame';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow.document;
        let itemsHtml = ticketData.items.map(item => `
            <div style="display:flex; justify-content:space-between; font-family: monospace; font-size:12px;">
                <span>${item.qty}x ${item.name}</span>
                <span>$${item.subTotal.toFixed(2)}</span>
            </div>
        `).join('');

        doc.open();
        doc.write(`
            <html><head><style>@page { size: 58mm auto; margin: 0; } body { width: 58mm; margin: 10px; font-family: monospace; }</style></head>
            <body>
                <center><b>FudiPos</b><br>Ticket de venta</center><hr>
                ${itemsHtml}
                <hr><div style="text-align:right"><b>TOTAL: $${ticketData.total.toFixed(2)}</b></div>
                <br><br><br>
            </body></html>
        `);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 500);
    };

    // ==========================================
    // FUNCIÓN MAESTRA EXPORTADA
    // ==========================================
    const printTicket = async (ticketData) => {
        const config = getPrinterConfig();

        try {
            // Intentar primero según la configuración del usuario
            if (config.mode === 'qz') {
                await printWithQZ(ticketData, config.printerName);
            } else if (config.mode === 'webusb') {
                await printWithWebUSB(ticketData);
            } else {
                printViaBrowser(ticketData);
            }
        } catch (err) {
            // Si el método "Pro" falla, siempre cae en el navegador por seguridad
            console.warn("Fallo el método nativo, usando navegador como respaldo.");
            printViaBrowser(ticketData);
        }
    };

    return { printTicket };
}