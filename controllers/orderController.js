const Order = require('../models/Order');
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Listado de Ventas (Últimas 200 para rendimiento)
exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ businessId: req.user.businessId })
            .select('createdAt total status paymentMethod customerId customerName customerPhone customerStreet customerNumber customerReference customerHowToPay createdBy items subtotal commission tax source') // Solo campos necesarios para tabla
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

// PUT: Actualizar orden (Status, Notas, Cancelación)
exports.updateOrder = async (req, res) => {
    try {
        const { status } = req.body;
        
        // Validación de estados permitidos
        const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: `Estado '${status}' no es válido` });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // --- LÓGICA DE NOTIFICACIÓN TWILIO ---
        if (status && updatedOrder.customerId && updatedOrder.customerId.phone) {
            const customerName = updatedOrder.customerId.name || 'Cliente';
            // Asegúrate que el teléfono en BD tenga código de país (ej: +52...)
            // Si usas Sandbox de Twilio, el formato es 'whatsapp:+521234567890'
            const toPhone = `whatsapp:+521${updatedOrder.customerId.phone}`; 
            const fromPhone = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`; // Tu número de Twilio o Sandbox

            let messageBody = '';

            switch (status) {
                case 'preparing':
                    messageBody = `👨‍🍳 Hola ${customerName}, estamos preparando tu pedido #${updatedOrder._id.toString().slice(-6)}.`;
                    break;
                case 'ready':
                    messageBody = `🚀 ¡${customerName}! Tu pedido #${updatedOrder._id.toString().slice(-6)} está listo para entrega/recoger.`;
                    break;
                case 'completed':
                    messageBody = `✅ Gracias por tu compra ${customerName}. Tu pedido ha sido completado. ¡Buen provecho!`;
                    break;
                case 'cancelled':
                    messageBody = `❌ Hola ${customerName}, tu pedido #${updatedOrder._id.toString().slice(-6)} ha sido cancelado.`;
                    break;
            }

            if (messageBody) {
                // Enviamos sin await para no bloquear la respuesta al frontend
                // client.messages.create({
                //     body: messageBody,
                //     from: fromPhone,
                //     to: toPhone
                // })
                // .then(message => console.log(`Mensaje enviado: ${message.sid}`))
                // .catch(err => console.error("Error enviando WhatsApp:", err));
            }
        }
        // -------------------------------------

        res.json(updatedOrder);
    } catch (err) {
        console.error("Error actualizando orden:", err);
        res.status(400).json({ message: err.message });
    }
};

// DELETE: Eliminar orden
exports.deleteOrder = async (req, res) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id);
        if (!deletedOrder) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }
        res.json({ message: 'Orden eliminada correctamente' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};