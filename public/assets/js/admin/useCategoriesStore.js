import { ref, reactive, computed } from 'vue';
import { authFetch } from './api.js';

export function useCategoriesStore(isDark) {
    const categories = reactive({ loading: false, list: [] });
    const categorySearch = ref('');
    const showCategoryModal = ref(false);
    const editingCategory = ref(null);
    const categoryForm = ref({ name: '', emoji: '🍔', active: true });

    const localCategoriesBackup = [
        { id: 'burgers', name: 'Hamburguesas', emoji: '🍔' },
        { id: 'pizza', name: 'Pizza', emoji: '🍕' },
        { id: 'sushi', name: 'Sushi', emoji: '🍣' },
        { id: 'tacos', name: 'Tacos', emoji: '🌮' },
        { id: 'mexican', name: 'Mexicana', emoji: '🌶️' },
        { id: 'wings', name: 'Alitas', emoji: '🍗' },
        { id: 'italian', name: 'Italiana', emoji: '🍝' },
        { id: 'chinese', name: 'China', emoji: '🥡' },
        { id: 'seafood', name: 'Mariscos', emoji: '🍤' },
        { id: 'chicken', name: 'Pollo', emoji: '🐓' },
        { id: 'coffee', name: 'Café', emoji: '☕' },
        { id: 'bakery', name: 'Panadería', emoji: '🥐' },
        { id: 'dessert', name: 'Postres', emoji: '🍰' },
        { id: 'healthy', name: 'Saludable', emoji: '🥗' },
        { id: 'vegan', name: 'Vegana', emoji: '🌱' },
        { id: 'bar', name: 'Bebidas', emoji: '🍺' },
        { id: 'breakfast', name: 'Desayunos', emoji: '🍳' },
        { id: 'fastfood', name: 'Rápida', emoji: '🍟' }
    ];

    const fetchCategories = async () => {
        categories.loading = true;
        try {
            const res = await authFetch('/api/categoriesStore');
            if (res.ok) {
                categories.list = await res.json();
            }
        } catch (e) {
            console.error("Error fetching global categories", e);
            if (window.toastr) toastr.error('Error al cargar categorías globales');
        } finally {
            categories.loading = false;
        }
    };

    const filteredCategories = computed(() => {
        if (!categorySearch.value) return categories.list;
        const q = categorySearch.value.toLowerCase();
        return categories.list.filter(c => c.name.toLowerCase().includes(q));
    });

    const openCategoryModal = (category = null) => {
        if (category) {
            editingCategory.value = { ...category };
            categoryForm.value = { ...category };
        } else {
            editingCategory.value = null;
            categoryForm.value = { name: '', emoji: '🍔', active: true };
        }
        showCategoryModal.value = true;
    };

    const closeCategoryModal = () => {
        showCategoryModal.value = false;
        categoryForm.value = { name: '', emoji: '🍔', active: true };
        editingCategory.value = null;
    };

    const saveCategory = async () => {
        try {
            if (!categoryForm.value.name.trim()) {
                if (window.toastr) toastr.warning('El nombre es requerido');
                return;
            }

            const url = editingCategory.value 
                ? `/api/categoriesStore/${categoryForm.value._id}` 
                : '/api/categoriesStore';
            const method = editingCategory.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryForm.value)
            });

            if (!res.ok) throw new Error('Error al guardar categoría');

            if (window.toastr) toastr.success(editingCategory.value ? 'Categoría actualizada' : 'Categoría creada');
            closeCategoryModal();
            await fetchCategories();
        } catch (e) {
            if (window.toastr) toastr.error(e.message);
        }
    };

    const deleteCategory = async (id) => {
        if (!window.Swal) return;
        
        Swal.fire({
            title: '¿Eliminar Categoría?',
            text: "Los negocios dejarán de ver esta categoría",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, eliminar',
            background: isDark.value ? '#1e293b' : '#fff',
            color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/categoriesStore/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        if (window.toastr) toastr.success('Categoría eliminada');
                        await fetchCategories();
                    } else {
                        throw new Error('Error al eliminar');
                    }
                } catch (e) {
                    if (window.toastr) toastr.error(e.message);
                }
            }
        });
    };
 

    const toggleCategoryActive = async (category) => {
        try {
            const res = await authFetch(`/api/categoriesStore/${category._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...category, active: !category.active })
            });
            if (res.ok) {
                if (window.toastr) toastr.success('Estado actualizado');
                await fetchCategories();
            }
        } catch (e) {
            if (window.toastr) toastr.error('Error al actualizar');
        }
    };

    return {
        categories,
        categorySearch,
        showCategoryModal,
        editingCategory,
        categoryForm,
        fetchCategories,
        filteredCategories,
        openCategoryModal,
        closeCategoryModal,
        saveCategory,
        deleteCategory, 
        toggleCategoryActive
    };
}