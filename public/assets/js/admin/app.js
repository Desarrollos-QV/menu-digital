import { createApp, ref, onMounted, computed, watch, nextTick, reactive } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch
const Swal = window.Swal;
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
import { usePos } from './usePos.js';
import { useUsers } from './useUsers.js';
import { useFinance } from './useFinance.js';
import { useOrders } from './useOrders.js';
import { useQuotes } from './useQuotes.js';
import { useKds } from './useKds.js';
import { useMunicipios } from './useMunicipios.js';
import { useCategoriesStore } from './useCategoriesStore.js';
import { usePrinter } from './usePrinter.js'; // Gestor de impresion universal
import { useBlog } from './useBlog.js'; // Blog Logic

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
        // Simular rol (en producción viene del token JWT decodificado)
        const currentUserRole = ref('admin_negocio'); // Cambia a 'superadmin' para probar la otra vista

        // availableCategories se carga ahora desde la base de datos vía categoriesStore
        // --- USANDO COMPOSABLES ---
        const auth = useAuth();
        const media = useMedia(auth.isDark);
        const banners = useBanners(auth.isDark, media.fetchMedia);
        const products = useProducts(auth.isDark, media.fetchMedia);
        const categories = useCategories(auth.isDark, media.fetchMedia);
        const addons = useAddons(auth.isDark);
        const settings = useSettings(auth);
        const pos = usePos(products, media.fetchMedia, settings);
        const saas = useSaas();
        const analytics = useAnalytics();
        const useloyalty = useLoyalty();
        const users = useUsers();
        const finance = useFinance();
        const orders = useOrders();
        const quotes = useQuotes(settings);
        const kds = useKds();
        const municipios = useMunicipios(auth.isDark);
        const categoriesStore = useCategoriesStore(auth.isDark);
        const printer = usePrinter(settings);
        const blog = useBlog(auth.isDark, media.fetchMedia);

        const saasMenu = ref([
            { id: 100, label: 'Clientes / Negocios', icon: 'fa-solid fa-building-user', view: 'saas_clients' },
            { id: 101, label: 'Publicidad Global', icon: 'fa-solid fa-globe', view: 'ads' },
            { id: 102, label: 'Galería Global', icon: 'fa-solid fa-images', view: 'media' },
            { id: 103, label: 'Categorias', icon: 'fa-solid fa-burger', view: 'categoriesStore' },
            { id: 104, label: 'Municipios', icon: 'fa-solid fa-map-location-dot', view: 'municipios' },
            { id: 105, label: 'Blog (Noticias)', icon: 'fa-solid fa-newspaper', view: 'blog' },
            //  { id: 104, label: 'Configuración', icon: 'fa-solid fa-gear', view: 'settings' }
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
                get locked() { return (settings.settings.value.plan == 'free') ? true : false; }
            },
            {
                id: 4,
                label: 'Lealtad',
                icon: 'fa-solid fa-gift',
                view: 'loyalty',
                get locked() { return (settings.settings.value.plan == 'free') ? true : false; }
            },
            {
                id: 5,
                label: 'Productos',
                icon: 'fa-solid fa-burger',
                expanded: false,
                children: [
                    { id: 6, label: 'Listado', view: 'products' },
                    { id: 7, label: 'Complementos', view: 'addons' },
                    { id: 8, label: 'Categorías', view: 'categories' }
                ]
            },
            {
                id: 9,
                label: 'Ventas',
                icon: 'fa-solid fa-receipt',
                expanded: false,
                children: [
                    {
                        id: 10, label: 'Historial', view: 'orders',
                        get locked() { return (settings.settings.value.plan == 'free') ? true : false; }
                    },
                    {
                        id: 11, label: 'Cotizaciones', view: 'quotes',
                        get locked() { return (settings.settings.value.plan == 'free') ? true : false; }
                    }
                ],
                get locked() { return (settings.settings.value.plan == 'free') ? true : false; }
            },
            { id: 3, label: 'KDS Cocina', icon: 'fa-solid fa-fire-burner', view: 'kds' }, // Nuevo Item
            { id: 12, label: 'Caja', icon: 'fa-solid fa-box', view: 'finance', get locked() { return (settings.settings.value.plan == 'free') ? true : false; } },
            { id: 13, label: 'Usuarios', icon: 'fa-solid fa-user-group', view: 'users' },
            { id: 14, label: 'Configuración', icon: 'fa-solid fa-gear', view: 'settings' }
        ]);


        // Lógica de Toggle
        const toggleCategory = async (id) => {
            if (settings.settings.value.categories.includes(id)) {
                // Quitar si ya existe
                settings.settings.value.categories = settings.settings.value.categories.filter(c => c !== id);
            } else {
                // Agregar si no existe
                settings.settings.value.categories.push(id);
            }
        };


        // Computada para decidir qué menú mostrar
        const activeMenuItems = computed(() => {
            return currentUserRole.value === 'superadmin' ? saasMenu.value : businessMenu.value;
        });

        // --- LÓGICA LOCAL PARA MODAL DETALLE ITEM ---
        const showItemDetailsModal = ref(false);
        const selectedCartItem = ref(null);


        // --- DATA TABLE PRODUCTS ---
        let dataTable = null;
        const initDataTable = () => {
            if (dataTable) {
                dataTable.destroy();
            }

            nextTick(() => {
                if (!document.getElementById('productsTable')) return;
                dataTable = $('#productsTable').DataTable({
                    data: products.products.value,
                    responsive: {
                        details: {
                            renderer: $.fn.dataTable.Responsive.renderer.listHiddenNodes(),
                        }
                    },
                    language: { url: "/es-ES.json" },
                    pageLength: 15,
                    columnDefs: [
                        { responsivePriority: 1, targets: 1 },  // Nombre: siempre visible
                        { responsivePriority: 2, targets: -1 }, // Acciones: siempre visible
                        { responsivePriority: 3, targets: 0 },  // Imagen
                        { responsivePriority: 4, targets: 4 },  // Precio
                        { responsivePriority: 5, targets: 6 },  // Estado
                        { responsivePriority: 6, targets: 2 },  // Stock
                        { responsivePriority: 7, targets: 5 },  // Categorías
                        { responsivePriority: 8, targets: 3 },  // Orden (menos importante)
                    ],
                    columns: [
                        {
                            data: 'image',
                            orderable: false,
                            render: (data) => `
                                <div class="flex-shrink-0">
                                    <img src="${data || 'https://via.placeholder.com/50'}" 
                                         class="w-11 h-11 rounded-xl object-cover shadow-sm border border-slate-100">
                                </div>`
                        },
                        {
                            data: 'name',
                            render: (data, type, row) => `
                                <div class="min-w-0">
                                    <div class="font-bold text-slate-800 text-sm">${data}</div>
                                    <div class="text-xs text-slate-400 truncate max-w-[180px]">${row.description || ''}</div>
                                </div>`
                        },
                        {
                            data: null,
                            render: (data, type, row) => {
                                const s = row.stock;
                                if (s === null || s === undefined)
                                    return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500"><i class="fa-solid fa-minus"></i> N/D</span>';
                                if (s <= 0)
                                    return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600"><i class="fa-solid fa-xmark"></i> Agotado</span>';
                                return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><i class="fa-solid fa-boxes-stacked"></i> ${s}</span>`;
                            }
                        },
                        {
                            data: 'sort',
                            render: (data) => `<span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-black">${data}</span>`
                        },
                        {
                            data: 'price',
                            render: (data) => `<span class="font-black text-slate-800 text-sm">$${parseFloat(data).toFixed(2)}</span>`
                        },
                        {
                            data: 'categories',
                            orderable: false,
                            render: (data) => {
                                if (!data || data.length === 0) return '<span class="text-slate-300 text-xs italic">—</span>';
                                return data.slice(0, 2).map(id =>
                                    `<span class="inline-block bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full text-[10px] font-bold mr-1">${products.getCategoryName(id)}</span>`
                                ).join('') + (data.length > 2 ? `<span class="text-[10px] text-slate-400">+${data.length - 2}</span>` : '');
                            }
                        },
                        {
                            data: 'active',
                            render: (data) => data
                                ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700"><i class="fa-solid fa-circle text-[6px]"></i> Activo</span>'
                                : '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-600"><i class="fa-solid fa-circle text-[6px]"></i> Inactivo</span>'
                        },
                        {
                            data: null,
                            orderable: false,
                            className: 'dt-nowrap',
                            render: (data, type, row) => `
                                <div class="flex items-center gap-1.5 justify-end">
                                    <button class="btn-edit inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition text-xs font-bold border border-blue-100 hover:border-blue-600" data-id="${row._id}">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                        <span class="hidden sm:inline">Editar</span>
                                    </button>
                                    <button class="btn-delete inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition text-xs font-bold border border-red-100 hover:border-red-500" data-id="${row._id}">
                                        <i class="fa-solid fa-trash-can"></i>
                                        <span class="hidden sm:inline">Eliminar</span>
                                    </button>
                                </div>`
                        }
                    ]
                });
            });
        };

        watch(products.products, () => {
            if (currentView.value === 'products') initDataTable();
        });

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

        // DATATABLE DE USUARIOS
        let usersTable = null;
        const initUsersTable = () => {
            if (usersTable) usersTable.destroy();
            nextTick(() => {
                if (!document.getElementById('usersTable')) return;

                usersTable = $('#usersTable').DataTable({
                    data: users.usersList.value,
                    responsive: true,
                    language: { url: "/es-ES.json" },
                    columns: [
                        { data: 'name', render: (data) => `<div class="font-bold text-slate-800 dark:text-white">${data}</div>` },
                        { data: 'phone' },
                        { data: 'points', render: (data) => `<span class="text-emerald-600 font-bold">${data}</span>` },
                        { data: 'visits' },
                        { data: 'lastVisit', render: (data) => data ? new Date(data).toLocaleDateString() : '-' },
                        { data: null, render: () => `<button class="btn-view-user text-primary hover:text-primaryDark"><i class="fa-solid fa-eye"></i></button>` }
                    ]
                });

                // Evento Click en Fila (Delegación) para ver detalle
                $('#usersTable tbody').off('click', 'tr').on('click', 'tr', function () {
                    const rowData = usersTable.row(this).data();
                    if (rowData) {
                        // Llamamos a la lógica para cargar detalle y cambiar vista
                        users.fetchUserDetails(rowData._id);
                        currentView.value = 'user_details';
                    }
                });
            });
        };

        // Watch para recargar tabla cuando cambie la lista
        watch(users.usersList, () => { if (currentView.value === 'users') initUsersTable(); });

        // DataTable Orders
        let ordersTable = null;
        const initOrdersTable = () => {
            if (ordersTable) ordersTable.destroy();
            nextTick(() => {
                if (!document.getElementById('ordersTable')) return;
                ordersTable = $('#ordersTable').DataTable({
                    data: orders.ordersList.value,
                    responsive: true,
                    language: { url: "/es-ES.json" },
                    order: [[7, 'ASC']], // Ordenar por fecha descendente
                    columns: [
                        { data: '_id', render: (data) => `<span class="font-mono text-xs text-slate-500">#${data.slice(-6).toUpperCase()}</span>` },
                        { data: 'createdAt', render: (data) => `<span class="text-sm">${new Date(data).toLocaleDateString()} ${new Date(data).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` },
                        { data: 'customerId', render: (data) => data ? `<span class="font-bold text-slate-800 dark:text-white">${data.name}</span>` : '<span class="italic text-slate-400">Mostrador</span>' },
                        { data: 'source', render: (data) => `<span class="badge badge-sm">${data}</span>` },
                        {
                            data: 'paymentMethod', render: (data) => {
                                const icons = { cash: 'fa-money-bill', card: 'fa-credit-card', transfer: 'fa-money-bill-transfer' };
                                return `<i class="fa-solid ${icons[data] || 'fa-circle-question'} text-slate-400 mr-1"></i> <span class="capitalize">${data}</span>`;
                            }
                        },
                        { data: 'total', render: (data) => `<span class="font-bold text-slate-800 dark:text-white">$${data.toFixed(2)}</span>` },
                        {
                            data: 'status', render: (data) => {
                                const colors = { completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700' };
                                return `<span class="px-2 py-1 rounded text-xs font-bold ${colors[data] || 'bg-slate-100'}">${data}</span>`;
                            }
                        },
                        { data: null, render: () => `<button class="btn-view-order text-primary hover:text-primaryDark"><i class="fa-solid fa-eye"></i></button>` }
                    ]
                });

                // Click evento
                $('#ordersTable tbody').off('click', '.btn-view-order').on('click', '.btn-view-order', function () {
                    const rowData = ordersTable.row($(this).parents('tr')).data();
                    if (rowData) {
                        orders.fetchOrderDetails(rowData._id);
                        currentView.value = 'order_details';
                    }
                });
            });
        };

        // Watcher
        watch(orders.ordersList, () => { if (currentView.value === 'orders') initOrdersTable(); });

        const viewListOrders = () => {
            orders.fetchOrders();
            initOrdersTable(); //<-- Inicializamos de nuevo
            currentView.value = 'orders';
        }

        // DataTable Quotes
        let QuotesTable = null;
        const initQuotesTable = () => {
            if (QuotesTable) QuotesTable.destroy();
            nextTick(() => {
                if (!document.getElementById('quotesTable')) return;
                QuotesTable = $('#quotesTable').DataTable({
                    data: quotes.quotesList.value,
                    responsive: true,
                    language: { url: "/es-ES.json" },
                    order: [[0, 'desc']], // Ordenar por fecha descendente
                    columns: [
                        { data: '_id', render: (data) => `<span class="font-mono text-xs text-slate-500">#${data.slice(-6).toUpperCase()}</span>` },
                        { data: 'customerName', render: (data) => data ? `<span class="font-bold text-slate-800 dark:text-white">${data.toUpperCase()}</span>` : '<span class="italic text-slate-400">Mostrador</span>' },
                        { data: 'validUntil', render: (data) => `<span class="badge badge-sm">${data}</span>` },
                        { data: 'total', render: (data) => `<span class="font-bold text-slate-800 dark:text-white">$${data.toFixed(2)}</span>` },
                        {
                            data: 'status', render: (data) => {
                                const colors = { ready: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700' };
                                return `<span class="px-2 py-1 rounded text-xs font-bold ${colors[data] || 'bg-slate-100'}">${data}</span>`;
                            }
                        },
                        {
                            data: null, render: () => `
                            <div class="flex gap-2 justify-end">
                                <button class="btn-edit-quote text-blue-500 hover:bg-blue-50 p-2 rounded"><i class="fa-solid fa-eye"></i></button>
                                <button class="btn-delete-quote text-red-500 hover:bg-red-50"><i class="fa-solid fa-trash"></i></button>
                            </div>` }
                    ]
                });

                // Click evento
                $('#quotesTable tbody').off('click', '.btn-edit-quote').on('click', '.btn-edit-quote', function () {
                    const rowData = QuotesTable.row($(this).parents('tr')).data();
                    if (rowData) {
                        editQuote(rowData)
                    }
                });
                $('#quotesTable tbody').off('click', '.btn-delete-quote').on('click', '.btn-delete-quote', function () {
                    const rowData = QuotesTable.row($(this).parents('tr')).data();
                    if (rowData) {
                        quotes.deleteQuote(rowData._id)
                    }
                });
            });
        };

        // Watcher
        watch(quotes.quotesList, () => { if (currentView.value === 'quotes') initQuotesTable(); });

        // --- Interceptamos el login para obtener el rol real
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
                    settings.fetchSettings(); // <-- Cargamos y normalizamos configuraciones...
                    finance.fetchCurrentStatus(); // <-- Cargamos el status de la caja
                    finance.fetchHistory(); // <-- Cargamos el status de la caja
                    analytics.fetchDashboardStats(); // <-- Cargamos stadisticas
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

        const navigate = async (item) => {
            currentView.value = item.view;
            localStorage.setItem('currentView', JSON.stringify(item));
            mobileMenuOpen.value = false;

            // 1. CAMBIAR LA URL VISUALMENTE
            const slug = item.view === 'dashboard' ? '' : item.view; // /admin/dashboard -> /admin/
            // Nota: Asumimos base /admin/
            if (!item.locked) {
                const newUrl = `/admin/${slug}`;
                window.history.pushState({ view: item.view }, '', newUrl);
            } else {
                const Toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 3500 });
                Toast.fire({ icon: 'error', title: 'Sección Bloqueada', text: "Por favor activa un plan PRO" });
                currentView.value = "dashboard";
                // 1. CAMBIAR LA URL VISUALMENTE
                const newUrl = `/admin/dashboard`;
                window.history.pushState({ view: currentView.value }, '', newUrl);
                return;
            }

            if (window.innerWidth < 768) mobileMenuOpen.value = false;
            else collapsed.value = false;

            // Stop KDS polling if leaving KDS
            if (item.view !== 'kds') kds.stopPolling();
            // Check KDS for sidebar
            if (item.view == 'kds') {
                if (window.innerWidth < 768) {
                    mobileMenuOpen.value = false;
                    collapsed.value = false;
                } else {
                    mobileMenuOpen.value = true;
                    collapsed.value = true;
                }
            }

            // Optimizamos el espacio del POS
            if (item.view == 'pos') {
                products.fetchProducts();
                if (window.innerWidth < 768) {
                    mobileMenuOpen.value = false;
                    collapsed.value = false;
                } else {
                    mobileMenuOpen.value = true;
                    collapsed.value = true;
                }
            }

            if (!item.children) {
                // Vistas Comunes (Admin y Negocio)
                if (item.view === 'media') media.fetchMedia();
                if (item.view === 'ads') banners.fetchBanners();
                if (item.view === 'settings') {
                    settings.fetchSettings(); // <-- Obtenemos Configuraciones 
                    municipios.fetchMunicipios(); // <-- Obtenemos Colonias
                    settings.scanPrinters(); // <-- Buscamos impresoras
                }
                if (item.view === 'municipios') municipios.fetchMunicipios();
                if (item.view === 'blog') blog.fetchBlogs();

                // Vistas Específicas
                if (item.view === 'saas_clients') saas.fetchBusinesses();
                if (item.view === 'products') products.fetchProducts();
                if (item.view === 'categories') categories.fetchCategories();
                if (item.view === 'addons') addons.fetchAddons();
                if (item.view === 'loyalty') useloyalty.fetchProgram();
                if (item.view === 'dashboard' && currentUserRole.value !== 'superadmin') {
                    analytics.fetchDashboardStats();
                }
                if (item.view === 'users') users.fetchUsers();
                if (item.view === 'finance') {
                    finance.fetchCurrentStatus();
                    finance.fetchHistory();
                }
                if (item.view === 'orders') orders.fetchOrders();
                if (item.view === 'quotes') quotes.fetchQuotes();
                if (item.view === 'kds') kds.startPolling(); // Start polling for KDS
                if (item.view === 'categoriesStore') categoriesStore.fetchCategories();
            }
        };

        const toggleSubmenu = (item) => {
            item.expanded = !item.expanded;
            if (collapsed.value) collapsed.value = false;
        };


        const openItemDetails = (item) => {
            selectedCartItem.value = item;
            if (!item.note) item.note = '';
            // Inicializar opciones seleccionadas si no existen
            if (!item.selectedOptions) item.selectedOptions = [];
            showItemDetailsModal.value = true;
        };

        // Helpers para Complementos en Modal
        const selectedItemAddonGroups = computed(() => {
            if (!selectedCartItem.value || !selectedCartItem.value.addons) return [];
            return selectedCartItem.value.addons;
        });

        const selectedItemUnitPrice = computed(() => {
            if (!selectedCartItem.value) return 0;
            const addonsTotal = (selectedCartItem.value.selectedOptions || []).reduce((sum, opt) => sum + (opt.price || 0), 0);
            return selectedCartItem.value.price + addonsTotal;
        });

        const toggleAddonOption = (group, option) => {
            const item = selectedCartItem.value;
            if (!item.selectedOptions) item.selectedOptions = [];

            const existingIdx = item.selectedOptions.findIndex(o => o.name === option.name && o.group === group.name);

            if (existingIdx !== -1) {
                // Deseleccionar
                item.selectedOptions.splice(existingIdx, 1);
            } else {
                // Seleccionar
                if (group.maxOptions > 1) {
                    // Lógica Checkbox (Múltiple con límite)
                    const currentInGroup = item.selectedOptions.filter(o => o.group === group.name).length;
                    if (currentInGroup < group.maxOptions) {
                        item.selectedOptions.push({ name: option.name, price: option.priceExtra, group: group.name });
                    } else {
                        toastr.warning(`Máximo ${group.maxOptions} opciones para ${group.name}`);
                    }
                } else {
                    // Lógica Radio (Único: reemplaza otros del mismo grupo)
                    const others = item.selectedOptions.filter(o => o.group !== group.name);
                    others.push({ name: option.name, price: option.priceExtra, group: group.name });
                    item.selectedOptions = others;
                }
            }
        };

        const isOptionSelected = (group, option) => {
            return selectedCartItem.value?.selectedOptions?.some(o => o.name === option.name && o.group === group.name);
        };

        // 1. EXPORTAR A EXCEL
        const downloadSalesExcel = () => {
            if (!orders.ordersList.value || orders.ordersList.value.length === 0) {
                return Swal.fire('Error', 'No hay datos para exportar', 'warning');
            }

            // Preparar datos planos para Excel
            const data = orders.ordersList.value.map(o => ({
                Folio: o._id.slice(-6).toUpperCase(),
                Fecha: new Date(o.createdAt).toLocaleDateString(),
                Hora: new Date(o.createdAt).toLocaleTimeString(),
                Cliente: o.customerId ? o.customerId.name : 'Mostrador',
                MetodoPago: o.paymentMethod,
                Total: o.total,
                Estado: o.status
            }));

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");

            // Generar archivo
            XLSX.writeFile(workbook, `Reporte_Ventas_${new Date().toISOString().split('T')[0]}.xlsx`);
            toastr.success('Reporte descargado correctamente');
        };

        // --- LÓGICA IMPRESIÓN DE TICKETS PRO ---
        const showTicketModal = ref(false);
        const ticketData = ref(null);

        const openTicketPreview = () => {
            const ord = orders.selectedOrder.value;
            if (!ord) return;

            ticketData.value = {
                id: ord._id,
                origin: 'reprint',
                folio: ord._id.slice(-6).toUpperCase(),
                customer: ord.customerId ? ord.customerId.name : (ord.customerName || 'Mostrador'),
                customerPhone: ord.customerPhone || '',
                total: ord.total,
                subtotal: ord.subtotal || 0,
                tax: ord.tax || 0,
                deliveryCost: ord.deliveryCost || 0,
                deliveryZone: ord.deliveryZone || '',
                deliveryType: ord.deliveryType || '',
                customerStreet: ord.customerStreet || '',
                customerNumber: ord.customerNumber || '',
                customerColony: ord.customerColony || '',
                customerZipCode: ord.customerZipCode || '',
                customerReference: ord.customerReference || '',
                commission: ord.commission || null,
                discount: ord.discount || null,
                method: ord.paymentMethod,
                customerHowToPay: ord.customerHowToPay || '',
                items: ord.items.map(i => ({ qty: i.quantity, name: i.name, price: i.price, selectedOptions: i.selectedOptions || [] }))
            };
            showTicketModal.value = true;
        };

        // Truco del Iframe invisible para imprimir SIN abrir ventana
        const printTicketNow = async () => {
            let ord = null;
            
            if (ticketData.value.origin === 'reprint') {
                // Viene desde "Listado de ventas", ya tenemos seleccionada la orden correcta
                ord = orders.selectedOrder.value;
            } else {
                // Viene desde el POS al terminar una venta, necesitamos obtener los detalles reales para imprimir complementos
                orders.fetchOrderDetails(ticketData.value.id);
                // Damos un tiempo a que la reactividad y fetch terminen
                await new Promise(resolve => setTimeout(resolve, 1000));
                ord = orders.selectedOrder.value;
            }
            
            if(!ord) return window.toastr ? toastr.error('Error al recuperar la orden') : console.error('Orden no encontrada');
            
            printer.printTicket(ord);
            
            console.log('Ticket impreso: ', ord);
            showTicketModal.value = false;
        };

       
        // 3. GENERAR PDF
        const generatePDF = () => {
            const ord = orders.selectedOrder.value;
            if (!ord) return;

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const business = settings.settings.value;
            const lineH = 6; // line height
            let y = 20;

            // ---- ENCABEZADO ----
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text(business.appName || 'Comprobante de Venta', 105, y, { align: 'center' });
            y += 7;
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100);
            if (business.address) { doc.text(business.address, 105, y, { align: 'center' }); y += 5; }
            if (business.phone)   { doc.text(`Tel: ${business.phone}`, 105, y, { align: 'center' }); y += 5; }
            doc.setTextColor(0);

            // Línea separadora
            y += 2;
            doc.setLineWidth(0.5);
            doc.line(20, y, 190, y);
            y += 6;

            // ---- DATOS GENERALES ----
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('COMPROBANTE DE VENTA', 20, y);
            y += lineH;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            doc.text(`Folio:`, 20, y); doc.setFont(undefined, 'bold'); doc.text(`#${ord._id.slice(-6).toUpperCase()}`, 40, y); doc.setFont(undefined, 'normal');
            doc.text(`Estado: ${ord.status.toUpperCase()}`, 140, y);
            y += lineH;
            doc.text(`Fecha: ${new Date(ord.createdAt).toLocaleString()}`, 20, y);
            doc.text(`Canal: ${ord.source || 'N/A'}`, 140, y);
            y += lineH;
            doc.text(`Cliente: ${ord.customerId ? ord.customerId.name : (ord.customerName || 'Mostrador')}`, 20, y);
            y += lineH;
            if (ord.customerPhone) { doc.text(`Tel: ${ord.customerPhone}`, 20, y); y += lineH; }
            doc.text(`Método de pago: ${ord.paymentMethod || 'N/A'}`, 20, y);
            if (ord.customerHowToPay) { doc.text(`Paga con: $${ord.customerHowToPay}`, 110, y); }
            y += lineH;
            doc.text(`Atendido por: ${ord.createdBy ? ord.createdBy.username : 'Sistema (Web)'}`, 20, y);
            y += lineH;

            // ---- DATOS DE ENVÍO (solo si es a domicilio) ----
            const isDelivery = ord.deliveryType === 'delivery' || ord.customerStreet;
            if (isDelivery) {
                y += 3;
                doc.setLineWidth(0.2);
                doc.line(20, y, 190, y);
                y += 5;
                doc.setFont(undefined, 'bold');
                doc.setFontSize(9);
                doc.text('DATOS DE ENTREGA A DOMICILIO', 20, y);
                y += lineH;
                doc.setFont(undefined, 'normal');
                if (ord.customerStreet) {
                    doc.text(`Calle: ${ord.customerStreet} ${ord.customerNumber || ''}`, 20, y); y += lineH;
                }
                if (ord.customerColony || ord.deliveryZone) {
                    doc.text(`Colonia/Zona: ${ord.customerColony || ord.deliveryZone}`, 20, y); y += lineH;
                }
                if (ord.customerZipCode) {
                    doc.text(`Código Postal: ${ord.customerZipCode}`, 20, y); y += lineH;
                }
                if (ord.customerReference) {
                    doc.text(`Referencia: ${ord.customerReference}`, 20, y); y += lineH;
                }
            }

            // Línea separadora
            y += 3;
            doc.setLineWidth(0.5);
            doc.line(20, y, 190, y);
            y += 7;

            // ---- TABLA PRODUCTOS ----
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setFillColor(245, 245, 245);
            doc.rect(20, y - 4, 170, 7, 'F');
            doc.text('Producto', 22, y);
            doc.text('Cant.', 122, y, { align: 'center' });
            doc.text('Precio U.', 148, y, { align: 'right' });
            doc.text('Total', 190, y, { align: 'right' });
            doc.setFont(undefined, 'normal');
            y += lineH;

            ord.items.forEach(item => {
                let name = (item.name || '').substring(0, 48);
                doc.text(name, 22, y);
                doc.text(item.quantity.toString(), 122, y, { align: 'center' });
                doc.text(`$${item.price.toFixed(2)}`, 148, y, { align: 'right' });
                doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 190, y, { align: 'right' });
                y += lineH;
                // Complementos
                if (item.selectedOptions && item.selectedOptions.length > 0) {
                    item.selectedOptions.forEach(opt => {
                        doc.setFontSize(7);
                        doc.setTextColor(120);
                        doc.text(`  + ${opt.name} ($${opt.price || 0})`, 22, y);
                        doc.setFontSize(9);
                        doc.setTextColor(0);
                        y += 4;
                    });
                }
                if (item.note) {
                    doc.setFontSize(7);
                    doc.setTextColor(180, 100, 0);
                    doc.text(`  ★ Nota: ${item.note}`, 22, y);
                    doc.setFontSize(9);
                    doc.setTextColor(0);
                    y += 4;
                }
            });

            // Línea separadora
            doc.setLineWidth(0.5);
            doc.line(100, y + 2, 190, y + 2);
            y += 9;

            // ---- DESGLOSE DE TOTALES ----
            const subtotal = ord.subtotal || 0;
            const commAmt = ord.commission && ord.commission.amount > 0
                ? (ord.commission.type === 'percent' ? subtotal * ord.commission.amount / 100 : ord.commission.amount)
                : 0;
            const deliveryCost = ord.deliveryCost || 0;
            const discount = ord.discount && ord.discount.amount > 0 ? ord.discount.amount : 0;

            doc.setFontSize(9);
            const labelX = 140;
            const valX = 190;

            doc.setTextColor(80);
            doc.text('Subtotal:', labelX, y); doc.text(`$${subtotal.toFixed(2)}`, valX, y, { align: 'right' });
            y += lineH;

            if (commAmt > 0) {
                doc.setTextColor(200, 100, 0);
                const commLabel = `Comisión (${ord.commission.type === 'percent' ? ord.commission.amount + '%' : '$'}):` ;
                doc.text(commLabel, labelX, y); doc.text(`+$${commAmt.toFixed(2)}`, valX, y, { align: 'right' });
                y += lineH;
            }

            if (deliveryCost > 0) {
                doc.setTextColor(0, 80, 180);
                const zoneLabel = ord.deliveryZone ? ` (${ord.deliveryZone})` : '';
                doc.text(`Envío${zoneLabel}:`, labelX, y); doc.text(`+$${deliveryCost.toFixed(2)}`, valX, y, { align: 'right' });
                y += lineH;
            }

            if (discount > 0) {
                doc.setTextColor(200, 0, 0);
                doc.text(`Descuento:`, labelX, y); doc.text(`-$${discount.toFixed(2)}`, valX, y, { align: 'right' });
                y += lineH;
            }

            // Total final
            doc.setTextColor(0);
            doc.setLineWidth(0.3);
            doc.line(120, y, 190, y);
            y += 5;
            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            doc.text('TOTAL:', labelX, y); doc.text(`$${ord.total.toFixed(2)}`, valX, y, { align: 'right' });

            // ---- PIE ----
            y += 14;
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(150);
            doc.text('Gracias por su preferencia.', 105, y, { align: 'center' });
            y += 4;
            doc.text('Documento generado por TengoHambre.app', 105, y, { align: 'center' });

            doc.save(`Comprobante_${ord._id.slice(-6).toUpperCase()}.pdf`);
            toastr.success('PDF generado correctamente');
        };

        // --- LÓGICA DE COTIZACIONES (BRIDGE) ---
        const startNewQuote = () => {
            // Asegurarnos que tenemos los usuarios cargados
            users.fetchUsers().then(() => {
                quotes.setClientsDb(users.usersList.value);
                quotes.setProductsDb(products.products.value);
                quotes.newQuote();
                currentView.value = 'quote_editor';
            });
        };

        const editQuote = (q) => {
            // Asegurarnos que tenemos los usuarios cargados
            users.fetchUsers().then(() => {
                quotes.setClientsDb(users.usersList.value);
                quotes.setProductsDb(products.products.value);
                quotes.editQuote(q);
                currentView.value = 'quote_editor';
            });
        };

        const saveQuote = async () => {
            if (!quotes.clientSearch.value) return Swal.fire('Falta información', 'Ingresa el nombre del cliente', 'warning');
            if (quotes.form.items.length === 0) return Swal.fire('Vacío', 'Agrega productos a la cotización', 'warning');

            quotes.form.total = quotes.totals.value.total; // Guardamos el total final calculado
            quotes.form.createdAt = new Date().toISOString();

            try {
                const url = quotes.isEditing.value ? `/api/quotes/${quotes.form._id}` : '/api/quotes';
                const method = quotes.isEditing.value ? 'PUT' : 'POST';
                const res = await authFetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(quotes.form)
                });

                if (!res.ok) throw new Error('Error al guardar la cotizacion');
                quotes.isEditing.value = false;
                quotes.fetchQuotes(); // <-- Recargamos la data
                toastr.success('Cotización registrada correctamente');
                currentView.value = 'quotes';
            } catch (error) {
                toastr.error(error.message);
            }

        };

        const convertQuoteToSale = () => {

            if (!quotes.clientSearch.value) return Swal.fire('Falta información', 'Ingresa el nombre del cliente', 'warning');
            if (quotes.form.items.length === 0) return Swal.fire('Vacío', 'Agrega productos a la cotización', 'warning');

            const items = quotes.form.items;
            if (items.length === 0) return Swal.fire('Error', 'La cotización está vacía', 'warning');
            Swal.fire({
                title: '¿Generar Venta?',
                text: "Una vez generada la venta esta cotización sera cerrada!!.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, Generar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        // Aplicamos el carrito
                        pos.activeTab.value.cart = JSON.parse(JSON.stringify(items));
                        // Aplicamops el descuento
                        pos.activeTab.value.discount.amount = quotes.form.discount.value;
                        pos.activeTab.value.discount.reason = quotes.form.discount.title;
                        pos.activeTab.value.discount.type = quotes.form.discount.type;
                        // Aplicamos el usuario
                        pos.selectCustomer(quotes.form.client);
                        // Eliminamos solo si ya es una quote guardada...
                        if (quotes.isEditing.value) {
                            quotes.form.status = 'ready'; // <-- Marcamos como lista
                            const res = await authFetch(`/api/quotes/${quotes.form._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quotes.form) });
                            if (!res.ok) throw new Error('Error al guardar la cotizacion');
                            if (res.ok) { toastr.success('Cotización Actualizada con éxito!'); }
                        }
                        // Cambiamos vista...
                        currentView.value = 'pos';
                        toastr.success('Productos cargados al POS');
                    } catch (e) { toastr.error('Error'); }
                }
            });
        };

        const viewListQuotes = () => {
            quotes.fetchQuotes(); // <-- Reiniciamos data
            initQuotesTable(); // <-- Reinicializamos la datatable
            currentView.value = 'quotes'; // <-- Cambiamos de vista
        }

        const showDiscountModal = ref(false);
        const tempDiscount = reactive({ type: 'amount', value: 0, title: '' });

        const openDiscountModal = () => {
            // Copiar valores actuales al temporal
            const current = quotes.form.discount;
            tempDiscount.type = current.type || 'amount';
            tempDiscount.value = current.value || 0;
            tempDiscount.title = current.title || '';
            showDiscountModal.value = true;
        };

        const confirmDiscount = () => {
            quotes.applyDiscount(tempDiscount.type, tempDiscount.value, tempDiscount.title);
            showDiscountModal.value = false;
        };

        // 4. COMPARTIR WHATSAPP
        const showShareModal = ref(false);
        const sharePhone = ref('');
        const sharePrefix = ref('52'); // Default México
        const shareContext = ref('ticket'); // 'ticket' | 'quote'

        const openShareModal = () => {
            shareContext.value = 'ticket';
            // Pre-llenar teléfono si el cliente lo tiene
            const customer = orders.selectedOrder.value?.customerId;
            if (customer && customer.phone) {
                sharePhone.value = customer.phone;
            } else {
                sharePhone.value = '';
            }
            showShareModal.value = true;
        };

        const openQuoteShare = (type) => {
            if (type === 'wa') {
                shareContext.value = 'quote';
                sharePhone.value = ''; // No guardamos teléfono en cotización simple
                showShareModal.value = true;
            }
        };

        const confirmShare = () => {
            if (!sharePhone.value) return Swal.fire('Error', 'Ingresa un número', 'warning');
            const fullPhone = `${sharePrefix.value}${sharePhone.value.replace(/[^0-9]/g, '')}`;

            let msg = '';
            if (shareContext.value === 'ticket') {
                const ord = orders.selectedOrder.value;
                const deliverySection = ord.customerStreet
                    ? `\nEntrega: ${ord.customerStreet} ${ord.customerNumber || ''}, ${ord.customerColony || ord.deliveryZone || ''}`
                    : '';
                const deliveryCostLine = (ord.deliveryCost || 0) > 0
                    ? `\nCosto de envío (${ord.deliveryZone || 'zona'}): +$${(ord.deliveryCost || 0).toFixed(2)}`
                    : '';
                const commLine = ord.commission && ord.commission.amount > 0
                    ? `\nComisión: +$${ord.commission.type === 'percent' ? (ord.subtotal * ord.commission.amount / 100).toFixed(2) : ord.commission.amount.toFixed(2)}`
                    : '';
                const items = ord.items.map(i => `  • ${i.quantity}x ${i.name} - $${(i.price * i.quantity).toFixed(2)}`).join('\n');
                msg = `¡Hola *${ord.customerId ? ord.customerId.name : (ord.customerName || 'Cliente')}*! Aquí tienes el detalle de tu pedido en *${settings.settings.value.appName || 'Tengo Hambre'}*.✅\n\n`;
                msg += `📦 *Folio:* #${ord._id.slice(-6).toUpperCase()}\n`;
                msg += `📅 *Fecha:* ${new Date(ord.createdAt).toLocaleString()}\n`;
                msg += `💳 *Método de pago:* ${ord.paymentMethod}\n${deliverySection}\n\n`;
                msg += `🛒 *Productos:*\n${items}\n\n`;
                msg += `💰 *SubTotal:* $${(ord.subtotal || 0).toFixed(2)}${commLine}${deliveryCostLine}\n`;
                msg += `⭐ *TOTAL: $${ord.total.toFixed(2)}*\n\n`;
                msg += `🙏 ¡Gracias por tu preferencia!`;
            } else {
                // Usar la lógica de mensaje de useQuotes
                msg = decodeURIComponent(quotes.sendWhatsApp());
            }

            const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
            showShareModal.value = false;
        };

        // Gestion de cajas
        const closeFinanceShift = () => {
            finance.closeAmount.value = 0;
            finance.closeRecounts.debit = 0;
            finance.closeRecounts.credit = 0;
            finance.closeRecounts.transfer = 0;
            finance.showCloseModal.value = true;
        }

        // --- FUNCIÓN: PROCESAR VENTA Y ABRIR TICKET ---
        const finishSale = async () => {
            await pos.processSale(finance)
            // Si el modal de pago se cierra, asumimos éxito
            if (!pos.showPayModal.value) {
                setTimeout(async () => {
                    // Buscar la última orden para imprimir su ticket
                    await orders.fetchOrders();
                    const lastOrder = orders.ordersList.value[0];
                    console.log(lastOrder);

                    if (lastOrder) {
                        ticketData.value = {
                            id : lastOrder._id,
                            origin: 'pos',
                            folio: lastOrder._id.slice(-6).toUpperCase(),
                            customer: lastOrder.customerId ? lastOrder.customerId.name : 'Mostrador',
                            total: lastOrder.total,
                            subtotal: lastOrder.subtotal,
                            commission: lastOrder.commission,
                            tax: lastOrder.tax,
                            method: lastOrder.paymentMethod,
                            items: lastOrder.items.map(i => ({ qty: i.quantity, name: i.name, price: i.price }))
                        };
                        showTicketModal.value = true;
                    }
                }, 500); // Pequeño delay para asegurar que BD actualizó
            }
        };

        /** Coberturas y DeliveryZones */
        const toggleMunicipio = (id) => {
            const idx = settings.settings.value.deliveryZones.indexOf(id);
            if (idx === -1) settings.settings.value.deliveryZones.push(id);
            else settings.settings.value.deliveryZones.splice(idx, 1);
        };


        // --- GOOGLE PLACES AUTOCOMPLETE para Modal SaaS ---
        let _saasAutocomplete = null;

        const initSaasPlaces = () => {
            if (!window.google || !window.google.maps) return;
            const input = document.getElementById('saas-address-input');
            if (!input || _saasAutocomplete) return;

            _saasAutocomplete = new window.google.maps.places.Autocomplete(input, {
                types: ['establishment', 'geocode'],
                fields: ['formatted_address', 'geometry']
            });

            _saasAutocomplete.addListener('place_changed', () => {
                const place = _saasAutocomplete.getPlace();
                if (!place.geometry) return;
                saas.saasForm.value.address = place.formatted_address;
                saas.saasForm.value.lat = place.geometry.location.lat();
                saas.saasForm.value.lng = place.geometry.location.lng();
            });
        };

        watch(saas.showSaasModal, (val) => {
            if (val) {
                _saasAutocomplete = null; // Reset para reinicializar
                nextTick(() => {
                    if (window._googlePlacesReady) {
                        initSaasPlaces();
                    } else {
                        document.addEventListener('google-places-ready', initSaasPlaces, { once: true });
                    }
                });
            }
        });

        // --- GOOGLE PLACES AUTOCOMPLETE para Vista SETTINGS ---
        let _settingsAutocomplete = null;

        const initSettingsPlaces = () => {
            if (!window.google || !window.google.maps) return;
            const input = document.getElementById('settings-address-input');
            if (!input || _settingsAutocomplete) return;

            _settingsAutocomplete = new window.google.maps.places.Autocomplete(input, {
                types: ['establishment', 'geocode'],
                fields: ['formatted_address', 'geometry']
            });

            _settingsAutocomplete.addListener('place_changed', () => {
                const place = _settingsAutocomplete.getPlace();
                if (!place.geometry) return;
                settings.settings.value.address = place.formatted_address;
                settings.settings.value.lat     = place.geometry.location.lat();
                settings.settings.value.lng     = place.geometry.location.lng();
            });
        };

        watch(currentView, (val) => {
            if (val === 'settings') {
                _settingsAutocomplete = null; // Reset al entrar a la vista
                nextTick(() => {
                    if (window._googlePlacesReady) {
                        initSettingsPlaces();
                    } else {
                        document.addEventListener('google-places-ready', initSettingsPlaces, { once: true });
                    }
                });
            }
        });

        onMounted(async () => {
            auth.checkSession();
            const path = window.location.pathname; // Ej: /admin/pos
            // Extraer la última parte de la URL
            const parts = path.split('/').filter(p => p);
            const lastPart = parts[parts.length - 1]; // "pos"
            kds.stopPolling();

            if (auth.isAuthenticated.value) {
                const savedRole = localStorage.getItem('role');
                if (savedRole) currentUserRole.value = savedRole;
                await settings.fetchSettings();
                await finance.fetchCurrentStatus();
                await finance.fetchHistory();
                if (currentUserRole.value === 'superadmin') {
                    const found = saasMenu.value.find(i => i.view === lastPart);
                    if (found) {
                        currentView.value = found.view;
                    }
                    // Si recargamos y estamos en dashboard, mover a saas
                    if (currentView.value === 'dashboard') currentView.value = 'saas_clients';
                    // Cargar datos según la vista inicial
                    if (currentView.value === 'saas_clients') saas.fetchBusinesses();
                    if (currentView.value === 'ads') banners.fetchBanners();
                    if (currentView.value === 'media') media.fetchMedia();
                    if (currentView.value === 'settings') settings.fetchSettings();
                    if (currentView.value === 'municipios') municipios.fetchMunicipios();
                    if (currentView.value === 'categoriesStore') categoriesStore.fetchCategories();
                } else {
                    // Si la URL es solo /admin, vamos al dashboard
                    if (path.endsWith('/admin') || path.endsWith('/admin/')) {
                        currentView.value = 'dashboard';
                    } else {
                        // Buscar si existe una vista con ese nombre
                        const found = businessMenu.value.find(i => i.view === lastPart);

                        if (lastPart == 'pos') {
                            if (settings.settings.value.plan == 'free') {
                                const Toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 3500 });
                                Toast.fire({ icon: 'error', title: 'Sección Bloqueada', text: "Por favor activa un plan PRO" });
                                currentView.value = "dashboard";
                                // 1. CAMBIAR LA URL VISUALMENTE
                                const newUrl = `/admin/dashboard`;
                                window.history.pushState({ view: currentView.value }, '', newUrl);
                            } else {
                                currentView.value = 'pos';
                            }
                        } else {
                            if (found) {
                                if (found.locked == undefined) {
                                    currentView.value = found.view;
                                } else {
                                    const Toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 3500 });
                                    Toast.fire({ icon: 'error', title: 'Sección Bloqueada', text: "Por favor activa un plan PRO" });
                                    currentView.value = "dashboard";
                                    // 1. CAMBIAR LA URL VISUALMENTE
                                    const newUrl = `/admin/dashboard`;
                                    window.history.pushState({ view: currentView.value }, '', newUrl);
                                }
                            } else {
                                // Buscamos por children
                                const childrenFound = businessMenu.value.find(c => c.children && c.children.find(cx => cx.view === lastPart));
                                if (childrenFound) {
                                    const child = childrenFound.children.find(cx => cx.view === lastPart);
                                    if (child) {
                                        currentView.value = child.view
                                        toggleSubmenu(childrenFound)
                                    };
                                }
                            }
                        }


                        // Cargar datos iniciales de negocio
                        if (currentView.value === 'pos') {
                            products.fetchProducts();
                            if (window.innerWidth < 768) {
                                mobileMenuOpen.value = false;
                                collapsed.value = false;
                            } else {
                                mobileMenuOpen.value = true;
                                collapsed.value = true;
                            }
                        }
                        if (currentView.value === 'dashboard') analytics.fetchDashboardStats();
                        if (currentView.value === 'media') media.fetchMedia();
                        if (currentView.value === 'ads') { banners.isUploadingBanner.value = false; banners.fetchBanners(); }
                        if (currentView.value === 'loyalty') useloyalty.fetchProgram();
                        if (currentView.value === 'products') products.isUploadingProductImg.value = false; products.fetchProducts();
                        if (currentView.value === 'addons') addons.fetchAddons();
                        if (currentView.value === 'categories') categories.isUploadingCatImg.value = false; categories.fetchCategories();
                        if (currentView.value === 'orders') orders.fetchOrders();
                        if (currentView.value === 'finance') {
                            finance.fetchCurrentStatus();
                            finance.fetchHistory();
                        }
                        if (currentView.value === 'users') users.fetchUsers();
                        if (currentView.value === 'settings') {
                            settings.fetchSettings(); // <-- Obenemos configuracion
                            municipios.fetchMunicipios(); // <-- Obtenemos Colonias
                            categoriesStore.fetchCategories(); // <-- Obtenemos categorias
                            settings.scanPrinters(); // <-- Buscamos impresoras
                        }
                        if (currentView.value === 'quotes') quotes.fetchQuotes();
                        if (currentView.value === 'kds') {
                            kds.startPolling();
                            if (window.innerWidth < 768) {
                                mobileMenuOpen.value = false;
                                collapsed.value = false;
                            } else {
                                mobileMenuOpen.value = true;
                                collapsed.value = true;
                            }
                        }

                    }
                }
            }
        });


        // 4. MANEJAR BOTÓN "ATRÁS" DEL NAVEGADOR
        window.onpopstate = (event) => {
            if (event.state && event.state.view) {
                currentView.value = event.state.view;
            } else {
                // Fallback si no hay estado (ej: volver al inicio)
                currentView.value = 'dashboard';
            }
        };

        // Función para abrir la PWA
        const openPWA = () => {
            if (settings.settings.value && settings.settings.value.slug) {
                const url = '/' + settings.settings.value.slug;
                window.open(url, '_blank', 'width=400,height=850,scrollbars=yes,resizable=yes');
            } else {
                alert('El slug del negocio no está configurado');
            }
        };

        return {
            collapsed, mobileMenuOpen, currentView,
            activeMenuItems, currentUserRole,
            openPWA,
            toggleSidebar, navigate, toggleSubmenu,
            ...analytics, // Analitica general
            ...settings, // Configuraciones
            ...auth,   // isAuthenticated, username, login, logout, Theme...
            ...media,  // mediaFiles, uploadFile, deleteFile...
            ...banners, // banners, saveBanner...
            ...products, // products, saveProduct...
            ...categories, // categoriesList, saveCategory...
            ...addons, // addonsList, saveAddon, addOptionRow...
            ...saas, // Multinegocios (spread para compatibilidad existente)
            saas,   // Expuesto como objeto para nuevas funcionalidades (ventas por negocio)
            ...useloyalty, // Loyalty
            ...municipios,
            toggleMunicipio,
            kds, // KDS Expuesto
            // POS
            pos, showItemDetailsModal, selectedCartItem, openItemDetails,
            selectedItemAddonGroups, selectedItemUnitPrice, toggleAddonOption, isOptionSelected,
            users,
            finance, closeFinanceShift, // Exportar
            orders,
            quotes,
            saveQuote,
            viewListQuotes,
            viewListOrders,
            downloadSalesExcel, generatePDF,
            startNewQuote, editQuote, convertQuoteToSale, openQuoteShare,
            showShareModal, sharePhone, sharePrefix, openShareModal, confirmShare,
            showDiscountModal, tempDiscount, openDiscountModal, confirmDiscount,
            // Impresion de Tickets
            showTicketModal, ticketData, openTicketPreview, printTicketNow, finishSale,
            categoriesStore,
            toggleCategory,
            blog
        };
    }
}).mount('#app');