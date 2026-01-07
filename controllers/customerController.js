const Customer = require('../models/Customer');
const Order = require('../models/Order');
const mongoose = require('mongoose'); 

// Obtener todos los clientes (Para DataTable)
exports.getCustomers = async (req, res) => {
    try {
        // Traemos todos los clientes del negocio
        const customers = await Customer.find({ businessId: req.user.businessId })
            .sort({ lastVisit: -1 }); // Los más recientes primero
        res.json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Obtener detalle completo de un cliente
exports.getCustomerDetails = async (req, res) => {
    try {
        const customerId = req.params.id;

        // 1. Datos del Cliente
        const customer = await Customer.findOne({ _id: customerId, businessId: req.user.businessId });
        if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

        // 2. Historial de Órdenes (Últimas 5)
        const recentOrders = await Order.find({ 
            businessId: req.user.businessId, 
            customerId: customerId 
        })
        .select('_id createdAt total items status') // Solo campos necesarios
        .sort({ createdAt: -1 })
        .limit(5);

        // 3. Estadísticas Totales (Calculadas al vuelo para exactitud)
        const stats = await Order.aggregate([
            { 
                $match: {  
                    businessId: new mongoose.Types.ObjectId(req.user.businessId), 
                    customerId: new mongoose.Types.ObjectId(customerId) 
                } 
            }, 
            { 
                $group: {
                    _id: null,
                    totalSpent: { $sum: "$total" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        const totalSpent = stats.length > 0 ? stats[0].totalSpent : 0;
        const totalOrders = stats.length > 0 ? stats[0].totalOrders : 0;

        res.json({
            customer,
            recentOrders,
            customerId: customerId,
            stats: {
                totalSpent,
                totalOrders,
                totalVisits: customer.visits // Este viene del modelo Customer
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};