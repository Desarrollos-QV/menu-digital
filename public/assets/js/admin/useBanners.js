import { ref } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useBanners(isDark, fetchMedia) { // Recibimos fetchMedia para refrescar librería al subir
    const banners = ref([]);
    const showBannerModal = ref(false);
    const editingBanner = ref(null);
    const showMediaSelector = ref(false);
    const bannerForm = ref({ title: '', description: '', imageUrl: '', active: true, expiresAt: '' });

    // Upload directo desde banner
    const isUploadingBanner = ref(false);
    const bannerFileInput = ref(null);

    const fetchBanners = async () => {
        try {
            const res = await authFetch('/api/banners');
            if (res.ok) banners.value = await res.json();
        } catch (e) { console.error("Error fetching banners", e); }
    };

    const openBannerModal = (banner = null, mediaFilesLength = 0) => {
        editingBanner.value = !!banner;
        let dateStr = '';
        if (banner && banner.expiresAt) {
            dateStr = new Date(banner.expiresAt).toISOString().split('T')[0];
        }

        bannerForm.value = banner
            ? { ...banner, expiresAt: dateStr }
            : { title: '', description: '', imageUrl: '', active: true, expiresAt: '' };
        showMediaSelector.value = false;
        showBannerModal.value = true;

        // Si la librería está vacía, intentamos cargarla (llamando a la función externa)
        if (mediaFilesLength === 0 && fetchMedia) fetchMedia();
    };

    const selectBannerImage = (url) => {
        bannerForm.value.imageUrl = url;
        showMediaSelector.value = false;
    };

    const uploadBannerImage = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        isUploadingBanner.value = true;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authFetch('/api/media', { method: 'POST', body: formData });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Error al subir');

            toastr.success('Imagen subida y seleccionada');
            if (fetchMedia) await fetchMedia(); // Refrescamos librería global
            bannerForm.value.imageUrl = data.url;

        } catch (error) {
            toastr.error(error.message);
        } finally {
            event.target.value = null;
        }
    };

    const saveBanner = async () => {
        try {
            const url = editingBanner.value ? `/api/banners/${bannerForm.value._id}` : '/api/banners';
            const method = editingBanner.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bannerForm.value)
            });

            if (!res.ok) throw new Error('Error al guardar banner');

            toastr.success('Banner guardado correctamente');
            showBannerModal.value = false;
            await fetchBanners();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    const deleteBanner = async (id) => {
        Swal.fire({
            title: '¿Eliminar Banner?', text: "Se dejará de mostrar en la app", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            background: isDark.value ? '#1e293b' : '#fff', color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/banners/${id}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Banner eliminado'); await fetchBanners(); }
                } catch (e) { toastr.error('Error al eliminar'); }
            }
        });
    };

    const deleteImagePreviewBann = async () => {
        if (isUploadingBanner.value == true) {
            try {
                const res = await authFetch(`/api/media/${bannerForm.value.imageName}`, { method: 'DELETE' });
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

        isUploadingBanner.value = false;
        bannerForm.value.imageUrl = ''
    }

    return {
        banners,
        showBannerModal,
        editingBanner,
        bannerForm,
        showMediaSelector,
        isUploadingBanner,
        bannerFileInput,
        fetchBanners,
        openBannerModal,
        selectBannerImage,
        uploadBannerImage,
        saveBanner,
        deleteBanner,
        deleteImagePreviewBann
    };
}