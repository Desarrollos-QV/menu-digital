import { ref, computed } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch
import { usePrinter } from './usePrinter.js';

export function useSettings(auth) {
    const printerManager = usePrinter();
    const settings = ref({
        saving: false,
        role: '', // Para saber qué campos mostrar
        appName: '',
        adminName: '',
        address: '',
        plan: 'free',
        // Campos Negocio
        avatar: '',
        phone: '',
        ownerEmail: '',
        primaryColor: '#6366f1',
        urlApp: '',
        currency: 'MXN',
        iva: 0,
        slug: '',
        // Ubicación GPS
        lat: null,
        lng: null,
        // Tipos de servicio
        allowDelivery: true,
        allowPickup: false,
        // Categorías seleccionadas por el negocio - INICIALIZADO COMO ARRAY VACÍO
        categories: [],
        // Configuraciones de horario y entrega
        municipioId: '', // <-- Nuevo: Un solo municipio
        deliveryZones: [], // Zonas de entrega (Colonias IDs)
        // Configuraciones de horario y entrega
        time: '',
        deliveryCost: 0,
        isOpen: true,
        // Horarios de atención
        schedule: [
            { day: 'Lunes', open: '09:00', close: '22:00', isOpen: true },
            { day: 'Martes', open: '09:00', close: '22:00', isOpen: true },
            { day: 'Miércoles', open: '09:00', close: '22:00', isOpen: true },
            { day: 'Jueves', open: '09:00', close: '22:00', isOpen: true },
            { day: 'Viernes', open: '09:00', close: '23:00', isOpen: true },
            { day: 'Sábado', open: '10:00', close: '23:00', isOpen: true },
            { day: 'Domingo', open: '10:00', close: '21:00', isOpen: true }
        ],
        // Comisiones
        commissionPosType: 'percent',
        commissionPosAmount: 0
        
    });
     
    const printerName = ref(localStorage.getItem('fudi_printer_name') || '');
    const availablePrinters = ref([]);
    const scanningPrinters = ref(false);
    // Agregamos email al estado
    const profile = ref({
        username: '',
        email: '', 
        newPassword: ''
    });

    // Estado para el loader del avatar
    const isUploadingAvatar = ref(false);
    const avatarInput = ref(null);

    const fetchSettings = async () => {
        // 1. Configuración General (Pública/Global)
        try {
            const res = await authFetch('/api/config/admin');
            if (res.ok) {
                const data = await res.json(); 
                // Mezclamos la respuesta con el estado actual
                settings.value = { ...settings.value, ...data }; 
                // Asegurar que existan los arrays requeridos
                if (!Array.isArray(settings.value.categories)) settings.value.categories = [];
                if (!Array.isArray(settings.value.deliveryZones)) settings.value.deliveryZones = []; 
                if (!Array.isArray(settings.value.schedule) || settings.value.schedule.length === 0) {
                    settings.value.schedule = [
                        { day: 'Lunes', open: '09:00', close: '22:00', isOpen: true },
                        { day: 'Martes', open: '09:00', close: '22:00', isOpen: true },
                        { day: 'Miércoles', open: '09:00', close: '22:00', isOpen: true },
                        { day: 'Jueves', open: '09:00', close: '22:00', isOpen: true },
                        { day: 'Viernes', open: '09:00', close: '23:00', isOpen: true },
                        { day: 'Sábado', open: '10:00', close: '23:00', isOpen: true },
                        { day: 'Domingo', open: '10:00', close: '21:00', isOpen: true }
                    ];
                }
            }
        } catch (e) { console.error(e); }
        
        // 2. Datos del Perfil (Privado)
        try {
            const token = localStorage.getItem('token');
            const res = await authFetch('/api/auth/me');
            
            if (res.ok) {
                const userData = await res.json();
                profile.value.username = userData.username;
                profile.value.email = userData.email || '';
            }
        } catch (e) { console.error("Error cargando perfil", e); }

        profile.value.username = localStorage.getItem('username') || '';
    };

    // --- LÓGICA DE ZONAS DE ENTREGA (NUEVO REQUERIMIENTO) ---
    const showColoniasModal = ref(false);
    const currentMunicipio = ref(null);

    const openColoniasModal = (municipio) => {
        // Al abrir, seteamos el municipio actual para mostrar sus colonias
        currentMunicipio.value = municipio;
        
        // Si el municipio seleccionado es diferente al guardado, advertimos o limpiamos
        // PERO, solo guardamos el cambio cuando el usuario confirma o selecciona.
        // En este enfoque, al abrir el modal, simplemente mostramos las colonias.
        
        showColoniasModal.value = true;
    };

    const closeColoniasModal = () => {
        showColoniasModal.value = false;
        currentMunicipio.value = null;
    };

    const selectMunicipio = (municipioId) => {
        // Si cambia el municipio, limpiamos las colonias anteriores
        if (settings.value.municipioId !== municipioId) {
            settings.value.municipioId = municipioId;
            settings.value.deliveryZones = []; // Limpiar colonias de otro municipio
        }
    };

    // Extraer el ID seguro contemplando el casteo antiguo raw de MongoDB
    const getActualId = (z) => {
        if (!z) return null;
        if (z.buffer && Array.isArray(z.buffer.data)) {
            return z.buffer.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
        }
        return (z.coloniaId?._id || z.coloniaId || z._id || z)?.toString();
    };

    // Verificar si una colonia está seleccionada
    const isColoniaSelected = (coloniaId) => {
        const id = coloniaId?.toString();
        return settings.value.deliveryZones.some(z => getActualId(z) === id);
    };

    // Obtener el costo de envío de una colonia seleccionada
    const getColoniaCost = (coloniaId) => {
        const id = coloniaId?.toString();
        const zone = settings.value.deliveryZones.find(z => getActualId(z) === id);
        return zone ? (zone.deliveryCost ?? 0) : 0;
    };

    // Actualizar el costo de una colonia ya seleccionada
    const updateColoniaCost = (coloniaId, cost) => {
        const id = coloniaId?.toString();
        const zone = settings.value.deliveryZones.find(z => getActualId(z) === id);
        if (zone) zone.deliveryCost = parseFloat(cost) || 0;
    };

    const toggleColoniaZone = (coloniaId) => {
        const id = coloniaId?.toString();
        const idx = settings.value.deliveryZones.findIndex(z => getActualId(z) === id);
        if (idx === -1) {
            settings.value.deliveryZones.push({ coloniaId, deliveryCost: 0 });
        } else {
            settings.value.deliveryZones.splice(idx, 1);
        }
    };

    const toggleColonia = (id) => toggleColoniaZone(id);

    const scanPrinters = async () => {
        scanningPrinters.value = true;
        
        // Llamamos a la función que acabamos de crear
        const printers = await printerManager.getConnectedPrinters();
        
        if (printers.length > 0) {
            availablePrinters.value = printers;
            if(window.toastr) window.toastr.success(`${printers.length} impresoras encontradas`);
        }
        
        scanningPrinters.value = false;
    };
    
    const saveConfig = () => {
        // Cuando guarden los ajustes, guardas el valor en localStorage
        localStorage.setItem('fudi_printer_name', printerName.value);
        if(window.toastr) window.toastr.success('Impresora guardada');
    };

    // Función para subir el avatar
    const uploadAvatar = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        isUploadingAvatar.value = true;
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Reutilizamos el endpoint de medios que ya creamos
            const res = await authFetch('/api/media', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Error al subir');

            // Asignamos la URL retornada al setting
            settings.value.avatar = data.url;
            toastr.success('Avatar subido correctamente');
            
        } catch (error) {
            toastr.error(error.message);
        } finally {
            isUploadingAvatar.value = false;
            event.target.value = null; // Reset input
        }
    };

    const saveSettings = async () => {
        try {
            const res = await authFetch('/api/config/admin', {
                method: 'POST',
                body: JSON.stringify(settings.value)
            });
            if (res.ok) {
                saveProfile();
                toastr.success('Configuración guardada correctamente');
            }
        } catch (e) { toastr.error('Error al guardar'); }
    };

    const saveProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
            
                const body = { id: payload.id, username: profile.value.username, email: profile.value.email  };
                if (profile.value.newPassword) body.password = profile.value.newPassword;

                const res = await authFetch('/api/auth/update', {
                    method: 'PUT',
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    const data = await res.json();
                    toastr.success('Perfil actualizado.');
                    // Actualizar localstorage si cambió el username
                    if(data.user && data.user.username && auth.username.value != data.user.username ) {
                        auth.username.value = data.user.username;
                        toastr.success('Perfil actualizado. Inicia sesión de nuevo.');
                        localStorage.setItem('username', data.username);
                        auth.logout();
                    }
                    // Limpiar campo password
                    profile.value.newPassword = '';
                } else {
                    throw new Error('Error al actualizar');
                }
            }
        } catch (e) {
            toastr.error(e.message || 'Error al actualizar perfil');
        }
    };

    return {
        settings, 
        toggleColonia, // Mantener por compatibilidad o eliminar si ya no se usa
        showColoniasModal,
        currentMunicipio,
        openColoniasModal,
        closeColoniasModal,
        selectMunicipio,
        toggleColoniaZone,
        isColoniaSelected,
        getColoniaCost,
        updateColoniaCost,
        profile,
        isUploadingAvatar, // Exportar estado
        avatarInput,       // Exportar ref
        fetchSettings,
        uploadAvatar,      // Exportar función
        printerName,
        availablePrinters,
        scanningPrinters,
        scanPrinters,
        saveConfig,
        saveSettings,
        saveProfile
    };
}