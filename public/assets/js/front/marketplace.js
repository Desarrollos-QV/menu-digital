
const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } = Vue;
const Swal = window.Swal;

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
        const searchQuery = ref('');
        const selectedCategory = ref('all');
        const loading = ref(true);
        const error = ref(false);
        const scrolled = ref(false);
        const mobileDrawerOpen = ref(false);
        const businesses = ref([]);

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

         const initApp = async () => {
            // Cargar municipios
            try {
                const res = await fetch('/api/municipios');
                if(res.ok) allMunicipios.value = await res.json();
            } catch(e) { console.error("Error municipios", e); }

            // 3. Verificar Ubicación Guardada
            const storedLoc = localStorage.getItem('fudi_location');
            if(storedLoc) {
                currentLag.value = JSON.parse(storedLoc);
            } else {
                showLocationModal.value = true; // Forzar selección
            }
        };

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
        // --- AUTH & USER ---
        const currentUser = ref(null);

        const firstName = computed(() => {
            if (!currentUser.value) return '';
            return currentUser.value.customer.name.split(' ')[0];
        });

        const userInitial = computed(() => {
            if (!currentUser.value) return '?';
            return currentUser.value.customer.name.charAt(0).toUpperCase();
        });

        const checkAuth = () => {
            const storedUser = localStorage.getItem('th_customer');
            if (storedUser) {
                try {
                    currentUser.value = JSON.parse(storedUser);
                } catch (e) {
                    console.error('Error parsing user', e);
                    localStorage.removeItem('th_customer');
                }
            }
        };

        const logout = () => {
            localStorage.removeItem('th_customer');
            currentUser.value = null;
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500,
                icon: 'success',
                title: 'Sesión cerrada'
            });
            mobileDrawerOpen.value = false;
        };

        // --- MODAL USUARIO (REGISTRO & LOGIN) ---
        const showUserModal = ref(false);
        const isLoginMode = ref(true); // Default to Login

        // Formulario Login
        const loginForm = reactive({
            phone: '',
            pin: ''
        });

        // Formulario Registro
        const customerForm = reactive({
            name: '',
            phone: '',
            email: '',
            pin: ''
        });

        const openModal = (mode = 'login') => {
            isLoginMode.value = (mode === 'login');
            showUserModal.value = true;
        };

        const loginCustomer = async () => {
            try {
                const res = await fetch('/api/public/customers/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginForm)
                });

                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem('th_customer', JSON.stringify(data));
                    currentUser.value = data;
                    Swal.fire({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 1500,
                        icon: 'success',
                        title: '¡Hola de nuevo!',
                        text: `Bienvenido, ${data.customer.name}`,
                    });
                    showUserModal.value = false;

                    // Reset form
                    loginForm.phone = '';
                    loginForm.pin = '';
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de acceso',
                        text: data.message || 'Credenciales incorrectas.',
                        confirmButtonColor: '#6366f1'
                    });
                }
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'Fallo de conexión', 'error');
            }
        };

        const registerCustomer = async () => {
            try {
                const payload = {
                    ...customerForm,
                    businessId: null
                };

                const res = await fetch('/api/public/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (res.ok) {
                    // Guardamos sesión (Data debe contener el objeto cliente creado)
                    localStorage.setItem('th_customer', JSON.stringify(data));
                    currentUser.value = data;

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
                    customerForm.pin = '';
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message || 'No se pudo crear la cuenta.',
                        confirmButtonColor: '#6366f1'
                    });
                }
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'Fallo de conexión', 'error');
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

            // Filtro Categoría (soporta `b.categories` como array o string)
            if (selectedCategory.value !== 'all') {
                filtered = filtered.filter(b => {
                    const cats = b.categories ?? b.category ?? [];
                    if (Array.isArray(cats)) {
                        return cats.includes(selectedCategory.value);
                    }
                    return String(cats) === String(selectedCategory.value);
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

            const todayName = DAY_NAMES_MKT[new Date().getDay()];
            const day = schedule.find(d => d.day === todayName);

            // 3. Día no encontrado → abierto por defecto
            if (!day) return true;

            // 4. Día marcado como cerrado
            if (!day.isOpen) return false;

            // 5. Comparar hora actual
            const now = new Date();
            const [openH, openM] = (day.open || '00:00').split(':').map(Number);
            const [closeH, closeM] = (day.close || '23:59').split(':').map(Number);
            const cur = now.getHours() * 60 + now.getMinutes();
            return cur >= openH * 60 + openM && cur < closeH * 60 + closeM;
        };

        const getTodayHours = (biz) => {
            const schedule = biz.schedule;
            if (!schedule || schedule.length === 0) return null;
            const todayName = DAY_NAMES_MKT[new Date().getDay()];
            const day = schedule.find(d => d.day === todayName);
            if (!day || !day.isOpen) return null;
            return `${day.open} - ${day.close}`;
        };

        const goToBusiness = (biz) => {
            if (!biz.isOpen) {
                // Podrías mostrar un toast o alert
                // alert("Negocio cerrado");
            }
            window.location.href = biz.slug; // Redirección interna
        };

        const handleScroll = () => { scrolled.value = window.scrollY > 20; };

        onMounted(() => {
            initApp();
            window.addEventListener('scroll', handleScroll);
            checkAuth(); // Verificar sesión al cargar
            fetchBusinesses();
            resetInterval(); // Iniciar slider
        });

        onUnmounted(() => {
            window.removeEventListener('scroll', handleScroll);
            clearInterval(bannerInterval);
        });

        return {
            searchQuery, selectedCategory, categories,
            trendingBusinesses, filteredBusinesses,
            loading, error, scrolled, goToBusiness, fetchBusinesses,
            // Loc
            showLocationModal, locationSearch, filteredItems, currentLag, selectLocation,
            selectedMunicipio, selectMunicipio, goBackToMunicipios, modalTitle,
            // Slider
            banners, activeBanner, nextBanner, prevBanner, setActiveBanner, handleBannerClick,
            // Registro & Auth
            showUserModal, isLoginMode, openModal, customerForm, loginForm, registerCustomer, loginCustomer,
            currentUser, firstName, userInitial, logout,
            // Horario
            isBusinessCurrentlyOpen, getTodayHours,
            // Modo Recolectar + Mapa
            deliveryMode, setDeliveryMode,
            pickupBusinesses, mapReady,
            highlightedBiz, selectedPickupBiz, selectPickupBiz,
            // Mobile Drawer
            mobileDrawerOpen
        };
    }
}).mount('#app');