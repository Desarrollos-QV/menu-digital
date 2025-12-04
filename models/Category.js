const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    image: String, // URL de la imagen representativa
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);