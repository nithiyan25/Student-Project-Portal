const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET ALL ALERTS (Admin Only)
router.get('/alerts', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const alerts = await prisma.securityAlert.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(alerts);
    } catch (e) {
        next(e);
    }
});

// MARK ALERT AS READ
router.patch('/alerts/:id/read', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        await prisma.securityAlert.update({
            where: { id: req.params.id },
            data: { isRead: true }
        });
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// DELETE ALERT
router.delete('/alerts/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        await prisma.securityAlert.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// BULK DELETE ALERTS
router.post('/alerts/bulk-delete', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ error: "Invalid alert IDs" });
        }
        await prisma.securityAlert.deleteMany({
            where: { id: { in: ids } }
        });
        res.json({ success: true, count: ids.length });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
