const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Nombre físico del archivo
    originalName: String, // Nombre original que subió el usuario
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    
    // LA CLAVE DEL SAAS:
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' }, 
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Media', mediaSchema);