const fs = require('fs');
const path = require('path');
const Media = require('../models/Media');

// Obtener lista de imágenes
exports.getMedia = async (req, res) => {
    try {
        // En lugar de fs.readdir, consultamos la BD filtrando por businessId
        // req.user viene del middleware de autenticación
        // const mediaFiles = await Media.find({ businessId: req.user.businessId }).sort({ createdAt: -1 });
        
        const filter = req.user.role === 'superadmin' ? { businessId: null } : { businessId: req.user.businessId };
        const mediaFiles = await Media.find(filter).sort({ createdAt: -1 });

        res.status(200).send(mediaFiles);
    } catch (error) {
        res.status(500).send({ message: "Error al obtener medios: " + error.message });
    }
};

// Eliminar imagen
exports.deleteMedia = async (req, res) => {
    const filename = req.params.filename;
    
    try {
        // 1. Buscar y verificar que pertenezca al negocio
        const fileRecord = await Media.findOne({ 
            name: filename, 
            businessId: req.user.businessId 
        });

        if (!fileRecord) {
            return res.status(404).send({ message: "Archivo no encontrado o no tienes permiso." });
        }

        // 2. Eliminar registro de la BD
        await Media.deleteOne({ _id: fileRecord._id });

        // 3. Eliminar archivo físico
        const directoryPath = path.join(__dirname, '../public/uploads/', filename);
        if (fs.existsSync(directoryPath)) {
            fs.unlink(directoryPath, (err) => {
                if (err) console.error("Error borrando archivo físico:", err);
            });
        }

        res.status(200).send({ message: "Archivo eliminado exitosamente." });

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};