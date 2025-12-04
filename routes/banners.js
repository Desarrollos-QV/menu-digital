const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const auth = require('../middleware/auth'); // Middleware de seguridad

router.get('/', auth, bannerController.getBanners);
router.post('/', auth, bannerController.createBanner);
router.put('/:id', auth, bannerController.updateBanner);
router.delete('/:id', auth, bannerController.deleteBanner);

module.exports = router;