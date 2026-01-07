import { ref, reactive, computed } from 'vue';
import { authFetch } from './api.js';

export function useFinance() {
    const shiftStatus = ref('loading'); // 'loading', 'closed', 'open'
    const currentData = ref(null); // Datos del turno actual (si está abierto)
    const historyList = ref([]);
    
    // Formularios
    const openAmount = ref(0);
    const movementForm = reactive({ type: 'in', amount: 0, reason: '' });
    const closeAmount = ref(0); // Lo que el usuario cuenta físicamente
    const closeRecounts = reactive({
        debit: 0,      // Tarjeta Débito
        credit: 0,     // Tarjeta Crédito
        transfer: 0    // Transferencias
    });
    
    // Modales
    const showOpenModal = ref(false);
    const showMovementModal = ref(false);
    const showCloseModal = ref(false);

    // Cargar estado inicial
    const fetchCurrentStatus = async () => {
        try {
            const res = await authFetch('/api/finance/current');
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'open') {
                    shiftStatus.value = 'open';
                    currentData.value = data;
                    console.log(data);
                } else {
                    shiftStatus.value = 'closed';
                    currentData.value = null;
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchHistory = async () => {
        try {
            const res = await authFetch('/api/finance/history');
            if (res.ok) historyList.value = await res.json();
        } catch (e) { console.error(e); }
    };

    // Acciones
    const openRegister = async () => {
        try {
            const res = await authFetch('/api/finance/open', {
                method: 'POST',
                body: JSON.stringify({ amount: openAmount.value })
            });
            if (res.ok) {
                toastr.success('Caja abierta correctamente');
                showOpenModal.value = false;
                fetchCurrentStatus();
            } else {
                const err = await res.json();
                toastr.error(err.message);
            }
        } catch (e) { toastr.error('Error al abrir caja'); }
    };

    const registerMovement = async () => {
        try {
            const res = await authFetch('/api/finance/movement', {
                method: 'POST',
                body: JSON.stringify(movementForm)
            });
            if (res.ok) {
                toastr.success('Movimiento registrado');
                showMovementModal.value = false;
                movementForm.amount = 0; movementForm.reason = '';
                fetchCurrentStatus(); // Actualizar números
            }
        } catch (e) { toastr.error('Error al registrar movimiento'); }
    };

    const closeRegister = async () => {
        try {
            const res = await authFetch('/api/finance/close', {
                method: 'POST',
                body: JSON.stringify({ finalCashActual: closeAmount.value })
            });
            if (res.ok) {
                toastr.success('Caja cerrada. Corte realizado.');
                showCloseModal.value = false;
                fetchCurrentStatus();
                fetchHistory(); // Actualizar historial
            }
        } catch (e) { toastr.error('Error al cerrar caja'); }
    };

    return {
        shiftStatus, currentData, historyList,
        openAmount, movementForm, closeAmount, closeRecounts,
        showOpenModal, showMovementModal, showCloseModal,
        fetchCurrentStatus, fetchHistory,
        openRegister, registerMovement, closeRegister
    };
}