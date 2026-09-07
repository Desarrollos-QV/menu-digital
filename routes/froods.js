const express = require('express');
const router = express.Router();
const froodController = require('../controllers/froodController');
const auth = require('../middleware/auth'); // Middleware de seguridad

router.get('/', auth, froodController.getFroods);
router.post('/', auth, froodController.createFrood);
router.put('/:id', auth, froodController.updateFrood);
router.delete('/:id', auth, froodController.deleteFrood);

module.exports = router;
