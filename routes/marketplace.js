const express = require('express');
const router = express.Router();
const path = require('path');
const marketplaceController = require('../controllers/marketplaceController');

// VISTA: Renderizar el HTML del Marketplace
// GET /explore
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/marketplace/index.html'));
});

// API: Obtener listado de negocios (JSON)
// GET /explore/api/list
router.get('/api/list', marketplaceController.getAllBusinesses);

module.exports = router;