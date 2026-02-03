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
        res.json({ token: appToken, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;
