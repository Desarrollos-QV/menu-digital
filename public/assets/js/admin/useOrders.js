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

     // --- CAMBIAR ESTADO MANUALMENTE ---
    const updateOrderStatus = async (id, newStatus) => {
        try {
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                // Actualizar lista local
                const idx = ordersList.value.findIndex(o => o._id === id);
                if (idx !== -1) ordersList.value[idx].status = newStatus;
                
                Swal.fire({
                    toast: true, position: 'top-end', showConfirmButton: false, timer: 2000,
                    icon: 'success', title: `Estado cambiado a: ${newStatus}`
                });
            }
        } catch (error) {
            Swal.fire('Error', 'No se pudo actualizar el pedido', 'error');
        }
    };

    // --- CANCELAR PEDIDO (ELIMINAR DE CAJA) ---
    const cancelOrder = async (id) => {
        const result = await Swal.fire({
            title: '¿Cancelar Venta?',
            text: "Esta acción marcará el pedido como cancelado y se restará del total de caja del día.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, cancelar venta',
            cancelButtonText: 'Volver'
        });

        if (result.isConfirmed) {
            try {
                // Opción A: Borrar físico (DELETE) -> No recomendado para auditoría
                // Opción B: Update status 'cancelled' (Recomendado)
                const res = await fetch(`/api/orders/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'cancelled' })
                });

                if (res.ok) {
                    const idx = ordersList.value.findIndex(o => o._id === id);
                    if (idx !== -1) ordersList.value[idx].status = 'cancelled';
                    
                    Swal.fire(
                        'Cancelado',
                        'La venta ha sido cancelada y descontada.',
                        'success'
                    );
                }
            } catch (error) {
                Swal.fire('Error', 'Hubo un problema al cancelar', 'error');
            }
        }
    };

    // --- EXCEL ---
    const downloadSalesExcel = () => {
        if (!window.XLSX) return Swal.fire('Error', 'Librería Excel no cargada', 'error');
        
        const data = ordersList.value.map(o => ({
            Folio: o._id.slice(-6),
            Fecha: new Date(o.createdAt).toLocaleDateString(),
            Hora: new Date(o.createdAt).toLocaleTimeString(),
            Cliente: o.customerId ? o.customerId.name : 'Mostrador',
            Total: o.total,
            Metodo: o.paymentMethod,
            Estado: o.status
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");
        XLSX.writeFile(wb, `Ventas_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    return {
        ordersList, selectedOrder, isLoading,
        fetchOrders, fetchOrderDetails,
        updateOrderStatus,
        cancelOrder,
        downloadSalesExcel
    };
}