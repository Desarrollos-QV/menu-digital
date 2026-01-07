const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QuoteSchema = new Schema({ 
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    customerName: String,
    customerEmail: String,
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    branch: { type: String },
    validUntil: { type: String },
    notes: { type: String },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: String,
        price: Number,
        qty: Number,
        selectedOptions: Array,
        note: String
    }],
    discount: { 
        value: { type: Number, default: 0 },
        type: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
        title: String 
    },
    total: { type: Number, required: true },
    status: { type: String, enum: ['pending','ready'], default: 'pending'}
}, { timestamps: true });

module.exports = mongoose.model('Quotes', QuoteSchema);