const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const auth = require('../middleware/auth');

// Ruta Pública (Sin Auth) - Para el menú del cliente final
router.get('/', configController.getPublicConfig);

// Rutas Privadas (Con Auth) - Para el panel de control
// Usamos /admin para diferenciar explícitamente
router.get('/admin', auth, configController.getAdminConfig);
router.post('/admin', auth, configController.updateAdminConfig);


module.exports = router;