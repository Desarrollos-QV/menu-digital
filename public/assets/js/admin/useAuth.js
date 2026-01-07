 import { ref } from 'vue';

export function useAuth() {
    const isAuthenticated = ref(false);
    const username = ref('');
    const credentials = ref({ username: '', password: '' });
    const storedTheme = localStorage.getItem('isDark_cookie');
    const isDark = ref(storedTheme === 'true');


    if (isDark.value) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    const checkSession = () => {
        const token = localStorage.getItem('token');
        if (token) {
            isAuthenticated.value = true;
            username.value = localStorage.getItem('username') || 'Admin';
        }
    };

    const login = async () => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials.value)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            localStorage.setItem('user', JSON.stringify(data));
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            username.value = data.username;
            isAuthenticated.value = true;
            toastr.success(`Bienvenido ${data.username}`, 'Login Exitoso');
        } catch (error) {
            toastr.error(error.message, 'Error');
        }
    };

    const logout = () => {
        Swal.fire({
            title: '¿Salir?', text: "Cerrarás tu sesión actual", icon: 'warning',
            showCancelButton: true, confirmButtonText: 'Sí, salir', confirmButtonColor: '#6366f1',
            background: isDark.value ? '#1e293b' : '#fff', color: isDark.value ? '#fff' : '#000'
        }).then((res) => {
            if (res.isConfirmed) {
                localStorage.clear();
                isAuthenticated.value = false;
                credentials.value = { username: '', password: '' };
                location.reload();
            }
        });
    };

     const toggleTheme = () => {
        isDark.value = !isDark.value;
        
        if (isDark.value) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('isDark_cookie', 'true'); // Guardar preferencia
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('isDark_cookie', 'false'); // Guardar preferencia
        }
    };


    return {
        isAuthenticated,
        username,
        credentials,
        isDark,
        checkSession,
        login,
        logout,
        toggleTheme
    };
}