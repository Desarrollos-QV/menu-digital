const Banner = require('../models/Banner');

exports.getBanners = async (req, res) => {
    try {
        const filter = {};
        // Si es un admin de negocio, filtramos. Si es superadmin, podría ver todo (opcional)
        if (req.user.role === 'admin_negocio') {
            filter.businessId = req.user.businessId; 
        }

        const banners = await Banner.find(filter).sort({ createdAt: -1 });
        res.json(banners);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createBanner = async (req, res) => {
    try {
        const newBanner = new Banner({
            ...req.body,
            businessId: req.user.businessId
        });
        const savedBanner = await newBanner.save();
        res.status(201).json(savedBanner);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateBanner = async (req, res) => {
    try {
        const updatedBanner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedBanner);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteBanner = async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ message: 'Banner eliminado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};