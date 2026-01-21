const express = require('express');
const router = express.Router();
const coloniaController = require('../controllers/coloniaController');
const auth = require('../middleware/auth'); // Middleware de seguridad

router.get('/', coloniaController.getColonias);
router.post('/', auth, coloniaController.createColonia);
router.put('/:id', auth, coloniaController.updateColonia);
router.delete('/:id', auth, coloniaController.deleteColonia);

module.exports = router;