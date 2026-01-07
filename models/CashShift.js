const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cashShiftSchema = new Schema({
    businessId: { type: String, required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Quién abrió
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' }, // Quién cerró
    
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    
    // Estado
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    
    // Dinero
    initialCash: { type: Number, required: true }, // Fondo de caja
    
    // Contadores finales (se llenan al cerrar o calcular)
    finalCashExpected: { type: Number, default: 0 }, // Calculado por sistema
    finalCashActual: { type: Number }, // Lo que contó el cajero
    difference: { type: Number }, // Sobrante o Faltante
    
    // Movimientos Manuales (Entradas/Salidas de efectivo ajenas a ventas)
    movements: [{
        type: { type: String, enum: ['in', 'out'] }, // in = ingreso, out = retiro
        amount: Number,
        reason: String,
        performedBy: String, // Nombre del usuario
        date: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('CashShift', cashShiftSchema);