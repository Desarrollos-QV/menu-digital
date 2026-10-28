const Business = require('../models/Business');
const Banner = require('../models/Banner');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Frood = require('../models/Frood');

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

// Helper para verificar si un negocio está abierto según su configuración y horario (zona Monterrey/MX)
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_MAP = {
    'domingo': 'Domingo',
    'lunes': 'Lunes',
    'martes': 'Martes',
    'miércoles': 'Miércoles',
    'miercoles': 'Miércoles',
    'jueves': 'Jueves',
    'viernes': 'Viernes',
    'sábado': 'Sábado',
    'sabado': 'Sábado'
};

const isBusinessOpen = (biz) => {
    if (!biz) return false;
    if (biz.active === false) return false;
    if (biz.isOpen === false) return false;

    const schedule = biz.schedule;
    if (!schedule || schedule.length === 0) return biz.isOpen !== false;

    try {
        const tz = 'America/Monterrey';
        const now = new Date();
        const dayFormatter = new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'long' });
        const timeParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
        
        const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0', 10);
        const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0', 10);
        const currentMinutes = hour * 60 + minute;

        const rawDay = dayFormatter.format(now).toLowerCase();
        const todayName = DAY_MAP[rawDay] || 'Lunes';
        const todayIdx = DAY_NAMES.indexOf(todayName);
        const yesterdayIdx = (todayIdx + 6) % 7;
        const yesterdayName = DAY_NAMES[yesterdayIdx];

        const todayDay = schedule.find(d => d.day === todayName);
        const yesterdayDay = schedule.find(d => d.day === yesterdayName);

        const checkDayActive = (day, isToday) => {
            if (!day || !day.isOpen) return false;
            const [openH, openM] = (day.open || '00:00').split(':').map(Number);
            const [closeH, closeM] = (day.close || '23:59').split(':').map(Number);
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;

            if (openMinutes < closeMinutes) {
                return isToday && currentMinutes >= openMinutes && currentMinutes < closeMinutes;
            } else if (openMinutes > closeMinutes) {
                if (isToday) {
                    return currentMinutes >= openMinutes;
                } else {
                    return currentMinutes < closeMinutes;
                }
            } else {
                return isToday;
            }
        };

        return checkDayActive(todayDay, true) || checkDayActive(yesterdayDay, false);
    } catch (e) {
        return biz.isOpen !== false;
    }
};

// Obtener todos los productos marcados como promoción (solo de negocios abiertos)
exports.getPromos = async (req, res) => {
    try {
        const promos = await Product.find({ isPromo: true, active: true })
            .populate('businessId')
            .sort({ updatedAt: -1 });

        const openPromos = promos.filter(p => p.businessId && isBusinessOpen(p.businessId));
        res.json(openPromos);
    } catch (error) {
        console.error('Error al obtener promociones:', error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

// Obtener productos con precio menor o igual a $100 (solo de negocios abiertos)
exports.getCheapProducts = async (req, res) => {
    try {
        const products = await Product.find({ price: { $gt: 0, $lte: 100 }, active: true })
            .populate('businessId')
            .sort({ updatedAt: -1 });

        const openProducts = products.filter(p => p.businessId && isBusinessOpen(p.businessId)).slice(0, 20);
        res.json(openProducts);
    } catch (error) {
        console.error('Error al obtener productos de $100 o menos:', error);
        res.status(500).json({ message: 'Error al obtener productos' });
    }
};

// Obtener productos TOP (salesCount > 10), ordenados por popularidad (solo de negocios abiertos)
exports.getTopProducts = async (req, res) => {
    try {
        const topProducts = await Product.find({ active: true, salesCount: { $gt: 10 } })
            .populate('businessId')
            .sort({ salesCount: -1 });

        const openTop = topProducts.filter(p => p.businessId && isBusinessOpen(p.businessId)).slice(0, 10);
        res.json(openTop);
    } catch (error) {
        console.error('Error al obtener lo más pedido:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

exports.getFroods = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default to 10 for the web panel but mobile will request 5
        const skip = (page - 1) * limit;

        const froods = await Frood.find({ active: true })
            .populate('businessId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(froods);
    } catch (error) {
        console.error('Error al obtener froods:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
