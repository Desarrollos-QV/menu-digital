const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// Obtener todas las órdenes (KDS y Historial)
router.get('/', auth, orderController.getOrders);
// Obtener detalles de una orden específica
router.get('/:id', auth, orderController.getOrderDetails);
// Crear nueva orden (POS y PWA)
// router.post('/', auth, orderController.createOrder);
// Actualizar orden (Cambio de estado KDS, Cancelar, Completar)
router.put('/:id', auth, orderController.updateOrder);
// Eliminar orden
router.delete('/:id', auth, orderController.deleteOrder);

module.exports = router;