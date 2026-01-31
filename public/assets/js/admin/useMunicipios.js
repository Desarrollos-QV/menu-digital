import { ref, reactive, computed } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useMunicipios(isDark) {
    const municipios = reactive({ loading: false, list: [] });
    const municipioSearch = ref('');
    const showMunicipioModal = ref(false);
    const editingMunicipio = ref(null);
    const municipioForm = ref({ name: '', zipCode: '', city: 'Chihuahua', zone: '', active: true, colonias: [] });

    /**
     * Obtiene todas las municipios desde el API
     */
    const fetchMunicipios = async () => {
        municipios.loading = true;
        try {
            const res = await authFetch('/api/municipios');
            if (res.ok) {
                municipios.list = await res.json();
            }
        } catch (e) {
            console.error("Error fetching municipios", e);
            toastr.error('Error al cargar municipios');
        }
        finally { municipios.loading = false; }
    };

    const filteredMunicipios = computed(() => {
        if(!municipioSearch.value) return municipios.list;
        const q = municipioSearch.value.toLowerCase();
        return municipios.list.filter(m => m.name.toLowerCase().includes(q));
    });
    
    /**
     * Abre el modal para crear una nueva municipio o editar una existente
     * @param {Object} municipio - Datos de la municipio a editar (null para crear nueva)   
     */
    const openMunicipioModal = (municipio = null) => {
        editingMunicipio.value = !!municipio;

        if (municipio) {
            municipioForm.value = { 
                ...municipio,
                colonias: municipio.colonias ? [...municipio.colonias] : []
            };
        } else {
            municipioForm.value = { name: '', zipCode: '', city: 'Chihuahua', zone: '', active: true, colonias: [] };
        }

        showMunicipioModal.value = true;
    };

    /**
     * Cierra el modal y limpia el formulario
     */
    const closeMunicipioModal = () => {
        showMunicipioModal.value = false;
        municipioForm.value = { name: '', zipCode: '', city: 'Chihuahua', zone: '', active: true, colonias: [] };
        editingMunicipio.value = null;
    };

    /**
     * Guarda una municipio nueva o actualiza una existente
     */
    const saveMunicipio = async () => {
        try {
            // Validaciones básicas
            if (!municipioForm.value.name.trim()) {
                toastr.warning('El nombre de la municipio es requerido');
                return;
            }

            if (!municipioForm.value.city.trim()) {
                toastr.warning('La ciudad es requerida');
                return;
            }

            const url = editingMunicipio.value 
                ? `/api/municipios/${municipioForm.value._id}` 
                : '/api/municipios';
            const method = editingMunicipio.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(municipioForm.value)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Error al guardar municipio');
            }

            const savedMunicipio = await res.json();
            toastr.success(editingMunicipio.value ? 'Municipio actualizado correctamente' : 'Municipio creado correctamente');
            
            closeMunicipioModal();
            await fetchMunicipios();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    /**
     * Elimina una colonia con confirmación
     * @param {string} id - ID de la colonia a eliminar
     */
    const deleteMunicipio = async (id) => {
        Swal.fire({
            title: '¿Eliminar Municipio?',
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
                    const res = await authFetch(`/api/municipios/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        toastr.success('Municipio eliminado correctamente');
                        await fetchMunicipios();
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
    const toggleMunicipioActive = async (municipio) => {
        try {
            const res = await authFetch(`/api/municipios/${municipio._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...municipio, active: !municipio.active })
            });

            if (res.ok) {
                toastr.success(municipio.active ? 'Municipio desactivada' : 'Municipio activada');
                
                await fetchMunicipios();
            } else {
                throw new Error('Error al actualizar municipio');
            }
        } catch (e) {
            toastr.error(e.message);
        }
    };

    /**
     * Agrega una nueva colonia vacía al formulario
     */
    const addColonia = () => {
        if (!municipioForm.value.colonias) {
            municipioForm.value.colonias = [];
        }
        municipioForm.value.colonias.push({
            name: '',
            zone: '',
            active: true
        });
    };

    /**
     * Elimina una colonia del formulario por su índice
     * @param {number} index - Índice de la colonia a eliminar
     */
    const removeColonia = (index) => {
        municipioForm.value.colonias.splice(index, 1);
    };


    return {
        municipios,
        showMunicipioModal,
        editingMunicipio,
        municipioForm,
        fetchMunicipios,
        openMunicipioModal,
        closeMunicipioModal,
        saveMunicipio,
        deleteMunicipio,
        toggleMunicipioActive,
        addColonia,
        removeColonia,
        municipioSearch,
        filteredMunicipios
    };
}