import { ref } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useCategories(isDark, fetchMedia) {
    const categoriesList = ref([]);
    const showCategoryModal = ref(false);
    const editingCategory = ref(null);
    const showMediaSelector = ref(false);
    const token = localStorage.getItem('token');

    // Formulario Base
    const defaultForm = { name: '', description: '', image: '', imageName: '', active: true };
    const categoryForm = ref({ ...defaultForm });

    // Subida directa desde Modal
    const isUploadingCatImg = ref(false);
    const categoryFileInput = ref(null);

    const fetchCategories = async () => {
        try {
            const res = await authFetch('/api/categories');
            if (res.ok) categoriesList.value = await res.json();
        } catch (e) { console.error("Error fetching categories", e); }
    };

    const openCategoryModal = (cat = null, mediaFilesLength = 0) => {
        editingCategory.value = !!cat;
        categoryForm.value = cat ? { ...cat } : { ...defaultForm };
        showMediaSelector.value = false;
        showCategoryModal.value = true;

        // Cargar librería si está vacía
        if (mediaFilesLength === 0 && fetchMedia) fetchMedia();
    };

    const selectCategoryImage = (url) => {
        categoryForm.value.image = url;
        showMediaSelector.value = false;
        isUploadingCatImg.value = false;
    };

    const uploadCategoryImage = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        isUploadingCatImg.value = true;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authFetch('/api/media', { method: 'POST', body: formData});
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Error al subir');

            toastr.success('Imagen lista');
            if (fetchMedia) await fetchMedia();
            categoryForm.value.image = data.url;
            categoryForm.value.imageName = data.name;
            isUploadingCatImg.value = false;
        } catch (error) {
            toastr.error(error.message);
        } finally {
            event.target.value = null;
        }
    };

    const saveCategory = async () => {
        try {
            const url = editingCategory.value ? `/api/categories/${categoryForm.value._id}` : '/api/categories';
            const method = editingCategory.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json'},
                body: JSON.stringify(categoryForm.value)
            });

            if (!res.ok) throw new Error('Error al guardar categoría');

            toastr.success('Categoría guardada correctamente');
            showCategoryModal.value = false;
            await fetchCategories();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    const deleteCategory = async (id) => {
        Swal.fire({
            title: '¿Eliminar Categoría?',
            text: "Los productos asociados perderán esta categoría.",
            icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            background: isDark.value ? '#1e293b' : '#fff', color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/categories/${id}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Categoría eliminada'); await fetchCategories(); }
                } catch (e) { toastr.error('Error al eliminar'); }
            }
        });
    };

    const deleteImagePreviewCats = async () => {
        if (isUploadingCatImg.value == true) {
            try {
                const res = await authFetch(`/api/media/${categoryForm.value.imageName}`, { method: 'DELETE' });
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

        isUploadingCatImg.value = false;
        categoryForm.value.image = ''
    }

    return {
        categoriesList, // Renombramos para evitar conflicto con la vista mock anterior
        showCategoryModal,
        editingCategory,
        categoryForm,
        showMediaSelector,
        isUploadingCatImg,
        categoryFileInput,
        fetchCategories,
        openCategoryModal,
        selectCategoryImage,
        uploadCategoryImage,
        saveCategory,
        deleteCategory,
        deleteImagePreviewCats
    };
}