const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business'},
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, unique: true, required: true, trim: true, lowercase: true },
    password: { type: String, required: true }, // Contraseña encriptada
    avatar: { type: String, default: '' }, // Foto de perfil
    stripeCustomerId: { type: String, default: '' }, // ID de cliente Stripe
    points: { type: Number, default: 0 },
    visits: { type: Number, default: 0 },
    lastVisit: { type: Date, default: Date.now }
});

// Nota: Para clientes del Marketplace global, businessId puede ser opcional o nulo.
customerSchema.index({ businessId: 1, phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Customer', customerSchema);