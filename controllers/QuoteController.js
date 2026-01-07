const Quotes = require('../models/Quotes');

// GET: Listar todos
exports.getQuotes = async (req, res) => {
    try {
        const filter = {};
        // Si es un admin de negocio, filtramos. Si es superadmin, podría ver todo (opcional)
        if (req.user.role === 'admin_negocio') {
            filter.businessId = req.user.businessId; 
        }
        const quotes = await Quotes.find(filter)
         .sort({ createdAt: -1 });
        res.json(quotes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST: Crear
exports.createQuote = async (req, res) => {
    try {
        const { client }  = req.body;

        const newQuote = new Quotes({
            customerName: client ? client.name : 'Cliente Mostrador',
            customerEmail: client ? client.email : 'soporte@gmail.com',
            customerId: client ? client._id : null,
            ...req.body,
            businessId: req.user.businessId
        });
        const savedQuote = await newQuote.save();
        res.status(201).json(savedQuote);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// PUT: Editar
exports.updateQuote = async (req, res) => {
    try {
        const updatedQuote = await Quotes.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true }
        );
        res.json(updatedQuote);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// DELETE: Eliminar
exports.deleteQuote = async (req, res) => {
    try {
        await Quotes.findByIdAndDelete(req.params.id);
        res.json({ message: 'Cotización eliminada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};