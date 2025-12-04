const express = require('express');
const router = express.Router();
const saasController = require('../controllers/saasController');

// En producción, aquí agregaríamos un middleware para verificar que sea "superadmin"
router.get('/businesses', saasController.getAllBusinesses);
router.post('/businesses', saasController.createBusiness);
router.put('/businesses/:id/toggle', saasController.toggleBusinessStatus);

module.exports = router;