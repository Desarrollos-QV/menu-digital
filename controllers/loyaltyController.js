const LoyaltyProgram = require('../models/LoyaltyProgram');
const Customer = require('../models/Customer');
const Business = require('../models/Business'); // Asegurar importación

// --- PÚBLICO (WebApp) ---

exports.getCustomerStatus = async (req, res) => {
    try {
        const { slug, phone, pin } = req.body; // Recibimos PIN opcional
        
        const business = await Business.findOne({ slug });
        if (!business) return res.status(404).json({ message: 'Negocio no encontrado' });

        const program = await LoyaltyProgram.findOne({ businessId: business._id });
        if (!program) return res.status(404).json({ message: 'No hay programa activo' });

        const customer = await Customer.findOne({ businessId: business._id, phone });
        
        // Escenario 1: Cliente no existe
        if (!customer) {
            return res.json({ registered: false, program });
        }

        // Escenario 2: Cliente existe, pero no enviaron PIN (Intento de login)
        if (!pin) {
            return res.json({ 
                registered: true, 
                active: (program.active) ? true : false, 
                authRequired: true, // Bandera para que el front pida PIN
                program
                // NO enviamos datos sensibles del cliente aun
            });
        }

        // Escenario 3: Cliente existe y enviaron PIN (Validación)
        if (customer.pin !== pin) {
            return res.status(401).json({ message: 'PIN incorrecto' });
        }

        // Login Exitoso
        res.json({ 
            registered: true, 
            active: (program.active) ? true : false, 
            authSuccess: true,
            customer, 
            program 
        });

    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.registerCustomer = async (req, res) => {
    try {
        const { slug, name, phone, pin } = req.body;
        
        if (!pin || pin.length !== 4) {
            return res.status(400).json({ message: 'El PIN debe ser de 4 dígitos' });
        }

        const business = await Business.findOne({ slug });
        
        const newCustomer = new Customer({
            businessId: business._id,
            name,
            phone,
            pin // Guardamos el PIN
        });
        
        await newCustomer.save();
        res.json({ success: true, customer: newCustomer });
    } catch (e) { res.status(400).json({ error: 'Error al registrar o ya existe' }); }
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
