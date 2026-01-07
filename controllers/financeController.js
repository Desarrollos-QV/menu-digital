const CashShift = require('../models/CashShift');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

// 1. Obtener estado actual de la caja
exports.getCurrentShift = async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const currentShift = await CashShift.findOne({ 
            businessId: businessId, 
            status: 'open' 
        });

        if (!currentShift) {
            return res.json({ status: 'closed', message: 'No hay caja abierta' });
        }

        const salesStats = await Order.aggregate([
            { 
                $match: { 
                    businessId: new mongoose.Types.ObjectId(businessId), 
                    createdAt: { $gte: currentShift.startTime },
                    status: { $ne: 'cancelled' }
                } 
            },
            {
                $group: {
                    _id: "$paymentMethod", 
                    total: { $sum: "$total" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Formatear resultados (AHORA CON DESGLOSE DE TARJETAS)
        let salesSummary = { 
            cash: 0, 
            credit_card: 0, 
            debit_card: 0, 
            transfer: 0, 
            total: 0 
        };

        salesStats.forEach(stat => {
            // stat._id será 'cash', 'credit_card', 'debit_card', o 'transfer'
            if (salesSummary[stat._id] !== undefined) {
                salesSummary[stat._id] = stat.total;
            } else {
                // Fallback por si hay datos viejos 'card' -> sumar a credit_card por defecto
                if(stat._id === 'card') salesSummary.credit_card += stat.total;
            }
            salesSummary.total += stat.total;
        });

        // Calcular efectivo
        const manualIns = currentShift.movements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.amount, 0);
        const manualOuts = currentShift.movements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.amount, 0);
        
        const currentCashInDrawer = currentShift.initialCash + salesSummary.cash + manualIns - manualOuts;

        res.json({
            status: 'open',
            shift: currentShift,
            salesSummary,
            currentCashInDrawer,
            manualStats: { ins: manualIns, outs: manualOuts }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Abrir Caja
exports.openShift = async (req, res) => {
    try {
        const existing = await CashShift.findOne({ businessId: req.user.businessId, status: 'open' });
        if (existing) return res.status(400).json({ message: 'Ya hay una caja abierta' });

        const newShift = new CashShift({
            businessId: req.user.businessId,
            openedBy: req.user.id,
            initialCash: req.body.amount || 0
        });

        await newShift.save();
        res.json(newShift);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. Registrar Movimiento (Ingreso/Retiro)
exports.addMovement = async (req, res) => {
    try {
        const shift = await CashShift.findOne({ businessId: req.user.businessId, status: 'open' });
        if (!shift) return res.status(404).json({ message: 'No hay caja abierta' });

        const { type, amount, reason } = req.body;
        
        shift.movements.push({
            type,
            amount: parseFloat(amount),
            reason,
            performedBy: req.user.username || 'Usuario'
        });

        await shift.save();
        res.json(shift);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. Cerrar Caja (Corte)
exports.closeShift = async (req, res) => {
    try {
        const shift = await CashShift.findOne({ businessId: req.user.businessId, status: 'open' });
        if (!shift) return res.status(404).json({ message: 'No hay caja abierta' });

        const { finalCashActual } = req.body; // Lo que contó el usuario

        // Recalcular todo una última vez para cerrar
        // (Podríamos reutilizar la lógica de getCurrentShift, pero lo haremos simplificado aquí)
        // NOTA: En producción idealmente se extrae la lógica de cálculo a una función auxiliar
        
        // ... (Asumimos que el frontend envía los totales calculados o repetimos la agregación)
        // Para este ejemplo, confiaremos en que el sistema calcula el esperado, 
        // pero lo correcto es re-calcular 'finalCashExpected' en backend.
        
        // Calculo rápido backend:
        const salesStats = await Order.aggregate([
            { $match: { businessId: req.user.businessId, createdAt: { $gte: shift.startTime }, status: { $ne: 'cancelled' } } },
            { $group: { _id: "$paymentMethod", total: { $sum: "$total" } } }
        ]);
        
        let cashSales = 0;
        const cashStat = salesStats.find(s => s._id === 'cash');
        if (cashStat) cashSales = cashStat.total;

        const manualIns = shift.movements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.amount, 0);
        const manualOuts = shift.movements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.amount, 0);

        const expected = shift.initialCash + cashSales + manualIns - manualOuts;

        shift.endTime = Date.now();
        shift.status = 'closed';
        shift.closedBy = req.user.id;
        shift.finalCashExpected = expected;
        shift.finalCashActual = parseFloat(finalCashActual);
        shift.difference = parseFloat(finalCashActual) - expected;

        await shift.save();
        res.json(shift);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 5. Historial de Cortes
exports.getHistory = async (req, res) => {
    try {
        const history = await CashShift.find({ businessId: req.user.businessId, status: 'closed' })
            .sort({ endTime: -1 })
            .limit(20)
            .populate('openedBy', 'username')
            .populate('closedBy', 'username');
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};