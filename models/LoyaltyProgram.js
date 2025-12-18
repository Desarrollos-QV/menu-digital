const mongoose = require('mongoose');

const loyaltyProgramSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true },
    type: { type: String, enum: ['points', 'stamps'], default: 'points' }, // Puntos ($1 = 1pt) o Sellos (1 visita = 1 sello)
    goal: { type: Number, default: 100 }, // Meta para ganar
    reward: { type: String, default: 'Un descuento sorpresa' }, // Qué gana
    active: { type: Boolean, default: false }
});

module.exports = mongoose.model('LoyaltyProgram', loyaltyProgramSchema);