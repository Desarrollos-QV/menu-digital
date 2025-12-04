const express = require('express');
const router = express.Router();
const publicMenuController = require('../controllers/publicMenuController');

// Ruta genérica: /api/public/:type?slug=nombre-negocio
// Ejemplo: /api/public/products?slug=tacos-pepe
router.get('/:type', publicMenuController.getPublicData);

module.exports = router;