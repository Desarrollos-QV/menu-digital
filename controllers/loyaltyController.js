const LoyaltyProgram = require('../models/LoyaltyProgram');
const Customer = require('../models/Customer');
const Business = require('../models/Business');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'jwt_secret_key_default';

// --- PÚBLICO (WebApp) ---

exports.getCustomerStatus = async (req, res) => {
    try {
        const { slug, phone, pin, password } = req.body; 
        const inputPassword = password || pin; // Retrocompatibilidad con nombres antiguos
        
        let decodedSlug = slug;
        try { decodedSlug = decodeURIComponent(slug); } catch (e) {}
        
        let business = null;
        let program = null;
        
        if (slug) {
            const possibleSlugs = [slug, decodedSlug, decodedSlug.replace(/’/g, "'"), decodedSlug.replace(/'/g, "’")];
            business = await Business.findOne({ slug: { $in: possibleSlugs } });
            if (business) {
                program = await LoyaltyProgram.findOne({ businessId: business._id });
            }
        }

        // Búsqueda global por teléfono para permitir inicio de sesión unificado
        const customer = await Customer.findOne({ phone });
        
        // Escenario 1: Cliente no existe
        if (!customer) {
            return res.json({ registered: false, program });
        }

        // Escenario 2: Cliente existe, pero no enviaron contraseña (Intento de login)
        if (!inputPassword) {
            return res.json({ 
                registered: true, 
                active: program ? (program.active ? true : false) : false, 
                authRequired: true, 
                program
            });
        }

        // Escenario 3: Cliente existe y enviaron contraseña (Validación)
        // Soporte tanto para bcrypt como para PINs anteriores en texto plano (migración automática asistida)
        let isMatch = false;
        if (customer.password) {
            isMatch = await bcrypt.compare(inputPassword, customer.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Contraseña incorrecta' });
            }
        } else if (customer.pin) {
            isMatch = (customer.pin === inputPassword);
            if (!isMatch) {
                return res.status(401).json({ message: 'Contraseña incorrecta' });
            }
            // Si el pin coincide pero no tiene contraseña encriptada, solicitar la configuración
            return res.json({
                registered: true,
                requirePasswordSetup: true,
                phone: customer.phone,
                pin: inputPassword,
                email: customer.email || '',
                message: 'Actualización de seguridad requerida: configura tu contraseña.'
            });
        } else {
            // Caso raro de usuario sin PIN ni Password en la BD
            return res.json({
                registered: true,
                requirePasswordSetup: true,
                phone: customer.phone,
                email: customer.email || '',
                message: 'Actualización de seguridad requerida: configura tu contraseña.'
            });
        }

        // Generar Token JWT
        const token = jwt.sign(
            { id: customer._id, phone: customer.phone, email: customer.email, name: customer.name },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        // Login Exitoso
        res.json({ 
            registered: true, 
            active: program ? (program.active ? true : false) : false, 
            authSuccess: true,
            token,
            customer: {
                _id: customer._id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                avatar: customer.avatar || '',
                points: customer.points
            }, 
            program 
        });

    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.setupPassword = async (req, res) => {
    try {
        const { phone, pin, password, email } = req.body;
        if (!phone || !password || password.trim().length < 4) {
            return res.status(400).json({ message: 'Datos incompletos o contraseña inválida (mínimo 4 caracteres).' });
        }

        const customer = await Customer.findOne({ phone });
        if (!customer) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        // Si ya tiene contraseña, no permitir reconfiguración por este método abierto
        if (customer.password) {
            return res.status(400).json({ message: 'Esta cuenta ya tiene una contraseña configurada.' });
        }

        // Validar que el PIN legacy coincida si existe en la base de datos
        if (customer.pin && customer.pin !== pin) {
            return res.status(401).json({ message: 'El PIN de verificación es incorrecto.' });
        }

        // Si se envió un correo, validamos y guardamos
        if (email && email.trim()) {
            const trimmedEmail = email.toLowerCase().trim();
            // Verificar si el correo ya existe en otro cliente
            const existingEmail = await Customer.findOne({ email: trimmedEmail, _id: { $ne: customer._id } });
            if (existingEmail) {
                return res.status(400).json({ message: 'El correo electrónico ya está registrado por otro usuario.' });
            }
            customer.email = trimmedEmail;
        } else if (!customer.email) {
            // Si la cuenta no tenía correo y no se envió ninguno
            return res.status(400).json({ message: 'El correo electrónico es obligatorio para actualizar tu cuenta.' });
        }

        // Cifrar nueva contraseña y guardar
        customer.password = await bcrypt.hash(password, 10);
        customer.pin = undefined; // Limpiar PIN obsoleto
        await customer.save();

        // Generar Token JWT
        const token = jwt.sign(
            { id: customer._id, phone: customer.phone, email: customer.email, name: customer.name },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
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

exports.registerCustomer = async (req, res) => {
    try {
        const { slug, name, phone, pin, password, email } = req.body;
        const inputPassword = password || pin;
        
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'El correo electrónico es obligatorio' });
        }

        if (!inputPassword || inputPassword.length < 4) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres' });
        }

        // Verificar si ya existe un cliente con ese email o teléfono
        const existingCustomer = await Customer.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
        if (existingCustomer) {
            return res.status(400).json({ message: 'El teléfono o correo ya se encuentra registrado' });
        }

        let businessId = null;
        if (slug) {
            let decodedSlug = slug;
            try { decodedSlug = decodeURIComponent(slug); } catch (e) {}
            const possibleSlugs = [slug, decodedSlug, decodedSlug.replace(/’/g, "'"), decodedSlug.replace(/'/g, "’")];
            const business = await Business.findOne({ slug: { $in: possibleSlugs } });
            if (business) businessId = business._id;
        }

        // Encriptar password
        const hashedPassword = await bcrypt.hash(inputPassword, 10);
        
        const newCustomer = new Customer({
            businessId,
            name,
            phone,
            email: email.toLowerCase(),
            password: hashedPassword
        });
        
        await newCustomer.save();

        // Generar Token JWT
        const token = jwt.sign(
            { id: newCustomer._id, phone: newCustomer.phone, email: newCustomer.email, name: newCustomer.name },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.json({ 
            success: true, 
            token,
            customer: {
                _id: newCustomer._id,
                name: newCustomer.name,
                phone: newCustomer.phone,
                email: newCustomer.email,
                avatar: '',
                points: 0
            } 
        });
    } catch (e) { 
        res.status(400).json({ error: 'Error al registrar el cliente: ' + e.message }); 
    }
};
exports.getProgramConfig = async (req, res) => {  
    try {
        let program = await LoyaltyProgram.findOne({ businessId: req.user.businessId });
        if (!program) { program = new LoyaltyProgram({ businessId: req.user.businessId }); await program.save(); }
        res.json(program);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
exports.updateProgramConfig = async (req, res) => { 
    try {
        const program = await LoyaltyProgram.findOneAndUpdate({ businessId: req.user.businessId }, req.body, { new: true, upsert: true });
        res.json(program);
    } catch (e) { res.status(500).json({ error: e.message }); }
};
exports.addPoints = async (req, res) => { 
    try {
        const { phone, amount } = req.body;
        const customer = await Customer.findOne({ businessId: req.user.businessId, phone });
        if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });
        const program = await LoyaltyProgram.findOne({ businessId: req.user.businessId });
        if (program.type === 'points') customer.points += parseInt(amount); else customer.points += 1;
        customer.visits += 1; customer.lastVisit = new Date();
        await customer.save();
        const goalReached = customer.points >= program.goal;
        res.json({ success: true, newBalance: customer.points, goalReached, reward: program.reward });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
exports.redeemReward = async (req, res) => { 
    try {
        const { phone } = req.body;
        const customer = await Customer.findOne({ businessId: req.user.businessId, phone });
        const program = await LoyaltyProgram.findOne({ businessId: req.user.businessId });
        if (customer.points < program.goal) return res.status(400).json({ message: 'Puntos insuficientes' });
        customer.points -= program.goal;
        await customer.save();
        res.json({ success: true, message: 'Premio canjeado', newBalance: customer.points });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
// Buscar Clientes (Para el POS)
exports.searchCustomers = async (req, res) => {
    try {
        const { q } = req.query; // q = término de búsqueda
        const businessId = req.user.businessId;
        
        let query = { businessId };
        
        if (q) {
            // Buscar por Nombre O Teléfono
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ];
        }

        // Traer los últimos 5 si no hay búsqueda, o los coincidentes
        const customers = await Customer.find(query)
            .sort({ lastVisit: -1 }) // Los más recientes primero
            .limit(10);
            
        res.json(customers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
