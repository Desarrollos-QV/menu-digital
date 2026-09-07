const Frood = require('../models/Frood');

// Helper para detectar SuperAdmin (por rol o por nombre de usuario 'admin')
const isSuperAdmin = (user) => {
    return user.role === 'superadmin' || user.username === 'admin';
};

exports.getFroods = async (req, res) => {
    try {
        let filter = {};
        
        // Si es SuperAdmin (o el usuario 'admin' original)
        if (isSuperAdmin(req.user)) {
            filter = { isSystem: true };
        } 
        // Si es Negocio
        else {
            filter = { businessId: req.user.businessId };
        }

        const froods = await Frood.find(filter).sort({ createdAt: -1 });
        res.json(froods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createFrood = async (req, res) => {
    try {
        const froodData = { ...req.body };

        if (isSuperAdmin(req.user)) {
            froodData.isSystem = true;
            froodData.businessId = null; // Froods globales no tienen negocio
        } else {
            froodData.isSystem = false;
            froodData.businessId = req.user.businessId;
        }

        const newFrood = new Frood(froodData);
        const savedFrood = await newFrood.save();
        res.status(201).json(savedFrood);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateFrood = async (req, res) => {
    try {
        const updatedFrood = await Frood.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        res.json(updatedFrood);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.deleteFrood = async (req, res) => {
    try {
        await Frood.findByIdAndDelete(req.params.id);
        res.json({ message: 'Frood eliminado' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};
