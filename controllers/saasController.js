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
    const { businessName, ownerEmail, username, password, plan } = req.body;
    
    try {
        // 1. Crear el Negocio
        const newBusiness = new Business({
            name: businessName,
            ownerEmail: ownerEmail,
            slug: businessName.toLowerCase().replace(/ /g, '-'),
            plan: plan || 'free'
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
        const { name,ownerEmail, slug, plan } = req.body;
        // Solo actualizamos campos administrativos, no el dueño ni la contraseña aquí
        const updatedBusiness = await Business.findByIdAndUpdate(
            req.params.id, 
            { name, ownerEmail, slug, plan }, 
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