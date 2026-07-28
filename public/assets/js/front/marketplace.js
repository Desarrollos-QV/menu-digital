
const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } = Vue;
const Swal = window.Swal;

// Configuracion de Tailwind
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Plus Jakarta Sans', 'sans-serif'] },
            colors: {
                // USAMOS UNA VARIABLE CSS PARA EL COLOR DINÁMICO
                primary: 'var(--theme-color)',
               
                brand: '#E30613',       // Rojo Tengo Hambre
                brandDark: '#C20510',   // Rojo Tengo Hambre (Oscuro para hover)
                brandYellow: '#FFC800', // Amarillo Tengo Hambre
                
                dark: '#0f172a',
                light: '#f8fafc',

                // Neutros oficiales
                dark1: '#111111',
                dark2: '#333333',
                dark3: '#666666',
                light1: '#F2F2F2',
                light2: '#FAFAFA'
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


// Callback global que dispara Places cuando el SDK carga
window.initMarketplaceMap = function() {
    window._googlePlacesReady = true;
    document.dispatchEvent(new CustomEvent('maps-ready'));
};

// Carga dinámica del SDK de Google Maps
fetch('/api/public/maps-key')
    .then(response => response.json())
    .then(data => {
        if (data.apiKey) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&callback=initMarketplaceMap`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        } else {
            console.error('Google Maps API Key no configurada en el servidor.');
        }
    })
    .catch(error => console.error('Error al obtener la Google Maps API Key:', error));

createApp({
    setup() {
        const searchQuery = ref('');
        const selectedCategory = ref('all');
        const loading = ref(true);
        const error = ref(false);
        const scrolled = ref(false);
        const mobileDrawerOpen = ref(false);
        const businesses = ref([]);
        const froods = ref([]);
        const promos = ref([]);
        const cheapProducts = ref([]);

        // --- THEME LOGIC ---
        const theme = ref(localStorage.getItem('theme') || 'light');
        if (theme.value === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            theme.value = 'dark';
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        const toggleTheme = () => {
            if (theme.value === 'light') {
                theme.value = 'dark';
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else {
                theme.value = 'light';
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            }
        };

        // --- MODO ENTREGA vs RECOLECTAR ---
        const deliveryMode = ref('delivery'); // 'delivery' | 'pickup'
        const mapReady     = ref(false);
        const highlightedBiz    = ref(null);
        const selectedPickupBiz = ref(null);

        let _pickupMap     = null;
        let _pickupMarkers = {}; // { bizId: google.maps.Marker }
        let _infoWindow    = null;

        // --- Computed: negocios con pickup y filtrables ---
        const pickupBusinesses = computed(() => {
            let list = businesses.value.filter(b => b.allowPickup && b.lat && b.lng);
            if (searchQuery.value) {
                const q = searchQuery.value.toLowerCase();
                list = list.filter(b =>
                    (b.name && b.name.toLowerCase().includes(q)) ||
                    (b.address && b.address.toLowerCase().includes(q))
                );
            }
            return list;
        });

        // --- Inicializar mapa ---
        const initPickupMap = () => {
            if (!window.google || !window.google.maps) return;
            mapReady.value = true;

            const mapEl = document.getElementById('pickup-map');
            if (!mapEl) return;

            // Centro inicial: México
            const defaultCenter = { lat: 20.959, lng: -89.623 };

            _pickupMap = new window.google.maps.Map(mapEl, {
                center: defaultCenter,
                zoom: 11,
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                styles: [
                    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
                ]
            });

            _infoWindow = new window.google.maps.InfoWindow({ maxWidth: 280 });

            // Colocar markers
            refreshMarkers();
        };

        const makeMarkerSVG = (isOpen) => ({
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: isOpen ? '#10b981' : '#6366f1',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#fff',
            scale: 2,
            anchor: new window.google.maps.Point(12, 24)
        });

        const refreshMarkers = () => {
            if (!_pickupMap) return;

            // Limpiar markers previos
            Object.values(_pickupMarkers).forEach(m => m.setMap(null));
            _pickupMarkers = {};

            const bounds = new window.google.maps.LatLngBounds();
            let hasPoints = false;

            pickupBusinesses.value.forEach(biz => {
                if (!biz.lat || !biz.lng) return;
                const pos = { lat: biz.lat, lng: biz.lng };

                const marker = new window.google.maps.Marker({
                    position: pos,
                    map: _pickupMap,
                    title: biz.name,
                    icon: makeMarkerSVG(isBusinessCurrentlyOpen(biz)),
                    animation: window.google.maps.Animation.DROP
                });

                marker.addListener('click', () => selectPickupBiz(biz));
                _pickupMarkers[biz._id] = marker;
                bounds.extend(pos);
                hasPoints = true;
            });

            if (hasPoints) {
                _pickupMap.fitBounds(bounds);
                // Limitar zoom excesivo
                const listener = window.google.maps.event.addListenerOnce(_pickupMap, 'bounds_changed', () => {
                    if (_pickupMap.getZoom() > 15) _pickupMap.setZoom(15);
                });
            }
        };

        const selectPickupBiz = (biz) => {
            highlightedBiz.value  = biz._id;
            selectedPickupBiz.value = biz;

            if (_pickupMap && biz.lat && biz.lng) {
                const pos = { lat: biz.lat, lng: biz.lng };
                _pickupMap.panTo(pos);
                _pickupMap.setZoom(16);

                // InfoWindow
                const isOpen = isBusinessCurrentlyOpen(biz);
                const hours  = getTodayHours(biz);
                _infoWindow.setContent(`
                    <div style="font-family:'Outfit',sans-serif;padding:12px 16px;min-width:200px">
                        <p style="font-weight:800;font-size:14px;margin:0 0 4px;color:#1e293b">${biz.name}</p>
                        <p style="font-size:11px;color:#64748b;margin:0 0 6px">${biz.address || ''}</p>
                        <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:${isOpen ? '#10b981' : '#94a3b8'}">
                            <span style="width:7px;height:7px;border-radius:50%;background:${isOpen ? '#10b981' : '#94a3b8'};display:inline-block"></span>
                            ${isOpen ? ('Abierto' + (hours ? ' · ' + hours : '')) : 'Cerrado'}
                        </div>
                    </div>
                `);
                _infoWindow.open(_pickupMap, _pickupMarkers[biz._id]);
            }

            // Scrollear el card para que sea visible en móvil
            nextTick(() => {
                const el = document.querySelector(`.pickup-card.highlighted`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        };

        const setDeliveryMode = (mode) => {
            deliveryMode.value = mode;
            if (mode === 'pickup') {
                // Esperar a que el DOM renderice el mapa
                nextTick(() => {
                    if (!_pickupMap) {
                        if (window._mapsReady) {
                            initPickupMap();
                        } else {
                            document.addEventListener('maps-ready', initPickupMap, { once: true });
                        }
                    } else {
                        // Forzar refresco de markers si ya existe el mapa
                        refreshMarkers();
                        window.google.maps.event.trigger(_pickupMap, 'resize');
                    }
                });
            }
        };

        // Re-colocar markers cuando cambia el listado filtrado
        watch(pickupBusinesses, () => { if (_pickupMap) refreshMarkers(); });

        // --- UBICACIÓN ---
        const showLocationModal = ref(false);
        const locationSearch = ref('');
        const allMunicipios = ref([]); // Lista completa de municipios con sus colonias
        const selectedMunicipio = ref(null); // Municipio seleccionado temporalmente
        const currentLag = ref(null); // Colonia seleccionada { _id, name, ... }

          // --- AUTH & USER UNIFICADO ---
        const sharedCust = window.createSharedCustomer();
        
        const initApp = async () => {
            // Cargar municipios
            try {
                const res = await fetch('/api/municipios');
                if(res.ok) allMunicipios.value = await res.json();
            } catch(e) { console.error("Error municipios", e); }

            // Verificar Ubicación Guardada en localStorage
            const storedLoc = localStorage.getItem('fudi_location');
            if(storedLoc) {
                currentLag.value = JSON.parse(storedLoc);
            } else {
                // Si no hay ubicación guardada, intentar usar la dirección predeterminada del perfil
                const defaultAddr = sharedCust.addresses.value.find(a => a.isDefault && a.coloniaId);
                if (defaultAddr) {
                    trySetColoniaFromAddress(defaultAddr);
                } else {
                    showLocationModal.value = true; // Forzar selección
                }
            }

            // Si no está registrado, mostrar modal promocional después de 4 segundos
            if (!sharedCust.customer.value) {
                setTimeout(() => {
                    // Verificar si aún no está registrado
                    if (!sharedCust.customer.value) {
                        authPromptContext.value = 'marketplace';
                        showAuthPromptModal.value = true;
                    }
                }, 4000);
            }
        };

        // Función auxiliar: busca la colonia del sistema y la setea como currentLag
        const trySetColoniaFromAddress = (addr) => {
            let coloniaFound = null;
            for (const mun of allMunicipios.value) {
                if (mun.colonias) {
                    const col = mun.colonias.find(c => String(c._id) === String(addr.coloniaId));
                    if (col) { coloniaFound = col; break; }
                }
            }
            if (coloniaFound) {
                currentLag.value = coloniaFound;
                localStorage.setItem('fudi_location', JSON.stringify(coloniaFound));
            } else {
                showLocationModal.value = true;
            }
        };

        // Watch para timing: si las addresses llegan después de que initApp ya corrió
        watch(sharedCust.addresses, (addrs) => {
            if (currentLag.value) return; // Ya hay ubicación, no hacer nada
            if (localStorage.getItem('fudi_location')) return;
            const defaultAddr = addrs.find(a => a.isDefault && a.coloniaId);
            if (defaultAddr && allMunicipios.value.length > 0) {
                trySetColoniaFromAddress(defaultAddr);
            }
        });

        // Paso 1: Seleccionar Municipio
        const selectMunicipio = (municipio) => {
            selectedMunicipio.value = municipio;
            locationSearch.value = ''; // Limpiar búsqueda para el siguiente paso
        };

        // Regresar al Paso 1
        const goBackToMunicipios = () => {
            selectedMunicipio.value = null;
            locationSearch.value = '';
        };

        // Paso 2: Seleccionar Colonia (Final)
        const selectLocation = (col) => {
            currentLag.value = col;
            localStorage.setItem('fudi_location', JSON.stringify(col));
            showLocationModal.value = false;
            locationSearch.value = ''; 
            selectedMunicipio.value = null; // Resetear para la próxima vez
            
            // Resetear filtros para ver resultados frescos
            searchQuery.value = '';
            selectedCategory.value = 'all';
        };

        // --- COMPUTEDS ---
        const filteredItems = computed(() => {
            const q = locationSearch.value.toLowerCase();

            // Si ya seleccionó municipio, filtramos sus colonias
            if (selectedMunicipio.value) {
                const colonias = selectedMunicipio.value.colonias || [];
                if (!q) return colonias;
                return colonias.filter(c => c.name.toLowerCase().includes(q));
            }

            // Si no, filtramos municipios
            if (!q) return allMunicipios.value;
            return allMunicipios.value.filter(m => m.name.toLowerCase().includes(q) || m.zipCode.includes(q));
        });

        const modalTitle = computed(() => {
            return selectedMunicipio.value ? 'Selecciona tu Colonia' : 'Selecciona tu Municipio';
        });
      

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

        const logout = () => {
            sharedCust.logout();
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500,
                icon: 'success',
                title: 'Sesión cerrada'
            });
            showUserDropdown.value = false;
            mobileDrawerOpen.value = false;
        };

        // --- MODAL USUARIO (REGISTRO & LOGIN) ---
        const showUserModal = ref(false);
        const showAuthPromptModal = ref(false);
        const authPromptContext = ref('marketplace');
        const isLoginMode = ref(true); // Default to Login
        const isSetupPasswordMode = ref(false);
        const showUserDropdown = ref(false);

        // Formulario Login
        const loginForm = reactive({
            phone: '',
            password: ''
        });

        // Formulario Registro
        const customerForm = reactive({
            name: '',
            phone: '',
            email: '',
            password: ''
        });

        // Formulario Configurar Contraseña (Migración de PIN)
        const setupPasswordForm = reactive({
            email: '',
            password: '',
            confirmPassword: ''
        });

        let tempPhone = '';
        let tempPin = '';

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
                const data = await sharedCust.login(loginForm.phone, loginForm.password);
                
                if (data && data.requirePasswordSetup) {
                    tempPhone = data.phone;
                    tempPin = data.pin;
                    setupPasswordForm.email = data.email || '';
                    isSetupPasswordMode.value = true;
                    return;
                }

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 1500,
                    icon: 'success',
                    title: '¡Hola de nuevo!',
                    text: `Bienvenido, ${sharedCust.customer.value.name}`,
                });
                showUserModal.value = false;

                // Reset form
                loginForm.phone = '';
                loginForm.password = '';
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error de acceso',
                    text: err.message || 'Credenciales incorrectas.',
                    confirmButtonColor: '#6366f1'
                });
            }
        };

        const submitSetupPassword = async () => {
            if (!setupPasswordForm.email || !setupPasswordForm.email.trim()) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'El correo electrónico es obligatorio.',
                    confirmButtonColor: '#6366f1'
                });
                return;
            }
            if (setupPasswordForm.password !== setupPasswordForm.confirmPassword) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Las contraseñas no coinciden.',
                    confirmButtonColor: '#6366f1'
                });
                return;
            }
            if (setupPasswordForm.password.length < 4) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'La contraseña debe tener al menos 4 caracteres.',
                    confirmButtonColor: '#6366f1'
                });
                return;
            }

            try {
                await sharedCust.setupPassword(tempPhone, tempPin, setupPasswordForm.password, setupPasswordForm.email);
                
                Swal.fire({
                    icon: 'success',
                    title: '¡Contraseña configurada!',
                    text: 'Tu cuenta ha sido actualizada con tu nueva contraseña.',
                    confirmButtonColor: '#6366f1'
                });

                showUserModal.value = false;
                isSetupPasswordMode.value = false;
                setupPasswordForm.password = '';
                setupPasswordForm.confirmPassword = '';
                loginForm.phone = '';
                loginForm.password = '';
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message || 'No se pudo guardar la contraseña.',
                    confirmButtonColor: '#6366f1'
                });
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

                Swal.fire({
                    icon: 'success',
                    title: '¡Bienvenido!',
                    text: 'Tu cuenta ha sido creada exitosamente.',
                    confirmButtonColor: '#6366f1'
                });
                showUserModal.value = false;

                // Reset form
                customerForm.name = '';
                customerForm.phone = '';
                customerForm.email = '';
                customerForm.password = '';
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message || 'No se pudo crear la cuenta.',
                    confirmButtonColor: '#6366f1'
                });
            }
        };

        // --- GESTIÓN DE PERFIL Y DATOS DESDE "MI CUENTA" ---
        const activeProfileTab = ref('profile'); // 'profile' | 'addresses' | 'cards' | 'orders'
        const profileForm = reactive({
            name: '',
            phone: '',
            email: '',
            password: ''
        });
        const addressForm = reactive({
            _id: null,
            alias: 'Hogar',
            street: '',
            number: '',
            colony: '',
            zipCode: '',
            reference: '',
            isDefault: false
        });
        const showAddressFormModal = ref(false);
        const isEditingAddress = ref(false);

        // Stripe
        const showAddCardModal = ref(false);
        const stripeCardElement = ref(null);
        const stripeInstance = ref(null);
        const stripeCardError = ref('');
        const isSavingCard = ref(false);

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

        // DIRECCIONES
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

        // TARJETAS (STRIPE)
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
                        const elements = stripeInstance.value.elements();
                        const style = {
                            base: {
                                color: '#333333',
                                fontFamily: '"Outfit", sans-serif',
                                fontSize: '16px',
                                '::placeholder': { color: '#aab7c4' }
                            }
                        };
                        stripeCardElement.value = elements.create('card', { style });
                        stripeCardElement.value.mount('#card-element-save');
                        stripeCardElement.value.on('change', (event) => {
                            stripeCardError.value = event.error ? event.error.message : '';
                        });
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
                        card: stripeCardElement.value,
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

        // ACCIÓN RECOMPRAR RÁPIDO (MARKETPLACE)
        const reorderPastPurchase = (order) => {
            if (order.businessId) {
                // Redirigir al cliente a la página del negocio correspondiente
                // Guardamos en sessionStorage los artículos para que app.js los precargue
                sessionStorage.setItem('reorder_cart', JSON.stringify(order.items));
                
                // Buscar el slug del negocio
                fetch(`/api/public/config?id=${order.businessId}`)
                    .then(res => res.json())
                    .then(cfg => {
                        if (cfg && cfg.slug) {
                            window.location.href = `/${cfg.slug}`;
                        } else {
                            toastr.error('Negocio no encontrado');
                        }
                    })
                    .catch(() => toastr.error('Error al redirigir al negocio'));
            } else {
                toastr.error('Datos del pedido incompletos');
            }
        };

        // Categorías Estáticas (Iconos)
        const categories = ref([
            { id: 'burgers', name: 'Hamburguesas', emoji: '🍔' },
            { id: 'pizza', name: 'Pizza', emoji: '🍕' },
            { id: 'sushi', name: 'Sushi / Japonesa', emoji: '🍣' },
            { id: 'tacos', name: 'Tacos', emoji: '🌮' },
            { id: 'mexican', name: 'Mexicana', emoji: '🇲🇽' },
            { id: 'wings', name: 'Alitas / Boneless', emoji: '🍗' },
            { id: 'italian', name: 'Italiana / Pastas', emoji: '🍝' },
            { id: 'chinese', name: 'China / Asiática', emoji: '🥡' },
            { id: 'seafood', name: 'Mariscos', emoji: '🦞' },
            { id: 'chicken', name: 'Pollo / Rostizado', emoji: '🍖' },
            { id: 'coffee', name: 'Cafetería', emoji: '☕' },
            { id: 'bakery', name: 'Panadería / Repostería', emoji: '🥐' },
            { id: 'dessert', name: 'Postres / Helados', emoji: '🍨' },
            { id: 'healthy', name: 'Saludable / Ensaladas', emoji: '🥗' },
            { id: 'vegan', name: 'Vegana / Vegetariana', emoji: '🌱' },
            { id: 'bar', name: 'Bar / Bebidas', emoji: '🍻' },
            { id: 'breakfast', name: 'Desayunos / Brunch', emoji: '🥞' },
            { id: 'fastfood', name: 'Comida Rápida', emoji: '🍟' },
            { id: 'others', name: 'Otros', emoji: '🫧' }
        ]);
        
        // --- SLIDER CONFIGURATION ---
        const activeBanner = ref(0);
        const banners = ref([]);
        let bannerInterval = null;

        const nextBanner = () => {
            if (banners.value.length === 0) return;
            activeBanner.value = (activeBanner.value + 1) % banners.value.length;
        };

        const prevBanner = () => {
            if (banners.value.length === 0) return;
            activeBanner.value = (activeBanner.value - 1 + banners.value.length) % banners.value.length;
        };

        const setActiveBanner = (index) => {
            activeBanner.value = index;
            resetInterval();
        };

        const handleBannerClick = (banner) => {
            // Si el banner tuviera link, aquí iría. 
            // Como el objeto no tiene URL explícita, se deja genérico o se podría usar businessId
            if (banner.businessId) {
                // Lógica futura para redirigir a un negocio específico
            }
        };

        const resetInterval = () => {
            clearInterval(bannerInterval);
            bannerInterval = setInterval(nextBanner, 6000);
        };

        // Helper para colores aleatorios
        const getGradient = (index) => {
            const gradients = [
                'from-orange-600 to-orange-400',
                'from-emerald-600 to-emerald-400',
                'from-purple-600 to-purple-400',
                'from-rose-600 to-rose-400'
            ];
            return gradients[index % gradients.length];
        };

        // --- FETCH DATA DE MONGODB ---
        const fetchBusinesses = async () => {
            loading.value = true;
            error.value = false;

            try {

                const res = await fetch('api/public/list');
                if (!res.ok) throw new Error('Error fetching');
                // [businesses.value, banners.value]
                const data = await res.json();
                businesses.value = data[0];
                // Mapeamos los datos de la BD al formato visual que necesitamos
                banners.value = data[1].map((b, index) => ({
                    ...b, // Conservamos _id, title, description, etc.
                    bgClass: getGradient(index) // Asignamos un color visual
                })); 

                // Obtener categorías dinámicas de categoriesStore
                try {
                    const catRes = await fetch('api/categoriesStore');
                    if (catRes.ok) {
                        const dbCats = await catRes.json();
                        const activeCats = dbCats.filter(c => c.active);
                        if (activeCats.length > 0) {
                            categories.value = activeCats.map(c => ({
                                id: c._id,
                                name: c.name,
                                emoji: c.emoji || '🍔'
                            }));
                        }
                    }
                } catch (catErr) {
                    console.error('Error fetching global categories:', catErr);
                }

                // Inicializar Promociones y Froods dinámicamente según los negocios en base de datos
                if (businesses.value && businesses.value.length > 0) {
                    const list = businesses.value;
                    const findBiz = (keywords, fallbackIndex = 0) => {
                        const found = list.find(b => {
                            const nameLower = (b.name || '').toLowerCase();
                            const tagsLower = (b.tags || []).map(t => t.toLowerCase());
                            return keywords.some(k => nameLower.includes(k) || tagsLower.includes(k));
                        });
                        return found || list[fallbackIndex % list.length];
                    };

                    // Fetch de promos reales desde la base de datos de manera funcional
                    try {
                        const promosRes = await fetch('api/public/promos');
                        if (promosRes.ok) {
                            const dbPromos = await promosRes.json();
                            promos.value = dbPromos.map(p => {
                                // Resolver el tagClass basado en el tag
                                let tagClass = "bg-secondary text-white"; // default emerald
                                const tagLower = (p.promoTag || '').toLowerCase();
                                if (tagLower.includes('2x1')) {
                                    tagClass = "bg-yellow-500 text-slate-900";
                                } else if (tagLower.includes('hoy') || tagLower.includes('exclusiv') || tagLower.includes('sol')) {
                                    tagClass = "bg-red-600 text-white";
                                }
                                
                                return {
                                    id: p._id,
                                    title: p.name,
                                    price: p.price,
                                    tag: p.promoTag || "PROMO",
                                    tagClass: tagClass,
                                    image: p.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
                                    business: p.businessId
                                };
                            }).filter(p => p.business); // Solo si el producto tiene negocio válido
                        } else {
                            promos.value = [];
                        }
                    } catch (e) {
                        console.error("Error fetching promos:", e);
                        promos.value = [];
                    }

                    // Fetch de productos menores o iguales a $100
                    try {
                        const cheapRes = await fetch('api/public/cheap-products');
                        if (cheapRes.ok) {
                            const dbCheap = await cheapRes.json();
                            cheapProducts.value = dbCheap.map(p => {
                                return {
                                    id: p._id,
                                    title: p.name,
                                    price: p.price,
                                    image: p.image || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
                                    business: p.businessId
                                };
                            }).filter(p => p.business);
                        } else {
                            cheapProducts.value = [];
                        }
                    } catch (e) {
                        console.error("Error fetching cheap products:", e);
                        cheapProducts.value = [];
                    }

                    froods.value = [
                        {
                            id: 1,
                            title: "NUEVA BURGER Doble Smash",
                            views: "12.5K",
                            thumbnail: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&auto=format&fit=crop&q=80",
                            business: findBiz(["burger", "hamburguesa", "gorilla"], 1)
                        },
                        {
                            id: 2,
                            title: "MAC & CHEESE CON TOCINO",
                            views: "8.7K",
                            thumbnail: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=400&auto=format&fit=crop&q=80",
                            business: findBiz(["pasta", "italian", "yamy"], 0)
                        },
                        {
                            id: 3,
                            title: "BONELESS EN 3 SABORES",
                            views: "15.3K",
                            thumbnail: "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400&auto=format&fit=crop&q=80",
                            business: findBiz(["boneless", "wings", "alitas", "papis"], 2)
                        },
                        {
                            id: 4,
                            title: "TACOS AL PASTOR",
                            views: "15.3K",
                            thumbnail: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&auto=format&fit=crop&q=80",
                            business: findBiz(["tacos", "mexican", "bandidos"], 3)
                        },
                        {
                            id: 5,
                            title: "PIZZA PEPPERONI",
                            views: "9.1K",
                            thumbnail: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400&auto=format&fit=crop&q=80",
                            business: findBiz(["pizza", "yamy"], 0)
                        }
                    ];
                } 
            } catch (err) {
                // const req = err.json();
                console.log(err)
                error.value = true;
            } finally {
                loading.value = false;
            }
        };

        // Computados
        const trendingBusinesses = computed(() => {
            return businesses.value.filter(b => b.isTrending).slice(0, 5);
        });

        const filteredBusinesses = computed(() => {
            // 1. Filtro OBLIGATORIO de Ubicación
            if(!currentLag.value) return [];
            // Verificar si el negocio reparte en esta zona
            // Asegúrate de que tu modelo de negocio tenga 'deliveryZones' como array de IDs
            let filtered = businesses.value.filter(b => {
                if (!b.deliveryZones) return false;
                return b.deliveryZones.some(z => {
                    let idToMatch = z.coloniaId || z._id || z;
                    
                    // Soporte para legados: extraer ID si MongoDB lo transformó a raw BSON Buffer
                    if (z && z.buffer && Array.isArray(z.buffer.data)) {
                        idToMatch = z.buffer.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
                    }

                    const finalId = typeof idToMatch === 'object' ? idToMatch._id || idToMatch.toString() : idToMatch;
                    return String(finalId) === String(currentLag.value._id);
                });
            });

            // Filtro Categoría (soporta `b.categories` como array o string, buscando por ID o nombre para retrocompatibilidad)
            if (selectedCategory.value !== 'all') {
                const activeCatObj = categories.value.find(c => c.id === selectedCategory.value);
                const activeCatName = activeCatObj ? activeCatObj.name.toLowerCase() : '';
                
                filtered = filtered.filter(b => {
                    const cats = b.categories ?? b.category ?? [];
                    const catsArray = Array.isArray(cats) ? cats : [cats];
                    
                    return catsArray.some(cat => {
                        const catStr = String(cat).toLowerCase();
                        return catStr === String(selectedCategory.value).toLowerCase() || 
                               (activeCatName && catStr === activeCatName);
                    });
                });
            }
            
            // Filtro Búsqueda
            if (searchQuery.value) {
                const query = searchQuery.value.toLowerCase();
                filtered = filtered.filter(b =>
                    (b.name && b.name.toLowerCase().includes(query)) ||
                    (b.tags && b.tags.some(tag => tag.toLowerCase().includes(query)))
                );
            }

            // Ordenar: Abiertos primero, Cerrados al final
            filtered.sort((a, b) => {
                const aOpen = isBusinessCurrentlyOpen(a) ? 1 : 0;
                const bOpen = isBusinessCurrentlyOpen(b) ? 1 : 0;
                return bOpen - aOpen;
            });

            return filtered;
        });

        // ---- LÓGICA HORARIO MARKETPLACE ----
        const DAY_NAMES_MKT = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

        const isBusinessCurrentlyOpen = (biz) => {
            // 1. Si el admin lo cerró manualmente → siempre cerrado
            if (biz.isOpen === false) return false;

            const schedule = biz.schedule;
            // 2. Sin schedule configurado → confiamos en isOpen
            if (!schedule || schedule.length === 0) return biz.isOpen !== false;

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const todayIndex = now.getDay();
            const yesterdayIndex = (todayIndex + 6) % 7;

            const todayName = DAY_NAMES_MKT[todayIndex];
            const yesterdayName = DAY_NAMES_MKT[yesterdayIndex];

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
        };

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

        const getTodayHours = (biz) => {
            const schedule = biz.schedule;
            if (!schedule || schedule.length === 0) return null;
            const todayName = DAY_NAMES_MKT[new Date().getDay()];
            const day = schedule.find(d => d.day === todayName);
            if (!day || !day.isOpen) return null;
            return `${formatTime(day.open)} - ${formatTime(day.close)}`;
        };

        const goToBusiness = (biz) => {
            window.location.href = biz.slug; // Redirección interna
        };

        const handleScroll = () => { scrolled.value = window.scrollY > 20; };

        onMounted(() => {
            initApp();
            window.addEventListener('scroll', handleScroll);
            fetchBusinesses();
            resetInterval(); // Iniciar slider
        });

        onUnmounted(() => {
            window.removeEventListener('scroll', handleScroll);
            clearInterval(bannerInterval);
        });

        return {
            theme, toggleTheme,
            searchQuery, selectedCategory, categories,
            trendingBusinesses, filteredBusinesses,
            froods, promos, cheapProducts,
            loading, error, scrolled, goToBusiness, fetchBusinesses,
            // Loc
            showLocationModal, locationSearch, filteredItems, currentLag, selectLocation,
            selectedMunicipio, selectMunicipio, goBackToMunicipios, modalTitle,
            // Slider
            banners, activeBanner, nextBanner, prevBanner, setActiveBanner, handleBannerClick,
            // Auth y Perfil
            sharedCust, currentUser, firstName, userInitial, userAvatarUrl, logout,
            showUserModal, isLoginMode, isSetupPasswordMode, showUserDropdown,
            showAuthPromptModal, authPromptContext, openModal, customerForm, loginForm, setupPasswordForm, registerCustomer, loginCustomer, submitSetupPassword,
            // Gestión Perfil, Direcciones e Historial
            sharedCust, activeProfileTab, profileForm, addressForm, showAddressFormModal, isEditingAddress,
            openProfileEdit, saveProfile, handleAvatarChange, openAddAddress, openEditAddress, saveAddressForm, deleteAddressForm,
            // Stripe y Billetera
            showAddCardModal, stripeCardError, isSavingCard, initStripeCardElement, saveCardForm, deleteCardForm, reorderPastPurchase,
            // Horario
            isBusinessCurrentlyOpen, getTodayHours, formatTime,
            // Modo Recolectar + Mapa
            deliveryMode, setDeliveryMode,
            pickupBusinesses, mapReady,
            highlightedBiz, selectedPickupBiz, selectPickupBiz,
            // Mobile Drawer
            mobileDrawerOpen
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
