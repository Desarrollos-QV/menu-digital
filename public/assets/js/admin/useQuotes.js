import { ref, computed, reactive } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch
const Swal = window.Swal;

export function useQuotes(setingsRef) {
    // Estado General
    const quotesList = ref([]);
    const isEditing = ref(false);

    // Base de datos local para búsquedas 
    const dbClients = ref([]);
    const dbProducts = ref([]);

    // Estado de Buscadores
    const clientSearch = ref('');
    const showClientResults = ref(false);

    const productSearch = ref('');
    const showProductResults = ref(false);
    // Formulario de Cotización
    const form = reactive({
        id: null,
        client: null,
        branch: 'Matriz',
        validUntil: '',
        notes: '',
        items: [],
        discount: {
            type: 'fixed', // 'percentage' ($) o 'fixed' (%)
            value: 0,
            title: '' // Opcional (ej: "Promo Verano")
        },
        total: 0,
        status: 'pending'
    });
    
    const fetchQuotes = async () => {
        try {
            const res = await authFetch('/api/quotes');
            if (res.ok) quotesList.value = await res.json();
            console.log("Listado de productos> " , quotesList.value)
        } catch (e) { console.error("Error fetching Quotes", e); }
    };

    
    // --- COMPUTADOS ---
    const totals = computed(() => {
        const subtotal = form.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const ivaform = (setingsRef.settings.value.iva / 100);
        
        let discountAmount = 0;
        if (form.discount.value > 0) {
            if (form.discount.type === 'percentage') {
                discountAmount = subtotal * (form.discount.value / 100);
            } else {
                discountAmount = form.discount.value;
            }
        }

        let afterDiscount = subtotal - discountAmount;
        let tax = afterDiscount * ivaform;
        let total = Math.max(afterDiscount + tax);

        // const total = Math.max(0, subtotal - discountAmount);

        return {
            subtotal,
            discount: discountAmount,
            tax,
            total
        };
    });

    // Filtro de Clientes (Autocomplete)
    const filteredClients = computed(() => {
        if (!clientSearch.value || clientSearch.value.length < 1) return [];
        return dbClients.value.filter(client =>
            client.name.toLowerCase().includes(clientSearch.value.toLowerCase()) ||
            client.phone.includes(clientSearch.value)
        );
    });

    // Filtro de Productos (Buscador)
    const filteredProducts = computed(() => {
        if (!productSearch.value || productSearch.value.length < 1) return [];
        return dbProducts.value.filter(prod =>
            prod.name.toLowerCase().includes(productSearch.value.toLowerCase())
        );
    });

    // --- ACCIONES DE DATOS (Setters) ---
    // Estas funciones se llamarán desde el index.html para pasarle los datos reales
    const setClientsDb = (users) => {
        dbClients.value = users;
    };

    const setProductsDb = (products) => {
        dbProducts.value = products;
    };

    const BlurSetTime = () => {
        setTimeout(() => {
            showClientResults.value = false;
            showProductResults.value = false;
        }, 200);
    }

    // --- ACCIONES DE INTERFAZ ---

    // Seleccionar Cliente del Buscador
    const selectClient = (client) => {
        form.client = client;
        // Opcional: llenar otros datos si tuviéramos (teléfono, dirección)
        clientSearch.value = client.name; // Mostrar nombre en el input
        showClientResults.value = false;
    };

    // Agregar Producto desde Buscador
    const addProduct = (product) => {
        const existing = form.items.find(i => i._id === product._id);
        if (existing) {
            existing.qty++;
            // Feedback visual sutil (Toast)
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
            Toast.fire({ icon: 'success', title: '+1 Cantidad' });
        } else {
            form.items.push({
                ...product,
                qty: 1
            });
            console.log("elemento agregado... " , form);
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
            Toast.fire({ icon: 'success', title: 'Producto agregado' });
        }

        // Opcional: Limpiar buscador después de agregar
        productSearch.value = '';
    };

    const updateQty = (index, delta) => {
        const item = form.items[index];
        item.qty += delta;
        if (item.qty <= 0) form.items.splice(index, 1);
    };

    const removeItem = (index) => {
        form.items.splice(index, 1);
    };

    const applyDiscount = (type, value, title) => {
        form.discount.type = type;
        form.discount.value = parseFloat(value) || 0;
        form.discount.title = title || '';
    };

    const removeDiscount = () => {
        form.discount.value = 0;
        form.discount.title = '';
    };

    // --- CRUD ---
    const newQuote = () => {
        form.id = Date.now().toString();
        form.client = null;
        clientSearch.value = '';
        productSearch.value = '';
        form.branch = 'Matriz';
        const date = new Date();
        date.setDate(date.getDate() + 7);
        form.validUntil = date.toISOString().split('T')[0];
        form.notes = '';
        form.items = [];
        form.status = 'pending';
        // Reiniciar descuento
        form.discount = { type: 'fixed', value: 0, title: '' };
        isEditing.value = false;
    };

    const editQuote = (quote) => {
        // Buscar el cliente completo en dbClients por customerId
        const fullClient = dbClients.value.find(client => client._id === quote.customerId);

        // Reconstruir items con información completa desde dbProducts
        const completeItems = quote.items.map(itemId => {
            // Buscar el producto en dbProducts
            const product = dbProducts.value.find(prod => prod._id === itemId._id);
            return product || null; // Retornar el producto o null si no existe
        }).filter(item => item !== null); // Filtrar items que no se encontraron
        // Copiar la cotización al formulario
        Object.assign(form, JSON.parse(JSON.stringify(quote)));
        
        // Asignar el cliente completo (con toda su data)
        if (fullClient) {
            form.client = fullClient;
            clientSearch.value = fullClient.name;
        }
        
        // Reemplazar los items con la información completa
        form.items = completeItems.map(product => ({
            ...product,
            qty: quote.items.find(item => 
                typeof item === 'object' ? item._id === product._id : false
            )?.qty || 1
        }));

        // Asegurar compatibilidad si la cotización guardada no tenía campo de descuento
        if (!form.discount) form.discount = { type: 'fixed', value: 0, title: '' };

        isEditing.value = true;
    };

    const deleteQuote = async (id) => {
        Swal.fire({
            title: '¿Eliminar?',
            text: "No podrás revertir esto",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/quotes/${id}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Cotización eliminada'); await fetchQuotes(); }
                } catch (e) { toastr.error('Error al eliminar'); }
            }
        });
    };

    // --- EXPORTAR ---
    const generatePDF = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.text("COTIZACIÓN", 105, 20, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Folio: #${form.id.slice(-6)}`, 150, 30);
        doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 150, 35);
        doc.text(`Válido hasta: ${form.validUntil}`, 150, 40);

        // Cliente
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text("Cliente:", 20, 40);
        doc.setFont(undefined, 'normal');
        doc.text(clientSearch.value || form.client.name, 20, 46);

        // Tabla
        let y = 70;
        doc.setFillColor(240, 240, 240);
        doc.rect(20, y - 6, 170, 8, 'F');
        doc.setFont(undefined, 'bold');
        doc.text("Producto", 25, y);
        doc.text("Cant.", 100, y);
        doc.text("Precio", 125, y);
        doc.text("Total", 155, y);
        doc.setFont(undefined, 'normal');

        y += 8;
        form.items.forEach(item => {
            doc.text(item.name, 25, y);
            doc.text(item.qty.toString(), 105, y, { align: 'center' });
            doc.text(`$${item.price.toFixed(2)}`, 135, y, { align: 'right' });
            doc.text(`$${(item.price * item.qty).toFixed(2)}`, 180, y, { align: 'right' });
            y += 8;
        });

        y += 5;
        doc.line(20, y, 190, y);
        y += 10;

        // Totales con Descuento
        if (totals.value.discount > 0) {
            doc.text(`Subtotal: $${totals.value.subtotal.toFixed(2)}`, 180, y, { align: 'right' });
            y += 6;
            const discTitle = form.discount.title ? `(${form.discount.title})` : '';
            doc.text(`Descuento ${discTitle}: -$${totals.value.discount.toFixed(2)}`, 180, y, { align: 'right' });
            y += 6;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL: $${totals.value.total.toFixed(2)}`, 180, y, { align: 'right' });

        if (form.notes) {
            y += 20;
            doc.setFontSize(10);
            doc.text("Notas:", 20, y);
            doc.setFont(undefined, 'normal');
            doc.text(form.notes, 20, y + 5);
        }

        doc.save(`Cotizacion_${form.id.slice(-4)}.pdf`);
    };

    const sendWhatsApp = () => {
        let msg = `Hola ${clientSearch.value}, cotización #${form.id.slice(-6)}:\n\n`;
        form.items.forEach(i => {
            msg += `${i.qty} x ${i.name} - $${(i.price * i.qty).toFixed(2)}\n`;
        });

        if (totals.value.discount > 0) {
            msg += `\nSubtotal: $${totals.value.subtotal.toFixed(2)}`;
            msg += `\nDescuento: -$${totals.value.discount.toFixed(2)}`;
        }

        msg += `\n*TOTAL: $${totals.value.total.toFixed(2)}*`;
        return encodeURIComponent(msg);
    };

    const sendEmail = () => {
        const subject = `Cotización #${form.id.slice(-6)}`;
        let body = `Hola ${clientSearch.value},\n\n`;
        form.items.forEach(i => {
            body += `${i.qty} x ${i.name} ($${i.price}) = $${(i.price * i.qty).toFixed(2)}\n`;
        });

        if (totals.value.discount > 0) {
            body += `\nSubtotal: $${totals.value.subtotal.toFixed(2)}`;
            body += `\nDescuento: -$${totals.value.discount.toFixed(2)}`;
        }

        body += `\nTOTAL: $${totals.value.total.toFixed(2)}`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };

    return {
        fetchQuotes,
        quotesList, form, isEditing, totals,
        clientSearch, showClientResults, filteredClients, selectClient,
        productSearch, showProductResults, filteredProducts, addProduct,
        dbClients, dbProducts, setClientsDb, setProductsDb,
        BlurSetTime, updateQty, removeItem,
        applyDiscount, removeDiscount, // Nuevas funciones expuestas
        newQuote, editQuote, deleteQuote,
        generatePDF, sendWhatsApp, sendEmail
    };
}