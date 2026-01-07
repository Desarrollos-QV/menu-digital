const Order = require('../models/Order');

// Listado de Ventas (Últimas 200 para rendimiento)
exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ businessId: req.user.businessId })
            .select('createdAt total status paymentMethod customerId createdBy items source') // Solo campos necesarios para tabla
            .populate('customerId', 'name')
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 })
            .limit(200); 
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Detalle Completo de una Venta
exports.getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.id, businessId: req.user.businessId })
            .populate('customerId', 'name phone email points')
            .populate('createdBy', 'username role'); // Cajero
            
        if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
        
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};