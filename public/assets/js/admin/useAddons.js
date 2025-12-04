import { ref } from 'vue';
import { authFetch } from './api.js'; // <-- Helper para Fetch

export function useAddons(isDark) {
    const addonsList = ref([]);
    const showAddonModal = ref(false);
    const editingAddon = ref(null);

    // Formulario Base
    const defaultForm = {
        name: '',
        required: false,
        maxOptions: 1,
        active: true,
        options: [] // Array dinámico: { name, priceExtra }
    };
    const addonForm = ref({ ...defaultForm });

    const fetchAddons = async () => {
        try {
            const res = await authFetch('/api/addons');
            if (res.ok) addonsList.value = await res.json();
        } catch (e) { console.error("Error fetching addons", e); }
    };

    const openAddonModal = (addon = null) => {
        editingAddon.value = !!addon;
        if (addon) {
            // Clonamos profundamente para evitar referencias reactivas en el array de opciones
            addonForm.value = JSON.parse(JSON.stringify(addon));
        } else {
            addonForm.value = JSON.parse(JSON.stringify(defaultForm));
            // Agregamos una opción vacía por defecto para UX
            addonForm.value.options.push({ name: '', priceExtra: 0 });
        }
        showAddonModal.value = true;
    };

    // --- Gestión de Opciones Dinámicas ---
    const addOptionRow = () => {
        addonForm.value.options.push({ name: '', priceExtra: 0 });
    };

    const removeOptionRow = (index) => {
        addonForm.value.options.splice(index, 1);
    };
    // -------------------------------------

    const saveAddon = async () => {
        // Validación básica
        if (!addonForm.value.name || addonForm.value.options.length === 0) {
            toastr.warning('Debes poner un nombre y al menos una opción');
            return;
        }

        try {
            const url = editingAddon.value ? `/api/addons/${addonForm.value._id}` : '/api/addons';
            const method = editingAddon.value ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addonForm.value)
            });

            if (!res.ok) throw new Error('Error al guardar complemento');

            toastr.success('Complemento guardado correctamente');
            showAddonModal.value = false;
            await fetchAddons();
        } catch (error) {
            toastr.error(error.message);
        }
    };

    const deleteAddon = async (id) => {
        Swal.fire({
            title: '¿Eliminar Grupo?',
            text: "Se desvinculará de todos los productos",
            icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444',
            background: isDark.value ? '#1e293b' : '#fff', color: isDark.value ? '#fff' : '#000'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await authFetch(`/api/addons/${id}`, { method: 'DELETE' });
                    if (res.ok) { toastr.success('Grupo eliminado'); await fetchAddons(); }
                } catch (e) { toastr.error('Error al eliminar'); }
            }
        });
    };

    return {
        addonsList,
        showAddonModal,
        editingAddon,
        addonForm,
        fetchAddons,
        openAddonModal,
        saveAddon,
        deleteAddon,
        addOptionRow,
        removeOptionRow
    };
}