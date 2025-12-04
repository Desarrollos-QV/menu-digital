const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addonSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Ej: "Salsas", "Tamaño"
    required: { type: Boolean, default: false }, // ¿Es obligatorio elegir?
    maxOptions: { type: Number, default: 1 }, // Ej: Elegir solo 1, o hasta 3
    options: [{
        name: { type: String, required: true }, // Ej: "Ranch", "Grande"
        priceExtra: { type: Number, default: 0 } // Ej: 0, 15
    }],
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Addon', addonSchema);