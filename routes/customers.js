const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const auth = require('../middleware/auth');

router.get('/', auth, customerController.getCustomers);
router.get('/:id', auth, customerController.getCustomerDetails);

module.exports = router;