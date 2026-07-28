const Customer = require('../models/Customer');
const CustomerAddress = require('../models/CustomerAddress');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// --- MÉTODOS DE ADMINISTRACIÓN DE NEGOCIOS ---

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

// --- PERFIL DE USUARIO ---

exports.getProfile = async (req, res) => {
    try {
        const customer = await Customer.findById(req.customer.id).select('-password');
        if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });
        res.json(customer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        const customer = await Customer.findById(req.customer.id);
        if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

        // Verificar si el nuevo correo o teléfono ya están registrados por otro usuario
        if (email && email.toLowerCase() !== customer.email) {
            const emailExists = await Customer.findOne({ email: email.toLowerCase() });
            if (emailExists) return res.status(400).json({ message: 'El correo ya está registrado por otro usuario.' });
            customer.email = email.toLowerCase();
        }

        if (phone && phone !== customer.phone) {
            const phoneExists = await Customer.findOne({ phone });
            if (phoneExists) return res.status(400).json({ message: 'El teléfono ya está registrado por otro usuario.' });
            customer.phone = phone;
        }

        if (name) customer.name = name;

        // Actualizar contraseña si se envió
        if (password && password.trim().length >= 4) {
            customer.password = await bcrypt.hash(password, 10);
        }

        await customer.save();
        
        res.json({
            success: true,
            customer: {
                _id: customer._id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                avatar: customer.avatar || '',
                points: customer.points
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Por favor sube una imagen de perfil.' });
        }

        const customer = await Customer.findById(req.customer.id);
        if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

        // Guardamos la URL pública de la imagen
        customer.avatar = `/uploads/${req.file.filename}`;
        await customer.save();

        res.json({
            success: true,
            avatar: customer.avatar
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// --- LIBRETA DE DIRECCIONES ---

exports.getAddresses = async (req, res) => {
    try {
        const addresses = await CustomerAddress.find({ customerId: req.customer.id }).sort({ isDefault: -1, createdAt: -1 });
        res.json(addresses);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.createAddress = async (req, res) => {
    try {
        const { alias, street, number, colony, zipCode, reference, isDefault, coloniaId, municipioId, municipioName } = req.body;
        
        if (isDefault) {
            // Quitar el valor por defecto de las otras direcciones
            await CustomerAddress.updateMany({ customerId: req.customer.id }, { isDefault: false });
        }

        const newAddress = new CustomerAddress({
            customerId: req.customer.id,
            alias: alias || 'Hogar',
            street,
            number,
            colony,
            zipCode,
            coloniaId: coloniaId || null,
            municipioId: municipioId || null,
            municipioName: municipioName || '',
            reference: reference || '',
            isDefault: !!isDefault
        });

        await newAddress.save();
        res.json(newAddress);
    } catch (e) {
        console.error("Address error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.updateAddress = async (req, res) => {
    try {
        const { alias, street, number, colony, zipCode, reference, isDefault, coloniaId, municipioId, municipioName } = req.body;
        
        const address = await CustomerAddress.findOne({ _id: req.params.id, customerId: req.customer.id });
        if (!address) return res.status(404).json({ message: 'Dirección no encontrada' });

        if (isDefault) {
            // Quitar el valor por defecto de las otras direcciones
            await CustomerAddress.updateMany({ customerId: req.customer.id }, { isDefault: false });
        }

        address.alias = alias || address.alias;
        address.street = street || address.street;
        address.number = number || address.number;
        address.colony = colony || address.colony;
        address.zipCode = zipCode || address.zipCode;
        if (coloniaId !== undefined) address.coloniaId = coloniaId || null;
        if (municipioId !== undefined) address.municipioId = municipioId || null;
        if (municipioName !== undefined) address.municipioName = municipioName || '';
        address.reference = reference !== undefined ? reference : address.reference;
        address.isDefault = isDefault !== undefined ? !!isDefault : address.isDefault;

        await address.save();
        res.json(address);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const address = await CustomerAddress.findOneAndDelete({ _id: req.params.id, customerId: req.customer.id });
        if (!address) return res.status(404).json({ message: 'Dirección no encontrada' });
        res.json({ success: true, message: 'Dirección eliminada' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// --- MÉTODOS DE PAGO (STRIPE CARDS) ---

exports.createSetupIntent = async (req, res) => {
    try {
        if (!stripe) return res.status(500).json({ message: 'Stripe no está configurado en el servidor.' });

        const customer = await Customer.findById(req.customer.id);
        if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });

        // 1. Crear el cliente en Stripe si no tiene stripeCustomerId
        if (!customer.stripeCustomerId) {
            const stripeCustomer = await stripe.customers.create({
                email: customer.email,
                name: customer.name,
                phone: customer.phone,
                metadata: { customerId: customer._id.toString() }
            });
            customer.stripeCustomerId = stripeCustomer.id;
            await customer.save();
        }

        // 2. Crear SetupIntent
        const setupIntent = await stripe.setupIntents.create({
            customer: customer.stripeCustomerId,
            payment_method_types: ['card'],
        });

        res.json({ clientSecret: setupIntent.client_secret });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getCards = async (req, res) => {
    try {
        if (!stripe) return res.status(500).json({ message: 'Stripe no está configurado.' });

        const customer = await Customer.findById(req.customer.id);
        if (!customer || !customer.stripeCustomerId) {
            return res.json([]); // Si no tiene cliente de Stripe aún no tiene tarjetas
        }

        const paymentMethods = await stripe.paymentMethods.list({
            customer: customer.stripeCustomerId,
            type: 'card',
        });

        res.json(paymentMethods.data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deleteCard = async (req, res) => {
    try {
        if (!stripe) return res.status(500).json({ message: 'Stripe no está configurado.' });

        const { paymentMethodId } = req.params;
        
        // Desvincular tarjeta del cliente
        await stripe.paymentMethods.detach(paymentMethodId);
        
        res.json({ success: true, message: 'Tarjeta eliminada con éxito.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// --- HISTORIAL DE PEDIDOS ---

exports.getOrders = async (req, res) => {
    try {
        // Encontrar todas las órdenes que coincidan con el teléfono o ID del cliente logueado
        const query = {
            $or: [
                { customerId: req.customer.id },
                { customerPhone: req.customer.phone }
            ]
        };

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.chargeSavedCard = async (req, res) => {
    try {
        if (!stripe) return res.status(500).json({ message: 'Stripe no está configurado.' });
        const { amount, currency, paymentMethodId } = req.body;
        
        const customer = await Customer.findById(req.customer.id);
        if (!customer || !customer.stripeCustomerId) {
            return res.status(400).json({ message: 'El cliente no tiene cuenta de Stripe asociada.' });
        }
        
        const amountInCents = Math.round(amount * 100);
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: currency || 'MXN',
            customer: customer.stripeCustomerId,
            payment_method: paymentMethodId,
            off_session: false,
            confirm: true,
            return_url: req.get('referer') || `${req.protocol}://${req.get('host')}/`
        });
        
        res.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            status: paymentIntent.status
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};