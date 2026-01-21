const Colonia = require('../models/Colonia');

// Obtener todas las colonias (para el select del admin y filtros PWA)
exports.getColonias = async (req, res) => {
    try {
        const colonias = await Colonia.find({ active: true }).sort({ name: 1 });
        res.json(colonias);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener colonias' });
    }
};

// Seed/Crear colonias (Para uso interno o inicialización)
exports.createColonia = async (req, res) => {
    try {
        const nuevaColonia = new Colonia(req.body);
        await nuevaColonia.save();
        res.status(201).json(nuevaColonia);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Actualizar una colonia
exports.updateColonia = async (req, res) => {
    try {
        const colonia = await Colonia.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!colonia) return res.status(404).json({ message: 'Colonia no encontrada' });
        res.json(colonia);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Eliminar una colonia
exports.deleteColonia = async (req, res) => {
    try {
        const colonia = await Colonia.findByIdAndDelete(req.params.id);
        if (!colonia) return res.status(404).json({ message: 'Colonia no encontrada' });
        res.json({ message: 'Colonia eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};