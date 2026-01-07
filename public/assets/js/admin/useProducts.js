import { ref, computed } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useProducts(isDark, fetchMedia) {
    const products = ref([]);
    const showProductModal = ref(false);
    const editingProduct = ref(null);
    const showMediaSelector = ref(false);

    // Formulario Base
    const defaultForm = {
        name: '', price: 0, description: '', image: '', imageName: '',
        barcode: '',
        stock: 0,
        categories: [], addons: [], active: true,
        isTrending: false 
    };
    const productForm = ref({ ...defaultForm });

    // Listas dinámicas desde BD
    const availableCategories = ref([]);
    const availableAddons = ref([]);
    
    // ------------------------------------------------------------

    // Subida directa desde Modal Producto
    const isUploadingProductImg = ref(false);
    const productFileInput = ref(null);

    // Cargar listas (Categorías y Addons)
    const fetchAuxData = async () => {
        try {
            const [catRes, addRes] = await Promise.all([
                authFetch('/api/categories'),
                authFetch('/api/addons')
            ]);
            
            if(catRes.ok) availableCategories.value = await catRes.json();
            if(addRes.ok) availableAddons.value = await addRes.json();
        } catch (e) {
            console.error("Error cargando dependencias de productos", e);
        }
    };

    const fetchProducts = async () => {
        try {
            // Cargamos auxiliares primero para que la tabla pueda resolver los nombres de categorías
            await fetchAuxData();

            const res = await authFetch('/api/products');
            if (res.ok) products.value = await res.json();
            
        } catch (e) { console.error("Error fetching products", e); }
    };

    const openProductModal = async (prod = null, mediaFilesLength = 0) => {
        editingProduct.value = !!prod;
        
        // Asegurar que tenemos las listas actualizadas al abrir el modal
        if (availableCategories.value.length === 0 || availableAddons.value.length === 0) {
            await fetchAuxData();
        }

        if (prod) {
            // Clonar y asegurar arrays
            productForm.value = { 
                ...prod, 
                categories: prod.categories || [],
                addons: prod.addons || []
            };
        } else {
            productForm.value = { ...defaultForm, categories: [], addons: [] };
        }
        
        showMediaSelector.value = false;
        showProductModal.value = true;
        
        // Cargar librería si está vacía
        if(mediaFilesLength === 0 && fetchMedia) fetchMedia();
    };

    const selectProductImage = (url) => {
        productForm.value.image = url;
        showMediaSelector.value = false;
    };

    const uploadProductImage = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        isUploadingProductImg.value = true;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authFetch('/api/media', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Error al subir');

            toastr.success('Imagen lista');
            if (fetchMedia) await fetchMedia();
            productForm.value.image = data.url;
            productForm.value.imageName = data.name;
            isUploadingProductImg.value = false;
        } catch (error) {
            toastr.error(error.message);
        } finally {
            isUploadingProductImg.value = false;
            event.target.value = null;
        }
    };

    const saveProduct = async () => {
        try {
            const url = editingProduct.value ? `/api/products/${productForm.value._id}` : '/api/products';
            const method = editingProduct.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productForm.value)
            });

            if (!res.ok) throw new Error('Error al guardar producto');

            toastr.success('Producto guardado correctamente');
            showProductModal.value = false;
            await fetchProducts();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    const deleteProduct = async (id) => {
        Swal.fire({
            title: '¿Eliminar Producto?', text: "Esta acción no se puede deshacer", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            background: isDark.value ? '#1e293b' : '#fff', color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Producto eliminado'); await fetchProducts(); }
                } catch (e) { toastr.error('Error al eliminar'); }
            }
        });
    };

    const deleteImagePreviewProd = async () => {
        if (isUploadingProductImg.value == true) {
            try {
                const res = await authFetch(`/api/media/${productForm.value.imageName}`, { method: 'DELETE' });
                if (res.ok) {
                    toastr.success('Imagen eliminada');
                    await fetchMedia();
                } else {
                    throw new Error('Error al eliminar');
                }
            } catch (e) {
                toastr.error(e.message);
            }
        }

        isUploadingProductImg.value = false;
        productForm.value.image = ''
    }

    const getCategoryName = (id) => {
        const cat = availableCategories.value.find(c => c._id === id);
        return cat ? cat.name : 'Sin cat.';
    };

    // --- TRENDING TOP (Nuevo) ---
    const toggleTrending = async (product) => {
        try {
            // Invertimos el estado actual
            const newValue = !product.isTrending;
            
            const res = await authFetch(`/api/products/${product._id}`, {
                method: 'PUT',
                body: JSON.stringify({ isTrending: newValue })
            });

            if (res.ok) {
                toastr.success(newValue ? 'Producto marcado como Trending Top' : 'Producto removido de Trending');
                await fetchProducts(); // Recargar tabla
            }
        } catch (error) {
            toastr.error('Error al actualizar estado');
        }
    };

    return {
        products,
        showProductModal,
        editingProduct,
        productForm,
        showMediaSelector,
        isUploadingProductImg,
        productFileInput,
        availableCategories, // Exportamos para el select
        availableAddons,     // Exportamos para checkboxes
        fetchProducts,
        openProductModal,
        selectProductImage,
        uploadProductImage,
        saveProduct,
        deleteProduct,
        deleteImagePreviewProd,
        getCategoryName,
        toggleTrending
    };
}