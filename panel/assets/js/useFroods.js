import { ref } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useFroods(isDark, fetchMedia) { // Recibimos fetchMedia para refrescar librería al subir
    const froods = ref([]);
    const showFroodModal = ref(false);
    const editingFrood = ref(null);
    const showMediaSelectorFrood = ref(false);
    const froodForm = ref({ title: '', description: '', videoUrl: '', thumbnailUrl: '', active: true });

    // Upload directo desde frood
    const isUploadingFroodMedia = ref(false);
    const mediaTypeUploading = ref(''); // 'video' o 'image'

    const fetchFroods = async () => {
        try {
            const res = await authFetch('/api/froods');
            if (res.ok) froods.value = await res.json();
        } catch (e) { console.error("Error fetching froods", e); }
    };

    const openFroodModal = (frood = null, mediaFilesLength = 0) => {
        editingFrood.value = !!frood;

        froodForm.value = frood
            ? { ...frood }
            : { title: '', description: '', videoUrl: '', thumbnailUrl: '', active: true };
        showMediaSelectorFrood.value = false;
        showFroodModal.value = true;

        // Si la librería está vacía, intentamos cargarla (llamando a la función externa)
        if (mediaFilesLength === 0 && fetchMedia) fetchMedia();
    };

    const selectFroodMedia = (url) => {
        if (mediaTypeUploading.value === 'video') {
            froodForm.value.videoUrl = url;
        } else {
            froodForm.value.thumbnailUrl = url;
        }
        showMediaSelectorFrood.value = false;
    };

    const uploadFroodMedia = async (event, type) => {
        const file = event.target.files[0];
        if (!file) return;

        isUploadingFroodMedia.value = true;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authFetch('/api/media', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Error al subir');

            toastr.success('Archivo subido y seleccionado');
            if (fetchMedia) await fetchMedia(); // Refrescamos librería global
            
            if (type === 'video') {
                froodForm.value.videoUrl = data.url;
            } else {
                froodForm.value.thumbnailUrl = data.url;
            }

        } catch (error) {
            toastr.error(error.message);
        } finally {
            event.target.value = null;
            isUploadingFroodMedia.value = false;
        }
    };

    const saveFrood = async () => {
        try {
            const url = editingFrood.value ? `/api/froods/${froodForm.value._id}` : '/api/froods';
            const method = editingFrood.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(froodForm.value)
            });

            if (!res.ok) throw new Error('Error al guardar Frood');

            toastr.success('Frood guardado correctamente');
            showFroodModal.value = false;
            await fetchFroods();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    const deleteFrood = async (id) => {
        Swal.fire({
            title: '¿Eliminar Frood?', text: "Se dejará de mostrar en la app", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            background: isDark.value ? '#1e293b' : '#fff', color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/froods/${id}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Frood eliminado'); await fetchFroods(); }
                } catch (e) { toastr.error('Error al eliminar'); }
            }
        });
    };

    const deleteMediaPreviewFrood = async (type) => {
        // En una implementación real eliminaría el archivo físico.
        if (type === 'video') {
            froodForm.value.videoUrl = '';
        } else {
            froodForm.value.thumbnailUrl = '';
        }
    }

    return {
        froods,
        showFroodModal,
        editingFrood,
        froodForm,
        showMediaSelectorFrood,
        isUploadingFroodMedia,
        mediaTypeUploading,
        fetchFroods,
        openFroodModal,
        selectFroodMedia,
        uploadFroodMedia,
        saveFrood,
        deleteFrood,
        deleteMediaPreviewFrood
    };
}
