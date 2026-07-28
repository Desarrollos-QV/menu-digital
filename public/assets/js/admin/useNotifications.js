import { ref, computed } from 'vue';
import { authFetch } from './api.js';

export function useNotifications() {
    const notifications = ref([]);
    const showNotificationsMenu = ref(false);
    let pollingInterval = null;

    // Solo contabiliza notificaciones no leídas
    const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);

    // Obtener notificaciones desde el backend (por ahora se extraen de orders pending)
    const fetchNotifications = async () => {
        try {
            const res = await authFetch('/api/orders');
            if (res.ok) {
                const allOrders = await res.json();
                
                // Filtramos solo pending para notificaciones de "Nuevo Pedido"
                const pendingOrders = allOrders
                    .filter(o => o.status === 'pending')
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
                // Mapear al formato genérico de notificación
                const newNotifs = pendingOrders.map(o => ({
                    id: o._id,
                    type: 'order',
                    title: '¡Nuevo Pedido!',
                    message: `Folio #${o._id.slice(-6).toUpperCase()} por $${(o.total || 0).toFixed(2)}`,
                    time: new Date(o.createdAt),
                    read: false, // Nota: idealmente read status se guarda en DB o LocalStorage
                    icon: 'fa-solid fa-motorcycle',
                    color: 'text-brand bg-brand/10'
                }));

                // Mantener estado 'read' de las que ya teníamos
                const existingReadIds = new Set(notifications.value.filter(n => n.read).map(n => n.id));
                newNotifs.forEach(n => {
                    if (existingReadIds.has(n.id)) {
                        n.read = true;
                    }
                });

                notifications.value = newNotifs;
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    const markAsRead = (id) => {
        const n = notifications.value.find(n => n.id === id);
        if (n) n.read = true;
    };

    const markAllAsRead = () => {
        notifications.value.forEach(n => n.read = true);
    };

    const toggleMenu = () => {
        showNotificationsMenu.value = !showNotificationsMenu.value;
    };

    // Helper de tiempo
    const getTimeElapsed = (dateObj) => {
        const start = new Date(dateObj);
        const now = new Date();
        const diff = Math.floor((now - start) / 60000); // minutos
        if (diff < 1) return 'Hace un momento';
        if (diff < 60) return `Hace ${diff} min`;
        if (diff < 1440) return `Hace ${Math.floor(diff/60)} hrs`;
        return `Hace ${Math.floor(diff/1440)} días`;
    };

    const startPolling = () => {
        fetchNotifications();
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(fetchNotifications, 15000);
    };

    const stopPolling = () => {
        if (pollingInterval) clearInterval(pollingInterval);
    };

    return {
        notifications,
        unreadCount,
        showNotificationsMenu,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        toggleMenu,
        getTimeElapsed,
        startPolling,
        stopPolling
    };
}
