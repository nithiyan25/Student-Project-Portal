const { logSecurityAlert } = require('../utils/securityUtils');

/**
 * Middleware to detect and log suspicious probing attempts.
 * Catches attempts to access common sensitive files or directories.
 */
const probingGuard = (req, res, next) => {
    const url = req.originalUrl || req.url || '';

    // skip check for legitimate API routes
    if (url.startsWith('/api/') || url.startsWith('/api')) {
        return next();
    }

    // Common probing patterns for malicious tools/bots
    const suspiciousPatterns = [
        /\.env/i,
        /\.git/i,
        /wp-admin/i,
        /config/i,
        /setup/i,
        /backup/i,
        /database/i,
        /sql/i,
        /\.php/i,
        /\.jsp/i,
        /\.asp/i,
        /cgi-bin/i,
        /\/\./, // Any hidden file attempt starting with /
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(url))) {
        logSecurityAlert(
            null,
            'SUSPICIOUS_PROBE',
            `Automated tool/probe detected attempting to access: ${url}`,
            req,
            'HIGH'
        );
        return res.status(403).json({ error: 'Access denied. Suspicious activity flagged.' });
    }

    next();
};

module.exports = probingGuard;
