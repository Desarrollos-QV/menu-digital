const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');

router.get('/config', stripeController.getConfig);
router.post('/create-intent', stripeController.createPaymentIntent);

module.exports = router;
