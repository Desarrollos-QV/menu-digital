const Order = require('../models/Order');
const Visit = require('../models/Visit');
const Product = require('../models/Product');
const Business = require('../models/Business');
const mongoose = require('mongoose');


// 1. Registrar Visita (Público)
exports.registerVisit = async (req, res) => {
    try {
        const { slug, visitorId } = req.body;
        const business = await Business.findOne({ slug });
        if(!business) return res.status(404).json({error: 'Negocio no encontrado'});

        // Evitar duplicados el mismo día para el mismo usuario
        const startOfDay = new Date();
        startOfDay.setHours(0,0,0,0);

        const exists = await Visit.findOne({
            businessId: business._id,
            visitorId: visitorId,
            date: { $gte: startOfDay }
        });

        if (!exists) {
            await Visit.create({
                businessId: business._id,
                visitorId: visitorId,
                userAgent: req.headers['user-agent']
            });
        }
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. Registrar Pedido / Clic WhatsApp (Público)
exports.registerOrder = async (req, res) => {
    try {
        const { slug, customerName, customerEmail, cart, total } = req.body;
        const business = await Business.findOne({ slug });
        
        // Guardar Orden
        const newOrder = new Order({
            businessId: business._id,
            customerName,
            customerEmail,
            items: cart.map(item => ({
                productId: item.product._id,
                name: item.product.name,
                quantity: item.quantity,
                price: item.product.price
            })),
            total
        });
        await newOrder.save();

        // Incrementar contador de "Más Vendidos" en Productos
        // Esto optimiza la lectura de estadísticas después
        for (const item of cart) {
            await Product.findByIdAndUpdate(item.product._id, { 
                $inc: { salesCount: item.quantity } 
            });
        }

        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. Obtener KPI Dashboard (Privado - Para el Panel)
exports.getDashboardStats = async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const today = new Date();
        today.setHours(0,0,0,0);

        // 1. KPIs Básicos
        const ordersToday = await Order.find({ businessId, createdAt: { $gte: today } });
        const salesToday = ordersToday.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = await Order.countDocuments({ businessId });
        const uniqueUsers = await Order.distinct('customerEmail', { businessId });
        const visitsToday = await Visit.countDocuments({ businessId, date: { $gte: today } });

        // 2. Gráfica de Ventas (Últimos 7 días)
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 6);
        last7Days.setHours(0,0,0,0);

        // --- ZONA HORARIA ---
        const TIMEZONE_OFFSET = "-07:00"; 

        // Agregación para sumar ventas por día
        const salesAgg = await Order.aggregate([
            { $match: { 
                businessId: new mongoose.Types.ObjectId(businessId), 
                createdAt: { $gte: last7Days } 
            }},
            { $group: {
                // Aquí aplicamos la zona horaria para que agrupe correctamente por día LOCAL
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE_OFFSET } },
                total: { $sum: "$total" }
            }},
            { $sort: { _id: 1 } }
        ]);

        // Rellenar días vacíos
        const chartData = [];
        const chartLabels = [];
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(last7Days);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            
            // Formato etiqueta: "Lun", "Mar"
            const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' }); 
            
            // Buscamos coincidencia
            const found = salesAgg.find(s => s._id === dateStr);
            chartData.push(found ? found.total : 0);
            chartLabels.push(dayLabel);
        }

        // 3. Top 5 Productos
        const topProducts = await Product.find({ businessId })
            .sort({ salesCount: -1 })
            .limit(5)
            .select('name image salesCount price');

        res.json({
            salesToday,
            ordersTodayCount: ordersToday.length,
            totalOrders,
            uniqueUsers: uniqueUsers.length,
            visitsToday,
            chart: { labels: chartLabels, data: chartData },
            topProducts
        });

    } catch (e) { res.status(500).json({ error: e.message }); }
};