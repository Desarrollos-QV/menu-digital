const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET; 

module.exports = (req, res, next) => {
    // Leer token del header "Authorization: Bearer <token>"
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. No hay token.' });
    }

    try {
        const verified = jwt.verify(token, SECRET_KEY);
        req.user = verified; // { id, role, businessId }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido.' });
    }
};