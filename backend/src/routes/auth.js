const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Google OAuth Login
// SECURITY: Only users pre-registered in the database can login.
router.post('/google', async (req, res) => {
    const { token } = req.body;

    try {
        // 1. Verify Google ID Token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        email = payload.email;
        // console.log("Google Token Verified:", email);
    } catch (e) {
        console.error("Token verification failed:", e.message);
        return res.status(400).json({ error: "Invalid Google Token" });
    }

    try {
        // IMPORTANT: Only allow login for users that ALREADY exist in database
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: "Access denied. You are not registered in the system." });
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
                return res.status(200).json({
                    error: `Your account has been suspended${timeStr}. Reason: ${user.blockReason || 'Malpractice detected'}. Please contact the administrator (Learning Centre IV floor) to resolve this.`,
                    isBlocked: true,
                    blockedUntil: user.blockedUntil,
                    blockReason: user.blockReason
                });
            }
        }

        const appToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                isTemporaryAdmin: user.isTemporaryAdmin || false
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        // Track Login Metadata (Non-blocking)
        const UAParser = require('ua-parser-js');
        const parser = new UAParser(req.headers['user-agent']);
        const deviceData = parser.getResult();

        prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginIp: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                lastLoginDevice: JSON.parse(JSON.stringify(deviceData)),
                lastLoginAt: new Date()
            }
        }).catch(err => console.error("Failed to update login status:", err.message));

        res.json({ token: appToken, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Verify Token & Get Fresh User Data
router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token missing' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });

        if (!user) return res.status(404).json({ error: "User not found" });

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

        // Check Temp Admin Expiry
        if (user.isTemporaryAdmin && user.tempAdminExpiry && new Date(user.tempAdminExpiry) < new Date()) {
            user.isTemporaryAdmin = false;
            // Optionally update DB to reflect this immediately, but not strictly required as middleware handles it
        }

        res.json(user);
    } catch (e) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
