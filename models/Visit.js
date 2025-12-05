const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    visitorId: String, // Fingerprint o UUID del localStorage del cliente
    userAgent: String, // Para saber si es iPhone, Android, PC
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Visit', visitSchema);