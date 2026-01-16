import { ref, computed, reactive, nextTick, watch } from 'vue';
import { authFetch } from './api.js';

export function usePos(productsRef, fetchMedia, setingsRef) {
    // ... (Estados existentes) ...
    const posTabs = ref([{ id: 1, name: 'Cliente 1', cart: [], customer: null, discount: { type: 'fixed', amount: 0, reason: '' } }]);
    const activeTabId = ref(1);
    const showPayModal = ref(false);
    const showDiscountModal = ref(false);
    const searchQuery = ref('');
    // ACTUALIZADO: Payment Form con referencia
    const paymentForm = reactive({ method: 'cash', amountReceived: 0, change: 0, reference: '' });
    const showScannerProds = ref(false);
    let html5QrCode = null;
    const isSearchFocused = ref(false);
    const showCustomerModal = ref(false);
    const customerSearchQuery = ref('');
    const customerList = ref([]);
    const discountForm = reactive({ type: 'fixed', value: 0, reason: '' });

    // ... (Computed activeTab, currentTotals, discountPreview IGUALES) ...
    const activeTab = computed(() => posTabs.value.find(t => t.id === activeTabId.value));
    const currentTotals = computed(() => { 
            
        const ivaform = (setingsRef.settings.value.iva / 100);
        const tab = activeTab.value;
        if (!tab) return { subtotal: 0, tax: 0, total: 0 };
        let subtotal = tab.cart.reduce((sum, item) => {
            const addonsCost = item.selectedOptions ? item.selectedOptions.reduce((acc, opt) => acc + (parseFloat(opt.price) || 0), 0) : 0;
            return sum + ((item.price + addonsCost) * item.qty);
        }, 0);
        let discountAmount = tab.discount.type === 'fixed' ? tab.discount.amount : subtotal * (tab.discount.amount / 100);
        if (discountAmount > subtotal) discountAmount = subtotal;
        let afterDiscount = subtotal - discountAmount;
        let tax = afterDiscount * ivaform;
        let total = afterDiscount + tax;

        return { subtotal, discountAmount, tax, total };
    });
    const discountPreview = computed(() => { /* ... lógica existente ... */ return { original: 0, newTotal: 0, saving: 0 }; });

    // ... (Helpers: addTab, removeTab, addToCart, updateQty, removeFromCart IGUALES) ...
    const addTab = () => { const newId = posTabs.value.length > 0 ? Math.max(...posTabs.value.map(t => t.id)) + 1 : 1; posTabs.value.push({ id: newId, name: `Cliente ${newId}`, cart: [], customer: null, discount: { type: 'fixed', amount: 0, reason: '' } }); activeTabId.value = newId; };
    const removeTab = (id) => { if (posTabs.value.length === 1) return toastr.warning('Debe haber al menos una orden activa'); const idx = posTabs.value.findIndex(t => t.id === id); posTabs.value.splice(idx, 1); if (id === activeTabId.value) activeTabId.value = posTabs.value[0].id; };
    const addToCart = (product) => { 
        const tab = activeTab.value; 
        const existing = tab.cart.find(i => i._id === product._id); 
        if (existing) existing.qty++; else tab.cart.push({ ...product, qty: 1 }); 
        toastr.success(`Agregado: ${product.name}`); 
        searchQuery.value = ''; 
        isSearchFocused.value = false; 
    };
    const updateQty = (id, d) => { const t = activeTab.value; const i = t.cart.find(x => x._id === id); if (i) { i.qty += d; if (i.qty <= 0) t.cart.splice(t.cart.indexOf(i), 1); } };
    const removeFromCart = (itemId) => { const tab = activeTab.value; const index = tab.cart.findIndex(i => i._id === itemId); if (index !== -1) tab.cart.splice(index, 1); };

    // --- NUEVO: Setter Método Pago ---
    const setPaymentMethod = (method) => {
        paymentForm.method = method;
        paymentForm.reference = ''; // Limpiar referencia al cambiar
        // Si no es efectivo, asumimos pago exacto para lógica interna (aunque no se use amountReceived para cambio)
        if (method !== 'cash') {
            paymentForm.amountReceived = currentTotals.value.total;
            paymentForm.change = 0;
        } else {
            paymentForm.amountReceived = 0;
        }
    };

    const openPayment = () => {
        if (activeTab.value.cart.length === 0) return toastr.warning('Carrito vacío');
        setPaymentMethod('cash'); // Reset a efectivo por defecto
        showPayModal.value = true;
    };

    const calculateChange = () => {
        if (paymentForm.method === 'cash') {
            const total = currentTotals.value.total;
            paymentForm.change = paymentForm.amountReceived >= total ? paymentForm.amountReceived - total : 0;
        }
    };

    const processSale = async (financeStatus) => {
        // Validar que la caja esté abierta
        if (!financeStatus || financeStatus.shiftStatus?.value !== 'open') {
            return toastr.error('⚠️ La caja está cerrada. Debes abrir caja antes de registrar ventas.');
        }

        // Validación solo para efectivo
        if (paymentForm.method === 'cash' && paymentForm.amountReceived < currentTotals.value.total) {
            return toastr.error('Monto recibido insuficiente');
        }

        console.log(activeTab.value);

        try {
            const payload = {
                cart: activeTab.value.cart,
                customer: activeTab.value.customer,
                discount: activeTab.value.discount,
                paymentMethod: paymentForm.method, // 'cash', 'credit_card', 'debit_card', 'transfer'
                paymentReference: paymentForm.reference, // Guardar referencia bancaria si existe
                totals: currentTotals.value
            };

            const res = await authFetch('/api/analytics/pos/sale', { method: 'POST', body: JSON.stringify(payload) });

            if (res.ok) {
                toastr.success('Venta registrada correctamente');
                showPayModal.value = false;

                // Limpiar Tab
                const currentId = activeTab.value.id;
                const index = posTabs.value.findIndex(t => t.id === currentId);
                posTabs.value[index] = { id: currentId, name: `Cliente ${currentId}`, cart: [], customer: null, discount: { type: 'fixed', amount: 0, reason: '' } };
            } else {
                const err = await res.json();
                toastr.error(err.message || 'Error al procesar venta');
            }
        } catch (e) {
            console.error(e);
            toastr.error('Error de conexión al procesar venta');
        }
    };

    const handleSearchEnter = () => { const query = searchQuery.value.trim(); if (!query) return; const allProducts = productsRef.products.value; const productByCode = allProducts.find(p => p.barcode === query || p._id === query); if (productByCode) addToCart(productByCode); };
    const openCustomerModal = async () => { customerSearchQuery.value = ''; showCustomerModal.value = true; await searchCustomers(); };
    const searchCustomers = async () => { try { const query = customerSearchQuery.value ? `?q=${customerSearchQuery.value}` : ''; const res = await authFetch(`/api/loyalty/customers${query}`); if (res.ok) customerList.value = await res.json(); } catch (e) { console.error(e); } };
    const selectCustomer = (customer) => { 
        activeTab.value.customer = customer; 
        activeTab.value.name = customer.name.split(' ')[0]; 
        showCustomerModal.value = false; 
        toastr.success(`Cliente asignado: ${customer.name}`); 
    };
    const removeCustomer = () => { activeTab.value.customer = null; activeTab.value.name = `Cliente ${activeTab.value.id}`; toastr.info('Cliente desvinculado'); };
    const openDiscountModal = () => { if (activeTab.value.cart.length === 0) return toastr.warning('Agrega productos primero'); const current = activeTab.value.discount; discountForm.type = current.type; discountForm.value = current.amount; discountForm.reason = current.reason || ''; showDiscountModal.value = true; };
    const applyDiscount = () => { 
        activeTab.value.discount = { 
            type: discountForm.type, 
            amount: parseFloat(discountForm.value) || 0, 
            reason: discountForm.reason 
        }; 
        showDiscountModal.value = false; 
        toastr.success('Descuento aplicado'); 
    };
    const triggerRecargas = () => toastr.info('Próximamente');
    const changeSalesperson = () => toastr.info('Próximamente');
    const setCustomer = selectCustomer;
    const startCameraScanner = async () => { 
        showScannerProds.value = true; 
        await nextTick(); 
        
        html5QrCode = new Html5Qrcode("pos-reader"); 
        try { 
            await html5QrCode.start(
                { 
                    facingMode: "environment" 
                }, 
                { 
                    fps: 10, 
                    qrbox: 250 
                }, 
                (
                    decodedText
                ) => { 
                    if (html5QrCode) html5QrCode.pause(); 
                    const allProducts = productsRef.products.value; 
                    const product = allProducts.find(p => p.barcode === decodedText || p._id === decodedText); 
                    if (product) { 
                        addToCart(product); 
                        setTimeout(() => html5QrCode && html5QrCode.resume(), 1000); 
                    } else { 
                        toastr.warning(`Código no encontrado: ${decodedText}`); 
                        setTimeout(() => html5QrCode && html5QrCode.resume(), 1000); 
                    } 
            }, () => { }); 
        } catch (err) { 
            toastr.error("No se pudo iniciar la cámara"); 
            showScannerProds.value = false; 
        } 
    };
    const stopCameraScanner = async () => { if (html5QrCode) { try { await html5QrCode.stop(); html5QrCode.clear(); } catch (e) { } html5QrCode = null; } showScannerProds.value = false; };

    let searchTimeout;
    watch(customerSearchQuery, (newVal) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { searchCustomers(); }, 300); });

    return {
        posTabs, activeTabId, activeTab,
        searchQuery, isSearchFocused, currentTotals, showPayModal, showDiscountModal, paymentForm, showScannerProds,
        showCustomerModal, customerSearchQuery, customerList, discountForm, discountPreview,
        // Methods
        addTab, removeTab, addToCart, updateQty, removeFromCart,
        openPayment, setPaymentMethod, calculateChange, processSale,
        handleSearchEnter, startCameraScanner, stopCameraScanner,
        openCustomerModal, selectCustomer, removeCustomer,
        triggerRecargas, changeSalesperson, setCustomer,
        openDiscountModal, applyDiscount
    };
}