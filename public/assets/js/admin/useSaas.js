import { ref } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useSaas() {
    const businesses = ref([]);
    const showSaasModal = ref(false);
    const editingBusiness = ref(null);

    // Formulario de Alta de Negocio
    const defaultForm = { _id: null, businessName: '', username: '',ownerEmail: '',  password: '', plan: 'free', slug: '' };
    const saasForm = ref({ ...defaultForm });

    const openSaasModal = (business = null) => {
        if (business) {
            editingBusiness.value = true;
            // Mapeamos los datos del negocio al formulario
            saasForm.value = {
                _id: business._id,
                businessName: business.name,
                ownerEmail: business.ownerEmail,
                slug: business.slug,
                plan: business.plan,
                username: '---', // No mostramos usuario ni password al editar por seguridad
                password: ''
            };
        } else {
            editingBusiness.value = false;
            saasForm.value = { ...defaultForm };
        }
        showSaasModal.value = true;
    };

    const saveBusiness = async () => {
        // Validaciones
        if (!saasForm.value.businessName) {
            toastr.warning('El nombre del negocio es requerido');
            return;
        }

        if (!saasForm.value.ownerEmail) {
            toastr.warning('El Email del negocio es requerido');
            return;
        }

        // Si es nuevo, requerimos usuario y contraseña
        if (!editingBusiness.value && (!saasForm.value.username || !saasForm.value.password)) {
            toastr.warning('Usuario y contraseña son requeridos para nuevos negocios');
            return;
        }

        try {
            let url = '/api/saas/businesses';
            let method = 'POST';

            if (editingBusiness.value) {
                url = `/api/saas/businesses/${saasForm.value._id}`;
                method = 'PUT';
                // Preparamos payload para update (nombre, slug, plan)
                var payload = {
                    name: saasForm.value.businessName,
                    ownerEmail: saasForm.value.ownerEmail,
                    slug: saasForm.value.slug,
                    plan: saasForm.value.plan
                };
            } else {
                // Payload para create (incluye usuario)
                payload = {
                    businessName: saasForm.value.businessName,
                    username: saasForm.value.username,
                    ownerEmail: saasForm.value.ownerEmail,
                    password: saasForm.value.password,
                    plan: saasForm.value.plan,
                    slug: saasForm.value.slug
                };
            }

            const res = await authFetch(url, {
                method: method,
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Error en la operación');

            toastr.success(editingBusiness.value ? 'Negocio actualizado' : 'Negocio creado');
            showSaasModal.value = false;
            await fetchBusinesses();

        } catch (error) {
            toastr.error("Error: "+error.message);
        }
    };

    const deleteBusiness = async (id) => {
        Swal.fire({
            title: '¿Eliminar Negocio?',
            text: "Se borrará el acceso y todos sus datos. Esta acción es irreversible.",
            icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, eliminar todo'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/saas/businesses/${id}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Negocio eliminado'); await fetchBusinesses(); }
                } catch (e) { toastr.error('Error al eliminar'); }
            }
        });
    };

    const fetchBusinesses = async () => {
        try {
            const res = await fetch('/api/saas/businesses');
            if (res.ok) businesses.value = await res.json();
            console.log("businesses ",businesses.value)
        } catch (e) { console.error(e); }
    };

    const createBusiness = async () => {
        if (!saasForm.value.businessName || !saasForm.value.ownerEmail || !saasForm.value.username || !saasForm.value.password) {
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
            saasForm.value = { businessName: '', username: '', ownerEmail: '', password: '', plan: 'free' };
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
        editingBusiness, // Exportamos estado de edición
        fetchBusinesses,
        openSaasModal,   // Modificado para recibir parámetro
        saveBusiness,    // Modificado para manejar PUT/POST
        deleteBusiness,  // Nueva
        createBusiness,
        toggleStatus
    };
}