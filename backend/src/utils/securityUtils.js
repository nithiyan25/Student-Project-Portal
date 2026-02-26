const prisma = require('./prisma');
const UAParser = require('ua-parser-js');

/**
 * Logs a security alert/malpractice attempt to the database.
 * @param {string|null} userId - The ID of the user (if authenticated).
 * @param {string} type - The type of alert (e.g., UNAUTHORIZED_ACCESS).
 * @param {string} description - Details about the incident.
 * @param {object} req - The Express request object (to extract path, method, IP).
 * @param {string} severity - HIGH, MEDIUM, LOW.
 */
const logSecurityAlert = async (userId, type, description, req, severity = 'MEDIUM') => {
    try {
        await prisma.securityAlert.create({
            data: {
                userId: userId || null,
                type: type,
                description: description,
                path: req.originalUrl || req.url,
                method: req.method,
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                metadata: {
                    host: req.headers.host,
                    referrer: req.headers.referer || req.headers.referrer,
                    device: JSON.parse(JSON.stringify(new UAParser(req.headers['user-agent']).getResult()))
                },
                severity: severity
            }
        });
    } catch (err) {
        console.error("Failed to log security alert:", err.message);
    }
};

module.exports = { logSecurityAlert };
