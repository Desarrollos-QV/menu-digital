const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Media = require('../models/Media'); // Modelo DB
const auth = require('../middleware/auth'); // Middleware de seguridad

// Configuración de Multer (Igual que antes)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- RUTAS PROTEGIDAS CON AUTH ---

// GET: Ahora usa el controlador que consulta la BD
router.get('/', auth, mediaController.getMedia);

// POST: Subir archivo y REGISTRAR EN BD
router.post('/', auth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'Por favor sube un archivo.' });
    }

    try {
        // Detectar tipo
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(req.file.originalname);

        // CORRECCIÓN: Detectar si es admin o superadmin para poner businessId null
        const isSuperAdmin = req.user.role === 'superadmin' || req.user.username === 'admin';
        const businessId = isSuperAdmin ? null : req.user.businessId;

        // Guardar referencia en MongoDB vinculada al negocio
        const newMedia = new Media({
            name: req.file.filename,
            originalName: req.file.originalname,
            url: `/uploads/${req.file.filename}`,
            type: isVideo ? 'video' : 'image',
            // businessId: req.user.businessId // <--- AISLAMIENTO SAAS
            businessId: businessId
        });

        await newMedia.save();

        res.send({ 
            message: 'Archivo subido y registrado.', 
            url: newMedia.url,
            name: newMedia.name
        });
    } catch (error) {
        // Si falla la BD, borrar el archivo físico para no dejar basura
        fs.unlinkSync(req.file.path);
        res.status(500).send({ message: 'Error registrando archivo en BD.'+error.message });
    }
});

// DELETE: Usa el controlador que verifica propiedad
router.delete('/:filename', auth, mediaController.deleteMedia);

module.exports = router;