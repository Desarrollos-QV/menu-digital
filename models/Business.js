const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: {type: String},
    slug: { type: String, unique: true }, // Para la url: app.com/menu/hamburguesas-pepe
    description: { type: String },
    tags: [String], // Ej: ['Hamburguesas', 'Rápida']
    categories: [{ 
        type: String, 
        required: true,
        enum: [
            'burgers',   // Hamburguesas
            'pizza',     // Pizza
            'sushi',     // Sushi / Japonesa
            'tacos',     // Tacos
            'mexican',   // Mexicana General
            'wings',     // Alitas / Boneless
            'italian',   // Italiana / Pastas
            'chinese',   // China / Asiática
            'seafood',   // Mariscos
            'chicken',   // Pollo / Rostizado
            'coffee',    // Cafetería
            'bakery',    // Panadería / Repostería
            'dessert',   // Postres / Helados
            'healthy',   // Saludable / Ensaladas
            'vegan',     // Vegana / Vegetariana
            'bar',       // Bar / Bebidas / Cervecería
            'breakfast', // Desayunos / Brunch
            'fastfood',  // Comida Rápida General
            'others'     // Otros
        ] 
    }],
    rating: { type: Number, default: 5.0 },
    time: { type: String, default: '30-45' }, // Minutos estimados
    deliveryCost: { type: Number, default: 0 },
    isTrending: { type: Boolean, default: false },
    isOpen: { type: Boolean, default: true },
    promo: { type: Boolean, default: false },

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