const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { rubricValidation, validate } = require('../middleware/validation');

// GET all rubrics (with optional filters)
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { category, phase } = req.query;
        const where = {};
        if (category) where.category = category;
        if (phase) where.phase = parseInt(phase);

        const rubrics = await prisma.rubric.findMany({
            where,
            orderBy: [{ category: 'asc' }, { phase: 'asc' }]
        });
        res.json(rubrics);
    } catch (e) {
        next(e);
    }
});

// GET unique categories
router.get('/categories', authenticate, async (req, res, next) => {
    try {
        const categories = await prisma.project.findMany({
            select: { category: true },
            distinct: ['category'],
            where: { category: { not: '' } }
        });
        res.json(categories.map(c => c.category));
    } catch (e) {
        next(e);
    }
});

// GET rubric for specific review/project
router.get('/find', authenticate, async (req, res, next) => {
    try {
        const { category, phase } = req.query;
        if (!category || !phase) {
            return res.status(400).json({ error: 'Category and phase are required' });
        }

        const rubric = await prisma.rubric.findUnique({
            where: {
                category_phase: {
                    category,
                    phase: parseInt(phase)
                }
            }
        });

        if (!rubric) {
            return res.status(404).json({ error: 'No rubric found for this category and phase' });
        }

        res.json(rubric);
    } catch (e) {
        next(e);
    }
});

// GET single rubric by ID
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const rubric = await prisma.rubric.findUnique({
            where: { id: req.params.id }
        });
        if (!rubric) return res.status(404).json({ error: 'Rubric not found' });
        res.json(rubric);
    } catch (e) {
        next(e);
    }
});

// POST Create new rubric
router.post('/', authenticate, authorize(['ADMIN']), rubricValidation.create, async (req, res, next) => {
    try {
        const { name, category, phase, criteria } = req.body;

        // Calculate total marks (validated again in logic for safety)
        const criteriaList = JSON.parse(JSON.stringify(criteria)); // Ensure it's treated as data
        const totalMarks = criteriaList.reduce((sum, c) => sum + c.maxMarks, 0);

        const rubric = await prisma.rubric.create({
            data: {
                name,
                category,
                phase: parseInt(phase),
                criteria: JSON.stringify(criteria),
                totalMarks
            }
        });
        res.status(201).json(rubric);
    } catch (e) {
        if (e.code === 'P2002') {
            return res.status(400).json({ error: 'A rubric for this category and phase already exists' });
        }
        next(e);
    }
});

// PUT Update rubric
router.put('/:id', authenticate, authorize(['ADMIN']), rubricValidation.update, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, category, phase, criteria, isActive } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (category) updateData.category = category;
        if (phase) updateData.phase = parseInt(phase);
        if (isActive !== undefined) updateData.isActive = isActive;

        if (criteria) {
            const criteriaList = JSON.parse(JSON.stringify(criteria));
            const totalMarks = criteriaList.reduce((sum, c) => sum + c.maxMarks, 0);

            updateData.criteria = JSON.stringify(criteria);
            updateData.totalMarks = totalMarks;
        }

        const rubric = await prisma.rubric.update({
            where: { id },
            data: updateData
        });
        res.json(rubric);
    } catch (e) {
        if (e.code === 'P2001') { // Record not found
            return res.status(404).json({ error: 'Rubric not found' });
        }
        if (e.code === 'P2002') { // Unique constraint violation
            return res.status(400).json({ error: 'A rubric for this category and phase already exists' });
        }
        next(e);
    }
});

// DELETE Rubric
router.delete('/:id', authenticate, authorize(['ADMIN']), rubricValidation.delete, async (req, res, next) => {
    try {
        await prisma.rubric.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true, message: 'Rubric deleted successfully' });
    } catch (e) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: 'Rubric not found' });
        }
        next(e);
    }
});

module.exports = router;
