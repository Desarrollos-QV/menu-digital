const Business = require('../models/Business');
const User = require('../models/User');
const Order = require('../models/Order');


const Visit = require('../models/Visit');

// Obtener estadísticas globales del Dashboard (Visitas y Ganancias por modelo temporal)
exports.getDashboardStats = async (req, res) => {
    try {
        const queryFilter = {}; // Toda la historia base
        const monthFilter = req.query.month; // 'current', 'last', 'year'
        const clientTzOffset = parseInt(req.query.tzOffset) || 0; // Offset en minutos enviado desde el browser
        
        const now = new Date();
        const start = new Date();
        
        const visitQueryFilter = {};
        const orderQueryFilter = {};
        const visitCountByDate = {};
        const profitByDate = {};

        // Helper para evitar desfase de Zona Horaria al imprimir YYYY-MM
        const getLocalKey = (d, isMonth) => {
            // El browser manda 360 para -06:00. Restamos eso al tiempo UTC para obtener el tiempo local del cliente
            const tzOffMs = clientTzOffset * 60000; 
            const localISO = new Date(d.getTime() - tzOffMs).toISOString();
            return isMonth ? localISO.substring(0, 7) : localISO.split('T')[0];
        };

        const fillDays = (startDate, endDate) => {
            let cursor = new Date(startDate);
            while (cursor <= endDate) {
                const k = getLocalKey(cursor, false);
                visitCountByDate[k] = 0;
                profitByDate[k] = 0;
                cursor.setDate(cursor.getDate() + 1);
            }
        };

        const fillMonths = (startDate, endDate) => {
            let cursor = new Date(startDate);
            while (cursor <= endDate) {
                const k = getLocalKey(cursor, true);
                visitCountByDate[k] = 0;
                profitByDate[k] = 0;
                cursor.setMonth(cursor.getMonth() + 1);
            }
        };

        if (monthFilter === 'current') {
            start.setDate(1); start.setHours(0,0,0,0);
            visitQueryFilter.date = { $gte: start, $lte: now };
            orderQueryFilter.createdAt = { $gte: start, $lte: now };
            fillDays(start, now);
        } else if (monthFilter === 'last') {
            start.setMonth(start.getMonth() - 1); start.setDate(1); start.setHours(0,0,0,0);
            const end = new Date(start); end.setMonth(end.getMonth() + 1); end.setDate(0); end.setHours(23,59,59,999);
            visitQueryFilter.date = { $gte: start, $lte: end };
            orderQueryFilter.createdAt = { $gte: start, $lte: end };
            fillDays(start, end);
        } else if (monthFilter === 'year') {
            start.setMonth(0); start.setDate(1); start.setHours(0,0,0,0);
            visitQueryFilter.date = { $gte: start, $lte: now };
            orderQueryFilter.createdAt = { $gte: start, $lte: now };
            fillMonths(start, now);
        }

        // 1. Obtener Visitas según filtro
        const visits = await Visit.find(visitQueryFilter).select('date');
        visits.forEach(v => {
            if (!v.date) return;
            let groupKey = getLocalKey(v.date, monthFilter === 'year');
            visitCountByDate[groupKey] = (visitCountByDate[groupKey] || 0) + 1;
        });

        // 2. Obtener Comisiones (Órdenes) según filtro
        const orders = await Order.find({
            ...orderQueryFilter,
            $or: [ { "commission.amount": { $gt: 0 } } ]
        }).select('createdAt commission total tax subtotal');

        orders.forEach(o => {
            let groupKey = getLocalKey(o.createdAt, monthFilter === 'year');
            
            const subtotal = o.subtotal || (o.total - (o.tax || 0));
            let profit = 0;
            if (o.commission?.type === 'percent') {
                profit = subtotal * (o.commission.amount / 100);
            } else if (o.commission?.type === 'fixed') {
                profit = o.commission.amount;
            }
            profitByDate[groupKey] = (profitByDate[groupKey] || 0) + profit;
        });

        // 3. Totales de Hoy
        const todayStr = getLocalKey(now, false);
        const todayVisits = visitCountByDate[todayStr] || 0;
        const todayProfits = profitByDate[todayStr] || 0;
        
        // Contar pedidos de hoy independientemente de si tienen comisión o no
        const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
        const todayOrdersCount = await Order.countDocuments({ createdAt: { $gte: todayStart, $lte: now } });

        // 4. Totales Globales (Negocios y Clientes/Usuarios)
        const totalBusinesses = await Business.countDocuments();
        const activeBusinesses = await Business.countDocuments({ active: true });
        
        // Nota: commissionDebt se calcula sumando las deudas de todos los negocios
        // Para eficiencia, podríamos usar una agregación, pero usaremos el cálculo de getAllBusinesses simplificado
        const allBusinesses = await Business.find().lean();
        let totalPlatformDebt = 0;
        
        // Cálculo rápido de deuda (basado en lógica de getAllBusinesses)
        const allOrders = await Order.find({ "commission.amount": { $gt: 0 } }).lean();
        const bizProfits = {};
        allOrders.forEach(o => {
            const subtotal = o.subtotal || (o.total - (o.tax || 0));
            let profit = 0;
            if (o.commission?.type === 'percent') profit = subtotal * (o.commission.amount / 100);
            else profit = o.commission.amount;
            bizProfits[o.businessId] = (bizProfits[o.businessId] || 0) + profit;
        });
        
        allBusinesses.forEach(biz => {
            const earned = bizProfits[biz._id] || 0;
            const paid = (biz.commissionPayments || []).reduce((s, p) => s + p.amount, 0);
            totalPlatformDebt += Math.max(0, earned - paid);
        });

        res.json({
            kpis: {
                todayProfits: parseFloat(todayProfits.toFixed(2)),
                todayOrders: todayOrdersCount,
                todayVisits: todayVisits,
                totalBusinesses,
                activeBusinesses,
                totalDebt: parseFloat(totalPlatformDebt.toFixed(2))
            },
            visits: Object.keys(visitCountByDate).map(date => ({ date, count: visitCountByDate[date] })).sort((a,b) => a.date.localeCompare(b.date)),
            profits: Object.keys(profitByDate).map(date => ({ date, amount: profitByDate[date] })).sort((a,b) => a.date.localeCompare(b.date))
        });

    } catch(e) {
        res.status(500).json({ message: e.message });
    }
};

// Listar todos los negocios (Solo para SuperAdmin)
// Calcula commissionDebt en tiempo real desde las órdenes de cada negocio
exports.getAllBusinesses = async (req, res) => {
    try {
        const businesses = await Business.find().sort({ createdAt: -1 }).lean();

        // Calcular deuda real de comisiones para cada negocio en paralelo
        const businessesWithDebt = await Promise.all(
            businesses.map(async (biz) => {
                try {
                    const orders = await Order.find({ businessId: biz._id }).lean();

                    let totalEarned = 0;
                    let totalRevenue = 0;
                    const totalOrders = orders.length;

                    for (const order of orders) {
                        totalRevenue += order.total || 0;
                        if (order.commission && order.commission.amount > 0) {
                            const subtotal = order.subtotal || (order.total - (order.tax || 0));
                            if (order.commission.type === 'percent') {
                                totalEarned += subtotal * (order.commission.amount / 100);
                            } else {
                                totalEarned += order.commission.amount;
                            }
                        }
                    }

                    const totalPaid = (biz.commissionPayments || []).reduce((s, p) => s + p.amount, 0);
                    const currentDebt = Math.max(0, totalEarned - totalPaid);

                    return {
                        ...biz,
                        commissionDebt: parseFloat(currentDebt.toFixed(2)),
                        totalRevenue:   parseFloat(totalRevenue.toFixed(2)),
                        totalOrders
                    };
                } catch (e) {
                    return biz;
                }
            })
        );


        res.json(businessesWithDebt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Registrar un Nuevo Negocio + Su Usuario Admin
exports.createBusiness = async (req, res) => {
    const { businessName, ownerEmail, username, password, plan,
            commissionWebType, commissionWebAmount,
            commissionPosType, commissionPosAmount } = req.body;
    
    try {
        // 1. Crear el Negocio
        const newBusiness = new Business({
            name: businessName,
            ownerEmail: ownerEmail,
            slug: businessName.toLowerCase().replace(/ /g, '-'),
            plan: plan || 'free',
            commissionWebType:   commissionWebType   || 'percent',
            commissionWebAmount: commissionWebAmount  ?? 0,
            commissionPosType:   commissionPosType   || 'percent',
            commissionPosAmount: commissionPosAmount  ?? 0
        });
        const savedBusiness = await newBusiness.save();

        // 2. Crear el Usuario Admin para ese negocio
        const newUser = new User({
            username,
            email : ownerEmail,
            password,
            role: 'admin_negocio',
            businessId: savedBusiness._id
        });
        await newUser.save();

        res.status(201).json({ 
            message: 'Negocio y Usuario creados', 
            business: savedBusiness,
            user: { username: newUser.username }
        });

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


// EDITAR NEGOCIO
exports.updateBusiness = async (req, res) => {
    try {
        const { name, ownerEmail, slug, plan, phone, address, isOpen, active, isTrending,
                lat, lng, allowDelivery, allowPickup,
                commissionWebType, commissionWebAmount,
                commissionPosType, commissionPosAmount } = req.body;

        const updateData = { name, ownerEmail, slug, plan };

        if (phone             !== undefined) updateData.phone             = phone;
        if (address           !== undefined) updateData.address           = address;
        if (isOpen            !== undefined) updateData.isOpen            = isOpen;
        if (active            !== undefined) updateData.active            = active;
        if (isTrending        !== undefined) updateData.isTrending        = isTrending;
        if (lat               !== undefined) updateData.lat               = lat;
        if (lng               !== undefined) updateData.lng               = lng;
        if (allowDelivery     !== undefined) updateData.allowDelivery     = allowDelivery;
        if (allowPickup       !== undefined) updateData.allowPickup       = allowPickup;
        // Comisiones
        if (commissionWebType   !== undefined) updateData.commissionWebType   = commissionWebType;
        if (commissionWebAmount !== undefined) updateData.commissionWebAmount = commissionWebAmount;
        if (commissionPosType   !== undefined) updateData.commissionPosType   = commissionPosType;
        if (commissionPosAmount !== undefined) updateData.commissionPosAmount = commissionPosAmount;

        const updatedBusiness = await Business.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        res.json(updatedBusiness);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// ELIMINAR NEGOCIO
exports.deleteBusiness = async (req, res) => {
    try {
        const businessId = req.params.id;
        
        // 1. Eliminar el negocio
        await Business.findByIdAndDelete(businessId);
        
        // 2. (Opcional pero recomendado) Eliminar usuarios asociados para que no queden huérfanos
        await User.deleteMany({ businessId: businessId });
        
        // NOTA: En un sistema real, también deberías borrar Productos, Categorías, etc. 
        // vinculados a este businessId para no dejar basura en la BD.

        res.json({ message: 'Negocio y accesos eliminados correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Bloquear/Activar Negocio
exports.toggleBusinessStatus = async (req, res) => {
    try {
        const business = await Business.findById(req.params.id);
        business.active = !business.active;
        await business.save();
        res.json({ message: `Negocio ${business.active ? 'Activado' : 'Bloqueado'}`, active: business.active });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Obtener stats de comisiones de UN negocio
exports.getCommissionStats = async (req, res) => {
    try {
        const business = await Business.findById(req.params.id);
        if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

        // Sumar total ganado por comisiones de órdenes registradas
        const orders = await Order.find({ businessId: req.params.id });

        let totalWebEarned = 0;
        let totalPosEarned = 0;
        let totalOrders = orders.length;

        for (const order of orders) {
            if (order.commission && order.commission.amount > 0) {
                const subtotal = order.subtotal || (order.total - (order.tax || 0));
                if (order.commission.origin === 'whatsapp' || order.source === 'whatsapp') {
                    if (order.commission.type === 'percent') {
                        totalWebEarned += subtotal * (order.commission.amount / 100);
                    } else {
                        totalWebEarned += order.commission.amount;
                    }
                } else if (order.commission.origin === 'pos' || order.source === 'pos') {
                    if (order.commission.type === 'percent') {
                        totalPosEarned += subtotal * (order.commission.amount / 100);
                    } else {
                        totalPosEarned += order.commission.amount;
                    }
                }
            }
        }

        const totalEarned = totalWebEarned + totalPosEarned;
        const totalPaid   = business.commissionPayments.reduce((s, p) => s + p.amount, 0);
        const currentDebt = Math.max(0, totalEarned - totalPaid);

        // Actualizar el campo rápido de deuda
        business.commissionDebt = currentDebt;
        await business.save();

        res.json({
            businessId:     business._id,
            businessName:   business.name,
            totalEarned:    parseFloat(totalEarned.toFixed(2)),
            totalWebEarned: parseFloat(totalWebEarned.toFixed(2)),
            totalPosEarned: parseFloat(totalPosEarned.toFixed(2)),
            totalPaid:      parseFloat(totalPaid.toFixed(2)),
            currentDebt:    parseFloat(currentDebt.toFixed(2)),
            totalOrders,
            payments:       business.commissionPayments.slice().reverse() // Más recientes primero
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Registrar un Abono
exports.addCommissionPayment = async (req, res) => {
    try {
        const { amount, note } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ message: 'Monto inválido' });

        const business = await Business.findById(req.params.id);
        if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

        business.commissionPayments.push({ amount: parseFloat(amount), type: 'abono', note: note || '' });
        const totalPaid = business.commissionPayments.reduce((s, p) => s + p.amount, 0);
        business.commissionDebt = Math.max(0, business.commissionDebt - parseFloat(amount));
        await business.save();

        res.json({ message: `Abono de $${amount} registrado`, debt: business.commissionDebt });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Liquidar deuda completa
exports.settleCommission = async (req, res) => {
    try {
        const { note } = req.body;
        const business = await Business.findById(req.params.id);
        if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

        const debtToSettle = business.commissionDebt;
        if (debtToSettle <= 0) return res.status(400).json({ message: 'No hay deuda pendiente' });

        business.commissionPayments.push({ amount: debtToSettle, type: 'liquidacion', note: note || 'Liquidación total' });
        business.commissionDebt = 0;
        await business.save();

        res.json({ message: `Deuda de $${debtToSettle.toFixed(2)} liquidada`, debt: 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─── KPIs POR RANGO DE FECHAS (SuperAdmin Dashboard) ────────────────────────
exports.getKpisByRange = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ message: 'Parámetros from y to requeridos' });

        const start = new Date(from);
        const end   = new Date(to);
        // Asegurar que el día final incluya hasta las 23:59:59
        end.setHours(23, 59, 59, 999);

        if (isNaN(start) || isNaN(end)) return res.status(400).json({ message: 'Fechas inválidas' });

        // Órdenes con comisión en el rango
        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            "commission.amount": { $gt: 0 }
        }).lean();

        let totalCommissions = 0;
        let totalOrders = 0;

        // Todos los pedidos del rango (con o sin comisión) para contar volumen
        const allOrders = await Order.find({
            createdAt: { $gte: start, $lte: end }
        }).lean();
        totalOrders = allOrders.length;

        const bizProfits = {};
        orders.forEach(o => {
            const subtotal = o.subtotal || (o.total - (o.tax || 0));
            let profit = 0;
            if (o.commission?.type === 'percent') profit = subtotal * (o.commission.amount / 100);
            else profit = o.commission.amount;
            totalCommissions += profit;
            bizProfits[o.businessId] = (bizProfits[o.businessId] || 0) + profit;
        });

        // Deuda total considerando solo comisiones generadas en el rango menos lo ya pagado
        const allBusinesses = await require('../models/Business').find().lean();
        let totalDebt = 0;
        allBusinesses.forEach(biz => {
            const earned = bizProfits[biz._id] || 0;
            const paid   = (biz.commissionPayments || []).reduce((s, p) => s + p.amount, 0);
            // Deuda en este rango = lo ganado en este rango (sin descontar pagos ya que los pagos son globales)
            // Se muestra la comision generada en el rango
            totalDebt += earned;
        });

        res.json({
            from: start.toISOString(),
            to:   end.toISOString(),
            totalCommissions: parseFloat(totalCommissions.toFixed(2)),
            totalOrders,
            totalDebt: parseFloat(totalDebt.toFixed(2))
        });

    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// ─── VENTAS DE UN NEGOCIO (SuperAdmin) ───────────────────────────────────────
exports.getBusinessOrders = async (req, res) => {
    try {
        const bizId = req.params.id;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 25);
        const skip  = (page - 1) * limit;
        const { from, to } = req.query;

        const business = await Business.findById(bizId).select('name slug');
        if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

        const filter = { businessId: bizId };

        if (from && to) {
            const start = new Date(from);
            start.setHours(0, 0, 0, 0);
            const end = new Date(to);
            end.setHours(23, 59, 59, 999);
            filter.createdAt = { $gte: start, $lte: end };
        }

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('customerId', 'name phone')
                .populate('createdBy', 'username')
                .lean(),
            Order.countDocuments(filter)
        ]);

        // KPIs rápidos del negocio (con o sin filtro)
        const allOrders   = await Order.find(filter).lean();
        const totalRevenue = allOrders.reduce((s, o) => s + (o.total || 0), 0);
        const totalDelivery = allOrders.filter(o => o.deliveryType === 'delivery' || o.customerStreet).length;

        res.json({
            business: { _id: business._id, name: business.name, slug: business.slug },
            orders,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
            kpis: {
                totalOrders: total,
                totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                totalDelivery
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};