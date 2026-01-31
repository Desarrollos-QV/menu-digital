const Municipio = require('../models/Municipio');

// Obtener todas las colonias (para el select del admin y filtros PWA)
exports.getMunicipios = async (req, res) => {
    try {
        const municipios = await Municipio.find({ active: true }).sort({ name: 1 });
        res.json(municipios);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener municipios' });
    }
};

// Seed/Crear municipios (Para uso interno o inicialización)
exports.createMunicipio = async (req, res) => {
    try {
        const nuevoMunicipio = new Municipio(req.body);
        await nuevoMunicipio.save();
        res.status(201).json(nuevoMunicipio);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Actualizar un municipio
exports.updateMunicipio = async (req, res) => {
    try {
        const municipio = await Municipio.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!municipio) return res.status(404).json({ message: 'Municipio no encontrado' });
        res.json(municipio);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Eliminar un municipio
exports.deleteMunicipio = async (req, res) => {
    try {
        const municipio = await Municipio.findByIdAndDelete(req.params.id);
        if (!municipio) return res.status(404).json({ message: 'Municipio no encontrado' });
        res.json({ message: 'Municipio eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Obtiene las colonias de un municipio específico
 */
exports.getColoniasByMunicipio = async (req, res) => {
    try {
        const municipio = await Municipio.findById(req.params.id);
        if (!municipio) return res.status(404).json({ message: 'Municipio no encontrado' });
        res.json(municipio.colonias);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener colonias' });
    }
};

/**
 * Crea una colonia en un municipio específico
 */
exports.createColonia = async (req, res) => {
    try {
        const municipio = await Municipio.findById(req.params.id);
        if (!municipio) return res.status(404).json({ message: 'Municipio no encontrado' });
        municipio.colonias.push(req.body);
        await municipio.save();
        res.status(201).json(municipio.colonias);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear colonia' });
    }
};

/**
 * Actualiza una colonia en un municipio específico
 */
exports.updateColonia = async (req, res) => {
    try {
        const municipio = await Municipio.findById(req.params.id);
        if (!municipio) return res.status(404).json({ message: 'Municipio no encontrado' });
        const colonia = municipio.colonias.id(req.params.coloniaId);
        if (!colonia) return res.status(404).json({ message: 'Colonia no encontrada' });
        colonia.set(req.body);
        await municipio.save();
        res.json(municipio.colonias);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar colonia' });
    }
};

/**
 * Elimina una colonia en un municipio específico
 */
exports.deleteColonia = async (req, res) => {
    try {
        const municipio = await Municipio.findById(req.params.id);
        if (!municipio) return res.status(404).json({ message: 'Municipio no encontrado' });
        const colonia = municipio.colonias.id(req.params.coloniaId);
        if (!colonia) return res.status(404).json({ message: 'Colonia no encontrada' });
        colonia.remove();
        await municipio.save();
        res.json(municipio.colonias);
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar colonia' });
    }
};