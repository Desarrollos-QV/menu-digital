import { ref } from 'vue';
import { authFetch } from './api.js';

export function useOrders() {
    const ordersList = ref([]);
    const selectedOrder = ref(null);
    const isLoading = ref(false);

    // Cargar Listado
    const fetchOrders = async () => {
        isLoading.value = true;
        try {
            const res = await authFetch('/api/orders');
            if (res.ok) {
                ordersList.value = await res.json();
            }
        } catch (e) { console.error(e); }
        finally { isLoading.value = false; }
    };

    // Cargar Detalle
    const fetchOrderDetails = async (id) => {
        isLoading.value = true;
        selectedOrder.value = null; // Limpiar anterior
        try {
            const res = await authFetch(`/api/orders/${id}`);
            if (res.ok) {
                selectedOrder.value = await res.json();
            }
        } catch (e) { 
            console.error(e);
            toastr.error('Error cargando la venta');
        }
        finally { isLoading.value = false; }
    };

    // --- ACCIONES ---

    const printTicket = () => {
        // Aquí conectaríamos con la impresora térmica o generaríamos un popup imprimible
        toastr.info('Enviando a impresora...');
        // window.print(); // O lógica específica de ticket
    };

    const downloadPDF = () => {
        // Placeholder para librería jsPDF
        toastr.info('Generando PDF...');
    };

    const shareWhatsapp = () => {
        if(!selectedOrder.value) return;
        const ord = selectedOrder.value;
        const customerName = ord.customerId ? ord.customerId.name : 'Cliente';
        const msg = `Hola ${customerName}, adjunto el comprobante de tu compra en FudiApp.\nOrden: #${ord._id.slice(-6).toUpperCase()}\nTotal: $${ord.total.toFixed(2)}\nGracias por tu preferencia.`;
        
        // Si tenemos el teléfono del cliente, lo usamos, si no, abre WhatsApp genérico
        const phone = ord.customerId && ord.customerId.phone ? ord.customerId.phone : '';
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const generateInvoice = () => {
        toastr.info('Módulo de Facturación próximamente');
    };

    return {
        ordersList, selectedOrder, isLoading,
        fetchOrders, fetchOrderDetails,
        printTicket, downloadPDF, shareWhatsapp, generateInvoice
    };
}