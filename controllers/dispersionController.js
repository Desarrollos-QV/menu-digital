const Order = require('../models/Order');
const Business = require('../models/Business');
const Dispersion = require('../models/Dispersion');
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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
                { paymentMethod: { $nin: ['card', 'credit_card', 'debit_card', 'online', 'stripe'] }, status: { $nin: ['cancelled', 'rejected'] } },
                { stripePaymentStatus: 'succeeded', status: { $nin: ['cancelled', 'rejected'] } }
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
            totalSales += (o.total || 0); // Sumar el total completo para que Cuadre con los ingresos reales
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

            if (isCard && o.total > 0) {
                const sPct = parseFloat(process.env.STRIPE_FEE_PERCENT) || 4.1;
                const sFix = parseFloat(process.env.STRIPE_FEE_FIXED) || 3;
                let sFee = (o.total * (sPct / 100)) + sFix;
                sFee = sFee * 1.16; // IVA
                stripeFees += sFee;
            }
        });

        const MAINTENANCE_FEE = parseFloat(process.env.MAINTENANCE_FEE) || 70;
        const netToPay = cardSales - commissionTotal - stripeFees - MAINTENANCE_FEE;

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
            maintenanceFee: MAINTENANCE_FEE,
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
                { paymentMethod: { $nin: ['card', 'credit_card', 'debit_card', 'online', 'stripe'] }, status: { $nin: ['cancelled', 'rejected'] } },
                { stripePaymentStatus: 'succeeded', status: { $nin: ['cancelled', 'rejected'] } }
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
            totalSales += (o.total || 0);
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

            if (isCard && o.total > 0) {
                const sPct = parseFloat(process.env.STRIPE_FEE_PERCENT) || 4.1;
                const sFix = parseFloat(process.env.STRIPE_FEE_FIXED) || 3;
                let sFee = (o.total * (sPct / 100)) + sFix;
                sFee = sFee * 1.16;
                stripeFees += sFee;
            }
        });

        const MAINTENANCE_FEE = parseFloat(process.env.MAINTENANCE_FEE) || 70;
        const netToPay = cardSales - commissionTotal - stripeFees - MAINTENANCE_FEE;

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
            maintenanceFee: MAINTENANCE_FEE,
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

        // --- LÓGICA DE NOTIFICACIÓN TWILIO A RESTAURANTE ---
        if (business.phone) {
            try {
                // Formatear fechas para el mensaje
                const formatDate = (date) => new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                
                const toPhone = `whatsapp:+521${business.phone}`;
                const fromPhone = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
                const msg = `🔔 *Tengo Hambre - Resumen de Corte*\nHola *${business.name}*, se ha generado tu corte de ventas en la plataforma.\n\n📅 *Período:* ${formatDate(start)} al ${formatDate(end)}\n📦 *Pedidos incluidos:* ${orders.length}\n💰 *Balance final:* $${netToPay.toFixed(2)}\n\n✅ *Tus deudas pendientes de este período han sido liquidadas.*`;

                await client.messages.create({
                    body: msg,
                    from: fromPhone,
                    to: toPhone
                });
            } catch (twilioErr) {
                console.error("Error enviando WhatsApp de corte:", twilioErr.message);
            }
        }
        // ----------------------------------------------------

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

// ─── BALANCE POR RESTAURANTE (SuperAdmin → Billetera → Balance) ─────────────
// Balance = Saldos con Tarjeta (no dispersado) - (Comisión pendiente + Mantenimiento)
//   > 0  → la plataforma le debe al restaurante
//   < 0  → el restaurante le debe a la plataforma
// Comisión: SOLO una por restaurante → % interno (ej. 5%) o fijo por pedido (ej. $5).
// Query opcional: ?month=YYYY-MM (por defecto el mes actual, hora Monterrey)
exports.getBalanceSummary = async (req, res) => {
    try {
        const tzHelper = require('../helper/timezone');
        const MAINTENANCE_FEE = parseFloat(process.env.MAINTENANCE_FEE) || 70;
        const STRIPE_FEE_PERCENT = parseFloat(process.env.STRIPE_FEE_PERCENT) || 4.1;
        const STRIPE_FEE_FIXED   = parseFloat(process.env.STRIPE_FEE_FIXED) || 3;
        const CARD_METHODS = ['card', 'credit_card', 'debit_card', 'online', 'stripe'];
        const r2 = n => parseFloat((n || 0).toFixed(2));

        // 1. Rango del mes (Alineado con getDailySales para que no haya discrepancia de zonas horarias)
        let y, m;
        if (/^\d{4}-\d{2}$/.test(req.query.month || '')) {
            const parts = req.query.month.split('-');
            y = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
        } else {
            const d = new Date();
            y = d.getFullYear();
            m = d.getMonth() + 1;
        }
        const mStr = m.toString().padStart(2, '0');
        // getDailySales usa new Date('YYYY-MM-DDT00:00:00')
        const start = new Date(`${y}-${mStr}-01T00:00:00`);
        // Para obtener el fin de mes:
        let nextM = m + 1;
        let nextY = y;
        if (nextM > 12) { nextM = 1; nextY++; }
        const nextMStr = nextM.toString().padStart(2, '0');
        const end = new Date(new Date(`${nextY}-${nextMStr}-01T00:00:00`).getTime() - 1);

        // 2. Órdenes válidas del mes (Para calcular actividad: Ventas y Comisiones)
        const monthOrders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            $or: [
                { paymentMethod: { $nin: CARD_METHODS }, status: { $nin: ['cancelled', 'rejected'] } },
                { stripePaymentStatus: 'succeeded', status: { $nin: ['cancelled', 'rejected'] } }
            ]
        }).select('businessId subtotal total paymentMethod dispersionId').lean();

        // 2.5 Órdenes pendientes históricas (Para calcular la deuda real acumulada)
        // A petición del administrador, se ignoran deudas de antes del 1 de Julio de 2026
        const CUTOFF_DATE = new Date('2026-07-01T00:00:00');
        const pendingOrders = await Order.find({
            createdAt: { $gte: CUTOFF_DATE, $lte: end },
            dispersionId: null,
            $or: [
                { paymentMethod: { $nin: CARD_METHODS }, status: { $nin: ['cancelled', 'rejected'] } },
                { stripePaymentStatus: 'succeeded', status: { $nin: ['cancelled', 'rejected'] } }
            ]
        }).select('businessId subtotal total paymentMethod dispersionId').lean();

        // 3. Negocios: activos + cualquiera que tenga actividad o saldos pendientes
        const bizIds1 = monthOrders.map(o => String(o.businessId)).filter(Boolean);
        const bizIds2 = pendingOrders.map(o => String(o.businessId)).filter(Boolean);
        const bizIdsWithOrders = [...new Set([...bizIds1, ...bizIds2])];
        
        const businesses = await Business.find({
            $or: [{ active: true }, { _id: { $in: bizIdsWithOrders } }]
        }).select('name avatar slug active commissionInternalType commissionInternalAmount commissionWebType commissionWebAmount').lean();

        const byBiz = {};
        businesses.forEach(b => {
            let type = 'none';
            let amount = 0;
            if ((b.commissionInternalAmount || 0) > 0) {
                type = b.commissionInternalType;
                amount = b.commissionInternalAmount;
            } else if ((b.commissionWebAmount || 0) > 0) {
                type = b.commissionWebType;
                amount = b.commissionWebAmount;
            }

            byBiz[String(b._id)] = {
                businessId:        String(b._id),
                businessName:      b.name || 'Desconocido',
                avatar:            b.avatar || '',
                slug:              b.slug || '',
                commissionType:    type,          // 'percent' | 'fixed' | 'none'
                commissionValue:   amount,        // 5 (→ 5%) ó 5 (→ $5 por pedido)
                commissionRate:    type === 'percent' ? `${amount}%` : (type === 'fixed' ? `$${amount} x pedido` : 'Sin comisión'),
                cashSales:         0,
                cardSales:         0,
                totalOrders:       0,
                commission:        0,             // comisión generada en el mes (informativa)
                commissionPending: 0,             // comisión de pedidos aún NO dispersados (la que se cobra aquí)
                maintenance:       MAINTENANCE_FEE,
                cardBalance:       0,             // ventas con tarjeta aún NO dispersadas
                balance:           0
            };
        });

        // 4. Acumular actividad del mes actual (Solo para mostrar ventas)
        monthOrders.forEach(o => {
            const b = byBiz[String(o.businessId)];
            if (!b) return;

            const subtotal = o.subtotal || 0;
            const isCard   = CARD_METHODS.includes(o.paymentMethod);

            b.totalOrders += 1;
            
            // Se usa el subtotal para las columnas de Ventas para que el 5% cuadre visualmente
            if (isCard) b.cardSales += subtotal; else b.cashSales += subtotal;

            // Comisión generada en el mes: % sobre subtotal ó fijo por pedido
            let comm = 0;
            if (b.commissionType === 'percent') comm = subtotal * (b.commissionValue / 100);
            else if (b.commissionType === 'fixed') comm = b.commissionValue;

            b.commission += comm;
        });

        // 4.5 Acumular deuda pendiente (Saldos con tarjeta y Comisiones no dispersadas)
        pendingOrders.forEach(o => {
            const b = byBiz[String(o.businessId)];
            if (!b) return;

            const subtotal = o.subtotal || 0;
            const total = o.total || 0;
            const isCard = CARD_METHODS.includes(o.paymentMethod);

            // Comisión pendiente
            let comm = 0;
            if (b.commissionType === 'percent') comm = subtotal * (b.commissionValue / 100);
            else if (b.commissionType === 'fixed') comm = b.commissionValue;

            b.commissionPending += comm;

            // El saldo a favor que tenemos nosotros es el TOTAL del cargo de Stripe menos comisiones de Stripe
            if (isCard) {
                let sFee = 0;
                if (total > 0) {
                    sFee = (total * (STRIPE_FEE_PERCENT / 100)) + STRIPE_FEE_FIXED;
                    sFee = sFee * 1.16; // IVA
                }
                b.cardBalance += (total - sFee);
            }
        });

        // 5. Balance final
        const result = Object.values(byBiz).map(b => {
            // El usuario solicitó explícitamente restar el TOTAL de comisiones PENDIENTES + mantenimiento contra el saldo con tarjeta.
            // Ojo: Si el negocio tuvo ventas pero ya se le dispersó todo, su commissionPending es 0. 
            // Su mantenimiento del mes sí se cobra, por lo que el totalFees será mantenimiento + comisiones pendientes.
            // Para que cuadre matemáticamente con el mes actual, sumaremos el mantenimiento.
            const totalFees = b.commissionPending + b.maintenance;
            const balance = totalFees - b.cardBalance; // Deuda - Saldo = Balance
            
            // Si balance > 0, significa que Deuda > Saldo (El restaurante le debe a la plataforma "Nos deben")
            // Si balance < 0, significa que Saldo > Deuda (La plataforma le debe al restaurante "Debemos")
            return {
                ...b,
                cashSales:         r2(b.cashSales),
                cardSales:         r2(b.cardSales),
                commission:        r2(b.commission),
                commissionPending: r2(b.commissionPending),
                maintenance:       r2(b.maintenance),
                totalFees:         r2(totalFees),
                cardBalance:       r2(b.cardBalance),
                balance:           r2(balance),
                status:            balance > 0 ? 'we_owe' : (balance < 0 ? 'they_owe' : 'zero')
            };
        }).sort((a, b) => (b.cashSales + b.cardSales) - (a.cashSales + a.cardSales));

        // 6. KPIs del mes (cards superiores + resumen inferior)
        const k = {
            cashSales: 0, cardSales: 0, totalSales: 0, totalOrders: 0,
            commissionPercent: 0, commissionFixed: 0, maintenance: 0, totalFees: 0,
            cardBalance: 0, monthlyProfit: 0,
            withDebtCount: 0, toCollectCount: 0, zeroCount: 0
        };
        result.forEach(r => {
            k.cashSales   += r.cashSales;
            k.cardSales   += r.cardSales;
            k.totalOrders += r.totalOrders;
            k.maintenance += r.maintenance;
            k.cardBalance += r.cardBalance;
            k.totalFees   += r.totalFees;
            if (r.commissionType === 'percent') k.commissionPercent += r.commission;
            if (r.commissionType === 'fixed')   k.commissionFixed   += r.commission;
            if (r.status === 'they_owe') k.withDebtCount++;
            else if (r.status === 'we_owe') k.toCollectCount++;
            else k.zeroCount++;
        });
        k.totalSales    = k.cashSales + k.cardSales;
        // Ganancia mensual de la plataforma = comisiones (5% + $5) + mantenimiento
        k.monthlyProfit = k.commissionPercent + k.commissionFixed + k.maintenance;
        ['cashSales','cardSales','totalSales','commissionPercent','commissionFixed','maintenance','totalFees','cardBalance','monthlyProfit']
            .forEach(key => { k[key] = r2(k[key]); });

        const monthKey = start.toLocaleDateString('en-CA', { timeZone: 'America/Monterrey' }).substring(0, 7);

        res.json({ month: monthKey, kpis: k, rows: result });
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
            $or: [
                // Como filtramos por tarjeta arriba, en realidad solo aplica la regla de Stripe, pero mantenemos la lógica por seguridad
                { paymentMethod: { $nin: ['card', 'credit_card', 'debit_card', 'online', 'stripe'] }, status: { $nin: ['cancelled', 'rejected'] } },
                { stripePaymentStatus: 'succeeded', status: { $nin: ['cancelled', 'rejected'] } }
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
            const isCard = ['card', 'credit_card', 'debit_card', 'online', 'stripe'].includes(o.paymentMethod);

            r.totalOrders++;
            r.totalSales += orderSubtotal;
            if (isCard) r.cardSales += orderTotal;

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
            if (isCard && orderTotal > 0) {
                sFee = (orderTotal * (STRIPE_FEE_PERCENT / 100)) + STRIPE_FEE_FIXED;
                sFee = sFee * 1.16; // IVA
            }
            r.stripeFees += sFee;

            r.netToPay += (isCard ? orderTotal : 0) - totalComm - sFee;

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
            $or: [
                { paymentMethod: { $nin: ['card', 'credit_card', 'debit_card', 'online', 'stripe'] }, status: { $nin: ['cancelled', 'rejected'] } },
                { stripePaymentStatus: 'succeeded', status: { $nin: ['cancelled', 'rejected'] } }
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
                const isCard = ['card', 'credit_card', 'debit_card', 'online', 'stripe'].includes(o.paymentMethod);
                
                totalOrders++;
                if (isCard) cardSales += orderTotal;

                let webComm = o.commission?.amount || (business.commissionWebType === 'percent' ? (orderSubtotal * (business.commissionWebAmount / 100)) : (business.commissionWebAmount || 0));
                let intComm = business.commissionInternalAmount > 0 ? (business.commissionInternalType === 'percent' ? (orderSubtotal * (business.commissionInternalAmount / 100)) : business.commissionInternalAmount) : 0;
                commissionTotal += (webComm + intComm);

                let sFee = 0;
                if (isCard && orderTotal > 0) {
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
