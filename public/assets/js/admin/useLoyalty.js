import { ref, nextTick } from 'vue';
import { authFetch } from './api.js';

export function useLoyalty() {
    const program = ref({ active: false, type: 'points', goal: 100, reward: '' });
    const showScanner = ref(false);
    const scanResult = ref(null); 
    
    // Instancia del lector directo
    let html5QrCode = null;

    const fetchProgram = async () => {
        try {
            console.log("Solicitamos config")
            const res = await authFetch('/api/loyalty/config');
            if (res.ok) {
                program.value = await res.json();
                console.log("program ",program.value);
                
            }
        } catch (e) { console.error(e); }
    };

    const saveProgram = async () => {
        try {
            await authFetch('/api/loyalty/config', {
                method: 'POST',
                body: JSON.stringify(program.value)
            });
            toastr.success('Programa actualizado');
        } catch (e) { toastr.error('Error al guardar'); }
    };

    // --- ESCÁNER MEJORADO ---
    const startScanner = async () => {
        showScanner.value = true;
        scanResult.value = null;
        
        await nextTick();
        
        // Usamos la clase base Html5Qrcode en lugar de Scanner UI
        // Asegúrate de que el div en el HTML tenga id="reader"
        html5QrCode = new Html5Qrcode("reader");

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        // Preferir cámara trasera
        try {
            await html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                onScanSuccess, 
                onScanFailure
            );
        } catch (err) {
            console.error("Error iniciando cámara", err);
            toastr.error("No se pudo acceder a la cámara. Verifica permisos y HTTPS.");
            showScanner.value = false;
        }
    };

    const onScanSuccess = async (decodedText) => {
        // Pausar o detener para no leer múltiples veces
        if(html5QrCode) {
            await html5QrCode.stop();
            html5QrCode = null;
        }
        showScanner.value = false;
        
        // Procesar Lectura
        try {
            let amount = 1;
            if (program.value.type === 'points') {
                const input = prompt("Cliente detectado. Ingresa el monto de la compra ($):", "100");
                if(!input) return; // Cancelado
                amount = input;
            }

            const res = await authFetch('/api/loyalty/add', {
                method: 'POST',
                body: JSON.stringify({ phone: decodedText, amount })
            });

            const data = await res.json();
            if (res.ok) {
                if (data.goalReached) {
                    Swal.fire({
                        title: '¡PREMIO DESBLOQUEADO!',
                        text: `El cliente ganó: ${data.reward}`,
                        icon: 'success',
                        confirmButtonText: 'Genial'
                    });
                } else {
                    toastr.success(`Puntos sumados. Nuevo saldo: ${data.newBalance}`);
                }
            } else {
                toastr.error(data.message || 'Error al sumar puntos');
            }
        } catch (e) {
            toastr.error('Error de conexión');
        }
    };

    const onScanFailure = (error) => {
        // Ignorar errores por frame, son normales mientras busca
    };

    const stopScanner = async () => {
        if(html5QrCode) {
            try {
                await html5QrCode.stop();
                html5QrCode = null;
            } catch(e) { console.log(e); }
        }
        showScanner.value = false;
    };

    return {
        program,
        showScanner,
        scanResult,
        fetchProgram,
        saveProgram,
        startScanner,
        stopScanner
    };
}