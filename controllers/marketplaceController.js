const Business = require('../models/Business');
const Banner = require('../models/Banner');
const Customer = require('../models/Customer');

// Obtener todos los negocios para el directorio
exports.getAllBusinesses = async (req, res) => {
    try {
        const now = new Date();
                
        // Podrías agregar filtros aquí si vienen en req.query
        // Por ahora devolvemos todos ordenados por si son Trending primero
        const businesses = await Business.find()
            .sort({ isTrending: -1, isOpen: -1, createdAt: -1 });
        
        const Banners = await Banner.find({ 
            isSystem: true, 
            active: true,
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
        }).sort({ createdAt: -1 });

        res.json([businesses, Banners]);
    } catch (error) {
        console.error('Error al obtener negocios:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// Obtener un negocio específico por ID (Opcional, para futuros detalles)
exports.getBusinessById = async (req, res) => {
    try {
        const business = await Business.findById(req.params.id);
        if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });
        res.json(business);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.registerCustomer = async (req, res) => {
    try {
        const { name, phone, email, pin } = req.body;
        
        if (!phone) {
            return res.status(400).json({ message: 'El Telefono es requerido' });
        }

        const newCustomer = new Customer({
            name,
            phone,
            email,
            pin
        });
        
        await newCustomer.save();
        res.json({ success: true, customer: newCustomer });
    } catch (e) { res.status(400).json({ error: 'Error al registrar o ya existe'+e }); }
};

exports.getCustomerStatus = async (req, res) => {
    try {
        const { phone, pin } = req.body; // Recibimos PIN opcional
        
        const customer = await Customer.findOne({ phone, pin });
        
        // Escenario 1: Cliente no existe
        if (!customer) {
            return res.json({ registered: false });
        }

        // Escenario 2: Cliente existe, pero no enviaron PIN (Intento de login)
        if (!pin) {
            return res.json({ 
                registered: true, 
                authRequired: true, // Bandera para que el front pida PIN
            });
        }

        // Escenario 3: Cliente existe y enviaron PIN (Validación)
        if (customer.pin !== pin) {
            return res.status(401).json({ message: 'PIN incorrecto' });
        }

        // Login Exitoso
        res.json({  
            success: true,
            customer 
        });

    } catch (e) { res.status(500).json({ error: e.message }); }
};