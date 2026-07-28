const mongoose = require('mongoose');

const customerAddressSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    alias: { type: String, default: 'Hogar' }, // 'Hogar', 'Trabajo', 'Otro'
    street: { type: String, required: true },
    number: { type: String, required: true },
    colony: { type: String, required: true },       // Nombre de la colonia (display)
    coloniaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Municipio', default: null }, // ID de la colonia del sistema
    municipioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Municipio', default: null }, // ID del Municipio padre
    municipioName: { type: String, default: '' },   // Nombre del municipio (display)
    zipCode: { type: String, default: '' },
    reference: { type: String, default: '' },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('CustomerAddress', customerAddressSchema);
