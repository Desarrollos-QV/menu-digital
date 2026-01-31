const express = require('express');
const router = express.Router();
const categoryStoreController = require('../controllers/categoryStoreController');
const auth = require('../middleware/auth');

router.get('/', categoryStoreController.getCategoriesStore);
router.post('/', auth, categoryStoreController.createCategoryStore);
router.put('/:id', auth, categoryStoreController.updateCategoryStore);
router.delete('/:id', auth, categoryStoreController.deleteCategoryStore);

module.exports = router;
