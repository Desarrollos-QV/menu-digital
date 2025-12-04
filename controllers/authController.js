const User = require('../models/User');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET; 

exports.getMe = async (req, res) => {
    try {
        // req.user.id viene del middleware auth
        const user = await User.findById(req.user.id).select('-password'); // Excluir password
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { id, username, email, password } = req.body;
        
        // Usamos el ID del token para seguridad (req.user.id)
        // O el ID enviado si es un superadmin editando a otro (depende de tu lógica)
        // Para este caso de "Mi Perfil", usamos req.user.id
        const userIdToUpdate = req.user.id; 

        const user = await User.findById(userIdToUpdate);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        if (username) user.username = username;
        if (email) user.email = email; // Nuevo
        if (password) user.password = password;

        await user.save();
        
        res.json({ message: 'Perfil actualizado exitosamente', user: { username: user.username, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;
        // Verificar si existe
        const existing = await User.findOne({ username });
        if (existing) return res.status(400).json({ message: 'El usuario ya existe' });

        const user = new User({ username, password });
        await user.save();
        res.status(201).json({ message: 'Usuario creado exitosamente' });
    } catch (error) {
        res.status(500).json({"data" : "Error",  message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 1. Buscar usuario
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

        // 2. Comparar contraseña
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas' });

        // 3. Generar Token
        const token = jwt.sign({ id: user._id, role: user.role, businessId: user.businessId }, SECRET_KEY, { expiresIn: '8h' });

        res.json({ 
            token, 
            username: user.username,
            role: user.role,
            status: 200
        });
    } catch (error) {
        res.status(500).json({ message: error.message,status:500 });
    }
};

