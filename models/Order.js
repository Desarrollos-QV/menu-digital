const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    customerName: String,
    customerEmail: String,
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        quantity: Number,
        selectedOptions: Array,
        note: String
    }],
    subtotal: Number,
    discount: { 
        amount: { type: Number, default: 0 },
        type: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
        reason: String 
    },
    tax: Number,
    total: { type: Number, required: true },
    source: { type: String, enum: ['whatsapp', 'pos'], default: 'whatsapp' },
    
    // IMPORTANTE PARA CAJA:
    paymentMethod: { 
        type: String, 
        enum: ['cash', 'card', 'credit_card', 'debit_card', 'transfer', 'online'], 
        default: 'cash' 
    },
    paymentReference: String, // Para vouchers o # transferencia

    status: { 
        type: String, 
        enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'], 
        default: 'pending' 
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);