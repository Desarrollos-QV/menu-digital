import { ref, computed, reactive } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch
const Swal = window.Swal;

export function useKds() {
    const activeOrders = ref([]);
    const isLoading = ref(false);
    let pollingInterval = null;

    // --- OBTENER PEDIDOS ACTIVOS ---
    const fetchActiveOrders = async () => {
        isLoading.value = true;
        try {
            // Asumimos que el backend tiene un endpoint o filtro para esto
            // Si no, traemos todos y filtramos aquí (menos eficiente pero funcional para demo)
            const res = await authFetch('/api/orders'); 
            if (res.ok) {
                const allOrders = await res.json();
                // Filtramos solo los que NO están completados ni cancelados
                activeOrders.value = allOrders.filter(o => 
                    ['pending', 'preparing', 'ready'].includes(o.status)
                ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // FIFO (Primero en entrar, primero en salir)
                console.log(activeOrders);
            }
        } catch (error) {
            console.error("Error KDS:", error);
        } finally {
            isLoading.value = false;
        }
    };

    // --- COLUMNAS COMPUTADAS ---
    const pendingOrders = computed(() => activeOrders.value.filter(o => o.status === 'pending'));
    const preparingOrders = computed(() => activeOrders.value.filter(o => o.status === 'preparing'));
    const readyOrders = computed(() => activeOrders.value.filter(o => o.status === 'ready'));

    // --- CAMBIAR ESTADO (AVANZAR) ---
    const advanceStatus = async (order, nextStatus) => {
        try {
            const res = await authFetch(`/api/orders/${order._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus })
            });

            if (res.ok) {
                // Actualización optimista local
                const idx = activeOrders.value.findIndex(o => o._id === order._id);
                if (idx !== -1) {
                    if (nextStatus === 'completed') {
                        activeOrders.value.splice(idx, 1); // Remover del tablero
                        Swal.fire({
                            toast: true, position: 'top-end', showConfirmButton: false, timer: 1500,
                            icon: 'success', title: 'Pedido Entregado/Completado'
                        });
                    } else {
                        activeOrders.value[idx].status = nextStatus;
                    }
                }
            } else {
                Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Fallo de conexión', 'error');
        }
    };

    // --- AUTO-REFRESH (POLLING) ---
    const startPolling = () => {
        fetchActiveOrders();
        // Actualizar cada 15 segundos automáticamente
        pollingInterval = setInterval(fetchActiveOrders, 15000);
    };

    const stopPolling = () => {
        if (pollingInterval) clearInterval(pollingInterval);
    };

    // Helper para calcular tiempo transcurrido
    const getTimeElapsed = (dateString) => {
        const start = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - start) / 60000); // minutos
        if (diff < 1) return 'Hace un momento';
        if (diff > 60) return `Hace ${Math.floor(diff/60)}h ${diff%60}m`;
        return `Hace ${diff} min`;
    };

    return {
        activeOrders,
        pendingOrders, preparingOrders, readyOrders,
        fetchActiveOrders, advanceStatus,
        startPolling, stopPolling,
        getTimeElapsed, isLoading
    };
}