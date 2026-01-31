const express = require('express');
const router = express.Router();
const publicMenuController = require('../controllers/publicMenuController');
const marketplaceController = require('../controllers/marketplaceController');
const categoryStoreController = require('../controllers/categoryStoreController'); // <-- Importar


// API: Obtener listado de negocios (JSON)
// GET /explore/api/list
router.get('/list', marketplaceController.getAllBusinesses);
router.post('/customers', marketplaceController.registerCustomer);
router.post('/customers/login', marketplaceController.getCustomerStatus);
// Ruta pública para obtener Categorías Globales (Para registro)
router.get('/categories-store', categoryStoreController.getCategoriesStore);
// Ruta genérica: /api/public/:type?slug=nombre-negocio
// Ejemplo: /api/public/products?slug=tacos-pepe
router.get('/:type', publicMenuController.getPublicData);

// Ruta para registrar negocio
router.post('/register', publicMenuController.registerBusiness);



module.exports = router;