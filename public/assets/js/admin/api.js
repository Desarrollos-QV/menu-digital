
import { useAuth } from './useAuth.js';
/**
 * Pequeña utilidad para hacer peticiones autenticadas 
 * De manera global
 */
export async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const auth = useAuth();
    // Configurar headers por defecto
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Si hay token, agregarlo
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Si estamos enviando FormData (archivos), quitamos Content-Type
    // para que el navegador lo ponga automático con el boundary correcto
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Manejo global de error 401 (Token vencido)
    if (response.status === 401) {
        console.warn("Sesión caducada o token inválido. Cerrando sesión...");

        // 1. Limpiar almacenamiento local
        localStorage.clear();
        auth.isAuthenticated.value = false;
        auth.credentials.value = { username: '', password: '' };
        // 2. Redirigir al login (recargando la página para limpiar estado de Vue)
        // Si ya estamos en el login no recargamos para evitar bucles
        if (!window.location.pathname.endsWith('/admin') && window.location.pathname !== '/admin/') {
            window.location.href = '/admin';
        } else {
            // Si estamos en la misma SPA, forzamos recarga para mostrar pantalla de login
            window.location.reload();
        }

        // Retornamos respuesta para que el código que llamó no explote (aunque se redirija)
        return response;
    }

    return response;
}