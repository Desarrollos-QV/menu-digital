const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    customerName: String,
    customerEmail: String, // ¡Oro molido para marketing!
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        quantity: Number,
        price: Number
    }],
    total: Number,
    status: { type: String, default: 'whatsapp_clicked' }, // Por ahora solo tenemos este estado
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);