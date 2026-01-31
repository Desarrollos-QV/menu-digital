const mongoose = require('mongoose');

const MunicipioSchema = new mongoose.Schema({
    name: { type: String, required: true },
    zipCode: { type: String }, // Código Postal
    city: { type: String, required: true, default: 'Nuevo Leon' },
    active: { type: Boolean, default: true },
    colonias: [{
        name: { type: String, required: true },
        zone: { type: String }, // Norte, Sur, Centro (Opcional para agrupar)
        active: { type: Boolean, default: true }
    }]
});

module.exports = mongoose.model('Municipio', MunicipioSchema);