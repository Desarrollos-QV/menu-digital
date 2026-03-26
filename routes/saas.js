const express = require('express');
const router = express.Router();
const saasController = require('../controllers/saasController');

// En producción, aquí agregaríamos un middleware para verificar que sea "superadmin"
router.get('/businesses', saasController.getAllBusinesses);
router.post('/businesses', saasController.createBusiness);
router.put('/businesses/:id/toggle', saasController.toggleBusinessStatus);

router.put('/businesses/:id', saasController.updateBusiness);
router.delete('/businesses/:id', saasController.deleteBusiness);

// Comisiones por negocio
router.get('/businesses/:id/commission-stats', saasController.getCommissionStats);
router.post('/businesses/:id/commission-payment', saasController.addCommissionPayment);
router.post('/businesses/:id/commission-settle', saasController.settleCommission);

module.exports = router;