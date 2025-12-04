const express = require('express');
const router = express.Router();
const addonController = require('../controllers/addonController');
const auth = require('../middleware/auth'); // Middleware de seguridad

router.get('/', auth, addonController.getAddons);
router.post('/', auth, addonController.createAddon);
router.put('/:id', auth, addonController.updateAddon);
router.delete('/:id', auth, addonController.deleteAddon);

module.exports = router;