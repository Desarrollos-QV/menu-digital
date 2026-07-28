const { createApp, ref, computed, onMounted, nextTick, reactive, watch } = Vue;

createApp({
    setup() {
        // --- TEMA (DARK MODE) ---
        const isDark = ref(false);
        const toggleTheme = () => {
            isDark.value = !isDark.value;
            updateHtmlClass();
            localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
        };
        const updateHtmlClass = () => document.documentElement.classList.toggle('dark', isDark.value);
        const initTheme = () => {
            if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                isDark.value = true;
            }
            updateHtmlClass();
        };

        // --- SESSION CLIENTE UNIFICADA ---
        const sharedCust = window.createSharedCustomer();
        
        const currentUser = computed(() => sharedCust.customer.value ? { customer: sharedCust.customer.value } : null);
        const firstName = computed(() => {
            if (!sharedCust.customer.value) return '';
            return sharedCust.customer.value.name.split(' ')[0];
        });
        const userInitial = computed(() => {
            if (!sharedCust.customer.value) return '?';
            return sharedCust.customer.value.name.charAt(0).toUpperCase();
        });

        const userAvatarUrl = computed(() => {
            if (!sharedCust.customer.value) return '';
            return sharedCust.customer.value.avatar;
        });

        // --- AUTH FORMS ---
        const isLoginMode = ref(true);
        const isSetupPasswordMode = ref(false);
        const showUserDropdown = ref(false);

        // Formulario Login
        const loginForm = reactive({ phone: '', password: '' });
        // Formulario Registro
        const customerForm = reactive({ name: '', phone: '', email: '', password: '' });
        // Formulario Configurar Contraseña (Migración de PIN)
        const setupPasswordForm = reactive({ email: '', password: '', confirmPassword: '' });

        let tempPhone = '';
        let tempPin = '';

        const openModal = (mode = 'login') => {
            isLoginMode.value = (mode === 'login');
            isSetupPasswordMode.value = false;
            setupPasswordForm.email = '';
            setupPasswordForm.password = '';
            setupPasswordForm.confirmPassword = '';
        };

        const loginCustomer = async () => {
            try {
                const data = await sharedCust.login(loginForm.phone, loginForm.password);
                
                if (data && data.requirePasswordSetup) {
                    tempPhone = data.phone;
                    tempPin = data.pin;
                    setupPasswordForm.email = data.email || '';
                    isSetupPasswordMode.value = true;
                    return;
                }

                toastr.success('¡Hola de nuevo! Sesión iniciada.');
                loginForm.phone = '';
                loginForm.password = '';
            } catch (err) {
                toastr.error(err.message || 'Error al iniciar sesión');
            }
        };

        const registerCustomer = async () => {
            try {
                await sharedCust.register(
                    customerForm.name,
                    customerForm.phone,
                    customerForm.email,
                    customerForm.password
                );
                toastr.success('¡Bienvenido! Tu cuenta ha sido creada exitosamente.');
                customerForm.name = '';
                customerForm.phone = '';
                customerForm.email = '';
                customerForm.password = '';
            } catch (err) {
                toastr.error(err.message || 'No se pudo crear la cuenta.');
            }
        };

        const submitSetupPassword = async () => {
            if (!setupPasswordForm.email || !setupPasswordForm.email.trim()) {
                toastr.error('El correo electrónico es obligatorio.');
                return;
            }
            if (setupPasswordForm.password !== setupPasswordForm.confirmPassword) {
                toastr.error('Las contraseñas no coinciden.');
                return;
            }
            if (setupPasswordForm.password.length < 4) {
                toastr.error('La contraseña debe tener al menos 4 caracteres.');
                return;
            }

            try {
                await sharedCust.setupPassword(tempPhone, tempPin, setupPasswordForm.password, setupPasswordForm.email);
                toastr.success('¡Contraseña configurada! Sesión iniciada.');
                isSetupPasswordMode.value = false;
                setupPasswordForm.email = '';
                setupPasswordForm.password = '';
                setupPasswordForm.confirmPassword = '';
                loginForm.phone = '';
                loginForm.password = '';
            } catch (err) {
                toastr.error(err.message || 'No se pudo guardar la contraseña.');
            }
        };

        const logout = () => {
            sharedCust.logout();
            toastr.info('Sesión cerrada');
            window.location.href = '/';
        };

        // --- GESTIÓN DE PERFIL ---
        const activeProfileTab = ref(window.innerWidth < 768 ? '' : 'profile'); // 'profile' | 'addresses' | 'cards' | 'orders'
        const profileForm = reactive({ name: '', phone: '', email: '', password: '' });
        
        const openProfileEdit = () => {
            if (sharedCust.customer.value) {
                profileForm.name = sharedCust.customer.value.name;
                profileForm.phone = sharedCust.customer.value.phone;
                profileForm.email = sharedCust.customer.value.email;
                profileForm.password = '';
            }
        };

        // Sincronizar formulario de perfil al recibir datos del cliente
        watch(sharedCust.customer, () => {
            openProfileEdit();
        }, { immediate: true });

        const saveProfile = async () => {
            try {
                await sharedCust.updateProfile({
                    name: profileForm.name,
                    phone: profileForm.phone,
                    email: profileForm.email,
                    password: profileForm.password || undefined
                });
                toastr.success('Perfil actualizado con éxito');
            } catch (err) {
                toastr.error(err.message || 'Error al guardar cambios');
            }
        };

        const handleAvatarChange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                await sharedCust.uploadAvatar(file);
                toastr.success('Foto de perfil actualizada con éxito');
            } catch (err) {
                toastr.error(err.message || 'Error al subir foto de perfil');
            }
        };

        // --- GESTIÓN DE DIRECCIONES ---
        const addressForm = reactive({
            _id: null, alias: 'Hogar', street: '', number: '',
            colony: '', coloniaId: null,
            municipioId: null, municipioName: '',
            zipCode: '', reference: '', isDefault: false
        });
        const showAddressFormModal = ref(false);
        const isEditingAddress = ref(false);

        // --- MUNICIPIOS / COLONIAS (Selector en Perfil) ---
        const allMunicipios = ref([]);
        const addrSelectedMunicipio = ref(null);  // Municipio activo en el form
        const addrLocationSearch = ref('');

        const loadMunicipios = async () => {
            if (allMunicipios.value.length > 0) return;
            try {
                const res = await fetch('/api/municipios');
                if (res.ok) allMunicipios.value = await res.json();
            } catch(e) { console.error('Error cargando municipios', e); }
        };

        const addrFilteredItems = computed(() => {
            const q = addrLocationSearch.value.toLowerCase();
            if (addrSelectedMunicipio.value) {
                const cols = addrSelectedMunicipio.value.colonias || [];
                return q ? cols.filter(c => c.name.toLowerCase().includes(q)) : cols;
            }
            return q ? allMunicipios.value.filter(m => m.name.toLowerCase().includes(q)) : allMunicipios.value;
        });

        const addrSelectMunicipio = (mun) => {
            addrSelectedMunicipio.value = mun;
            addrLocationSearch.value = '';
        };

        const addrGoBack = () => {
            addrSelectedMunicipio.value = null;
            addrLocationSearch.value = '';
        };

        // Paso final: seleccionar colonia en el form de dirección
        const addrSelectColonia = (col) => {
            addressForm.colony = col.name;
            addressForm.coloniaId = col._id;
            addressForm.zipCode = col.zipCode || addrSelectedMunicipio.value?.zipCode || '';
            addressForm.municipioId = addrSelectedMunicipio.value?._id || null;
            addressForm.municipioName = addrSelectedMunicipio.value?.name || '';
            // Volver al estado inicial del selector
            addrSelectedMunicipio.value = null;
            addrLocationSearch.value = '';
        };

        const addrClearColonia = () => {
            addressForm.colony = '';
            addressForm.coloniaId = null;
            addressForm.municipioId = null;
            addressForm.municipioName = '';
            addressForm.zipCode = '';
            addrSelectedMunicipio.value = null;
            addrLocationSearch.value = '';
        };

        const openAddAddress = async () => {
            await loadMunicipios();
            isEditingAddress.value = false;
            addressForm._id = null;
            addressForm.alias = 'Hogar';
            addressForm.street = '';
            addressForm.number = '';
            addressForm.colony = '';
            addressForm.coloniaId = null;
            addressForm.municipioId = null;
            addressForm.municipioName = '';
            addressForm.zipCode = '';
            addressForm.reference = '';
            addressForm.isDefault = false;
            addrSelectedMunicipio.value = null;
            addrLocationSearch.value = '';
            showAddressFormModal.value = true;
        };

        const openEditAddress = async (addr) => {
            await loadMunicipios();
            isEditingAddress.value = true;
            addressForm._id = addr._id;
            addressForm.alias = addr.alias;
            addressForm.street = addr.street;
            addressForm.number = addr.number;
            addressForm.colony = addr.colony;
            addressForm.coloniaId = addr.coloniaId || null;
            addressForm.municipioId = addr.municipioId || null;
            addressForm.municipioName = addr.municipioName || '';
            addressForm.zipCode = addr.zipCode || '';
            addressForm.reference = addr.reference || '';
            addressForm.isDefault = addr.isDefault;
            addrSelectedMunicipio.value = null;
            addrLocationSearch.value = '';
            showAddressFormModal.value = true;
        };

        const saveAddressForm = async () => {
            if (!addressForm.colony || !addressForm.coloniaId) {
                toastr.warning('Por favor selecciona una colonia del listado.');
                return;
            }
            try {
                await sharedCust.saveAddress({ ...addressForm });
                toastr.success(isEditingAddress.value ? 'Dirección actualizada con éxito' : 'Dirección agregada');
                showAddressFormModal.value = false;
            } catch (err) {
                toastr.error(err.message || 'Error al guardar dirección');
            }
        };

        const deleteAddressForm = async (addrId) => {
            if (!confirm('¿Estás seguro de eliminar esta dirección?')) return;
            try {
                await sharedCust.deleteAddress(addrId);
                toastr.success('Dirección eliminada con éxito');
            } catch (err) {
                toastr.error(err.message || 'Error al eliminar dirección');
            }
        };

        // --- TARJETAS (STRIPE SPLIT ELEMENTS) ---
        const showAddCardModal = ref(false);
        const cardNumberElement = ref(null);
        const cardExpiryElement = ref(null);
        const cardCvcElement = ref(null);
        const stripeInstance = ref(null);
        const stripeCardError = ref('');
        const isSavingCard = ref(false);

        const initStripeCardElement = async () => {
            try {
                const stripeConfigRes = await fetch('/api/stripe/config');
                if (!stripeConfigRes.ok) throw new Error();
                const stripeConfig = await stripeConfigRes.json();
                
                if (!stripeInstance.value && stripeConfig.publishableKey) {
                    stripeInstance.value = Stripe(stripeConfig.publishableKey);
                }
                
                if (stripeInstance.value) {
                    showAddCardModal.value = true;
                    stripeCardError.value = '';
                    
                    nextTick(() => {
                        // Destruir elementos previos si existieran
                        if (cardNumberElement.value) { try { cardNumberElement.value.destroy(); } catch (e) {} }
                        if (cardExpiryElement.value) { try { cardExpiryElement.value.destroy(); } catch (e) {} }
                        if (cardCvcElement.value) { try { cardCvcElement.value.destroy(); } catch (e) {} }

                        const elements = stripeInstance.value.elements();
                        const style = {
                            base: {
                                color: isDark.value ? '#ffffff' : '#0f172a',
                                fontFamily: '"Plus Jakarta Sans", sans-serif',
                                fontSize: '15px',
                                '::placeholder': { color: isDark.value ? '#64748b' : '#94a3b8' }
                            },
                            invalid: {
                                color: '#ef4444'
                            }
                        };

                        cardNumberElement.value = elements.create('cardNumber', { style, showIcon: true });
                        cardExpiryElement.value = elements.create('cardExpiry', { style });
                        cardCvcElement.value = elements.create('cardCvc', { style });

                        cardNumberElement.value.mount('#card-number-element');
                        cardExpiryElement.value.mount('#card-expiry-element');
                        cardCvcElement.value.mount('#card-cvc-element');

                        const handleChange = (event) => {
                            stripeCardError.value = event.error ? event.error.message : '';
                        };

                        cardNumberElement.value.on('change', handleChange);
                        cardExpiryElement.value.on('change', handleChange);
                        cardCvcElement.value.on('change', handleChange);
                    });
                } else {
                    toastr.error('No se pudo inicializar la pasarela de pagos.');
                }
            } catch (e) {
                toastr.error('Error al inicializar formulario de tarjeta.');
            }
        };

        const saveCardForm = async () => {
            if (isSavingCard.value) return;
            isSavingCard.value = true;
            stripeCardError.value = '';
            
            try {
                const clientSecret = await sharedCust.getSetupIntent();
                
                const result = await stripeInstance.value.confirmCardSetup(clientSecret, {
                    payment_method: {
                        card: cardNumberElement.value,
                        billing_details: {
                            name: sharedCust.customer.value.name,
                            email: sharedCust.customer.value.email,
                            phone: sharedCust.customer.value.phone
                        }
                    }
                });
                
                if (result.error) {
                    stripeCardError.value = result.error.message;
                } else {
                    if (result.setupIntent.status === 'succeeded') {
                        toastr.success('Tarjeta guardada correctamente');
                        showAddCardModal.value = false;
                        await sharedCust.fetchCards();
                    }
                }
            } catch (err) {
                stripeCardError.value = err.message || 'Error al guardar la tarjeta.';
            } finally {
                isSavingCard.value = false;
            }
        };

        const deleteCardForm = async (pmId) => {
            if (!confirm('¿Estás seguro de eliminar esta tarjeta?')) return;
            try {
                await sharedCust.deleteCard(pmId);
                toastr.success('Tarjeta eliminada con éxito');
            } catch (err) {
                toastr.error(err.message || 'Error al eliminar tarjeta');
            }
        };

        // --- RECOMPRAR HISTORIAL ---
        const reorderPastPurchase = (order) => {
            if (order.businessId) {
                sessionStorage.setItem('reorder_cart', JSON.stringify(order.items));
                
                fetch(`/api/public/business-slug/${order.businessId}`)
                    .then(res => {
                        if (!res.ok) throw new Error();
                        return res.json();
                    })
                    .then(data => {
                        if (data && data.slug) {
                            window.location.href = `/${data.slug}`;
                        } else {
                            toastr.error('No se pudo encontrar el negocio para reordenar.');
                        }
                    })
                    .catch(() => {
                        toastr.error('Error al intentar reordenar el pedido.');
                    });
            }
        };

        onMounted(() => {
            initTheme();
        });

        return {
            isDark, toggleTheme,
            sharedCust, currentUser, firstName, userInitial, userAvatarUrl,
            isLoginMode, isSetupPasswordMode, showUserDropdown,
            loginForm, customerForm, setupPasswordForm,
            openModal, loginCustomer, registerCustomer, submitSetupPassword, logout,
            activeProfileTab, profileForm, saveProfile, handleAvatarChange,
            addressForm, showAddressFormModal, isEditingAddress,
            allMunicipios, addrSelectedMunicipio, addrLocationSearch, addrFilteredItems,
            addrSelectMunicipio, addrGoBack, addrSelectColonia, addrClearColonia,
            openAddAddress, openEditAddress, saveAddressForm, deleteAddressForm,
            showAddCardModal, stripeCardError, isSavingCard,
            initStripeCardElement, saveCardForm, deleteCardForm, reorderPastPurchase
        };
    }
}).mount('#app');
