
const { createApp, ref, reactive, computed, onMounted, onUnmounted } = Vue;
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
        const businesses = ref([]);

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
                console.log(businesses.value, banners.value, showUserModal.value);
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
            let filtered = businesses.value;

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
            return filtered;
        });

        const goToBusiness = (biz) => {
            if (!biz.isOpen) {
                // Podrías mostrar un toast o alert
                // alert("Negocio cerrado");
            }
            window.location.href = biz.slug; // Redirección interna
        };

        const handleScroll = () => { scrolled.value = window.scrollY > 20; };

        onMounted(() => {
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
            // Slider
            banners, activeBanner, nextBanner, prevBanner, setActiveBanner, handleBannerClick,
            // Registro & Auth
            showUserModal, isLoginMode, openModal, customerForm, loginForm, registerCustomer, loginCustomer,
            currentUser, firstName, userInitial, logout
        };
    }
}).mount('#app');