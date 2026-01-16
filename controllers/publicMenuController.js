const Business = require('../models/Business');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Addon = require('../models/Addon');
const Banner = require('../models/Banner');
const Config = require('../models/Config');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET; 

// Helper para obtener ID del negocio desde el slug
const getBusinessIdBySlug = async (slug) => {
    if (!slug) return null;
    const business = await Business.findOne({ slug, active: true });
    return business ? business._id : null;
};

// ... getPublicData para obtener toda la data completa ...
exports.getPublicData = async (req, res) => {
    const { slug } = req.query;
    const type = req.params.type; // products, categories, etc.

    try {
        // 1. Buscamos el negocio completo primero para saber su PLAN
        const business = await Business.findOne({ slug, active: true });
        
        if (!business) {
            return res.status(404).json({ message: 'Negocio no encontrado o inactivo' });
        }

        const businessId = business._id;
        let data = [];

        switch (type) {
            case 'products':
                data = await Product.find({ businessId, active: true }).sort({ createdAt: -1 });
                break;
            
            case 'categories':
                data = await Category.find({ businessId, active: true }).sort({ name: 1 });
                break;
            
            case 'addons':
                data = await Addon.find({ businessId, active: true });
                break;
            
            case 'banners':
                const now = new Date();
                
                // --- LÓGICA MAESTRA FREE vs PRO ---
                if (business.plan === 'pro') {
                    // SI ES PRO: Busca SOLO los banners creados por este negocio
                    data = await Banner.find({ 
                        businessId: business._id, 
                        active: true,
                        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
                    }).sort({ createdAt: -1 });
                } else {
                    // SI ES FREE: Busca SOLO los banners del sistema (Admin)
                    // isSystem: true (Debes asegurarte de haber actualizado el modelo Banner)
                    data = await Banner.find({ 
                        isSystem: true, 
                        active: true,
                        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
                    }).sort({ createdAt: -1 });
                }
                break;
                
            case 'config':
                // Retornar configuración del negocio
                return res.json({
                    appName: business.name,
                    phone: business.phone,
                    ownerEmail: business.ownerEmail,
                    currency: business.settings?.currency || 'MXN',
                    primaryColor: business.settings?.primaryColor || '#6366f1',
                    avatar: business?.avatar || '',
                    plan: business.plan // Enviamos el plan por si el front quiere ocultar/mostrar cosas extra
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

// --- FUNCIÓN DE REGISTRO PÚBLICO ---
exports.registerBusiness = async (req, res) => {
    const { businessName, name, email, password, categories } = req.body;

    try {
        // Validaciones básicas
        if (!businessName || !name || !email || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios' });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ name });
        if (existingUser) {
            return res.status(400).json({ message: 'El usuario ya existe, elige otro.' });
        }

        // Generar Slug único
        let slug = businessName.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres no alfanuméricos con guion
            .replace(/^-+|-+$/g, '');    // Eliminar guiones al inicio y final
        
        // Verificar si el slug existe y agregar sufijo si es necesario
        const existingSlug = await Business.findOne({ slug });
        if (existingSlug) {
            slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
        }

        // 1. Crear el Negocio (Plan FREE forzado)
        const newBusiness = new Business({
            name: businessName,
            slug: slug,
            plan: 'free',
            active: true,
            categories
        });
        const savedBusiness = await newBusiness.save();

        // 2. Crear el Usuario Admin vinculado
        const newUser = new User({
            username: name,
            password,
            email,
            role: 'admin_negocio',
            businessId: savedBusiness._id
        });
        await newUser.save();

        // 3. Generar Token
        const token = jwt.sign(
            { 
                id: newUser._id, 
                role: newUser.role, 
                businessId: newUser.businessId 
            }, 
            SECRET_KEY, 
            { expiresIn: '7d' }
        );

        res.status(201).json({ 
            message: 'Registro exitoso', 
            slug: savedBusiness.slug,
            token, 
            username: newUser.username, 
            role: newUser.role 
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};