
/**
 * Pequeña utilidad para hacer peticiones autenticadas 
 * De manera global
 */
export async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    
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
        localStorage.removeItem('token');
        window.location.reload(); // Mandar al login
        throw new Error('Sesión expirada');
    }

    return response;
}