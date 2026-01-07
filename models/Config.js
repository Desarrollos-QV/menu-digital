const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    appName: { type: String, default: 'FudiApp' },
    adminName: { type: String, default: 'Administrador' },

    // Configuración visual
    avatar: { type: String }, // Logo/Icono

    // Configuración global (si aplica)
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Config', configSchema);