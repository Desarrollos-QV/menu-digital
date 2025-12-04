const Business = require('../models/Business');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Addon = require('../models/Addon');
const Banner = require('../models/Banner');
const Config = require('../models/Config');

// Helper para obtener ID del negocio desde el slug
const getBusinessIdBySlug = async (slug) => {
    if (!slug) return null;
    const business = await Business.findOne({ slug, active: true });
    return business ? business._id : null;
};

exports.getPublicData = async (req, res) => {
    const { slug } = req.query;
    const type = req.params.type; // products, categories, etc.

    try {
        const businessId = await getBusinessIdBySlug(slug);
        
        if (!businessId) {
            return res.status(404).json({ message: 'Negocio no encontrado o inactivo' });
        }

        let data = [];

        switch (type) {
            case 'products':
                // Solo productos activos
                data = await Product.find({ businessId, active: true }).sort({ createdAt: -1 });
                break;
            
            case 'categories':
                data = await Category.find({ businessId, active: true }).sort({ name: 1 });
                break;
            
            case 'addons':
                data = await Addon.find({ businessId, active: true });
                break;
            
            case 'banners':
                // Filtrar también por fecha de expiración si aplica
                const now = new Date();
                data = await Banner.find({ 
                    businessId, 
                    active: true,
                    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
                }).sort({ createdAt: -1 });
                break;
                
            case 'config':
                // Retornar configuración mezclada (Global + Negocio)
                const business = await Business.findById(businessId);
                // Aquí podrías mezclar con Config global si quisieras
                return res.json({
                    appName: business.name,
                    phone: business.phone,
                    ownerEmail: business.ownerEmail,
                    currency: business.settings?.currency || 'MXN',
                    primaryColor: business.settings?.primaryColor || '#6366f1',
                    avatar: business.avatar || '' // Asumiendo que guardaste avatar aquí o en raíz
                });

            default:
                return res.status(400).json({ message: 'Tipo de datos no válido' });
        }

        res.json(data);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};