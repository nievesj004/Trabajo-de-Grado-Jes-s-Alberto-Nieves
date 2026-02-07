const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tu_super_secreto_secreto';

exports.verifyToken = (req, res, next) => {
    const tokenHeader = req.headers['authorization'];

    if (!tokenHeader) {
        return res.status(403).json({ message: 'No se proporcionó token de seguridad' });
    }

    const token = tokenHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Formato de token inválido' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token no autorizado o expirado' });
        }
        req.user = decoded;
        next();
    });
};

exports.isAdmin = (req, res, next) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Requiere privilegios de Administrador' });
    }
    next();
};