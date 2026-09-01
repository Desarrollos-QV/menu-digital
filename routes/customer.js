const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const customerAuth = require('../middleware/customerAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de Multer para Avatares de Clientes
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Máximo 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/i;
        const extMatch = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimeMatch = allowedTypes.test(file.mimetype);
        if (extMatch && mimeMatch) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'));
        }
    }
});

// Todas las rutas de este archivo requieren autenticación de cliente
router.use(customerAuth);

// --- PERFIL ---
router.get('/profile', customerController.getProfile);
router.put('/profile', customerController.updateProfile);
router.post('/profile/avatar', upload.single('avatar'), customerController.uploadAvatar);

// --- LIBRETA DE DIRECCIONES ---
router.get('/addresses', customerController.getAddresses);
router.post('/addresses', customerController.createAddress);
router.put('/addresses/:id', customerController.updateAddress);
router.delete('/addresses/:id', customerController.deleteAddress);

// --- METODOS DE PAGO (STRIPE CARDS) ---
router.post('/cards/setup-intent', customerController.createSetupIntent);
router.get('/cards', customerController.getCards);
router.delete('/cards/:paymentMethodId', customerController.deleteCard);
router.post('/cards/charge', customerController.chargeSavedCard);

// Push Notifications
router.post('/fcm-token', customerController.saveFcmToken);

// --- HISTORIAL DE PEDIDOS ---
router.get('/orders', customerController.getOrders);

// --- CUPONES DE DESCUENTO ---
const couponController = require('../controllers/couponController');
router.post('/coupons/validate', couponController.validateCoupon);

module.exports = router;
