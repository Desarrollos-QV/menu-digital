
const { createApp, ref, computed, onMounted, nextTick, reactive, watch } = Vue;

// Configuracion de Tailwind
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Outfit', 'sans-serif'] },
            colors: {
                // USAMOS UNA VARIABLE CSS PARA EL COLOR DINÁMICO
                primary: 'var(--theme-color)',
                dark: '#0f172a',
                light: '#f8fafc'
            },
            animation: {
                'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slide-up': 'slideUp 0.3s ease-out forwards'
            },
            keyframes: {
                slideUp: {
                    '0%': { transform: 'translateY(100%)' },
                    '100%': { transform: 'translateY(0)' },
                }
            }
        }
    }
};
// Configuración Toastr (Formateada para evitar errores de línea)
toastr.options = {
    "positionClass": "toast-top-center",
    "timeOut": "3000",
    "showDuration": "300",
    "hideDuration": "1000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
};

createApp({
    setup() {
        // Data
        const banners = ref([]);
        const categories = ref([]);
        const products = ref([]);
        const addons = ref([]);
        const config = ref({ appName: 'Cargando...' });

        // UI
        const searchQuery = ref('');
        const selectedCategory = ref('all');
        const scrollY = ref(0);
        const isDark = ref(false);
        const isLoading = ref(true);
        const businessError = ref(false);

        // Business Info & Reviews Logic
        const showBusinessModal = ref(false);
        const reviews = ref([]);
        const newReview = ref({ customerName: '', rating: 5, comment: '' });
        const submittingReview = ref(false);

        // Cart Logic
        const cart = ref([]);
        const showCartModal = ref(false);
        const customerName = ref('');
        const customerPhone = ref('');
        const customerEmail = ref('');
        const customerStreet = ref('');
        const customerColony = ref('');
        const customerNumber = ref('');
        const customerZipCode = ref('');
        const customerReference = ref('');
        const paymentMethod = ref('cash');
        const customerHowToPay = ref('');
        const deliveryType = ref('delivery');
        const selectedColonia = ref(null);   // Colonia específica (tiene el deliveryCost)

        // Stripe Logic
        const stripeEnabled = ref(false);
        const stripePublishableKey = ref('');
        const stripeFeePercent = ref(0);
        const stripeFeeFixed = ref(0);
        const showStripeModal = ref(false);
        const stripeInstance = ref(null);
        const stripeCardElement = ref(null);
        const stripeClientSecret = ref('');
        const stripePaymentIntentId = ref('');
        const isProcessingPayment = ref(false);
        const stripePaymentError = ref('');

        // Product Logic
        const showProductModal = ref(false);
        const activeProduct = ref({});
        const activeProductAddons = ref([]);
        const activeSelections = ref({});
        const modalQuantity = ref(1);

        // --- COMPARTIDO DE CLIENTE ---
        const sharedCust = window.createSharedCustomer();

        const currentUser = computed(() => {
            if (!sharedCust.token.value || !sharedCust.customer.value) return null;
            return { customer: sharedCust.customer.value };
        });

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


        // Formulario Login
        const loginForm = reactive({ phone: '', password: '' });
        const customerForm = reactive({ name: '', phone: '', email: '', password: '' });
        const setupPasswordForm = reactive({ email: '', password: '', confirmPassword: '' });
        const isLoginMode = ref(true);
        const isSetupPasswordMode = ref(false);
        const showUserModal = ref(false); // Modal login/registro
        const showAuthPromptModal = ref(false); // Modal de popup promocional
        const authPromptContext = ref('marketplace'); // 'marketplace' o 'checkout'
        const pendingCheckout = ref(false); // true si el usuario intentó pedir y se le pidió registro
        const skipAuthPrompt = ref(false); // true si el usuario decidió continuar como invitado

        const continueAsGuest = () => {
            showAuthPromptModal.value = false;
            if (authPromptContext.value === 'checkout') {
                skipAuthPrompt.value = true;
                checkout();
            }
        };

        const currentView = ref('menu'); // 'menu' o 'profile'
        const showUserDropdown = ref(false); // Dropdown de opciones de usuario
        
        let tempPhone = '';
        let tempPin = '';

        // Profile Tabs & Modal
        const activeProfileTab = ref('profile'); // 'profile', 'addresses', 'cards', 'orders'
        const addressForm = reactive({ _id: null, alias: 'Hogar', street: '', number: '', colony: '', zipCode: '', reference: '', isDefault: false });
        const showAddressFormModal = ref(false);
        const isEditingAddress = ref(false);
        const profileForm = reactive({ name: '', phone: '', email: '', password: '' });

        // Saved Cards (Stripe Account Panel)
        const showAddCardModal = ref(false);
        const stripeCardElementSave = ref(null);
        const stripeInstanceSave = ref(null);
        const stripeCardErrorSave = ref('');
        const isSavingCard = ref(false);

        // Checkout Variables
        const selectedAddressId = ref('');
        const selectedSavedCardId = ref('');

        const openProfileEdit = () => {
            if (sharedCust.customer.value) {
                profileForm.name = sharedCust.customer.value.name;
                profileForm.phone = sharedCust.customer.value.phone;
                profileForm.email = sharedCust.customer.value.email;
                profileForm.password = '';
                
                // Pre-llenar checkout
                customerName.value = sharedCust.customer.value.name;
                customerPhone.value = sharedCust.customer.value.phone;
                customerEmail.value = sharedCust.customer.value.email;
            }
        };

        const selectCheckoutAddress = (addr) => {
            customerStreet.value = addr.street;
            customerNumber.value = addr.number;
            customerColony.value = addr.colony;
            customerZipCode.value = addr.zipCode || '';
            customerReference.value = addr.reference || '';
            
            if (config.value.deliveryZones && config.value.deliveryZones.length > 0) {
                let matchedCol = null;
                // Prioridad 1: Match por coloniaId (nuevo sistema)
                if (addr.coloniaId) {
                    matchedCol = config.value.deliveryZones.find(z =>
                        String(z.coloniaId) === String(addr.coloniaId) ||
                        String(z._id) === String(addr.coloniaId)
                    );
                }
                // Prioridad 2: Fallback por nombre (compatibilidad con direcciones antiguas)
                if (!matchedCol && addr.colony) {
                    matchedCol = config.value.deliveryZones.find(z =>
                        z.name.toLowerCase().trim() === addr.colony.toLowerCase().trim()
                    );
                }
                selectedColonia.value = matchedCol || null;
            }
        };


        // Sincronizadores automáticos
        watch(sharedCust.customer, () => {
            openProfileEdit();
            if (sharedCust.addresses.value.length > 0) {
                const defAddr = sharedCust.addresses.value.find(a => a.isDefault);
                if (defAddr) {
                    selectedAddressId.value = defAddr._id;
                    selectCheckoutAddress(defAddr);
                }
            }
            if (sharedCust.cards.value.length > 0) {
                selectedSavedCardId.value = sharedCust.cards.value[0].id;
            }
        }, { immediate: true });

        watch(selectedAddressId, (newVal) => {
            const addr = sharedCust.addresses.value.find(a => a._id === newVal);
            if (addr) {
                selectCheckoutAddress(addr);
            }
        });
        
        // Success Screen Logic
        const showSuccessScreen = ref(false);
        const lastOrderNumber = ref('');
        const lastOrderId = ref('');
        const lastWhatsAppUrl = ref('');
        
        // --- LÓGICA DE SLUG ACTUALIZADA ---
        const getSlug = () => {
            // 1. Intentar obtener de ?slug=nombre
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('slug')) return urlParams.get('slug');

            // 2. Intentar obtener de la ruta /nombre
            const path = window.location.pathname.replace(/^\/|\/$/g, ''); // Quitar slashes
            // Ignorar rutas reservadas
            if (path && path !== 'admin' && path !== 'index.html') {
                return path;
            }

            return null;
        };

        // -- Función para generar/obtener ID único --
        const getVisitorId = () => {
            let vid = localStorage.getItem('visitor_id');
            if (!vid) {
                vid = crypto.randomUUID(); // Nativo del navegador
                localStorage.setItem('visitor_id', vid);
            }
            return vid;
        };

        // --- Fetch ---
        const slug = getSlug();
        const fetchData = async () => {
            if (!slug) {
                businessError.value = true;
                return;
            }

            isLoading.value = true;
            try {
                // CAMBIO CLAVE: Usamos /api/public en lugar de /api/
                const query = `?slug=${slug}`;
                const [bannersRes, catsRes, prodsRes, addonsRes, configRes, reviewsRes] = await Promise.all([
                    fetch('/api/public/banners' + query),
                    fetch('/api/public/categories' + query),
                    fetch('/api/public/products' + query),
                    fetch('/api/public/addons' + query),
                    fetch('/api/public/config' + query),
                    fetch('/api/public/reviews' + query)
                ]);

                if (!configRes.ok) throw new Error();

                if (bannersRes.ok) banners.value = await bannersRes.json();
                if (catsRes.ok) categories.value = await catsRes.json();
                if (prodsRes.ok) products.value = await prodsRes.json();
                if (addonsRes.ok) addons.value = await addonsRes.json();
                if (reviewsRes.ok) reviews.value = await reviewsRes.json();

                // Organizamos por Sort catsRes y ProdsRes
                categories.value.sort((a, b) => a.sort - b.sort);
                products.value.sort((a, b) => a.sort - b.sort);

                const configData = await configRes.json();

                config.value = configData;

                if (configData.primaryColor) document.documentElement.style.setProperty('--theme-color', configData.primaryColor);
                document.title = configData.appName || 'Menú Digital';

                if (configData.avatar) {
                    const favicon = document.getElementById('favicon');
                    if (favicon) favicon.href = configData.avatar;
                }

                // Fetch Stripe config
                try {
                    const stripeRes = await fetch('/api/stripe/config');
                    if (stripeRes.ok) {
                        const stripeConfig = await stripeRes.json();
                        stripeEnabled.value = stripeConfig.stripeEnabled;
                        stripePublishableKey.value = stripeConfig.publishableKey;
                        stripeFeePercent.value = stripeConfig.feePercent;
                        stripeFeeFixed.value = stripeConfig.feeFixed;
                    }
                } catch(e) { console.error("Stripe config error", e); }

                // Auto-seleccionar método de pago inicial válido según los métodos habilitados
                const cashOk = configData.acceptCash !== false;
                const cardOk = configData.acceptCard !== false && stripeEnabled.value;
                if (!cashOk && cardOk) {
                    paymentMethod.value = 'stripe';
                } else if (cashOk) {
                    paymentMethod.value = 'cash';
                }
                // Si ninguno está disponible se deja el default 'cash' (caso imposible con validación backend)

                nextTick(() => { if (banners.value.length > 0) new Swiper('.banner-swiper', { slidesPerView: 1.1, spaceBetween: 10, loop: true, autoplay: { delay: 4000 } }); });

                // Revisar si viene de una reordenación
                checkReorderCart();
            } catch (e) { businessError.value = true; }
            finally { isLoading.value = false; }
        };

        // Enviar Review
        const submitReview = async () => {
            if (!newReview.value.customerName || !newReview.value.comment) {
                return toastr.warning('Completa tu nombre y comentario.');
            }
            submittingReview.value = true;
            try {
                const query = `?slug=${slug}`; // For potential future logic
                const res = await fetch('/api/public/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug, ...newReview.value })
                });

                if (res.ok) {
                    const data = await res.json();
                    reviews.value.unshift(data.review); // Add it to top
                    toastr.success('¡Gracias por tu reseña!');
                    newReview.value = { customerName: '', rating: 5, comment: '' };
                } else {
                    const err = await res.json();
                    toastr.error(err.message || 'Hubo un error al enviar tu reseña.');
                }
            } catch (e) {
                toastr.error('Error de conexión.');
            } finally {
                submittingReview.value = false;
            }
        };

        // ----- LÓGICA DE HORARIO -----
        const formatTime = (timeStr) => {
            if (!timeStr) return '';
            const [hStr, mStr] = timeStr.split(':');
            let hours = parseInt(hStr, 10);
            const minutes = mStr || '00';
            if (isNaN(hours)) return timeStr;
            const ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const paddedHours = String(hours).padStart(2, '0');
            return `${paddedHours}:${minutes} ${ampm}`;
        };

        const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        // Horario del día actual (puede ser null si no hay schedule configurado)
        const todaySchedule = computed(() => {
            const schedule = config.value.schedule;
            if (!schedule || schedule.length === 0) return null;
            const todayName = DAY_NAMES[new Date().getDay()];
            return schedule.find(d => d.day === todayName) || null;
        });

        // ¿El negocio está abierto AHORA mismo?
        const isBusinessOpen = computed(() => {
            // 1. Si el admin lo cerró manualmente, siempre cerrado
            if (config.value.isOpen === false) return false;

            const schedule = config.value.schedule;
            // 2. Si no hay schedule, confiamos en el campo isOpen del config
            if (!schedule || schedule.length === 0) return config.value.isOpen !== false;

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const todayIndex = now.getDay();
            const yesterdayIndex = (todayIndex + 6) % 7;

            const todayName = DAY_NAMES[todayIndex];
            const yesterdayName = DAY_NAMES[yesterdayIndex];

            const todayDay = schedule.find(d => d.day === todayName);
            const yesterdayDay = schedule.find(d => d.day === yesterdayName);

            const checkDayActive = (day, isToday) => {
                if (!day || !day.isOpen) return false;
                
                const [openH, openM] = (day.open || '00:00').split(':').map(Number);
                const [closeH, closeM] = (day.close || '23:59').split(':').map(Number);
                const openMinutes = openH * 60 + openM;
                const closeMinutes = closeH * 60 + closeM;

                if (openMinutes < closeMinutes) {
                    // Horario normal (ej. 09:00 - 18:00)
                    return isToday && currentMinutes >= openMinutes && currentMinutes < closeMinutes;
                } else if (openMinutes > closeMinutes) {
                    // Horario nocturno que cruza medianoche (ej. 14:00 - 01:00)
                    if (isToday) {
                        return currentMinutes >= openMinutes;
                    } else {
                        return currentMinutes < closeMinutes;
                    }
                } else {
                    // Abre y cierra al mismo tiempo (ej. 24h)
                    return isToday;
                }
            };

            const openToday = checkDayActive(todayDay, true);
            const openYesterday = checkDayActive(yesterdayDay, false);

            return openToday || openYesterday;
        });

        // --- Logic Helpers for Cart ---
        const initAddToCart = (product) => {
            if (product.addons && product.addons.length > 0) openProductDetails(product);
            else addToCartSimple(product);
        };

        const openProductDetails = (product) => {
            activeProduct.value = product;
            modalQuantity.value = 1;
            activeSelections.value = {};
            activeProductAddons.value = addons.value.filter(a => product.addons.includes(a._id));
            activeProductAddons.value.forEach(group => activeSelections.value[group._id] = []);
            showProductModal.value = true;
        };

        const toggleOption = (group, option) => {
            const current = activeSelections.value[group._id] || [];
            if (group.maxOptions === 1) {
                activeSelections.value[group._id] = [option];
            } else {
                const idx = current.findIndex(o => o._id === option._id);
                if (idx > -1) current.splice(idx, 1);
                else if (current.length < group.maxOptions) current.push(option);
                else toastr.warning(`Máximo ${group.maxOptions}`);
            }
        };

        const isOptionSelected = (group, option) => activeSelections.value[group._id]?.some(o => o._id === option._id);

        const modalTotalPrice = computed(() => {
            let total = activeProduct.value.price || 0;
            for (const k in activeSelections.value) activeSelections.value[k].forEach(o => total += o.priceExtra);
            return total * modalQuantity.value;
        });

        const confirmAddToCart = () => {
            for (const g of activeProductAddons.value) if (g.required && !activeSelections.value[g._id].length) return toastr.error(`Selecciona: ${g.name}`);
            let opts = [];
            for (const k in activeSelections.value) opts = [...opts, ...activeSelections.value[k]];

            let unitPrice = activeProduct.value.price;
            opts.forEach(o => unitPrice += o.priceExtra);

            cart.value.push({ product: activeProduct.value, selectedOptions: opts, quantity: modalQuantity.value, unitPrice });
            if (window.clarity) window.clarity("set", "CartAction", "AddToCart");
            toastr.success('Agregado');
            showProductModal.value = false;
        };

        const addToCartSimple = (product) => {
            const exist = cart.value.find(i => i.product._id === product._id && (!i.selectedOptions || !i.selectedOptions.length));
            if (exist) exist.quantity++;
            else cart.value.push({ product, selectedOptions: [], quantity: 1, unitPrice: product.price });
            if (window.clarity) window.clarity("set", "CartAction", "AddToCart");
            toastr.success('Agregado');
        };

        const decreaseCartItem = (idx) => {
            if (cart.value[idx].quantity > 1) cart.value[idx].quantity--;
            else { cart.value.splice(idx, 1); if (!cart.value.length) showCartModal.value = false; }
        };

        const alertBussinesClose = () => {
            toastr.error(`El negocio está cerrado por el momento.`);
        };

        // Checkout & Send Whatsapp
        const checkout = () => {
            // --- Validaciones Generales ---
            if (!customerName.value.trim()) {
                return toastr.warning('⚠️ Tu nombre es requerido');
            }
            if (!customerPhone.value.trim()) {
                return toastr.warning('⚠️ Tu teléfono es requerido');
            }

            // --- Bloqueo de Registro ---
            if (!sharedCust.customer.value && !skipAuthPrompt.value) {
                authPromptContext.value = 'checkout';
                pendingCheckout.value = true;
                
                // Pre-llenar datos en el formulario de registro/login
                customerForm.name = customerName.value;
                customerForm.phone = customerPhone.value;
                loginForm.phone = customerPhone.value;
                
                showAuthPromptModal.value = true;
                return;
            }

            // --- Validaciones solo para Delivery ---
            if (deliveryType.value === 'delivery') {
                if (!customerStreet.value.trim()) {
                    return toastr.warning('⚠️ Ingresa tu calle');
                }
                if (!customerNumber.value.trim()) {
                    return toastr.warning('⚠️ Ingresa tu número de casa / exterior');
                }

                // Si el negocio tiene zonas de entrega configuradas, la colonia ES OBLIGATORIA
                if (config.value.deliveryZones && config.value.deliveryZones.length > 0) {
                    if (!selectedColonia.value) {
                        return toastr.warning('⚠️ Debes seleccionar tu Colonia / Zona de entrega para calcular el costo de envío');
                    }
                } else {
                    // Sin zonas configuradas: se requiere al menos el campo libre de colonia
                    if (!customerColony.value.trim()) {
                        return toastr.warning('⚠️ Ingresa tu colonia');
                    }
                }
            }

            // --- Efectivo: monto requerido ---
            if (paymentMethod.value === 'cash' && (!customerHowToPay.value || !customerHowToPay.value.toString().trim())) {
                return toastr.warning('⚠️ Indica con cuánto vas a pagar');
            }

            if (window.clarity) window.clarity("set", "Checkout", "Started");

            if (paymentMethod.value === 'stripe') {
                if (selectedSavedCardId.value) {
                    // Si ya seleccionó una tarjeta guardada, procesar directo sin modal
                    processStripePayment();
                } else {
                    // Si es tarjeta nueva, inicializar intent y abrir modal
                    initStripePayment();
                }
            } else {
                finalizeCheckout(paymentMethod.value);
            }
        };


        const initStripePayment = async () => {
            if (!stripePublishableKey.value) return toastr.error("Stripe no está configurado.");
            
            isProcessingPayment.value = true;
            showStripeModal.value = true;
            stripePaymentError.value = '';

            try {
                const res = await fetch('/api/stripe/create-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: cartTotalPrice.value, currency: config.value.currency || 'MXN' })
                });

                if (!res.ok) throw new Error("Error creando intent");
                const data = await res.json();
                stripeClientSecret.value = data.clientSecret;
                stripePaymentIntentId.value = data.paymentIntentId;

                if (!stripeInstance.value) {
                    stripeInstance.value = Stripe(stripePublishableKey.value);
                }
                
                nextTick(() => {
                    if (!stripeCardElement.value) {
                        const elements = stripeInstance.value.elements();
                        const style = {
                            base: {
                                color: isDark.value ? '#ffffff' : '#333333',
                                fontFamily: '"Outfit", sans-serif',
                                fontSmoothing: 'antialiased',
                                fontSize: '16px',
                                '::placeholder': { color: isDark.value ? '#9ca3af' : '#aab7c4' }
                            },
                            invalid: {
                                color: '#fa755a',
                                iconColor: '#fa755a'
                            }
                        };
                        stripeCardElement.value = elements.create('card', { style });
                        stripeCardElement.value.mount('#card-element');
                        stripeCardElement.value.on('change', (event) => {
                            stripePaymentError.value = event.error ? event.error.message : '';
                        });
                    }
                });
            } catch (err) {
                showStripeModal.value = false;
                toastr.error("Error al inicializar el pago en línea.");
            } finally {
                isProcessingPayment.value = false;
            }
        };

        const processStripePayment = async () => {
            if (!customerEmail.value || !customerEmail.value.trim()) {
                stripePaymentError.value = 'El correo electrónico es obligatorio para recibir tu comprobante.';
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(customerEmail.value.trim())) {
                stripePaymentError.value = 'Por favor ingresa un correo electrónico válido.';
                return;
            }

            isProcessingPayment.value = true;
            stripePaymentError.value = '';

            try {
                if (selectedSavedCardId.value) {
                    // Pagar con Tarjeta Guardada
                    const res = await fetch('/api/customer/cards/charge', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sharedCust.token.value}`
                        },
                        body: JSON.stringify({
                            amount: cartTotalPrice.value,
                            currency: config.value.currency || 'MXN',
                            paymentMethodId: selectedSavedCardId.value
                        })
                    });
                    
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || data.message || 'Error al procesar el pago con la tarjeta guardada.');
                    
                    if (data.success && (data.status === 'succeeded' || data.status === 'requires_capture')) {
                        stripePaymentIntentId.value = data.paymentIntentId;
                        await finalizeCheckout('stripe');
                        showStripeModal.value = false;
                    } else {
                        throw new Error('El pago falló o requiere autenticación adicional.');
                    }
                } else {
                    // Pagar con Tarjeta Nueva
                    const result = await stripeInstance.value.confirmCardPayment(stripeClientSecret.value, {
                        payment_method: {
                            card: stripeCardElement.value,
                            billing_details: {
                                name: customerName.value,
                                phone: customerPhone.value,
                                email: customerEmail.value,
                            }
                        }
                    });

                    if (result.error) {
                        stripePaymentError.value = result.error.message;
                        if (window.clarity) window.clarity("set", "PurchaseError", result.error.code || "StripeError");
                    } else {
                        if (result.paymentIntent.status === 'succeeded') {
                            stripePaymentIntentId.value = result.paymentIntent.id;
                            await finalizeCheckout('stripe');
                            showStripeModal.value = false;
                        }
                    }
                }
            } catch (err) {
                stripePaymentError.value = err.message || "Error inesperado procesando el pago.";
                if (window.clarity) window.clarity("set", "PurchaseError", "UnexpectedError");
            } finally {
                isProcessingPayment.value = false;
            }
        };

        const finalizeCheckout = async (finalPaymentMethod) => {
            const phone = config.value.phone;
            if (!phone) return toastr.error('Este negocio no tiene WhatsApp configurado');

            let msg = `👋 Hola, soy *${customerName.value}*, ${deliveryType.value === 'pickup' ? 'pasaré a recoger mi pedido' : 'mi pedido es'}:\n\n`;
            cart.value.forEach(i => {
                msg += `▪️ *${i.quantity}x ${i.product.name}* ($${i.unitPrice * i.quantity})\n`;
                if (i.selectedOptions?.length) msg += `   _Extras: ${i.selectedOptions.map(o => o.name).join(', ')}_\n`;
            });

            msg += `\n`;
            msg += `📄 *SubTotal: ${config.value.currency || '$'}${cartSubTotal.value.toFixed(2)}*\n`;
            
            if (commissionWebAmountCmp.value > 0) {
                const typeLabel = config.value.commissionWebType === 'percent' ? `${config.value.commissionWebAmount}%` : `$`;
                msg += `⚙️ *Comisión de Plataforma (${typeLabel}): +${config.value.currency || '$'}${commissionWebAmountCmp.value.toFixed(2)}*\n`;
            }

            if (deliveryCostCmp.value > 0) {
                msg += `🛵 *Costo de Envío (${selectedColonia.value?.name || 'Zona'}): +${config.value.currency || '$'}${deliveryCostCmp.value.toFixed(2)}*\n`;
            }

            if (paymentFeeCmp.value > 0 && finalPaymentMethod === 'stripe') {
                msg += `💳 *Comisión por pago con tarjeta: +${config.value.currency || '$'}${paymentFeeCmp.value.toFixed(2)}*\n`;
            }

            msg += `💰 *TOTAL A PAGAR: ${config.value.currency || '$'}${cartTotalPrice.value.toFixed(2)}*\n\n`;

            if (deliveryType.value === 'pickup') {
                msg += `🛍️ *_Retiro en tienda_*\n\n`;
            } else {
                // Agregar Datos de Entrega y Pago al mensaje
                msg += `📍 *_Datos de Entrega_*:\n`;
                msg += `Calle: ${customerStreet.value} #${customerNumber.value}\n`;
                msg += `Colonia: ${selectedColonia.value?.name || customerColony.value}\n`;
                msg += `CP: ${customerZipCode.value}\n`;
                msg += `Ref: ${customerReference.value}\n\n`;
            }

            msg += `💳 *_Método de Pago_*: ${finalPaymentMethod === 'cash' ? 'Efectivo' : (finalPaymentMethod === 'stripe' ? 'Pago en Línea (Aprobado)' : 'Tarjeta')}\n`;
            if (finalPaymentMethod === 'cash' && customerHowToPay.value) {
                msg += `💵 *¿Con cuanto paga?*: $${customerHowToPay.value}\n`;
            }
            msg += `\n`;

            // 1. Enviar datos al Backend (Sin esperar respuesta crítica)
            const cs = JSON.parse(localStorage.getItem('customer_data')) ?? [];
            const dataReq = {
                slug,
                customerName: customerName.value,
                customerId: (cs._value) ? cs._value._id : null,
                customerPhone: customerPhone.value,
                customerEmail: customerEmail.value || '',
                deliveryType: deliveryType.value,
                customerStreet: deliveryType.value === 'delivery' ? customerStreet.value : '',
                customerColony: deliveryType.value === 'delivery' ? (selectedColonia.value?.name || customerColony.value) : '',
                customerNumber: deliveryType.value === 'delivery' ? customerNumber.value : '',
                customerZipCode: deliveryType.value === 'delivery' ? customerZipCode.value : '',
                customerReference: deliveryType.value === 'delivery' ? customerReference.value : '',
                paymentMethod: finalPaymentMethod,
                customerHowToPay: customerHowToPay.value,
                cart: cart.value,
                total: cartTotalPrice.value,
                subtotal: cartSubTotal.value,
                deliveryCost: deliveryCostCmp.value,
                deliveryZone: selectedColonia.value?.name || '',
                paymentFee: paymentFeeCmp.value,
                stripePaymentIntentId: finalPaymentMethod === 'stripe' ? stripePaymentIntentId.value : undefined,
                commission: {
                    type: config.value.commissionWebType || 'percent',
                    amount: parseFloat(config.value.commissionWebAmount) || 0,
                    origin: 'whatsapp'
                }
            };

            // Enviar email de notificación al restaurante si es pago por Stripe
            if(finalPaymentMethod === 'stripe') {
                await fetch('/api/analytics/send-notification-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        msg,
                        orderDetails: dataReq,
                        business: config.value
                    })
                });
            }

            // // 2. Guardar Analytics el pedido
            const orderRes = await fetch('/api/analytics/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataReq)
            });

            let orderId = '';
            if (orderRes.ok) {
                const resData = await orderRes.json();
                orderId = resData.orderId || '';
            }

            if (orderId) {
                lastOrderNumber.value = orderId.slice(-6).toUpperCase();
                lastOrderId.value = orderId;
            } else {
                lastOrderNumber.value = Math.floor(100000 + Math.random() * 900000).toString();
            }

            /**
             * Esta funcion solo la obtendran los Negocios que esten INACTIVOS con PEDIDOS EN LINEA
             * Y tengan activo el boton de Whatsapp
             */
            
            const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
            lastWhatsAppUrl.value = whatsappUrl;

            if (!config.value.allowOnlineOrders) {
                // Intentar abrir Whatsapp automáticamente (evitamos bloqueo en iOS/móviles usando redirección de pestaña)
                try {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobile) {
                        window.location.href = whatsappUrl;
                    } else {
                        const newWindow = window.open(whatsappUrl, '_blank');
                        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                            // Fallback si el navegador bloquea la ventana emergente en escritorio
                            window.location.href = whatsappUrl;
                        }
                    }
                } catch (e) {
                    console.error("Error al abrir WhatsApp automáticamente:", e);
                    window.location.href = whatsappUrl;
                }
            }

            // Auto-guardar dirección si es un usuario logueado pero no tiene ninguna dirección
            if (sharedCust.customer.value && deliveryType.value === 'delivery' && sharedCust.addresses.value.length === 0) {
                try {
                    await sharedCust.saveAddress({
                        alias: 'Hogar',
                        street: customerStreet.value,
                        number: customerNumber.value,
                        colony: selectedColonia.value ? selectedColonia.value.name : customerColony.value,
                        zipCode: customerZipCode.value,
                        coloniaId: selectedColonia.value ? selectedColonia.value.coloniaId : null,
                        reference: customerReference.value,
                        isDefault: true
                    });
                    toastr.success('Hemos guardado tu dirección para futuras compras.');
                } catch (e) {
                    console.error('Error auto-saving address for first time user', e);
                }
            }

            cart.value = [];          // Vaciamos el arreglo
            showCartModal.value = false; // Cerramos el modal
            showSuccessScreen.value = true; // Mostramos la pantalla de éxito
            if (window.clarity) window.clarity("set", "Purchase", "Success");
            toastr.success('¡Pedido enviado! Gracias por tu compra.');
        };

        const cartTotalItems = computed(() => cart.value.reduce((s, i) => s + i.quantity, 0));
        
        const cartSubTotal = computed(() => cart.value.reduce((s, i) => s + (i.unitPrice * i.quantity), 0));
        
        const commissionWebAmountCmp = computed(() => {
            const amount = parseFloat(config.value.commissionWebAmount) || 0;
            if (amount <= 0 || cartSubTotal.value === 0) return 0;
            const type = config.value.commissionWebType || 'percent';
            return type === 'percent' ? cartSubTotal.value * (amount / 100) : amount;
        });

        const deliveryCostCmp = computed(() => {
            if (deliveryType.value !== 'delivery') return 0;
            if (!selectedColonia.value) return 0;
            return parseFloat(selectedColonia.value.deliveryCost) || 0;
        });

        const paymentFeeCmp = computed(() => {
            if (paymentMethod.value !== 'stripe') return 0;

            const baseTotal =
                cartSubTotal.value +
                commissionWebAmountCmp.value +
                deliveryCostCmp.value;

            if (baseTotal <= 0) return 0;

            const iva = 0.16;

            // Stripe México
            // Nacional: 3.6
            // Internacional: 4.1
            const percent = stripeFeePercent.value / 100;

            const fixed = stripeFeeFixed.value;

            // Fórmula inversa:
            // total = (base + fijo con IVA) / (1 - porcentaje con IVA)
            const totalWithStripeFee =
                (baseTotal + (fixed * (1 + iva))) /
                (1 - (percent * (1 + iva)));

            const stripeFeeToCharge = totalWithStripeFee - baseTotal;

            // Redondear hacia arriba para no perder centavos
            return Math.ceil(stripeFeeToCharge * 100) / 100;
        });

        const cartTotalPrice = computed(() => cartSubTotal.value + commissionWebAmountCmp.value + deliveryCostCmp.value + paymentFeeCmp.value); // $136.97 + $7.93 = $144.90

        // Filters & UI
        const filteredProducts = computed(() => {
            let res = products.value.filter(p => p.active);
            if (selectedCategory.value !== 'all') res = res.filter(p => p.categories?.includes(selectedCategory.value));
            if (searchQuery.value) {
                const q = searchQuery.value.toLowerCase();
                res = res.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
            }
            return res;
        });
        const selectedCategoryName = computed(() => {
            if (selectedCategory.value === 'all') return 'Todos los productos';
            const c = categories.value.find(x => x._id === selectedCategory.value);
            return c ? c.name : 'Productos';
        });

        const openLoyaltyModal = () => {
            if (sharedCust.token.value) {
                window.location.href = '/profile';
            } else {
                isLoginMode.value = true;
                showUserModal.value = true;
            }
        };

        const openModal = (mode = 'login') => {
            isLoginMode.value = (mode === 'login');
            isSetupPasswordMode.value = false;
            setupPasswordForm.email = '';
            setupPasswordForm.password = '';
            setupPasswordForm.confirmPassword = '';
            showUserModal.value = true;
        };

        const loginCustomer = async () => {
            try {
                const data = await sharedCust.login(loginForm.phone, loginForm.password, slug);
                
                if (data && data.requirePasswordSetup) {
                    tempPhone = data.phone;
                    tempPin = data.pin;
                    setupPasswordForm.email = data.email || '';
                    isSetupPasswordMode.value = true;
                    return;
                }

                toastr.success('¡Hola de nuevo! Sesión iniciada.');
                showUserModal.value = false;
                loginForm.phone = '';
                loginForm.password = '';
                
                if (pendingCheckout.value) {
                    setTimeout(() => checkout(), 500);
                    pendingCheckout.value = false;
                }
            } catch (err) {
                toastr.error(err.message || 'Error al iniciar sesión');
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
                
                showUserModal.value = false;
                isSetupPasswordMode.value = false;
                setupPasswordForm.email = '';
                setupPasswordForm.password = '';
                setupPasswordForm.confirmPassword = '';
                loginForm.phone = '';
                loginForm.password = '';

                if (pendingCheckout.value) {
                    setTimeout(() => checkout(), 500);
                    pendingCheckout.value = false;
                }
            } catch (err) {
                toastr.error(err.message || 'No se pudo guardar la contraseña.');
            }
        };

        const registerCustomer = async () => {
            try {
                await sharedCust.register(
                    customerForm.name,
                    customerForm.phone,
                    customerForm.email,
                    customerForm.password,
                    slug
                );
                toastr.success('Cuenta creada exitosamente');
                showUserModal.value = false;
                customerForm.name = '';
                customerForm.phone = '';
                customerForm.email = '';
                customerForm.password = '';

                if (pendingCheckout.value) {
                    if (deliveryType.value === 'delivery') {
                        try {
                            await sharedCust.saveAddress({
                                alias: 'Hogar',
                                street: customerStreet.value,
                                number: customerNumber.value,
                                colony: selectedColonia.value ? selectedColonia.value.name : customerColony.value,
                                zipCode: customerZipCode.value,
                                coloniaId: selectedColonia.value ? selectedColonia.value.coloniaId : null,
                                reference: customerReference.value,
                                isDefault: true
                            });
                            toastr.success('¡Hemos guardado esta dirección como tu predeterminada! Puedes actualizarla desde tu perfil.');
                        } catch (e) {
                            console.error('Error auto-saving address', e);
                        }
                    }
                    setTimeout(() => checkout(), 500);
                    pendingCheckout.value = false;
                }
            } catch (err) {
                toastr.error(err.message || 'Error al crear cuenta');
            }
        };

        const logout = () => {
            sharedCust.logout();
            toastr.success('Sesión cerrada');
            showUserDropdown.value = false;
        };

        // --- MÉTODOS DE PERFIL DESDE TIENDA ---
        const saveProfile = async () => {
            try {
                await sharedCust.updateProfile({
                    name: profileForm.name,
                    phone: profileForm.phone,
                    email: profileForm.email,
                    password: profileForm.password || undefined
                });
                toastr.success('Perfil actualizado');
            } catch (err) {
                toastr.error(err.message || 'Error al guardar cambios');
            }
        };

        const handleAvatarChange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            try {
                await sharedCust.uploadAvatar(file);
                toastr.success('Foto de perfil actualizada');
            } catch (err) {
                toastr.error(err.message || 'Error al subir foto');
            }
        };

        // CRUD Direcciones
        const openAddAddress = () => {
            isEditingAddress.value = false;
            addressForm._id = null;
            addressForm.alias = 'Hogar';
            addressForm.street = '';
            addressForm.number = '';
            addressForm.colony = '';
            addressForm.zipCode = '';
            addressForm.reference = '';
            addressForm.isDefault = false;
            showAddressFormModal.value = true;
        };

        const openEditAddress = (addr) => {
            isEditingAddress.value = true;
            addressForm._id = addr._id;
            addressForm.alias = addr.alias;
            addressForm.street = addr.street;
            addressForm.number = addr.number;
            addressForm.colony = addr.colony;
            addressForm.zipCode = addr.zipCode;
            addressForm.reference = addr.reference || '';
            addressForm.isDefault = addr.isDefault;
            showAddressFormModal.value = true;
        };

        const saveAddressForm = async () => {
            try {
                await sharedCust.saveAddress({ ...addressForm });
                toastr.success(isEditingAddress.value ? 'Dirección actualizada' : 'Dirección guardada');
                showAddressFormModal.value = false;
            } catch (err) {
                toastr.error(err.message || 'Error al guardar dirección');
            }
        };

        const deleteAddressForm = async (addrId) => {
            if (!confirm('¿Eliminar esta dirección?')) return;
            try {
                await sharedCust.deleteAddress(addrId);
                toastr.success('Dirección eliminada');
            } catch (err) {
                toastr.error(err.message || 'Error al eliminar dirección');
            }
        };

        // Stripe tarjetas guardadas
        const initStripeCardElement = async () => {
            try {
                if (!stripeInstanceSave.value && stripePublishableKey.value) {
                    stripeInstanceSave.value = Stripe(stripePublishableKey.value);
                }
                
                if (stripeInstanceSave.value) {
                    showAddCardModal.value = true;
                    stripeCardErrorSave.value = '';
                    
                    nextTick(() => {
                        const elements = stripeInstanceSave.value.elements();
                        const style = {
                            base: {
                                color: isDark.value ? '#ffffff' : '#333333',
                                fontFamily: '"Outfit", sans-serif',
                                fontSize: '16px',
                                '::placeholder': { color: isDark.value ? '#9ca3af' : '#aab7c4' }
                            }
                        };
                        stripeCardElementSave.value = elements.create('card', { style });
                        stripeCardElementSave.value.mount('#card-element-save');
                        stripeCardElementSave.value.on('change', (event) => {
                            stripeCardErrorSave.value = event.error ? event.error.message : '';
                        });
                    });
                } else {
                    toastr.error('No se pudo cargar la librería de Stripe.');
                }
            } catch (e) {
                toastr.error('Error al inicializar formulario de tarjeta.');
            }
        };

        const saveCardForm = async () => {
            if (isSavingCard.value) return;
            isSavingCard.value = true;
            stripeCardErrorSave.value = '';
            
            try {
                const clientSecret = await sharedCust.getSetupIntent();
                
                const result = await stripeInstanceSave.value.confirmCardSetup(clientSecret, {
                    payment_method: {
                        card: stripeCardElementSave.value,
                        billing_details: {
                            name: sharedCust.customer.value.name,
                            email: sharedCust.customer.value.email,
                            phone: sharedCust.customer.value.phone
                        }
                    }
                });
                
                if (result.error) {
                    stripeCardErrorSave.value = result.error.message;
                } else {
                    if (result.setupIntent.status === 'succeeded') {
                        toastr.success('Tarjeta guardada correctamente');
                        showAddCardModal.value = false;
                        await sharedCust.fetchCards();
                    }
                }
            } catch (err) {
                stripeCardErrorSave.value = err.message || 'Error al guardar tarjeta.';
            } finally {
                isSavingCard.value = false;
            }
        };

        const deleteCardForm = async (pmId) => {
            if (!confirm('¿Eliminar esta tarjeta?')) return;
            try {
                await sharedCust.deleteCard(pmId);
                toastr.success('Tarjeta eliminada');
            } catch (err) {
                toastr.error(err.message || 'Error al eliminar tarjeta');
            }
        };

        // REORDENAR DESDE LA TIENDA
        const checkReorderCart = () => {
            const reorderData = sessionStorage.getItem('reorder_cart');
            if (reorderData) {
                try {
                    const items = JSON.parse(reorderData);
                    cart.value = []; // Limpiar carrito
                    items.forEach(item => {
                        // Buscar por ID del producto (para órdenes nuevas) o por nombre exacto (para órdenes antiguas)
                        const dbProd = products.value.find(p => p._id === item.product || p.name === item.name);
                        if (dbProd) {
                            cart.value.push({
                                product: dbProd,
                                selectedOptions: item.selectedOptions || [],
                                quantity: item.quantity,
                                unitPrice: item.unitPrice || dbProd.price
                            });
                        }
                    });
                    toastr.success('Pedido cargado en el carrito');
                    showCartModal.value = true;
                } catch(e) { console.error("Error al reordenar:", e); }
                sessionStorage.removeItem('reorder_cart');
            }
        };

        const reorderPastPurchaseStore = (order) => {
            // Reordenar directamente en este mismo restaurante
            cart.value = [];
            order.items.forEach(item => {
                const dbProd = products.value.find(p => p._id === item.productId);
                if (dbProd) {
                    cart.value.push({
                        product: dbProd,
                        selectedOptions: item.selectedOptions || [],
                        quantity: item.quantity,
                        unitPrice: item.unitPrice || dbProd.price
                    });
                }
            });
            toastr.success('Artículos agregados al carrito');
            showLoyaltyModal.value = false;
            showCartModal.value = true;
        };


        const generateQR = (text) => {
            new QRious({
                element: document.getElementById('qr-code'),
                value: text, // El teléfono es el ID
                size: 150
            });
        };

        const sendWhatsAppOrderManual = () => {
            if (lastWhatsAppUrl.value) {
                try {
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobile) {
                        window.location.href = lastWhatsAppUrl.value;
                    } else {
                        const newWindow = window.open(lastWhatsAppUrl.value, '_blank');
                        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                            window.location.href = lastWhatsAppUrl.value;
                        }
                    }
                } catch (e) {
                    console.error("Error al abrir WhatsApp manualmente:", e);
                    window.location.href = lastWhatsAppUrl.value;
                }
            } else {
                toastr.error('No se encontró la URL de WhatsApp del pedido.');
            }
        };

        const goToMenu = () => {
            showSuccessScreen.value = false;
            lastOrderNumber.value = '';
            lastOrderId.value = '';
            lastWhatsAppUrl.value = '';
        };

        const toggleTheme = () => { isDark.value = !isDark.value; updateHtmlClass(); localStorage.setItem('theme', isDark.value ? 'dark' : 'light'); };
        const updateHtmlClass = () => document.documentElement.classList.toggle('dark', isDark.value);
        const initTheme = () => { if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) isDark.value = true; updateHtmlClass(); };
        const goToMarketplace = () => { window.location.href = '/'; };
        
        onMounted(() => {
            initTheme();
            fetchData();
            window.addEventListener('scroll', () => scrollY.value = window.scrollY);

            if (slug) {
                // Registrar visita en background (fire and forget)
                fetch('/api/analytics/visit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slug, visitorId: getVisitorId() })
                });
            }
           
        });

        return {
            banners, categories, products, config, isLoading, isDark, scrollY, businessError,
            searchQuery, selectedCategory, selectedCategoryName, filteredProducts, toggleTheme,
            showBusinessModal, reviews, newReview, submittingReview, submitReview,
            initAddToCart, showProductModal, activeProduct, activeProductAddons, isOptionSelected, toggleOption, modalQuantity, modalTotalPrice, confirmAddToCart,
            cart, showCartModal, customerName, customerPhone, customerEmail, customerStreet, customerColony, customerNumber, customerZipCode, customerReference, paymentMethod, customerHowToPay, decreaseCartItem, cartTotalItems, cartSubTotal, commissionWebAmountCmp, deliveryCostCmp, paymentFeeCmp, cartTotalPrice, checkout, deliveryType,
            selectedColonia, stripeEnabled, showStripeModal, stripePaymentError, isProcessingPayment, processStripePayment,
            showUserDropdown, loginForm, customerForm, setupPasswordForm, isLoginMode, isSetupPasswordMode, showUserModal, openModal, loginCustomer, submitSetupPassword, registerCustomer, logout,
            showAuthPromptModal, authPromptContext, pendingCheckout, continueAsGuest,
            currentUser, firstName, userInitial, userAvatarUrl,
            // Gestión Perfil, Direcciones e Historial
            sharedCust, activeProfileTab, profileForm, addressForm, showAddressFormModal, isEditingAddress,
            saveProfile, handleAvatarChange, openAddAddress, openEditAddress, saveAddressForm, deleteAddressForm,
            // Stripe y Billetera
            showAddCardModal, stripeCardErrorSave, isSavingCard, initStripeCardElement, saveCardForm, deleteCardForm, reorderPastPurchaseStore,
            selectedAddressId, selectedSavedCardId,
            isBusinessOpen, todaySchedule,
            alertBussinesClose,
            formatTime,
            showSuccessScreen, lastOrderNumber, lastOrderId, lastWhatsAppUrl,
            sendWhatsAppOrderManual, goToMenu, goToMarketplace
        };
    }
})
.directive('click-outside', {
    mounted(el, binding) {
        el._clickOutsideHandler = (event) => {
            if (!el.contains(event.target)) {
                binding.value(event);
            }
        };
        document.addEventListener('click', el._clickOutsideHandler, true);
    },
    unmounted(el) {
        document.removeEventListener('click', el._clickOutsideHandler, true);
    }
})
.mount('#app');
