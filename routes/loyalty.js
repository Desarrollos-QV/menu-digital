const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const auth = require('../middleware/auth');

// Públicas
router.post('/public/status', loyaltyController.getCustomerStatus);
router.post('/public/register', loyaltyController.registerCustomer);
router.post('/public/setup-password', loyaltyController.setupPassword);

// Privadas (Admin)
router.get('/config', auth, loyaltyController.getProgramConfig);
router.post('/config', auth, loyaltyController.updateProgramConfig);
router.post('/add', auth, loyaltyController.addPoints);
router.post('/redeem', auth, loyaltyController.redeemReward);
// NUEVA RUTA PARA POS
router.get('/customers', auth, loyaltyController.searchCustomers);


module.exports = router;