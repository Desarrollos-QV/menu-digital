const Product = require('../models/Product');

// GET: Listar todos
exports.getProducts = async (req, res) => {
    try {
        const filter = {};
        // Si es un admin de negocio, filtramos. Si es superadmin, podría ver todo (opcional)
        if (req.user.role === 'admin_negocio') {
            filter.businessId = req.user.businessId; 
        }
        // const products = await Product.find(filter).sort({ createdAt: -1 });
        // res.json(products);

        const products = await Product.find(filter)
            .populate('addons') // <--- ESTA LÍNEA ES LA CLAVE
            .populate('categories') // También poblamos categorías por si acaso
            .sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST: Crear
exports.createProduct = async (req, res) => {
    try {
        const newProduct = new Product({
            ...req.body,
            businessId: req.user.businessId
        });
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// PUT: Editar
exports.updateProduct = async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true }
        );
        res.json(updatedProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// DELETE: Eliminar
exports.deleteProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};