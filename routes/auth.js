const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth'); // Middleware de seguridad

router.post('/register', authController.register);
router.post('/login', authController.login);

// Rutas con autenticacion
router.get('/me', auth, authController.getMe);
router.put('/update', auth, authController.updateProfile);

module.exports = router;