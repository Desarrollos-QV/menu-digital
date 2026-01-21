import { ref, reactive, computed } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useColonias(isDark) {
    const colonias = reactive({ loading: false, list: [] });
    const coloniaSearch = ref('');
    const showColoniaModal = ref(false);
    const editingColonia = ref(null);
    const coloniaForm = ref({ name: '', zipCode: '', city: 'Chihuahua', zone: '', active: true });

    /**
     * Obtiene todas las colonias desde el API
     */
    const fetchColonias = async () => {
        colonias.loading = true;
        try {
            const res = await authFetch('/api/colonias');
            if (res.ok) {
                colonias.list = await res.json();
                console.log(colonias.list);
            }
        } catch (e) {
            console.error("Error fetching colonias", e);
            toastr.error('Error al cargar colonias');
        }
        finally { colonias.loading = false; }
    };

    const filteredColonias = computed(() => {
        if(!coloniaSearch.value) return colonias.list;
        const q = coloniaSearch.value.toLowerCase();
        return colonias.list.filter(c => c.name.toLowerCase().includes(q));
    });
    
    /**
     * Abre el modal para crear una nueva colonia o editar una existente
     * @param {Object} colonia - Datos de la colonia a editar (null para crear nueva)
     */
    const openColoniaModal = (colonia = null) => {
        editingColonia.value = !!colonia;

        coloniaForm.value = colonia
            ? { ...colonia }
            : { name: '', zipCode: '', city: 'Chihuahua', zone: '', active: true };

        showColoniaModal.value = true;
    };

    /**
     * Cierra el modal y limpia el formulario
     */
    const closeColoniaModal = () => {
        showColoniaModal.value = false;
        coloniaForm.value = { name: '', zipCode: '', city: 'Chihuahua', zone: '', active: true };
        editingColonia.value = null;
    };

    /**
     * Guarda una colonia nueva o actualiza una existente
     */
    const saveColonia = async () => {
        try {
            // Validaciones básicas
            if (!coloniaForm.value.name.trim()) {
                toastr.warning('El nombre de la colonia es requerido');
                return;
            }

            if (!coloniaForm.value.city.trim()) {
                toastr.warning('La ciudad es requerida');
                return;
            }

            const url = editingColonia.value 
                ? `/api/colonias/${coloniaForm.value._id}` 
                : '/api/colonias';
            const method = editingColonia.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(coloniaForm.value)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Error al guardar colonia');
            }

            const savedColonia = await res.json();
            toastr.success(editingColonia.value ? 'Colonia actualizada correctamente' : 'Colonia creada correctamente');
            
            closeColoniaModal();
            await fetchColonias();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    /**
     * Elimina una colonia con confirmación
     * @param {string} id - ID de la colonia a eliminar
     */
    const deleteColonia = async (id) => {
        Swal.fire({
            title: '¿Eliminar Colonia?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            background: isDark.value ? '#1e293b' : '#fff',
            color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/colonias/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toastr.success('Colonia eliminada correctamente');
                        await fetchColonias();
                    } else {
                        throw new Error('Error al eliminar colonia');
                    }
                } catch (e) {
                    toastr.error(e.message);
                }
            }
        });
    };

    /**
     * Alterna el estado activo/inactivo de una colonia
     * @param {Object} colonia - La colonia a togglear
     */
    const toggleColoniaActive = async (colonia) => {
        try {
            const res = await authFetch(`/api/colonias/${colonia._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...colonia, active: !colonia.active })
            });

            if (res.ok) {
                toastr.success(colonia.active ? 'Colonia desactivada' : 'Colonia activada');
                
                await fetchColonias();
            } else {
                throw new Error('Error al actualizar colonia');
            }
        } catch (e) {
            toastr.error(e.message);
        }
    };


    return {
        colonias,
        showColoniaModal,
        editingColonia,
        coloniaForm,
        fetchColonias,
        openColoniaModal,
        closeColoniaModal,
        saveColonia,
        deleteColonia,
        toggleColoniaActive,
        coloniaSearch,
        filteredColonias
    };
}