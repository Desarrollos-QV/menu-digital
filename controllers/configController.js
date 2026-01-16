const Config = require('../models/Config');
const Business = require('../models/Business');
exports.getConfig = async (req, res) => {
    try {
        // Buscamos la config, si no existe la creamos (Singleton)
        let config = await Config.findOne();
        if (!config) {
            config = new Config();
            await config.save();
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        let config = await Config.findOne();
        if (!config) config = new Config();
        
        if (req.body.appName) config.appName = req.body.appName;
        if (req.body.adminName) config.adminName = req.body.adminName;
        
        await config.save();
        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET Pública (Para la App del Cliente - Por ahora Global o por Query)
exports.getPublicConfig = async (req, res) => {
    try {
        // Aquí en el futuro buscaremos por slug ?slug=mi-negocio
        const config = await Config.findOne();
        res.json(config || { appName: 'Menú Digital' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET Privada (Para el Panel Administrativo)
exports.getAdminConfig = async (req, res) => {
    try {
        // CASO 1: SUPER ADMIN (Ve Configuración Global)
        if (req.user.role === 'superadmin') {
            let config = await Config.findOne();
            if (!config) {
                config = new Config();
                await config.save();
            }
            return res.json({
                role: 'superadmin',
                appName: config.appName,
                adminName: config.adminName
            });
        }

        // CASO 2: NEGOCIO (Ve Su Propia Info)
        if (req.user.role === 'admin_negocio') {
            const business = await Business.findById(req.user.businessId);
            if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

            return res.json({
                role: 'admin_negocio',
                appName: business.name, // El nombre del negocio será el nombre de la App para ellos
                adminName: req.user.username, // O un campo específico si lo agregas
                address: business.address || '',
                slug : business.slug || '',
                urlApp: 'https://'+req.hostname+'/'+business.slug,
                plan: business.plan || 'free',
                categories : business.categories,
                // Campos extra de negocio
                avatar: business.avatar || '',
                phone: business.phone || '',
                ownerEmail: business.ownerEmail || '',
                currency: business.settings?.currency || 'MXN',
                iva: business.settings?.iva || 16,
                primaryColor: business.settings?.primaryColor || '#6366f1'
            });
        }

        
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// UPDATE Privada
exports.updateAdminConfig = async (req, res) => {
    try {
        // CASO 1: SUPER ADMIN
        if (req.user.role === 'superadmin') {
            let config = await Config.findOne();
            if (!config) config = new Config();
            
            if (req.body.appName) config.appName = req.body.appName;
            if (req.body.adminName) config.adminName = req.body.adminName;
            
            await config.save();
            return res.json(config);
        }

        // CASO 2: NEGOCIO
        if (req.user.role === 'admin_negocio') {
            const business = await Business.findById(req.user.businessId);
            
            if (req.body.avatar) business.avatar = req.body.avatar;
            if (req.body.appName) business.name = req.body.appName;
            if (req.body.address) business.address = req.body.address;
            if (req.body.phone) business.phone = req.body.phone;
            if (req.body.ownerEmail) business.ownerEmail = req.body.ownerEmail;
            if (req.body.categories) business.categories = req.body.categories;
            
            // Settings anidados
            if (!business.settings) business.settings = {};
            if (req.body.currency) business.settings.currency = req.body.currency;
            if (req.body.iva) business.settings.iva = req.body.iva;
            if (req.body.primaryColor) business.settings.primaryColor = req.body.primaryColor;

            await business.save();
            return res.json({ message: 'Configuración de negocio actualizada' });
        }

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};