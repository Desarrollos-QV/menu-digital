// shared-customer.js
// Lógica unificada para el manejo de la cuenta de cliente (sincronizada en todo el sitio)



window.createSharedCustomer = function() {
    const token = ref(localStorage.getItem('th_customer_token') || '');
    const customer = ref(null);
    const addresses = ref([]);
    const cards = ref([]);
    const orders = ref([]);
    const loadingProfile = ref(false);
    
    // Cargar datos del cliente preexistentes si existen
    const storedData = localStorage.getItem('th_customer_data');
    if (storedData) {
        try {
            customer.value = JSON.parse(storedData);
        } catch (e) {
            localStorage.removeItem('th_customer_data');
        }
    }
    
    const setSession = (newToken, newCustomerData) => {
        token.value = newToken;
        customer.value = newCustomerData;
        localStorage.setItem('th_customer_token', newToken);
        localStorage.setItem('th_customer_data', JSON.stringify(newCustomerData));
    };
    
    const clearSession = () => {
        token.value = '';
        customer.value = null;
        addresses.value = [];
        cards.value = [];
        orders.value = [];
        localStorage.removeItem('th_customer_token');
        localStorage.removeItem('th_customer_data');
    };
    
    const apiFetch = async (url, options = {}) => {
        const headers = options.headers || {};
        if (token.value) {
            headers['Authorization'] = `Bearer ${token.value}`;
        }
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        });
        if (res.status === 401) {
            clearSession();
            throw new Error('Sesión expirada. Inicia sesión nuevamente.');
        }
        return res;
    };
    
    const login = async (phone, password, slug) => {
        const res = await fetch('/api/loyalty/public/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password, slug })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error de inicio de sesión');
        
        if (data.requirePasswordSetup) {
            return data;
        }

        setSession(data.token, data.customer);
        
        // Cargar todo lo demás de forma asíncrona
        fetchAddresses().catch(console.error);
        fetchCards().catch(console.error);
        fetchOrders().catch(console.error);
        
        return data;
    };
    
    const setupPassword = async (phone, pin, password, email) => {
        const res = await fetch('/api/loyalty/public/setup-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, pin, password, email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al configurar contraseña');
        
        setSession(data.token, data.customer);
        
        fetchAddresses().catch(console.error);
        fetchCards().catch(console.error);
        fetchOrders().catch(console.error);
        
        return data;
    };
    
    const register = async (name, phone, email, password, slug) => {
        const res = await fetch('/api/loyalty/public/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, password, slug })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al registrarse');
        setSession(data.token, data.customer);
        return data;
    };
    
    const fetchProfile = async () => {
        if (!token.value) return;
        const res = await apiFetch('/api/customer/profile');
        if (res.ok) {
            const data = await res.json();
            customer.value = data;
            localStorage.setItem('th_customer_data', JSON.stringify(data));
        }
    };
    
    const updateProfile = async (profileData) => {
        const res = await apiFetch('/api/customer/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al actualizar perfil');
        customer.value = data.customer;
        localStorage.setItem('th_customer_data', JSON.stringify(data.customer));
        return data;
    };
    
    const uploadAvatar = async (file) => {
        const formData = new FormData();
        formData.append('avatar', file);
        
        const res = await fetch('/api/customer/profile/avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token.value}`
            },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al subir avatar');
        
        customer.value.avatar = data.avatar;
        localStorage.setItem('th_customer_data', JSON.stringify(customer.value));
        return data;
    };
    
    const fetchAddresses = async () => {
        if (!token.value) return;
        const res = await apiFetch('/api/customer/addresses');
        if (res.ok) {
            addresses.value = await res.json();
        }
    };
    
    const saveAddress = async (addressData) => {
        const isEdit = !!addressData._id;
        const url = isEdit ? `/api/customer/addresses/${addressData._id}` : '/api/customer/addresses';
        const method = isEdit ? 'PUT' : 'POST';
        
        const res = await apiFetch(url, {
            method,
            body: JSON.stringify(addressData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al guardar dirección');
        await fetchAddresses();
        return data;
    };
    
    const deleteAddress = async (addressId) => {
        const res = await apiFetch(`/api/customer/addresses/${addressId}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Error al eliminar dirección');
        }
        await fetchAddresses();
    };
    
    const fetchCards = async () => {
        if (!token.value) return;
        const res = await apiFetch('/api/customer/cards');
        if (res.ok) {
            cards.value = await res.json();
        }
    };
    
    const getSetupIntent = async () => {
        const res = await apiFetch('/api/customer/cards/setup-intent', {
            method: 'POST'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Error al iniciar guardado de tarjeta');
        return data.clientSecret;
    };
    
    const deleteCard = async (paymentMethodId) => {
        const res = await apiFetch(`/api/customer/cards/${paymentMethodId}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Error al eliminar tarjeta');
        }
        await fetchCards();
    };
    
    const fetchOrders = async () => {
        if (!token.value) return;
        const res = await apiFetch('/api/customer/orders');
        if (res.ok) {
            orders.value = await res.json();
        }
    };
    
    // Carga inicial si hay sesión activa al montar
    if (token.value) {
        fetchProfile().catch(console.error);
        fetchAddresses().catch(console.error);
        fetchCards().catch(console.error);
        fetchOrders().catch(console.error);
    }
    
    return {
        token,
        customer,
        addresses,
        cards,
        orders,
        login,
        setupPassword,
        register,
        logout: clearSession,
        fetchProfile,
        updateProfile,
        uploadAvatar,
        fetchAddresses,
        saveAddress,
        deleteAddress,
        fetchCards,
        getSetupIntent,
        deleteCard,
        fetchOrders
    };
};
