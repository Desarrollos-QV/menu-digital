const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const verifyToken = require('../middleware/auth');

const isSuperadmin = (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(403).json({ message: 'Require Superadmin Role!' });
    }
};

// Rutas Públicas
router.get('/public', blogController.getBlogsPublic);

// Rutas Admin (Protegidas)
router.get('/', verifyToken, isSuperadmin, blogController.getBlogsAdmin);
router.post('/', verifyToken, isSuperadmin, blogController.createBlog);
router.put('/:id', verifyToken, isSuperadmin, blogController.updateBlog);
router.delete('/:id', verifyToken, isSuperadmin, blogController.deleteBlog);

module.exports = router;
