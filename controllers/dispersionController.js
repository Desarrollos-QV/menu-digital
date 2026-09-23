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
            dispersionId: null, // null matches both null and missing in MongoDB
            $or: [
                { status: { $in: ['completed', 'delivered', 'ready'] } },
                { paymentMethod: 'stripe', stripePaymentStatus: 'succeeded', status: { $ne: 'cancelled' } }
            ]
        });

        const business = await Business.findById(businessId);
        
        let totalOrders = orders.length;
        let totalSales = 0;
        let cardSales = 0;
        let cashSales = 0;
        let deliveryFees = 0;
        let commissionTotal = 0;
        let stripeFees = 0;

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

            // Comisión Web (Cobrada al cliente, la retenemos)
            let webComm = 0;
            if (o.commission && o.commission.amount) {
                webComm = o.commission.amount;
            } else {
                if (business.commissionWebType === 'percent') {
                    webComm = (orderSubtotal * (business.commissionWebAmount / 100));
                } else {
                    webComm = (business.commissionWebAmount || 0);
                }
            }

            // Comisión Interna (Cobrada al negocio)
            let intComm = 0;
            if (business.commissionInternalAmount > 0) {
                if (business.commissionInternalType === 'percent') {
                    intComm = (orderSubtotal * (business.commissionInternalAmount / 100));
                } else {
                    intComm = business.commissionInternalAmount;
                }
            }
            
            commissionTotal += (webComm + intComm);

            if (o.paymentMethod === 'stripe' && o.stripePaymentStatus === 'succeeded') {
                const sPct = parseFloat(process.env.STRIPE_FEE_PERCENT) || 0;
                const sFix = parseFloat(process.env.STRIPE_FEE_FIXED) || 0;
                stripeFees += (o.total * (sPct / 100)) + sFix;
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
            stripeFees,
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
            dispersionId: null,
            $or: [
                { status: { $in: ['completed', 'delivered', 'ready'] } },
                { paymentMethod: 'stripe', stripePaymentStatus: 'succeeded', status: { $ne: 'cancelled' } }
            ]
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

            // Comisión Web (Cobrada al cliente, la retenemos)
            let webComm = 0;
            if (o.commission && o.commission.amount) {
                webComm = o.commission.amount;
            } else {
                if (business.commissionWebType === 'percent') {
                    webComm = (orderSubtotal * (business.commissionWebAmount / 100));
                } else {
                    webComm = (business.commissionWebAmount || 0);
                }
            }

            // Comisión Interna (Cobrada al negocio)
            let intComm = 0;
            if (business.commissionInternalAmount > 0) {
                if (business.commissionInternalType === 'percent') {
                    intComm = (orderSubtotal * (business.commissionInternalAmount / 100));
                } else {
                    intComm = business.commissionInternalAmount;
                }
            }
            commissionTotal += (webComm + intComm);

            if (o.paymentMethod === 'stripe' && o.stripePaymentStatus === 'succeeded') {
                const sPct = parseFloat(process.env.STRIPE_FEE_PERCENT) || 0;
                const sFix = parseFloat(process.env.STRIPE_FEE_FIXED) || 0;
                stripeFees += (o.total * (sPct / 100)) + sFix;
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
            stripeFees,
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

// ─── RESUMEN GLOBAL DE DISPERSIONES (SuperAdmin Dashboard) ──────────────────
exports.getDispersionSummary = async (req, res) => {
    try {
        const Dispersion = require('../models/Dispersion');

        // 1. KPIs globales
        const [allDisp] = await Promise.all([Dispersion.find({}).populate('businessId', 'name avatar slug').lean()]);

        let totalPending = 0;
        let totalPaid    = 0;
        let totalCommissions = 0;
        let totalSalesAll = 0;

        let monthPending = 0;
        let monthPaid = 0;
        let monthCommissions = 0;
        let monthSales = 0;

        const uniqueBiz = new Set();
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        allDisp.forEach(d => {
            const isThisMonth = new Date(d.createdAt) >= startOfMonth;

            totalCommissions += d.commissionTotal || 0;
            totalSalesAll += d.totalSales || 0;
            if (d.businessId) uniqueBiz.add(String(d.businessId._id || d.businessId));
            
            if (d.status === 'paid') {
                totalPaid += d.netToPay || 0;
                if (isThisMonth) monthPaid += d.netToPay || 0;
            } else {
                totalPending += d.netToPay || 0;
                if (isThisMonth) monthPending += d.netToPay || 0;
            }

            if (isThisMonth) {
                monthCommissions += d.commissionTotal || 0;
                monthSales += d.totalSales || 0;
            }
        });

        // 2. Negocios con órdenes listas para corte (SIN DISPERSIÓN)
        const Order = require('../models/Order');
        const uncutOrders = await Order.find({ 
            dispersionId: null, 
            $or: [
                { status: { $in: ['completed', 'delivered', 'ready'] } },
                { paymentMethod: 'stripe', stripePaymentStatus: 'succeeded', status: { $ne: 'cancelled' } }
            ]
        }).populate('businessId', 'name avatar slug commissionInternalAmount commissionInternalType commissionWebType commissionWebAmount');

        const byBusiness = {};

        uncutOrders.forEach(o => {
            const biz = o.businessId;
            if (!biz) return;
            const bizId = String(biz._id);

            if (!byBusiness[bizId]) {
                let rateStr = 'Sin Comisión';
                if (biz.commissionInternalAmount > 0) {
                    rateStr = biz.commissionInternalType === 'percent' ? `${biz.commissionInternalAmount}%` : `$${biz.commissionInternalAmount}`;
                }

                byBusiness[bizId] = {
                    businessId: bizId,
                    name:       biz.name   || 'Desconocido',
                    avatar:     biz.avatar || '',
                    slug:       biz.slug   || '',
                    commissionRate: rateStr,
                    totalSales:      0,
                    commissionTotal: 0,
                    netToPay:        0, // Aqui sumaremos temporalmente las ventas por tarjeta
                    totalOrders:     0,
                    oldestOrderDate: o.createdAt,
                    newestOrderDate: o.createdAt
                };
            }
            
            const b = byBusiness[bizId];
            
            let orderSubtotal = o.subtotal || 0;
            b.totalSales += orderSubtotal;
            b.totalOrders += 1;

            if (new Date(o.createdAt) < new Date(b.oldestOrderDate)) b.oldestOrderDate = o.createdAt;
            if (new Date(o.createdAt) > new Date(b.newestOrderDate)) b.newestOrderDate = o.createdAt;

            // Comisión Web
            let webComm = 0;
            if (o.commission && o.commission.amount) {
                webComm = o.commission.amount;
            } else {
                if (biz.commissionWebType === 'percent') {
                    webComm = (orderSubtotal * (biz.commissionWebAmount / 100));
                } else {
                    webComm = (biz.commissionWebAmount || 0);
                }
            }

            // Comisión Interna
            let intComm = 0;
            if (biz.commissionInternalAmount > 0) {
                if (biz.commissionInternalType === 'percent') {
                    intComm = (orderSubtotal * (biz.commissionInternalAmount / 100));
                } else {
                    intComm = biz.commissionInternalAmount;
                }
            }

            b.commissionTotal += (webComm + intComm);

            const isCard = ['card', 'credit_card', 'debit_card', 'online', 'stripe'].includes(o.paymentMethod);
            if (isCard) {
                b.netToPay += o.total; // Sumar ventas por tarjeta
            }
        });

        // netToPay final = cardSales - commissionTotal
        Object.values(byBusiness).forEach(b => {
            b.netToPay = b.netToPay - b.commissionTotal;
        });

        const businessesPending = Object.values(byBusiness)
            .sort((a, b) => b.netToPay - a.netToPay);

        res.json({
            kpis: {
                // Histórico TODO
                totalToDisperseAll: parseFloat((totalPending + totalPaid).toFixed(2)),
                totalPending:       parseFloat(totalPending.toFixed(2)),
                totalPaid:          parseFloat(totalPaid.toFixed(2)),
                totalCommissions:   parseFloat(totalCommissions.toFixed(2)),
                totalSalesAll:      parseFloat(totalSalesAll.toFixed(2)),
                uniqueBusinessesCount: uniqueBiz.size,
                pendingBusinesses:  businessesPending.length,
                // Mes actual
                monthPending:       parseFloat(monthPending.toFixed(2)),
                monthPaid:          parseFloat(monthPaid.toFixed(2)),
                monthCommissions:   parseFloat(monthCommissions.toFixed(2)),
                monthSales:         parseFloat(monthSales.toFixed(2))
            },
            businessesPending
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
