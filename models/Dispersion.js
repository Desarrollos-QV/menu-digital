const mongoose = require('mongoose');

const dispersionSchema = new mongoose.Schema({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    
    // Periodo que abarca este corte
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    // Desglose de ventas en este periodo
    totalOrders: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 }, // Subtotal sin envío ni descuentos
    cardSales: { type: Number, default: 0 }, // Total cobrado con tarjeta/online
    cashSales: { type: Number, default: 0 }, // Total cobrado en efectivo
    deliveryFees: { type: Number, default: 0 }, // Total de costo de envíos generados

    // Comisiones 
    commissionTotal: { type: Number, default: 0 }, // Comisión de la plataforma sobre totalSales

    // Lo que realmente se le va a pagar o cobrar al restaurante
    // (cardSales - commissionTotal)
    // Si es negativo, el restaurante debe dinero a la plataforma (Saldo en contra)
    // Si es positivo, la plataforma debe dispersarle ese dinero (Saldo a favor)
    netToPay: { type: Number, required: true }, 

    status: { 
        type: String, 
        enum: ['pending', 'paid'], 
        default: 'pending' 
    },
    
    paidAt: { type: Date },
    reference: { type: String, default: '' }, // Número de transferencia o nota de pago
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Dispersion', dispersionSchema);
