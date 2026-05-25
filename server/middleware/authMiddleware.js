const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'neural_quiz_secret_fallback_key_123!';

module.exports = (req, res, next) => {
    // Permettre les requêtes OPTIONS (CORS preflight)
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Accès refusé. Token manquant.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token invalide ou expiré.' });
    }
};
