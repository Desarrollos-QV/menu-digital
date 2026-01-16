const express = require('express');
const router = express.Router();
const publicMenuController = require('../controllers/publicMenuController');
const marketplaceController = require('../controllers/marketplaceController');


// API: Obtener listado de negocios (JSON)
// GET /explore/api/list
router.get('/list', marketplaceController.getAllBusinesses);
router.post('/customers', marketplaceController.registerCustomer);
router.post('/customers/login', marketplaceController.getCustomerStatus);
// Ruta genérica: /api/public/:type?slug=nombre-negocio
// Ejemplo: /api/public/products?slug=tacos-pepe
router.get('/:type', publicMenuController.getPublicData);

// Ruta para registrar negocio
router.post('/register', publicMenuController.registerBusiness);


module.exports = router;