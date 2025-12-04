    const Addon = require('../models/Addon');

exports.getAddons = async (req, res) => {
    try {
        const filter = {};
        // Si es un admin de negocio, filtramos. Si es superadmin, podría ver todo (opcional)
        if (req.user.role === 'admin_negocio') {
            filter.businessId = req.user.businessId; 
        } 
        const addons = await Addon.find(filter).sort({ createdAt: -1 });
        res.json(addons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createAddon = async (req, res) => {
    try {
        const newAddon = new Addon({
            ...req.body,
            businessId: req.user.businessId
        });
        const savedAddon = await newAddon.save();
        res.status(201).json(savedAddon);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateAddon = async (req, res) => {
    try {
        const updatedAddon = await Addon.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedAddon);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteAddon = async (req, res) => {
    try {
        await Addon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Complemento eliminado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};