import { ref } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useSettings(auth) {
    const settings = ref({
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
        // Categorías seleccionadas por el negocio
        categories: []
    });
    
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
        settings.value = [];
        // 1. Configuración General (Pública/Global)
        try {
            const res = await authFetch('/api/config/admin');
            if (res.ok) {
                const data = await res.json();
                // Mezclamos la respuesta con el estado actual
                settings.value = { ...settings.value, ...data };
                // Asegurar que exista el array de categorias
                if (!Array.isArray(settings.value.categories)) settings.value.categories = [];
                console.log("Configuraciones: ", settings.value)
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
                toastr.success('Configuración guardada correctamente');
            }
        } catch (e) { toastr.error('Error al guardar'); }
    };

    const saveProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            
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
                if(data.user && data.user.username) {
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
        } catch (e) {
            toastr.error(e.message || 'Error al actualizar perfil');
        }
    };

    return {
        settings,
        profile,
        isUploadingAvatar, // Exportar estado
        avatarInput,       // Exportar ref
        fetchSettings,
        uploadAvatar,      // Exportar función
        saveSettings,
        saveProfile
    };
}