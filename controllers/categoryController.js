const Category = require('../models/Category');

exports.getCategories = async (req, res) => {
    try {
        const filter = {};
        // Si es un admin de negocio, filtramos. Si es superadmin, podría ver todo (opcional)
        if (req.user.role === 'admin_negocio') {
            filter.businessId = req.user.businessId; 
        } 
        const categories = await Category.find(filter).sort({ name: 1 });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message});
    }
};

exports.createCategory = async (req, res) => {
    try {
        const newCategory = new Category({
             ...req.body,
            businessId: req.user.businessId
        });
        const savedCategory = await newCategory.save();
        res.status(201).json(savedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};