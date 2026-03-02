const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    image: String, // URL de la imagen
    barcode: { type: String, unique: true, sparse: true, trim: true },
    stock: { type: Number },
    sort: { type: Number, default: 0 },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    // Relaciones (IDs de otras colecciones)
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    addons: [{ type: Schema.Types.ObjectId, ref: 'Addon' }],
    
    active: { type: Boolean, default: true },
    salesCount: { type: Number, default: 0 } // Para KPI de más vendidos
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);