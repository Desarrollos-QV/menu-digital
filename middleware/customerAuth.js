const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'jwt_secret_key_default';

module.exports = (req, res, next) => {
    // Read token from header "Authorization: Bearer <token>"
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No se encontró token de sesión.' });
    }

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        req.customer = verified; // { id, phone, email, name }
        next();
    } catch (error) {
        console.error("JWT Verification Error (Customer):", error.message, error);
        res.status(401).json({ message: 'Sesión expirada o token inválido.', error: error.message });
    }
};
