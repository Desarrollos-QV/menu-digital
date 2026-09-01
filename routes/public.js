const express = require('express');
const router = express.Router();
const publicMenuController = require('../controllers/publicMenuController');
const marketplaceController = require('../controllers/marketplaceController');
const categoryStoreController = require('../controllers/categoryStoreController'); // <-- Importar


// GET /api/public/maps-key
router.get('/maps-key', (req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_APIKEY });
});
// API: Obtener listado de negocios (JSON)
// GET /explore/api/list
router.get('/list', marketplaceController.getAllBusinesses);
router.get('/promos', marketplaceController.getPromos);
router.get('/cheap-products', marketplaceController.getCheapProducts);
router.post('/customers', marketplaceController.registerCustomer);
router.post('/customers/login', marketplaceController.getCustomerStatus);
// Ruta pública para obtener Categorías Globales (Para registro)
router.get('/categories-store', categoryStoreController.getCategoriesStore);
// Ruta genérica: /api/public/:type?slug=nombre-negocio
// Ejemplo: /api/public/products?slug=tacos-pepe
router.get('/:type', publicMenuController.getPublicData);

// Ruta para obtener el slug por id
router.get('/business-slug/:id', async (req, res) => {
    try {
        const Business = require('../models/Business');
        const b = await Business.findById(req.params.id);
        if (!b) return res.json({ slug: null, name: null, cover: '', avatar: '' });

        // obtener la url de la imagen
        const coverUrl = b.cover || '';
        const avatarUrl = b.avatar || '';
        res.json({ slug: b.slug, name: b.name, cover: coverUrl, avatar: avatarUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ruta para registrar negocio
router.post('/register', publicMenuController.registerBusiness);

// Ruta para guardar review
router.post('/reviews', publicMenuController.submitReview);


module.exports = router;