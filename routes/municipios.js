const express = require('express');
const router = express.Router();
const municipioController = require('../controllers/municipioController');
const auth = require('../middleware/auth'); // Middleware de seguridad

router.get('/', municipioController.getMunicipios);
router.post('/', auth, municipioController.createMunicipio);
router.put('/:id', auth, municipioController.updateMunicipio);
router.delete('/:id', auth, municipioController.deleteMunicipio);

// Agregamos las rutas para las colonias por cada municipio
router.get('/:id/colonias', municipioController.getColoniasByMunicipio);
router.post('/:id/colonias', auth, municipioController.createColonia);
router.put('/:id/colonias/:coloniaId', auth, municipioController.updateColonia);
router.delete('/:id/colonias/:coloniaId', auth, municipioController.deleteColonia);

module.exports = router;