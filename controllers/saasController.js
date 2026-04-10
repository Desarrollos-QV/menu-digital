const Business = require('../models/Business');
const User = require('../models/User');
const Order = require('../models/Order');


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
                    for (const order of orders) {
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

                    return { ...biz, commissionDebt: parseFloat(currentDebt.toFixed(2)) };
                } catch (e) {
                    return biz; // Si falla para uno, devuélvelo sin cambios
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

// ─── VENTAS DE UN NEGOCIO (SuperAdmin) ───────────────────────────────────────
exports.getBusinessOrders = async (req, res) => {
    try {
        const bizId = req.params.id;
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(100, parseInt(req.query.limit) || 25);
        const skip  = (page - 1) * limit;

        const business = await Business.findById(bizId).select('name slug');
        if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

        const filter = { businessId: bizId };

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

        // KPIs rápidos del negocio completo
        const allOrders   = await Order.find({ businessId: bizId }).lean();
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