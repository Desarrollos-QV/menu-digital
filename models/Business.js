const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: {type: String},
    slug: { type: String, unique: true }, // Para la url: app.com/menu/hamburguesas-pepe
    description: { type: String },
    tags: [String], // Ej: ['Hamburguesas', 'Rápida']
    categories: [{ 
        type: String, 
        required: true
    }],
    rating: { type: Number, default: 5.0 },
    time: { type: String, default: '30-45' }, // Minutos estimados
    deliveryCost: { type: Number, default: 0 },
    municipioId: { type: String },
    deliveryZones: [{
        coloniaId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Colonia' },
        deliveryCost: { type: Number, default: 0 }
    }],
    isTrending: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: true },
    promo: { type: Boolean, default: false },
    // Ubicación con coordenadas
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    // Tipos de servicio
    allowDelivery: { type: Boolean, default: true },
    allowPickup: { type: Boolean, default: false },
    schedule: [{
        day: String,
        open: String,
        close: String,
        isOpen: Boolean
    }],

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
    },
    // Comisiones SaaS
    commissionWebType:   { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    commissionWebAmount: { type: Number, default: 0, min: 0 }, // % o monto fijo por venta WebApp
    commissionPosType:   { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    commissionPosAmount: { type: Number, default: 0, min: 0 }, // % o monto fijo por venta POS (0 = inactivo)
    // Deuda y pagos de comisiones
    commissionDebt: { type: Number, default: 0, min: 0 }, // Monto total adeudado al admin SaaS
    commissionPayments: [{
        amount:    { type: Number, required: true },
        type:      { type: String, enum: ['abono', 'liquidacion'], default: 'abono' },
        note:      { type: String, default: '' },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);