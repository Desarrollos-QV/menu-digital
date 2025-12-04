const express = require('express');
const router = express.Router();

// Importar controladores (Asegúrate de crear el archivo controller también)
const productController = require('../controllers/productController');

// -- RUTA DE PRUEBA (Para ver si el server responde) --
router.get('/status', (req, res) => {
    res.json({ status: 'OK', message: 'API funcionando correctamente' });
});


module.exports = router;