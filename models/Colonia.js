const mongoose = require('mongoose');

const ColoniaSchema = new mongoose.Schema({
    name: { type: String, required: true },
    zipCode: { type: String }, // Código Postal
    city: { type: String, required: true, default: 'Chihuahua' },
    zone: { type: String }, // Norte, Sur, Centro (Opcional para agrupar)
    active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Colonia', ColoniaSchema);