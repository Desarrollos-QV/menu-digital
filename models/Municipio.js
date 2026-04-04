const mongoose = require('mongoose');

const MunicipioSchema = new mongoose.Schema({
    name: { type: String, required: true },
    zipCode: { type: String }, // Código Postal
    city: { type: String, required: true, default: 'Nuevo Leon' },
    active: { type: Boolean, default: true },
    colonias: [{
        name: { type: String, required: true },
        zone: { type: String },   // Norte, Sur, Centro (Opcional para agrupar)
        deliveryCost: { type: Number, default: 0 }, // Costo de envío por esta colonia/zona
        active: { type: Boolean, default: true }
    }]
});

module.exports = mongoose.model('Municipio', MunicipioSchema);