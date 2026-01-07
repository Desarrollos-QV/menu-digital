const express = require('express');
const router = express.Router();
const path = require('path');

// Helper para facilitar la ruta de los archivos
// Asume que tus HTML están en: raiz_proyecto/views/admin/
const views = (fileName) => path.join(__dirname, '../views/admin', fileName);

// Middleware para verificar sesión (Opcional por ahora, pero recomendado)
// const checkAuth = (req, res, next) => { ... } 

// 1. Redirección raíz
router.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

// 2. Rutas de Vistas Específicas
// Al entrar a /admin/dashboard -> servimos dashboard.html
router.get('/dashboard', (req, res) => {
    res.sendFile(views('dashboard.html'));
});

// Al entrar a /admin/pos -> servimos pos.html
router.get('/pos', (req, res) => {
    res.sendFile(views('pos.html'));
});

// Al entrar a /admin/finance -> servimos finance.html
router.get('/finance', (req, res) => {
    res.sendFile(views('finance.html'));
});

// Al entrar a /admin/users -> servimos users.html
router.get('/users', (req, res) => {
    res.sendFile(views('users.html'));
});

// Al entrar a /admin/products -> servimos products.html
router.get('/products', (req, res) => {
    res.sendFile(views('products.html'));
});

module.exports = router;