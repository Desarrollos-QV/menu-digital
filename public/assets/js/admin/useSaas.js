import { ref } from 'vue';
import { authFetch } from './api.js';

export function useSaas() {
    const businesses = ref([]);
    const showSaasModal = ref(false);
    const editingBusiness = ref(null);

    const defaultForm = {
        _id: null,
        businessName: '',
        username: '',
        ownerEmail: '',
        password: '',
        plan: 'free',
        slug: '',
        phone: '',
        address: '',
        lat: null,
        lng: null,
        allowDelivery: true,
        allowPickup: false,
        isOpen: true,
        active: true,
        isTrending: false,
        _stats: null
    };
    const saasForm = ref({ ...defaultForm });

    const openSaasModal = (business = null) => {
        if (business) {
            editingBusiness.value = true;
            saasForm.value = {
                _id: business._id,
                businessName: business.name,
                ownerEmail: business.ownerEmail || '',
                slug: business.slug || '',
                plan: business.plan || 'free',
                phone: business.phone || '',
                address: business.address || '',
                lat: business.lat || null,
                lng: business.lng || null,
                allowDelivery: business.allowDelivery !== false,
                allowPickup: business.allowPickup === true,
                isOpen: business.isOpen !== false,
                active: business.active !== false,
                isTrending: business.isTrending === true,
                username: '---',
                password: '',
                _stats: {
                    deliveryCost: business.deliveryCost || 0,
                    time: business.time || '—',
                    currency: business.settings?.currency || 'MXN',
                    primaryColor: business.settings?.primaryColor || '#6366f1',
                    deliveryZonesCount: Array.isArray(business.deliveryZones) ? business.deliveryZones.length : 0,
                    categoriesCount: Array.isArray(business.categories) ? business.categories.length : 0,
                }
            };
        } else {
            editingBusiness.value = false;
            saasForm.value = { ...defaultForm };
        }
        showSaasModal.value = true;
    };

    const saveBusiness = async () => {
        if (!saasForm.value.businessName) { toastr.warning('El nombre del negocio es requerido'); return; }
        if (!saasForm.value.ownerEmail)   { toastr.warning('El Email del negocio es requerido'); return; }
        if (!editingBusiness.value && (!saasForm.value.username || !saasForm.value.password)) {
            toastr.warning('Usuario y contraseña son requeridos para nuevos negocios'); return;
        }

        try {
            let url    = '/api/saas/businesses';
            let method = 'POST';
            let payload;

            if (editingBusiness.value) {
                url    = `/api/saas/businesses/${saasForm.value._id}`;
                method = 'PUT';
                payload = {
                    name:          saasForm.value.businessName,
                    ownerEmail:    saasForm.value.ownerEmail,
                    slug:          saasForm.value.slug,
                    plan:          saasForm.value.plan,
                    phone:         saasForm.value.phone,
                    address:       saasForm.value.address,
                    lat:           saasForm.value.lat,
                    lng:           saasForm.value.lng,
                    allowDelivery: saasForm.value.allowDelivery,
                    allowPickup:   saasForm.value.allowPickup,
                    isOpen:        saasForm.value.isOpen,
                    active:        saasForm.value.active,
                    isTrending:    saasForm.value.isTrending
                };
            } else {
                payload = {
                    businessName: saasForm.value.businessName,
                    username:     saasForm.value.username,
                    ownerEmail:   saasForm.value.ownerEmail,
                    password:     saasForm.value.password,
                    plan:         saasForm.value.plan,
                    slug:         saasForm.value.slug
                };
            }

            const res = await authFetch(url, { method, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error('Error en la operación');

            toastr.success(editingBusiness.value ? 'Negocio actualizado' : 'Negocio creado');
            showSaasModal.value = false;
            await fetchBusinesses();

        } catch (error) {
            toastr.error('Error: ' + error.message);
        }
    };

    const deleteBusiness = async (id) => {
        Swal.fire({
            title: '¿Eliminar Negocio?',
            text: 'Se borrará el acceso y todos sus datos. Esta acción es irreversible.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
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
        } catch (e) { console.error(e); }
    };

    const createBusiness = async () => {
        if (!saasForm.value.businessName || !saasForm.value.ownerEmail || !saasForm.value.username || !saasForm.value.password) {
            toastr.warning('Completa todos los campos'); return;
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
            saasForm.value = { ...defaultForm };
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

    const toggleTrending = async (business) => {
        try {
            const res = await authFetch(`/api/saas/businesses/${business._id}`, {
                method: 'PUT',
                body: JSON.stringify({ isTrending: !business.isTrending })
            });
            if (res.ok) {
                business.isTrending = !business.isTrending;
                toastr.success(`Negocio ${business.isTrending ? 'marcado como Trending 🔥' : 'quitado de Trending'}`);
            }
        } catch (error) {
            toastr.error('Error de conexión');
        }
    };

    return {
        businesses,
        showSaasModal,
        saasForm,
        editingBusiness,
        fetchBusinesses,
        openSaasModal,
        saveBusiness,
        deleteBusiness,
        createBusiness,
        toggleStatus,
        toggleTrending
    };
}