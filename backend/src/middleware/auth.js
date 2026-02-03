const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token missing' });

    try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid token' });
    }
};

const authorize = (roles) => (req, res, next) => {
    // Check if user has required role OR is a temporary admin
    const hasAccess = roles.includes(req.user.role) ||
        (roles.includes('ADMIN') && req.user.isTemporaryAdmin);

    if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
};

module.exports = { authenticate, authorize };
