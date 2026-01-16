const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business'},
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    pin: { type: String, required: true, minlength: 4, maxlength: 16 },
    points: { type: Number, default: 0 },
    visits: { type: Number, default: 0 },
    lastVisit: { type: Date, default: Date.now }
});

customerSchema.index({ businessId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('Customer', customerSchema);