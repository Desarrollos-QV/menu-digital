const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bannerSchema = new mongoose.Schema({
    title: { type: String },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    description: String,
    imageUrl: { type: String, required: true },
    active: { type: Boolean, default: true },
    expiresAt: Date, // Fecha de caducidad opcional
    isSystem: { type: Boolean, default: false }, // True = Publicidad Global (ADMIN)
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' }, // Opcional si es del sistema
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Banner', bannerSchema);