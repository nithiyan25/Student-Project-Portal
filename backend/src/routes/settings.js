const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

// Get all system settings
router.get('/', authenticate, async (req, res) => {
    try {
        const settings = await prisma.systemsettings.findMany();
        const config = {};
        settings.forEach(s => {
            config[s.key] = s.value;
        });
        res.json(config);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings (Admin only)
router.put(
    '/',
    authenticate,
    authorize(['ADMIN']),
    [
        body('settings').isObject().withMessage('Settings must be an object'),
        validate
    ],
    async (req, res) => {
        try {
            const { settings } = req.body;
            const updates = [];

            for (const [key, value] of Object.entries(settings)) {
                updates.push(
                    prisma.systemsettings.upsert({
                        where: { key },
                        update: { value: String(value) },
                        create: { key, value: String(value) }
                    })
                );
            }

            await prisma.$transaction(updates);

            const updatedSettings = await prisma.systemsettings.findMany();
            const config = {};
            updatedSettings.forEach(s => {
                config[s.key] = s.value;
            });

            res.json(config);
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({ error: 'Failed to update settings' });
        }
    }
);

module.exports = router;
