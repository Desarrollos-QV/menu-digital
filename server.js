const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// --- MIDDLEWARES GLOBALES (ESTO DEBE IR PRIMERO) ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir Archivos Estáticos (Frontend)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views/frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Rutas de la API (Backend)
app.use('/api', require('./routes/api'));
app.use('/api/saas', require('./routes/saas')); // <-- Multinegocios
// Estas rutas ahora tienen el middleware 'auth' dentro de sus archivos
app.use('/api/auth', require('./routes/auth')); // <-- Autenticacion
app.use('/api/media', require('./routes/media')); // <-- Subida de medios
app.use('/api/banners', require('./routes/banners')); // <-- Publicidad
app.use('/api/products', require('./routes/products')); // <-- Productos
app.use('/api/categories', require('./routes/categories')); // <-- Categorias
app.use('/api/addons', require('./routes/addons')); // <-- Complementos
app.use('/api/config', require('./routes/config')); // <-- Configuraciones
app.use('/api/analytics', require('./routes/analytics')); // <-- Analitica de visitas y pedidos
app.use('/api/customers', require('./routes/customers')); // <-- Listado de usuarios
app.use('/api/finance', require('./routes/finance')); // <-- Gestion de cajas
app.use('/api/orders', require('./routes/orders')); // <-- Gestion de ventas
app.use('/api/quotes', require('./routes/quotes')); // <-- Gestion de Cotizaciones
// --- RUTA PÚBLICA (SIN AUTH) ---
app.use('/api/public', require('./routes/public'));
app.use('/api/loyalty', require('./routes/loyalty'));

// --- NUEVO: MANEJO DE RUTAS AMIGABLES (SPA) ---
// Esto permite entrar a tengo-hambre.com/buffalucas
app.get(/.*/, (req, res) => {
    // 1. Ignorar si es una petición a la API o a una imagen
    if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
        return res.status(404).json({ message: 'No encontrado' });
    }

    // 2. EXCEPCIÓN PARA REGISTRO (Solución al conflicto)
    // Si la URL es /register, servimos el archivo de registro explícitamente
    if (req.url === '/register' || req.url === '/register.html') {
       return res.sendFile(path.join(__dirname, 'views','frontend', 'register.html'));
    }
    
    // 3. Rutas de Admin
    if (req.url.startsWith('/admin')) {
        return res.sendFile(path.join(__dirname, 'views', 'admin', 'index.html'));
    }

    // 3. Rutas de Admin
    if (req.url.startsWith('/marketplace')) {
        return res.sendFile(path.join(__dirname, 'views', 'frontend', 'marketplace.html'));
    }
    
    // 4. Default: App del Cliente (Menú Digital)
    // Cualquier otra ruta (ej: /tacos-pepe) se trata como un slug
    res.sendFile(path.join(__dirname, 'views','frontend', 'menu.html'));
});

// 3. Conexión DB y Servidor
// Asegúrate de tener tu archivo .env con MONGO_URI=...
const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/menu_digital'; // Fallback por si falla .env

mongoose.connect(dbUri)
    .then(() => console.log('Base de datos conectada'))
    .catch(err => {
        console.log('Connect to db', dbUri)
        console.log('Error de DB:', err)
    });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));