import { ref } from 'vue';
import { authFetch } from './api.js';

export function useBlog(isDark, fetchMedia) {
    const blogs = ref([]);
    const showBlogModal = ref(false);
    const editingBlog = ref(false);
    const isUploadingBlogImage = ref(false); // Ref to track upload status
    const showBlogMediaSelector = ref(false); // Media selector ref
    const currentBlogId = ref(null);

    const blogForm = ref({
        title: '',
        content: '',
        image: '',
        author: 'Admin',
        active: true
    });

    const fetchBlogs = async () => {
        try {
            const res = await authFetch('/api/blog');
            if (res.ok) {
                blogs.value = await res.json();
            } else {
                toastr.error('Error al cargar noticias');
            }
        } catch (error) {
            console.error('Error fetching blogs:', error);
            toastr.error('Error de conexión al cargar noticias');
        }
    };

    const openBlogModal = (blog = null, mediaCount = 0) => {
        if (blog) {
            editingBlog.value = true;
            currentBlogId.value = blog._id;
            blogForm.value = {
                title: blog.title,
                content: blog.content,
                image: blog.image || '',
                author: blog.author || 'Admin',
                active: blog.active
            };
        } else {
            editingBlog.value = false;
            currentBlogId.value = null;
            blogForm.value = {
                title: '',
                content: '',
                image: '',
                author: 'Admin',
                active: true
            };
        }
        showBlogMediaSelector.value = false; // Reset on open
        if (mediaCount === 0) fetchMedia();
        showBlogModal.value = true;
    };

    const saveBlog = async () => {
        if (!blogForm.value.title || !blogForm.value.content) {
            return toastr.warning('El título y contenido son obligatorios');
        }

        try {
            const url = editingBlog.value ? `/api/blog/${currentBlogId.value}` : '/api/blog';
            const method = editingBlog.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(blogForm.value)
            });

            if (res.ok) {
                toastr.success(`Noticia ${editingBlog.value ? 'actualizada' : 'creada'} correctamente`);
                showBlogModal.value = false;
                fetchBlogs();
            } else {
                toastr.error(`Error al ${editingBlog.value ? 'actualizar' : 'crear'} la noticia`);
            }
        } catch (error) {
            console.error('Error saving blog:', error);
            toastr.error('Error de conexión al guardar la noticia');
        }
    };

    const deleteBlog = async (id) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "No podrás revertir esto",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/blog/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toastr.success('Noticia eliminada correctamente');
                        fetchBlogs();
                    } else {
                        toastr.error('Error al eliminar la noticia');
                    }
                } catch (error) {
                    console.error('Error deleting blog:', error);
                    toastr.error('Error de conexión al eliminar la noticia');
                }
            }
        });
    };

    const selectBlogImage = (url) => {
        blogForm.value.image = url;
        showBlogMediaSelector.value = false;
    };

    const uploadBlogImage = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        isUploadingBlogImage.value = true;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await authFetch('/api/media', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                blogForm.value.image = data.url;
                toastr.success('Imagen subida y seleccionada correctamente');
                fetchMedia(); // Refresh media library
            } else {
                toastr.error('Error al subir la imagen');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            toastr.error('Error de conexión al subir la imagen');
        } finally {
            isUploadingBlogImage.value = false;
            event.target.value = ''; // Reset input
        }
    };

    return {
        blogs,
        showBlogModal,
        editingBlog,
        blogForm,
        isUploadingBlogImage,
        showBlogMediaSelector,
        fetchBlogs,
        openBlogModal,
        saveBlog,
        deleteBlog,
        selectBlogImage,
        uploadBlogImage
    };
}
