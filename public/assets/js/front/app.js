
const { createApp, ref, computed, onMounted, nextTick } = Vue;
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
        const customerStreet = ref('');
        const customerColony = ref('');
        const customerNumber = ref('');
        const customerZipCode = ref('');
        const customerReference = ref('');
        const paymentMethod = ref('cash');
        const customerHowToPay = ref('');
        const deliveryType = ref('delivery');
        const selectedColonia = ref(null);   // Colonia específica (tiene el deliveryCost)

        // Product Logic
        const showProductModal = ref(false);
        const activeProduct = ref({});
        const activeProductAddons = ref([]);
        const activeSelections = ref({});
        const modalQuantity = ref(1);

        // Loyalty Logic
        const showLoyaltyModal = ref(false);
        const loyaltyForm = ref({ name: '', phone: '', pin: '' });
        const loyaltyState = ref({ registered: false, authRequired: false, customer: {}, program: {} });
        const isRecovering = ref(false); // Modo manual de poner teléfono
        const customer = ref([]);
        
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

                nextTick(() => { if (banners.value.length > 0) new Swiper('.banner-swiper', { slidesPerView: 1.1, spaceBetween: 10, loop: true, autoplay: { delay: 4000 } }); });

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

            // 2. Si no hay schedule, confiamos en el campo isOpen del config
            const day = todaySchedule.value;
            if (!day) return config.value.isOpen !== false;

            // 3. Si el día está marcado como cerrado en el schedule
            if (!day.isOpen) return false;

            // 4. Comparar hora actual con apertura/cierre
            const now = new Date();
            const [openH, openM] = (day.open || '00:00').split(':').map(Number);
            const [closeH, closeM] = (day.close || '23:59').split(':').map(Number);
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;

            return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
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
            toastr.success('Agregado');
            showProductModal.value = false;
        };

        const addToCartSimple = (product) => {
            const exist = cart.value.find(i => i.product._id === product._id && (!i.selectedOptions || !i.selectedOptions.length));
            if (exist) exist.quantity++;
            else cart.value.push({ product, selectedOptions: [], quantity: 1, unitPrice: product.price });
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
            if (!customerName.value.trim() || !customerPhone.value.trim()) { // Validar Name and Phone
                return toastr.warning('Nombre y Telefono requeridos');
            }

            if (paymentMethod.value === 'cash' && (!customerHowToPay.value || !customerHowToPay.value.toString().trim())) {
                return toastr.warning('Por favor ingresa con cuánto vas a pagar');
            }

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

            msg += `💳 *_Método de Pago_*: ${paymentMethod.value === 'cash' ? 'Efectivo' : 'Tarjeta'}\n`;
            if (paymentMethod.value === 'cash' && customerHowToPay.value) {
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
                deliveryType: deliveryType.value,
                customerStreet: deliveryType.value === 'delivery' ? customerStreet.value : '',
                customerColony: deliveryType.value === 'delivery' ? (selectedColonia.value?.name || customerColony.value) : '',
                customerNumber: deliveryType.value === 'delivery' ? customerNumber.value : '',
                customerZipCode: deliveryType.value === 'delivery' ? customerZipCode.value : '',
                customerReference: deliveryType.value === 'delivery' ? customerReference.value : '',
                paymentMethod: paymentMethod.value,
                customerHowToPay: customerHowToPay.value,
                cart: cart.value,
                total: cartTotalPrice.value,
                subtotal: cartSubTotal.value,
                deliveryCost: deliveryCostCmp.value,
                deliveryZone: selectedColonia.value?.name || '',
                commission: {
                    type: config.value.commissionWebType || 'percent',
                    amount: parseFloat(config.value.commissionWebAmount) || 0,
                    origin: 'whatsapp'
                }
            };

            fetch('/api/analytics/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataReq)
            });

            // 2. Abrir Whatsapp
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');

            cart.value = [];          // Vaciamos el arreglo
            showCartModal.value = false; // Cerramos el modal
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

        const cartTotalPrice = computed(() => cartSubTotal.value + commissionWebAmountCmp.value + deliveryCostCmp.value);

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

        const openLoyaltyModal = async () => {
            showLoyaltyModal.value = true;
            const savedPhone = localStorage.getItem('loyalty_phone');
            const savedPin = localStorage.getItem('loyalty_pin');

            if (savedPhone) {
                loyaltyForm.value.phone = savedPhone;
                if(savedPin){
                    loyaltyForm.value.pin = savedPin;
                }
                await checkLoyaltyStatus(); 
            } else {
                loyaltyState.value = { registered: false, authRequired: false, customer: {}, program: {} };
            }
        };

        const toggleRecoverMode = () => {
            loyaltyState.value.authRequired = true;
            loyaltyState.value.registered = true;
            // const phone = prompt("Ingresa tu número de celular registrado:");
            // if(phone) {
            //     loyaltyForm.value.phone = phone;
            //     checkLoyaltyStatus(); // Esto detectará si existe y pedirá PIN
            // }
        };

        const checkLoyaltyStatus = async () => {
            try {
                const res = await fetch('/api/loyalty/public/status', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ slug, phone: loyaltyForm.value.phone, pin: loyaltyForm.value.pin})
                });
                
                if (res.ok) {
                    const data = await res.json();
                    loyaltyState.value = data; // Actualiza la UI (Pide PIN o muestra tarjeta)
                        
                    // Si ya está autenticado (se envió PIN antes o sesión viva?), generar QR
                    if (data.authSuccess) {
                        customer.value = data.customer;
                        customerName.value = customer.value.name;
                        localStorage.setItem('customer_data', JSON.stringify(customer));
                        localStorage.setItem('loyalty_name', customer.value.name);
                        localStorage.setItem('loyalty_phone', loyaltyForm.value.phone);
                        localStorage.setItem('loyalty_pin', loyaltyForm.value.pin);
                        nextTick(() => generateQR(loyaltyForm.value.phone));
                    }
                }
            } catch (e) { console.error(e); }
        };

        const loginLoyalty = async () => {
            // Reusamos el endpoint de status pero enviando el PIN
            try {
                const res = await fetch('/api/loyalty/public/status', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        slug, 
                        phone: loyaltyForm.value.phone,
                        pin: loyaltyForm.value.pin 
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.authSuccess) {
                        await checkLoyaltyStatus(); 
                        toastr.success('Sesión iniciada');
                    } else {
                        toastr.error('PIN incorrecto');
                    }
                } else {
                    toastr.error('Error de autenticación');
                }
            } catch (e) { toastr.error('Error de conexión'); }
        };

        const registerLoyalty = async () => {
            if(loyaltyForm.value.pin.length !== 4) return toastr.warning('El PIN debe ser de 4 dígitos');
            
            const res = await fetch('/api/loyalty/public/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ slug, ...loyaltyForm.value })
            });
            
            if (res.ok) {
                toastr.success('¡Tarjeta creada!');
                // Auto-login tras registro
                await loginLoyalty(); 
            } else {
                const err = await res.json();
                toastr.error(err.message || 'Error al registrar (¿Ya existe el número?)');
            }
        };
        
        const logoutLoyalty = () => {
            localStorage.removeItem('loyalty_phone');
            localStorage.removeItem('loyalty_pin');
            loyaltyForm.value = { name: '', phone: '', pin: '' };
            loyaltyState.value = { registered: false, authRequired: false };
        };
        
        const resetLoyaltyState = logoutLoyalty;


        const generateQR = (text) => {
            new QRious({
                element: document.getElementById('qr-code'),
                value: text, // El teléfono es el ID
                size: 150
            });
        };

        const toggleTheme = () => { isDark.value = !isDark.value; updateHtmlClass(); localStorage.setItem('theme', isDark.value ? 'dark' : 'light'); };
        const updateHtmlClass = () => document.documentElement.classList.toggle('dark', isDark.value);
        const initTheme = () => { if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) isDark.value = true; updateHtmlClass(); };

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
                if(localStorage.getItem('customer_data') && localStorage.getItem('customer_data') != null) {
                    loyaltyForm.value.phone = localStorage.getItem('loyalty_phone');
                    loyaltyForm.value.pin = localStorage.getItem('loyalty_pin');
                    checkLoyaltyStatus();
                }
            }
        });

        return {
            banners, categories, products, config, isLoading, isDark, scrollY, businessError,
            searchQuery, selectedCategory, selectedCategoryName, filteredProducts, toggleTheme,
            showBusinessModal, reviews, newReview, submittingReview, submitReview,
            initAddToCart, showProductModal, activeProduct, activeProductAddons, isOptionSelected, toggleOption, modalQuantity, modalTotalPrice, confirmAddToCart,
            cart, showCartModal, customerName, customerPhone, customerStreet, customerColony, customerNumber, customerZipCode, customerReference, paymentMethod, customerHowToPay, decreaseCartItem, cartTotalItems, cartSubTotal, commissionWebAmountCmp, deliveryCostCmp, cartTotalPrice, checkout, deliveryType,
            selectedColonia,
            showLoyaltyModal, loyaltyForm, loyaltyState, isRecovering,
            openLoyaltyModal, registerLoyalty, loginLoyalty, logoutLoyalty, toggleRecoverMode, resetLoyaltyState,
            isBusinessOpen, todaySchedule,
            alertBussinesClose
        };
    }
}).mount('#app');