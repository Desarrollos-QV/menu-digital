const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    expirationDate: { type: Date, default: null },
    maxUses: { type: Number, default: 0 }, // 0 means no limit
    currentUses: { type: Number, default: 0 },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null }, // Si es null, aplica a todos los negocios
    minPurchaseAmount: { type: Number, default: 0 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }] // Evita que un mismo cliente lo use 2 veces
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
