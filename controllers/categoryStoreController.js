const CategoryStore = require('../models/CategoryStore');

exports.getCategoriesStore = async (req, res) => {
    try {
        const categories = await CategoryStore.find().sort({ name: 1 });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message, msg : 'error de controller' });
    }
};

exports.createCategoryStore = async (req, res) => {
    try {
        const newCategory = new CategoryStore(req.body);
        const savedCategory = await newCategory.save();
        res.status(201).json(savedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateCategoryStore = async (req, res) => {
    try {
        const updatedCategory = await CategoryStore.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedCategory) return res.status(404).json({ message: 'Categoría no encontrada' });
        res.json(updatedCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteCategoryStore = async (req, res) => {
    try {
        const deletedCategory = await CategoryStore.findByIdAndDelete(req.params.id);
        if (!deletedCategory) return res.status(404).json({ message: 'Categoría no encontrada' });
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
