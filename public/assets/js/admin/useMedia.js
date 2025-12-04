import { ref, computed } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useMedia(isDark) { // Recibimos isDark para las alertas
    const mediaFiles = ref([]);
    const isUploading = ref(false);
    const fileInput = ref(null);
    const mediaFilters = ref({ search: '', type: 'all', date: '' });
    const token = localStorage.getItem('token');

    const fetchMedia = async () => {
        try {
            const res = await authFetch('/api/media');
            if (res.ok) mediaFiles.value = await res.json();
        } catch (error) { console.error("Error fetching media", error); }
    };

    // --- Helpers de Filtros ---
    const isVideo = (name) => /\.(mp4|webm|ogg|mov)$/i.test(name);
    const isImage = (name) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
    const getDateFromFilename = (filename) => {
        const parts = filename.split('-');
        if (parts.length > 0 && !isNaN(parseInt(parts[0]))) return new Date(parseInt(parts[0])).toISOString().split('T')[0];
        return null;
    };

    const filteredMedia = computed(() => {
        return mediaFiles.value.filter(file => {
            const matchesSearch = file.name.toLowerCase().includes(mediaFilters.value.search.toLowerCase());
            let matchesType = true;
            if (mediaFilters.value.type === 'image') matchesType = isImage(file.name);
            if (mediaFilters.value.type === 'video') matchesType = isVideo(file.name);
            let matchesDate = true;
            if (mediaFilters.value.date) matchesDate = getDateFromFilename(file.name) === mediaFilters.value.date;
            return matchesSearch && matchesType && matchesDate;
        });
    });

    const clearMediaFilters = () => mediaFilters.value = { search: '', type: 'all', date: '' };

    // --- Acciones ---
    const uploadFile = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        isUploading.value = true;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await authFetch('/api/media', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Error al subir');
            toastr.success('Archivo subido');
            await fetchMedia();
        } catch (error) { toastr.error(error.message); }
        finally { isUploading.value = false; event.target.value = null; }
    };

    const deleteFile = async (filename) => {
        Swal.fire({
            title: '¿Eliminar archivo?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444',
            background: isDark.value ? '#1e293b' : '#fff', color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/media/${filename}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Eliminado'); await fetchMedia(); }
                } catch (e) { toastr.error('Error'); }
            }
        });
    };

    const copyToClipboard = (url) => {
        navigator.clipboard.writeText(window.location.origin + url).then(() => toastr.info('URL copiada'));
    };

    return {
        mediaFiles,
        isUploading,
        fileInput,
        mediaFilters,
        filteredMedia,
        fetchMedia,
        uploadFile,
        deleteFile,
        copyToClipboard,
        clearMediaFilters,
        isVideo
    };
}