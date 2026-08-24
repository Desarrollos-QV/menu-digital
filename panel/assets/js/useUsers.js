import { ref } from 'vue';
import { authFetch } from './api.js';

export function useUsers() {
    const usersList = ref([]);
    const selectedUser = ref(null); // Datos básicos
    const selectedUserStats = ref({}); // Estadísticas
    const selectedUserOrders = ref([]); // Historial pedidos
    const isLoadingDetails = ref(false);

    // Obtener lista para DataTable
    const fetchUsers = async () => {
        try {
            const res = await authFetch('/api/customers');
            if (res.ok) {
                usersList.value = await res.json();
            }
        } catch (e) { console.error(e); }
    };

    // Obtener detalle profundo
    const fetchUserDetails = async (id) => {
        isLoadingDetails.value = true;
        try {
            const res = await authFetch(`/api/customers/${id}`);
            if (res.ok) {
                const data = await res.json();
                selectedUser.value = data.customer;
                selectedUserOrders.value = data.recentOrders;
                selectedUserStats.value = data.stats;
            }
        } catch (e) {
            console.error(e);
            toastr.error('Error al cargar detalles');
        } finally {
            isLoadingDetails.value = false;
        }
    };

    return {
        usersList,
        selectedUser,
        selectedUserStats,
        selectedUserOrders,
        isLoadingDetails,
        fetchUsers,
        fetchUserDetails
    };
}