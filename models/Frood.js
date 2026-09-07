const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const froodSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    views: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false }, // True = Publicidad Global (ADMIN)
    businessId: { type: Schema.Types.ObjectId, ref: 'Business' }, // Opcional si es del sistema
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Frood', froodSchema);
