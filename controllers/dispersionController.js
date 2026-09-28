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
        const dispersions = await Dispersion.find(query).populate('businessId', 'name slug phone').sort({ createdAt: -1 });
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
exports.getDailySales = async (req, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) return res.status(400).json({ message: 'start y end requeridos' });

        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T23:59:59.999');

        const orders = await Order.find({
            createdAt: { $gte: startDate, $lte: endDate },
            paymentMethod: { $in: ['card', 'credit_card', 'debit_card', 'online', 'stripe'] },
            $or: [
                { status: { $in: ['completed', 'delivered', 'ready'] } },
                { stripePaymentStatus: 'succeeded', status: { $ne: 'cancelled' } }
            ]
        }).populate('businessId', 'name slug phone commissionInternalAmount commissionInternalType commissionWebType commissionWebAmount').populate('dispersionId', 'status');

        const STRIPE_FEE_PERCENT = parseFloat(process.env.STRIPE_FEE_PERCENT) || 4.1;
        const STRIPE_FEE_FIXED = parseFloat(process.env.STRIPE_FEE_FIXED) || 3;

        const days = {};

        orders.forEach(o => {
            const biz = o.businessId;
            if (!biz) return;
            const dayKey = new Date(o.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD local
            
            if (!days[dayKey]) {
                days[dayKey] = {
                    date: dayKey,
                    totalOrders: 0,
                    totalSales: 0,
                    commissionTotal: 0,
                    stripeFees: 0,
                    netToPay: 0,
                    pendingCount: 0,
                    restaurants: {}
                };
            }
            
            const g = days[dayKey];
            const bizId = String(biz._id);

            if (!g.restaurants[bizId]) {
                g.restaurants[bizId] = {
                    businessId: { _id: bizId, name: biz.name, phone: biz.phone },
                    totalOrders: 0,
                    totalSales: 0,
                    cardSales: 0,
                    commissionTotal: 0,
                    stripeFees: 0,
                    netToPay: 0,
                    status: 'paid', // asumimos paid hasta que encontremos un pending
                    _date: dayKey
                };
            }
            const r = g.restaurants[bizId];

            let orderSubtotal = o.subtotal || 0;
            let orderTotal = o.total || 0;

            r.totalOrders++;
            r.totalSales += orderSubtotal;
            r.cardSales += orderTotal;

            // Comision Web
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

            // Comision Interna
            let intComm = 0;
            if (biz.commissionInternalAmount > 0) {
                if (biz.commissionInternalType === 'percent') {
                    intComm = (orderSubtotal * (biz.commissionInternalAmount / 100));
                } else {
                    intComm = biz.commissionInternalAmount;
                }
            }
            
            const totalComm = webComm + intComm;
            r.commissionTotal += totalComm;

            // Stripe fee
            let sFee = 0;
            if (orderTotal > 0) {
                sFee = (orderTotal * (STRIPE_FEE_PERCENT / 100)) + STRIPE_FEE_FIXED;
                sFee = sFee * 1.16; // IVA
            }
            r.stripeFees += sFee;

            r.netToPay += (orderTotal - totalComm - sFee);

            // Verificar si este pedido esta pagado
            // Esta pagado si tiene un dispersionId y el status del dispersion es 'paid'
            const isOrderPaid = o.dispersionId && o.dispersionId.status === 'paid';
            if (!isOrderPaid) {
                r.status = 'pending';
            }
        });

        // Convertir diccionarios a arrays
        const result = Object.values(days).map(day => {
            let dayPending = 0;
            let dayTotalSales = 0;
            let dayComm = 0;
            let dayStripe = 0;
            let dayNet = 0;
            let dayOrders = 0;

            const rests = Object.values(day.restaurants).map(r => {
                if (r.status === 'pending') dayPending++;
                dayTotalSales += r.cardSales;
                dayComm += r.commissionTotal;
                dayStripe += r.stripeFees;
                dayNet += r.netToPay;
                dayOrders += r.totalOrders;
                return r;
            });
            
            return {
                date: day.date,
                totalOrders: dayOrders,
                totalSales: dayTotalSales,
                commissionTotal: dayComm,
                stripeFees: dayStripe,
                netToPay: dayNet,
                pendingCount: dayPending,
                restaurants: rests
            };
        });

        // Ordenar de mas reciente a mas antiguo
        result.sort((a, b) => b.date.localeCompare(a.date));

        res.json(result);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.payDayDispersion = async (req, res) => {
    try {
        const { businessId, date, reference } = req.body;
        if (!businessId || !date) return res.status(400).json({ message: 'businessId y date requeridos' });

        const startDate = new Date(date + 'T00:00:00');
        const endDate = new Date(date + 'T23:59:59.999');

        const orders = await Order.find({
            businessId,
            createdAt: { $gte: startDate, $lte: endDate },
            paymentMethod: { $in: ['card', 'credit_card', 'debit_card', 'online', 'stripe'] },
            $or: [
                { status: { $in: ['completed', 'delivered', 'ready'] } },
                { stripePaymentStatus: 'succeeded', status: { $ne: 'cancelled' } }
            ]
        }).populate('businessId');

        if (orders.length === 0) return res.status(400).json({ message: 'No hay pedidos validos en este dia' });
        
        let totalOrders = 0;
        let cardSales = 0;
        let commissionTotal = 0;
        let stripeFees = 0;
        
        const STRIPE_FEE_PERCENT = parseFloat(process.env.STRIPE_FEE_PERCENT) || 4.1;
        const STRIPE_FEE_FIXED = parseFloat(process.env.STRIPE_FEE_FIXED) || 3;

        const business = orders[0].businessId;

        const ordersToCut = orders.filter(o => !o.dispersionId);
        let dispersionCreated = null;
        
        if (ordersToCut.length > 0) {
            ordersToCut.forEach(o => {
                let orderSubtotal = o.subtotal || 0;
                let orderTotal = o.total || 0;
                totalOrders++;
                cardSales += orderTotal;

                let webComm = o.commission?.amount || (business.commissionWebType === 'percent' ? (orderSubtotal * (business.commissionWebAmount / 100)) : (business.commissionWebAmount || 0));
                let intComm = business.commissionInternalAmount > 0 ? (business.commissionInternalType === 'percent' ? (orderSubtotal * (business.commissionInternalAmount / 100)) : business.commissionInternalAmount) : 0;
                commissionTotal += (webComm + intComm);

                let sFee = 0;
                if (orderTotal > 0) {
                    sFee = (orderTotal * (STRIPE_FEE_PERCENT / 100)) + STRIPE_FEE_FIXED;
                    sFee = sFee * 1.16; 
                }
                stripeFees += sFee;
            });

            const netToPay = cardSales - commissionTotal - stripeFees;

            dispersionCreated = new Dispersion({
                businessId,
                periodStart: startDate,
                periodEnd: endDate,
                totalOrders,
                totalSales: cardSales,
                cardSales,
                cashSales: 0,
                deliveryFees: 0,
                commissionTotal,
                stripeFees,
                netToPay,
                status: 'paid',
                paidAt: new Date(),
                reference: reference || 'PAGO DIARIO',
                createdBy: req.user ? req.user.id : null
            });
            await dispersionCreated.save();

            await Order.updateMany(
                { _id: { $in: ordersToCut.map(o => o._id) } },
                { $set: { dispersionId: dispersionCreated._id } }
            );
        }

        // Ademas si habia ordenes q ya tenian dispersionId pero estaba en pending, la ponemos en paid
        const dispersionIds = [...new Set(orders.filter(o => o.dispersionId).map(o => String(o.dispersionId._id || o.dispersionId)))];
        if (dispersionIds.length > 0) {
            await Dispersion.updateMany(
                { _id: { $in: dispersionIds }, status: 'pending' },
                { $set: { status: 'paid', paidAt: new Date(), reference: reference || 'PAGO DIARIO' } }
            );
            
            if (!dispersionCreated) {
                dispersionCreated = await Dispersion.findById(dispersionIds[0]).populate('businessId');
            }
        }
        
        if (dispersionCreated && !dispersionCreated.populated('businessId')) {
             await dispersionCreated.populate('businessId');
        }

        res.json({ success: true, dispersion: dispersionCreated });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
