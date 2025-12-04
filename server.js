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

// --- RUTA PÚBLICA (SIN AUTH) ---
app.use('/api/public', require('./routes/public'));

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