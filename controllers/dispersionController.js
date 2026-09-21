const Order = require('../models/Order');
const Business = require('../models/Business');
const Dispersion = require('../models/Dispersion');

exports.previewDispersion = async (req, res) => {
    try {
        const { businessId, periodStart, periodEnd } = req.body;
        if (!businessId || !periodStart || !periodEnd) {
            return res.status(400).json({ message: 'businessId, periodStart y periodEnd son requeridos' });
        }

        const start = new Date(periodStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(periodEnd);
        end.setHours(23, 59, 59, 999);

        const orders = await Order.find({
            businessId,
            createdAt: { $gte: start, $lte: end },
            dispersionId: { $exists: false },
            status: { $in: ['completed', 'delivered', 'ready'] } // Asumiendo estados validos
        });

        const business = await Business.findById(businessId);
        
        let totalOrders = orders.length;
        let totalSales = 0;
        let cardSales = 0;
        let cashSales = 0;
        let deliveryFees = 0;
        let commissionTotal = 0;

        orders.forEach(o => {
            let orderSubtotal = o.subtotal || 0; 
            totalSales += orderSubtotal;
            deliveryFees += (o.deliveryCost || 0);

            const isCard = ['card', 'credit_card', 'debit_card', 'online', 'stripe'].includes(o.paymentMethod);
            if (isCard) {
                cardSales += o.total; 
            } else {
                cashSales += o.total;
            }

            if (o.commission && o.commission.amount) {
                commissionTotal += o.commission.amount;
            } else {
                if (business.commissionWebType === 'percent') {
                    commissionTotal += (orderSubtotal * (business.commissionWebAmount / 100));
                } else {
                    commissionTotal += (business.commissionWebAmount || 0);
                }
            }
        });

        const netToPay = cardSales - commissionTotal;

        res.json({
            businessId,
            periodStart: start,
            periodEnd: end,
            totalOrders,
            totalSales,
            cardSales,
            cashSales,
            deliveryFees,
            commissionTotal,
            netToPay
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.createDispersion = async (req, res) => {
    try {
        const { businessId, periodStart, periodEnd } = req.body;
        
        const start = new Date(periodStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(periodEnd);
        end.setHours(23, 59, 59, 999);

        const orders = await Order.find({
            businessId,
            createdAt: { $gte: start, $lte: end },
            dispersionId: { $exists: false },
            status: { $in: ['completed', 'delivered', 'ready'] } 
        });

        if (orders.length === 0) {
            return res.status(400).json({ message: 'No hay órdenes completadas sin dispersar en este rango de fechas.' });
        }

        const business = await Business.findById(businessId);
        
        let totalSales = 0;
        let cardSales = 0;
        let cashSales = 0;
        let deliveryFees = 0;
        let commissionTotal = 0;

        orders.forEach(o => {
            let orderSubtotal = o.subtotal || 0; 
            totalSales += orderSubtotal;
            deliveryFees += (o.deliveryCost || 0);

            const isCard = ['card', 'credit_card', 'debit_card', 'online', 'stripe'].includes(o.paymentMethod);
            if (isCard) {
                cardSales += o.total; 
            } else {
                cashSales += o.total;
            }

            if (o.commission && o.commission.amount) {
                commissionTotal += o.commission.amount;
            } else {
                if (business.commissionWebType === 'percent') {
                    commissionTotal += (orderSubtotal * (business.commissionWebAmount / 100));
                } else {
                    commissionTotal += (business.commissionWebAmount || 0);
                }
            }
        });

        const netToPay = cardSales - commissionTotal;

        const dispersion = new Dispersion({
            businessId,
            periodStart: start,
            periodEnd: end,
            totalOrders: orders.length,
            totalSales,
            cardSales,
            cashSales,
            deliveryFees,
            commissionTotal,
            netToPay,
            status: 'pending',
            createdBy: req.user ? req.user.id : null
        });

        await dispersion.save();

        // Vincular las ordenes a esta dispersión
        await Order.updateMany(
            { _id: { $in: orders.map(o => o._id) } },
            { $set: { dispersionId: dispersion._id } }
        );

        res.json({ success: true, dispersion });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.payDispersion = async (req, res) => {
    try {
        const { id } = req.params;
        const { reference } = req.body;
        const dispersion = await Dispersion.findById(id);
        if (!dispersion) return res.status(404).json({ message: 'Dispersión no encontrada' });

        dispersion.status = 'paid';
        dispersion.paidAt = new Date();
        dispersion.reference = reference || '';
        await dispersion.save();

        res.json({ success: true, dispersion });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.listDispersionsAdmin = async (req, res) => {
    try {
        const query = {};
        if (req.query.businessId) {
            query.businessId = req.query.businessId;
        }
        const dispersions = await Dispersion.find(query).populate('businessId', 'name slug').sort({ createdAt: -1 });
        res.json(dispersions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.listMyDispersions = async (req, res) => {
    try {
        // Asume que req.user.businessId está disponible si es el admin del negocio
        const businessId = req.user.businessId;
        if (!businessId) {
            return res.status(403).json({ message: 'No tienes un negocio asociado' });
        }
        const dispersions = await Dispersion.find({ businessId }).sort({ createdAt: -1 });
        res.json(dispersions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
