import { ref } from 'vue';
import { authFetch } from './api.js';

export function useCoupons() {
    const coupons = ref([]);
    const loadingCoupons = ref(false);
    const showCouponModal = ref(false);
    
    // Formulario de Cupones
    const couponForm = ref({
        _id: null,
        code: '',
        discountType: 'percentage',
        discountValue: 0,
        minPurchaseAmount: 0,
        maxUses: 0,
        isActive: true,
        expirationDate: ''
    });

    const resetCouponForm = () => {
        couponForm.value = {
            _id: null,
            code: '',
            discountType: 'percentage',
            discountValue: 0,
            minPurchaseAmount: 0,
            maxUses: 0,
            isActive: true,
            expirationDate: ''
        };

        showCouponModal.value = true;
    };

    const fetchCoupons = async () => {
        loadingCoupons.value = true;
        try {
            const res = await authFetch('/api/coupons');
            const data = await res.json();
            if(res.ok) {
                coupons.value = data;
            } else {
                throw new Error(data.message || 'Error al cargar');
            }
        } catch (error) {
            console.error("Error cargando cupones:", error);
            toastr.error('Error al cargar cupones');
        } finally {
            loadingCoupons.value = false;
        }
    };

    const saveCoupon = async () => {
        if (!couponForm.value.code || couponForm.value.discountValue <= 0) {
            toastr.warning('Código y valor de descuento son requeridos.');
            return;
        }
        
        try {
            if (couponForm.value._id) {
                // Update (solo campos permitidos)
                const res = await authFetch(`/api/coupons/${couponForm.value._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        isActive: couponForm.value.isActive,
                        expirationDate: couponForm.value.expirationDate,
                        maxUses: couponForm.value.maxUses
                    })
                });
                if(!res.ok) throw new Error(await res.text());
                toastr.success('Cupón actualizado');
            } else {
                // Create
                const res = await authFetch('/api/coupons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(couponForm.value)
                });
                if(!res.ok) {
                    const data = await res.json();
                    throw new Error(data.message || 'Error al guardar cupón');
                }
                toastr.success('Cupón creado exitosamente');
            }
            fetchCoupons();
            showCouponModal.value = false;
        } catch (error) {
            console.error("Error guardando cupón:", error);
            toastr.error(error.message || 'Error al guardar cupón');
        }
    };

    const deleteCoupon = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este cupón?')) return;
        try {
            const res = await authFetch(`/api/coupons/${id}`, { method: 'DELETE' });
            if(!res.ok) throw new Error('Error al eliminar');
            toastr.success('Cupón eliminado');
            fetchCoupons();
        } catch (error) {
            console.error("Error eliminando cupón:", error);
            toastr.error('Error al eliminar cupón');
        }
    };

    const editCoupon = (coupon) => {
        couponForm.value = {
            ...coupon,
            expirationDate: coupon.expirationDate ? new Date(coupon.expirationDate).toISOString().split('T')[0] : ''
        };
        showCouponModal.value = true;
    };

    return {
        coupons,
        loadingCoupons,
        showCouponModal,
        couponForm,
        fetchCoupons,
        saveCoupon,
        deleteCoupon,
        editCoupon,
        resetCouponForm
    };
}
