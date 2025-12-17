const Banner = require('../models/Banner');

// Helper para detectar SuperAdmin (por rol o por nombre de usuario 'admin')
const isSuperAdmin = (user) => {
    return user.role === 'superadmin' || user.username === 'admin';
};

exports.getBanners = async (req, res) => {
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

        const banners = await Banner.find(filter).sort({ createdAt: -1 });
        res.json(banners);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createBanner = async (req, res) => {
    try {
        const bannerData = { ...req.body };

        if (isSuperAdmin(req.user)) {
            bannerData.isSystem = true;
            bannerData.businessId = null; // Banners globales no tienen negocio
        } else {
            bannerData.isSystem = false;
            bannerData.businessId = req.user.businessId;
        }

        const newBanner = new Banner(bannerData);
        const savedBanner = await newBanner.save();
        res.status(201).json(savedBanner);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update y Delete funcionan igual, solo asegúrate de validar permisos si quieres ser estricto
exports.updateBanner = async (req, res) => {
    try {
        const updatedBanner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedBanner);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.deleteBanner = async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ message: 'Banner eliminado' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};