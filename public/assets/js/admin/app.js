import { createApp, ref, onMounted, computed, watch, nextTick } from 'vue';

import { useAuth } from './useAuth.js';
import { useMedia } from './useMedia.js';
import { useBanners } from './useBanners.js';
import { useProducts } from './useProducts.js';
import { useCategories } from './useCategories.js';
import { useAddons } from './useAddons.js';
import { useSettings } from './useSettings.js';
import { useSaas } from './useSaas.js';
import { useAnalytics } from './useAnalytics.js';
import { useLoyalty } from './useLoyalty.js';

// Configuracion de Tailwind
tailwind.config = {
    darkMode: 'class', // Activamos el modo oscuro manual por clases
    theme: {
        extend: {
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
            colors: {
                primary: '#6366f1', // Indigo 500 equivalent but softer
                primaryDark: '#4f46e5',
                secondary: '#10b981', // Emerald 500
                dark: '#1e293b', // Slate 800
                sidebar: '#0f172a', // Slate 900
            }
        }
    }
}
// Configuración Global de Toastr
toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-bottom-right", // Abajo a la derecha
    "timeOut": "3000",
}


createApp({
    setup() {
        // STATE
        const collapsed = ref(false);
        const mobileMenuOpen = ref(false);
        const currentView = ref(localStorage.getItem('currentView') || 'dashboard');
        const isDark = ref(false);
        // Simular rol (en producción viene del token JWT decodificado)
        const currentUserRole = ref('admin_negocio'); // Cambia a 'superadmin' para probar la otra vista

        const saasMenu = ref([
            { id: 100, label: 'Clientes / Negocios', icon: 'fa-solid fa-building-user', view: 'saas_clients' },
            { id: 102, label: 'Publicidad Global', icon: 'fa-solid fa-globe', view: 'ads' },
            { id: 102, label: 'Galería Global', icon: 'fa-solid fa-images', view: 'media' },
            { id: 103, label: 'Configuración', icon: 'fa-solid fa-gear', view: 'settings' }
        ]);

        const businessMenu = ref([
            { id: 1, label: 'Dashboard', icon: 'fa-solid fa-chart-pie', view: 'dashboard' },
            { id: 2, label: 'Medios', icon: 'fa-solid fa-images', view: 'media' },
            // PUBLICIDAD CONDICIONAL
            { 
                id: 3, 
                label: 'Publicidad', 
                icon: 'fa-solid fa-bullhorn', 
                view: 'ads',
                // Propiedad computada para bloqueo visual
                get locked() { return settings.settings.value.plan === 'free'; } 
            },
            {
                id: 4, label: 'Productos', icon: 'fa-solid fa-burger', expanded: false, children: [
                    { id: 41, label: 'Listado', view: 'products' },
                    { id: 42, label: 'Complementos', view: 'addons' },
                    { id: 43, label: 'Categorías', view: 'categories' }
                ]
            },
            { id: 5, label: 'Lealtad', icon: 'fa-solid fa-gift', view: 'loyalty' },
            { id: 6, label: 'Usuarios', icon: 'fa-solid fa-user-group', view: 'users' },
            { id: 7, label: 'Configuración', icon: 'fa-solid fa-gear', view: 'settings' }
        ]);

        // Computada para decidir qué menú mostrar
        const activeMenuItems = computed(() => {
            return currentUserRole.value === 'superadmin' ? saasMenu.value : businessMenu.value;
        });

        // --- USANDO COMPOSABLES ---
        const auth = useAuth();
        const media = useMedia(auth.isDark);
        const banners = useBanners(auth.isDark, media.fetchMedia);
        const products = useProducts(auth.isDark, media.fetchMedia);
        const categories = useCategories(auth.isDark, media.fetchMedia);
        const addons = useAddons(auth.isDark);
        const settings = useSettings(auth);
        const saas = useSaas();
        const analytics = useAnalytics();
        const useloyalty = useLoyalty();
        

        // --- DATA TABLE LOGIC ---
        let dataTable = null;

        // Inicializar DataTable
        const initDataTable = () => {
            if (dataTable) {
                dataTable.destroy();
            }

            // Esperamos que el DOM esté listo
            nextTick(() => {
                if (!document.getElementById('productsTable')) return;

                dataTable = $('#productsTable').DataTable({
                    data: products.products.value, // Datos de Vue
                    responsive: true,
                    language: { url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" }, // Español
                    columns: [
                        {
                            data: 'image',
                            render: (data) => `<img src="${data || 'https://via.placeholder.com/50'}" class="w-10 h-10 rounded object-cover">`
                        },
                        {
                            data: 'name',
                            render: (data, type, row) => `<div><div class="font-bold text-slate-800 dark:text-white">${data}</div><div class="text-xs text-slate-500">${row.description || ''}</div></div>`
                        },
                        { data: 'price', render: (data) => `<span class="font-bold">$${data}</span>` },
                        {
                            data: 'categories',
                            render: (data) => {
                                if (!data) return '';
                                return data.map(id => `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] mx-1">${products.getCategoryName(id)}</span>`).join('');
                            }
                        },
                        {
                            data: 'active',
                            render: (data) => `<span class="px-2 py-1 rounded text-xs font-bold ${data ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">${data ? 'Activo' : 'Inactivo'}</span>`
                        },
                        {
                            data: null,
                            orderable: false,
                            render: (data, type, row) => `
                                    <div class="flex gap-2 justify-end">
                                        <button class="btn-trending w-8 h-8 rounded-full ${row.isTrending ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400'} hover:bg-yellow-200 transition flex items-center justify-center" data-id="${row._id}" title="Trending Top">
                                            <i class="fa-solid fa-star"></i>
                                        </button>
                                        <button class="btn-edit w-8 h-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition flex items-center justify-center" data-id="${row._id}">
                                            <i class="fa-solid fa-pen text-xs"></i>
                                        </button>
                                        <button class="btn-delete w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition flex items-center justify-center" data-id="${row._id}">
                                            <i class="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                `
                        }
                    ]
                });
            });
        };

        // Watcher para recargar tabla cuando cambian los productos
        watch(products.products, () => {
            if (currentView.value === 'products') initDataTable();
        });

        // Delegación de Eventos (Porque los botones los crea DataTables, no Vue)
        $(document).on('click', '.btn-edit', function () {
            const id = $(this).data('id');
            const prod = products.products.value.find(p => p._id === id);
            products.openProductModal(prod, media.mediaFiles.value.length);
        });

        $(document).on('click', '.btn-delete', function () {
            const id = $(this).data('id');
            products.deleteProduct(id);
        });

        $(document).on('click', '.btn-trending', function () {
            const id = $(this).data('id');
            const prod = products.products.value.find(p => p._id === id);
            products.toggleTrending(prod);
        });


        // Interceptamos el login para obtener el rol real
        const originalLogin = auth.login;
        auth.login = async () => {
            // Hacemos el login normal
            await originalLogin();

            // Si el login fue exitoso (hay token), determinamos el rol
            if (auth.isAuthenticated.value) {
                // TRUCO: Decodificar el JWT para sacar el rol real
                const token = localStorage.getItem('token');
                if (token) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    const role = payload.role || 'admin_negocio';

                    // Guardar y Actualizar estado
                    localStorage.setItem('role', role);
                    currentUserRole.value = role;

                    // Redirección inteligente
                    if (role === 'superadmin') {
                        currentView.value = 'saas_clients';
                        saas.fetchBusinesses();
                    } else {
                        currentView.value = 'dashboard';
                        analytics.fetchDashboardStats();
                    }
                }
            }
        };

        const toggleSidebar = () => {
            if (window.innerWidth < 768) mobileMenuOpen.value = !mobileMenuOpen.value;
            else collapsed.value = !collapsed.value;
        };

        const navigate = (item) => {
            if (!item.children) {
                currentView.value = item.view;
                localStorage.setItem('currentView', item.view);
                mobileMenuOpen.value = false;
                
            
                // CORRECCIÓN: Ejecutamos el fetch correspondiente SIN importar el rol.
                // El backend ya sabe qué devolver basándose en el token del usuario.
                
                // Vistas Comunes (Admin y Negocio)
                if(item.view === 'media') media.fetchMedia();
                if(item.view === 'ads') banners.fetchBanners();
                if(item.view === 'settings') settings.fetchSettings();

                // Vistas Específicas
                if(item.view === 'saas_clients') saas.fetchBusinesses();
                
                if(item.view === 'products') products.fetchProducts();
                if(item.view === 'categories') categories.fetchCategories();
                if(item.view === 'addons') addons.fetchAddons();
                if(item.view === 'loyalty') useloyalty.fetchProgram();
                if(item.view === 'dashboard' && currentUserRole.value !== 'superadmin') {
                    analytics.fetchDashboardStats();
                }

            }
        };

        const toggleSubmenu = (item) => {
            item.expanded = !item.expanded;
            if (collapsed.value) collapsed.value = false;
        };

        const toggleTheme = () => {
            isDark.value = !isDark.value;
            if (isDark.value) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        };


        onMounted(() => {
            auth.checkSession();
            if (auth.isAuthenticated.value) {
                const savedRole = localStorage.getItem('role');
                if (savedRole) currentUserRole.value = savedRole;
                settings.fetchSettings();
                
                if (currentUserRole.value === 'superadmin') {
                    // Si recargamos y estamos en dashboard, mover a saas
                    if (currentView.value === 'dashboard') currentView.value = 'saas_clients';
                    
                    // Cargar datos según la vista inicial
                    if(currentView.value === 'saas_clients') saas.fetchBusinesses();
                    if(currentView.value === 'ads') banners.fetchBanners();
                    if(currentView.value === 'media') media.fetchMedia();
                    if(currentView.value === 'settings') settings.fetchSettings();
                } else {
                    
                    // Cargar datos iniciales de negocio
                    if (currentView.value === 'dashboard') analytics.fetchDashboardStats();
                    if (currentView.value === 'media') media.fetchMedia();
                    if (currentView.value === 'ads') { banners.isUploadingBanner.value = false; banners.fetchBanners(); }
                    if (currentView.value === 'products') products.isUploadingProductImg.value = false; products.fetchProducts();
                    if (currentView.value === 'categories') categories.isUploadingProductImg.value = false; categories.fetchCategories();
                    if (currentView.value === 'addons') addons.fetchAddons();
                    if (currentView.value === 'settings') settings.fetchSettings();
                    if (currentView.value === 'loyalty') useloyalty.fetchProgram();
                
                }
                
            }
        });

        return {
            collapsed, mobileMenuOpen, currentView,
            activeMenuItems, currentUserRole,
            toggleSidebar, navigate, toggleSubmenu, toggleTheme,
            ...analytics, // Analitica general
            ...settings, // Configuraciones
            ...auth,   // isAuthenticated, username, login, logout...
            ...media,  // mediaFiles, uploadFile, deleteFile...
            ...banners, // banners, saveBanner...
            ...products, // products, saveProduct...
            ...categories, // categoriesList, saveCategory...
            ...addons, // addonsList, saveAddon, addOptionRow...
            ...saas, // Multinegocios
            ...useloyalty // Loyalty
        
        };
    }
}).mount('#app');