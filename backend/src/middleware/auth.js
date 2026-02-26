const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { logSecurityAlert } = require('../utils/securityUtils');

const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        // Log guest malpractice if trying to hit sensitive routes directly in browser
        const sensitiveRoutes = ['/api/admin', '/api/users', '/api/security', '/api/settings'];
        if (sensitiveRoutes.some(route => (req.originalUrl || req.url || "").startsWith(route))) {
            logSecurityAlert(
                null,
                'UNAUTHENTICATED_ACCESS',
                `Guest/Anonymous attempted to access sensitive route: ${req.originalUrl || req.url}`,
                req,
                'MEDIUM'
            );
        }
        return res.status(401).json({ error: 'Token missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // FRESH AUTH: Fetch user from DB to ensure role/status is up-to-date
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if (!user) {
            return res.status(401).json({ error: 'User no longer exists or access revoked.' });
        }

        // BLOCK CHECK & AUTO-EXPIRATION
        if (user.isBlocked) {
            const now = new Date();
            if (user.blockedUntil && now > new Date(user.blockedUntil)) {
                // Period expired - auto-unblock
                await prisma.user.update({
                    where: { id: user.id },
                    data: { isBlocked: false, blockedUntil: null }
                });
            } else {
                const timeStr = user.blockedUntil
                    ? ` until ${new Date(user.blockedUntil).toLocaleString()}`
                    : " indefinitely";
                return res.status(403).json({
                    error: `Your account has been suspended${timeStr}. Reason: ${user.blockReason || 'Malpractice detected'}. Please contact the administrator (Learning Centre IV floor) to resolve this.`,
                    isBlocked: true,
                    blockedUntil: user.blockedUntil,
                    blockReason: user.blockReason
                });
            }
        }

        req.user = user; // Attach FRESH user object
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

const authorize = (roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "User not authenticated" });

    // Check if temporary admin access has expired (using DB value)
    if (req.user.isTemporaryAdmin && req.user.tempAdminExpiry) {
        if (new Date(req.user.tempAdminExpiry) < new Date()) {
            // Expired: Treat as normal user (usually STUDENT/FACULTY)
            // We do NOT modify DB here (keep it pure), just deny admin access if role isn't natively ADMIN
            req.user.isTemporaryAdmin = false;
        }
    }

    // Check if user has required role OR is a valid temporary admin for ADMIN routes
    const hasAccess = roles.includes(req.user.role) ||
        (roles.includes('ADMIN') && req.user.isTemporaryAdmin);

    if (!hasAccess) {
        // LOG MALPRACTICE/TAMPERING ATTEMPT
        logSecurityAlert(
            req.user.id,
            'UNAUTHORIZED_ACCESS',
            `User ${req.user.name} (${req.user.role}${req.user.rollNumber ? `, Roll: ${req.user.rollNumber}` : ""}) attempted to access restricted route: ${req.originalUrl}`,
            req,
            'HIGH'
        );
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
};

module.exports = { authenticate, authorize };
