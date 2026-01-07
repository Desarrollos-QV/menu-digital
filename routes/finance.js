const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const auth = require('../middleware/auth');

router.get('/current', auth, financeController.getCurrentShift);
router.post('/open', auth, financeController.openShift);
router.post('/movement', auth, financeController.addMovement); // Ingreso/Retiro
router.post('/close', auth, financeController.closeShift);
router.get('/history', auth, financeController.getHistory);

module.exports = router;