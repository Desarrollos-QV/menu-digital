import { ref } from 'vue';
import { authFetch } from './api.js';

export function useSaas() {
    const businesses = ref([]);
    const showSaasModal = ref(false);
    const editingBusiness = ref(null);

    // Dashboard global
    const dashboardStats = ref({ 
        visits: [], 
        profits: [],
        kpis: {
            todayProfits: 0,
            todayOrders: 0,
            todayVisits: 0,
            totalBusinesses: 0,
            activeBusinesses: 0,
            totalDebt: 0
        }
    });
    const dashboardLoading = ref(false);
    const dashboardMonthFilter = ref('current');

    // KPIs por rango de fechas (para los cards de comisiones/pedidos/deuda)
    const today = new Date().toISOString().split('T')[0];
    const kpiDateFrom    = ref(today);
    const kpiDateTo      = ref(today);
    const kpiRangeLoading = ref(false);
    const kpiRangeStats  = ref({ totalCommissions: 0, totalOrders: 0, totalDebt: 0 });
    const kpiRangeApplied = ref(false); // true cuando el usuario aplica el filtro

    const fetchKpisByRange = async () => {
        if (!kpiDateFrom.value || !kpiDateTo.value) return;
        kpiRangeLoading.value = true;
        try {
            const res = await authFetch(`/api/saas/kpis-range?from=${kpiDateFrom.value}&to=${kpiDateTo.value}`);
            if (res.ok) {
                kpiRangeStats.value = await res.json();
                kpiRangeApplied.value = true;
            } else {
                toastr.error('Error al obtener KPIs por rango');
            }
        } catch (e) {
            toastr.error('Error de conexión');
        } finally {
            kpiRangeLoading.value = false;
        }
    };

    const clearKpiRange = () => {
        kpiRangeApplied.value = false;
        kpiRangeStats.value = { totalCommissions: 0, totalOrders: 0, totalDebt: 0 };
        kpiDateFrom.value = today;
        kpiDateTo.value   = today;
    };

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
        // Comisiones
        commissionWebType:   'percent',
        commissionWebAmount: 0,
        commissionPosType:   'percent',
        commissionPosAmount: 0,
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
                // Comisiones
                commissionWebType:   business.commissionWebType   || 'percent',
                commissionWebAmount: business.commissionWebAmount  ?? 0,
                commissionPosType:   business.commissionPosType   || 'percent',
                commissionPosAmount: business.commissionPosAmount  ?? 0,
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
                    allowDelivery:       saasForm.value.allowDelivery,
                    allowPickup:         saasForm.value.allowPickup,
                    isOpen:              saasForm.value.isOpen,
                    active:              saasForm.value.active,
                    isTrending:          saasForm.value.isTrending,
                    // Comisiones
                    commissionWebType:   saasForm.value.commissionWebType,
                    commissionWebAmount: saasForm.value.commissionWebAmount,
                    commissionPosType:   saasForm.value.commissionPosType,
                    commissionPosAmount: saasForm.value.commissionPosAmount
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

    const fetchDashboardStats = async () => {
        dashboardLoading.value = true;
        try {
            const tzOffset = new Date().getTimezoneOffset();
            const res = await authFetch(`/api/saas/dashboard-stats?month=${dashboardMonthFilter.value}&tzOffset=${tzOffset}`);
            if (res.ok) {
                const data = await res.json();
                dashboardStats.value = data;
                setTimeout(() => { if (window.renderDashboardCharts) window.renderDashboardCharts(dashboardStats); }, 50);
            }
        } catch (e) {
            console.error('Error fetching dashboard stats', e);
        } finally {
            dashboardLoading.value = false;
        }
    };

    // ─── GESTIÓN DE COMISIONES ────────────────────────────────────────
    const showCommissionModal = ref(false);
    const selectedBizStats    = ref(null);   // Datos del negocio seleccionado
    const abonarForm          = ref({ amount: '', note: '' });

    const fetchCommissionStats = async (bizId) => {
        try {
            const res = await authFetch(`/api/saas/businesses/${bizId}/commission-stats`);
            if (res.ok) {
                selectedBizStats.value = await res.json();
                showCommissionModal.value = true;
            } else {
                toastr.error('Error al obtener estadísticas');
            }
        } catch (e) { toastr.error('Error de conexión'); }
    };

    const submitAbono = async () => {
        const amount = parseFloat(abonarForm.value.amount);
        if (!amount || amount <= 0) return toastr.warning('Ingresa un monto válido');
        try {
            const res = await authFetch(`/api/saas/businesses/${selectedBizStats.value.businessId}/commission-payment`, {
                method: 'POST',
                body: JSON.stringify({ amount, note: abonarForm.value.note })
            });
            if (res.ok) {
                const data = await res.json();
                toastr.success(data.message);
                abonarForm.value = { amount: '', note: '' };
                await fetchCommissionStats(selectedBizStats.value.businessId);
                await fetchBusinesses();
            } else {
                const err = await res.json();
                toastr.error(err.message);
            }
        } catch (e) { toastr.error('Error de conexión'); }
    };

    const submitLiquidar = async () => {
        if (!selectedBizStats.value || selectedBizStats.value.currentDebt <= 0) {
            return toastr.warning('No hay deuda pendiente');
        }
        Swal.fire({
            title: '¿Liquidar deuda completa?',
            text: `Se marcará como pagada la deuda de $${selectedBizStats.value.currentDebt.toFixed(2)}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Sí, liquidar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/saas/businesses/${selectedBizStats.value.businessId}/commission-settle`, {
                        method: 'POST',
                        body: JSON.stringify({ note: 'Liquidación total' })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        toastr.success(data.message);
                        await fetchCommissionStats(selectedBizStats.value.businessId);
                        await fetchBusinesses();
                    } else {
                        const err = await res.json();
                        toastr.error(err.message);
                    }
                } catch (e) { toastr.error('Error de conexión'); }
            }
        });
    };
    // ─────────────────────────────────────────────────────────────────────

    // ─── VENTAS POR NEGOCIO (SuperAdmin) ─────────────────────────────────────
    const showBizOrdersModal = ref(false);
    const bizOrdersBusiness  = ref(null);       // { _id, name, slug }
    const bizOrders          = ref([]);
    const bizOrdersLoading   = ref(false);
    const bizOrdersKpis      = ref({ totalOrders: 0, totalRevenue: 0, totalDelivery: 0 });
    const bizOrdersPagination = ref({ total: 0, page: 1, limit: 25, pages: 1 });

    // Filtros de fecha para Ventas de Negocio
    const bizOrdersDateFrom = ref(today);
    const bizOrdersDateTo   = ref(today);
    const bizOrdersRangeApplied = ref(false);

    const fetchBizOrders = async (bizId, page = 1) => {
        bizOrdersLoading.value = true;
        try {
            let url = `/api/saas/businesses/${bizId}/orders?page=${page}&limit=25`;
            if (bizOrdersRangeApplied.value && bizOrdersDateFrom.value && bizOrdersDateTo.value) {
                url += `&from=${bizOrdersDateFrom.value}&to=${bizOrdersDateTo.value}`;
            }

            const res = await authFetch(url);
            if (res.ok) {
                const data = await res.json();
                bizOrdersBusiness.value  = data.business;
                bizOrders.value          = data.orders;
                bizOrdersKpis.value      = data.kpis;
                bizOrdersPagination.value = data.pagination;
                showBizOrdersModal.value = true;
            } else {
                toastr.error('Error al cargar las ventas');
            }
        } catch (e) {
            toastr.error('Error de conexión');
        } finally {
            bizOrdersLoading.value = false;
        }
    };

    const applyBizOrdersFilter = async () => {
        if (!bizOrdersDateFrom.value || !bizOrdersDateTo.value) return;
        bizOrdersRangeApplied.value = true;
        if (bizOrdersBusiness.value) {
            await fetchBizOrders(bizOrdersBusiness.value._id, 1);
        }
    };

    const clearBizOrdersFilter = async () => {
        bizOrdersDateFrom.value = today;
        bizOrdersDateTo.value = today;
        bizOrdersRangeApplied.value = false;
        if (bizOrdersBusiness.value) {
            await fetchBizOrders(bizOrdersBusiness.value._id, 1);
        }
    };
    // ─────────────────────────────────────────────────────────────────────────

    return {
        businesses,
        showSaasModal,
        saasForm,
        editingBusiness,
        fetchBusinesses,
        dashboardStats,
        dashboardLoading,
        dashboardMonthFilter,
        fetchDashboardStats,
        // KPIs por rango
        kpiDateFrom,
        kpiDateTo,
        kpiRangeLoading,
        kpiRangeStats,
        kpiRangeApplied,
        fetchKpisByRange,
        clearKpiRange,
        openSaasModal,
        saveBusiness,
        deleteBusiness,
        createBusiness,
        toggleStatus,
        toggleTrending,
        // Comisiones
        showCommissionModal,
        selectedBizStats,
        abonarForm,
        fetchCommissionStats,
        submitAbono,
        submitLiquidar,
        // Ventas por negocio
        showBizOrdersModal,
        bizOrdersBusiness,
        bizOrders,
        bizOrdersLoading,
        bizOrdersKpis,
        bizOrdersPagination,
        fetchBizOrders,
        bizOrdersDateFrom,
        bizOrdersDateTo,
        bizOrdersRangeApplied,
        applyBizOrdersFilter,
        clearBizOrdersFilter
    };
}