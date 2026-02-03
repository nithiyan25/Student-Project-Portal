const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const router = express.Router();

// Email-only Login (Insecure - requested by user)
// SECURITY: Only users pre-registered in the database can login.
router.post('/login', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
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
        console.error("Login error:", error);
        res.status(500).json({ error: 'Login failed' });
    }
});

module.exports = router;
