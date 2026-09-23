const express = require('express');
const router = express.Router();
const saasController = require('../controllers/saasController');
const dispersionController = require('../controllers/dispersionController');
const auth = require('../middleware/auth');

// En producción, aquí agregaríamos un middleware para verificar que sea "superadmin"
router.get('/dashboard-stats', saasController.getDashboardStats);
router.get('/kpis-range', saasController.getKpisByRange);
router.get('/businesses', saasController.getAllBusinesses);
router.post('/businesses', saasController.createBusiness);
router.put('/businesses/:id/toggle', saasController.toggleBusinessStatus);

router.put('/businesses/:id', saasController.updateBusiness);
router.delete('/businesses/:id', saasController.deleteBusiness);

// Comisiones por negocio
router.get('/businesses/:id/commission-stats', saasController.getCommissionStats);
router.post('/businesses/:id/commission-payment', saasController.addCommissionPayment);
router.post('/businesses/:id/commission-settle', saasController.settleCommission);

// Ventas de un negocio específico (SuperAdmin)
router.get('/businesses/:id/orders', saasController.getBusinessOrders);

// Ventas globales de toda la plataforma (SuperAdmin)
router.get('/global-orders', saasController.getGlobalOrders);

// Dispersiones (Wallet & Pagos)
router.post('/dispersions/preview', dispersionController.previewDispersion);
router.post('/dispersions', dispersionController.createDispersion);
// IMPORTANTE: rutas fijas ANTES de /:id para evitar conflictos
router.get('/dispersions/summary', dispersionController.getDispersionSummary);
router.get('/dispersions/me', auth, dispersionController.listMyDispersions);
router.get('/dispersions', dispersionController.listDispersionsAdmin);
router.put('/dispersions/:id/pay', dispersionController.payDispersion);

// Clientes frecuentes e historial de recompra (SuperAdmin)
router.get('/frequent-customers', saasController.getFrequentCustomers);
router.get('/frequent-customers/:phone/orders', saasController.getFrequentCustomerOrders);

module.exports = router;