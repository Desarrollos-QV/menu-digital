const Business = require('../models/Business');
const User = require('../models/User');

// Listar todos los negocios (Solo para SuperAdmin)
exports.getAllBusinesses = async (req, res) => {
    try {
        const businesses = await Business.find().sort({ createdAt: -1 });
        res.json(businesses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Registrar un Nuevo Negocio + Su Usuario Admin
exports.createBusiness = async (req, res) => {
    const { businessName, username, password, plan } = req.body;
    
    try {
        // 1. Crear el Negocio
        const newBusiness = new Business({
            name: businessName,
            slug: businessName.toLowerCase().replace(/ /g, '-'),
            plan: plan || 'free'
        });
        const savedBusiness = await newBusiness.save();

        // 2. Crear el Usuario Admin para ese negocio
        const newUser = new User({
            username,
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