const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: {type: String},
    slug: { type: String, unique: true }, // Para la url: app.com/menu/hamburguesas-pepe
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    avatar: { type: String }, // Para la url: app.com/menu/hamburguesas-pepe
    active: { type: Boolean, default: true }, // Para bloquearlos por falta de pago
    ownerEmail: String,
    phone: String,
    // Configuración específica de este negocio
    settings: {
        currency: { type: String, default: 'MXN' },
        iva: { type: Number, default: 16 },
        primaryColor: { type: String, default: '#6366f1' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);