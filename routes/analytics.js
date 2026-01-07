const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth');

// Rutas Públicas (Desde la WebApp del cliente)
router.post('/visit', analyticsController.registerVisit);
router.post('/order', analyticsController.registerOrder);

// Rutas Privadas (Para el Panel Admin)
router.get('/dashboard', auth, analyticsController.getDashboardStats);
router.post('/pos/sale', auth, analyticsController.createPosOrder);

module.exports = router;