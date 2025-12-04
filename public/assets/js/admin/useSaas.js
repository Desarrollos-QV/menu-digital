import { ref } from 'vue';

export function useSaas() {
    const businesses = ref([]);
    const showSaasModal = ref(false);
    
    // Formulario de Alta de Negocio
    const saasForm = ref({
        businessName: '',
        email: '',      // Email para el cliente
        username: '', // Usuario para el cliente
        password: '', // Contraseña para el cliente
        plan: 'free'
    });

    const fetchBusinesses = async () => {
        try {
            const res = await fetch('/api/saas/businesses');
            if (res.ok) businesses.value = await res.json();
            console.log(businesses)
        } catch (e) { console.error(e); }
    };

    const createBusiness = async () => {
        if (!saasForm.value.businessName || !saasForm.value.email || !saasForm.value.username || !saasForm.value.password) {
            toastr.warning('Completa todos los campos');
            return;
        }

        try {
            const res = await fetch('/api/saas/businesses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saasForm.value)
            });
            
            if (!res.ok) throw new Error('Error al crear negocio');
            
            toastr.success('Negocio y Usuario creados exitosamente');
            showSaasModal.value = false;
            // Limpiar form
            saasForm.value = { businessName: '', username: '', email: '', password: '', plan: 'free' };
            await fetchBusinesses();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    const toggleStatus = async (business) => {
        try {
            const res = await fetch(`/api/saas/businesses/${business._id}/toggle`, { method: 'PUT' });
            if (res.ok) {
                business.active = !business.active;
                toastr.info(`Negocio ${business.active ? 'Activado' : 'Bloqueado'}`);
            }
        } catch (error) {
            toastr.error('Error de conexión');
        }
    };

    return {
        businesses,
        showSaasModal,
        saasForm,
        fetchBusinesses,
        createBusiness,
        toggleStatus
    };
}