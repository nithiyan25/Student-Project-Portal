const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

// List Scopes
router.get('/', authenticate, async (req, res, next) => {
    try {
        const scopes = await prisma.projectscope.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { projects: true, students: true } }
            }
        });
        res.json(scopes);
    } catch (e) {
        next(e);
    }
});

// Get My Scopes (Student)
router.get('/my-scopes', authenticate, authorize(['STUDENT']), async (req, res, next) => {
    try {
        const userWithScopes = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                scopes: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        res.json(userWithScopes?.scopes || []);
    } catch (e) {
        next(e);
    }
});

// Create Scope (Admin only)
router.post(
    '/',
    authenticate,
    authorize(['ADMIN']),
    [
        body('name').notEmpty().withMessage('Name is required'),
        validate
    ],
    async (req, res, next) => {
        try {
            const { name, description, type, isActive, requireGuide, requireSubjectExpert } = req.body;
            const scope = await prisma.projectscope.create({
                data: {
                    name,
                    description,
                    type,
                    isActive: isActive !== undefined ? isActive : true,
                    requireGuide: requireGuide === true,
                    requireSubjectExpert: requireSubjectExpert === true,
                    numberOfPhases: req.body.numberOfPhases ? parseInt(req.body.numberOfPhases) : 4,
                    updatedAt: new Date()
                }
            });
            res.json(scope);
        } catch (e) {
            next(e);
        }
    }
);

// Update Scope (PATCH)
router.patch('/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, type, isActive, requireGuide, requireSubjectExpert } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (requireGuide !== undefined) updateData.requireGuide = requireGuide;
        if (requireSubjectExpert !== undefined) updateData.requireSubjectExpert = requireSubjectExpert;
        if (req.body.numberOfPhases !== undefined) updateData.numberOfPhases = parseInt(req.body.numberOfPhases);

        const scope = await prisma.projectscope.update({
            where: { id },
            data: updateData
        });
        res.json(scope);
    } catch (e) {
        next(e);
    }
});

// Toggle Active Status
router.put('/:id/toggle', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const scope = await prisma.projectscope.findUnique({ where: { id } });
        if (!scope) return res.status(404).json({ error: "Scope not found" });

        const updated = await prisma.projectscope.update({
            where: { id },
            data: { isActive: !scope.isActive }
        });
        res.json(updated);
    } catch (e) {
        next(e);
    }
});

// Get Students in Scope
router.get('/:id/students', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const scope = await prisma.projectscope.findUnique({
            where: { id },
            include: {
                students: {
                    select: { id: true, name: true, email: true, rollNumber: true }
                }
            }
        });
        if (!scope) return res.status(404).json({ error: "Scope not found" });
        res.json(scope.students);
    } catch (e) {
        next(e);
    }
});

// Add Students to Scope
router.post('/:id/students', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { studentIds } = req.body; // Array of UUIDs

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: "studentIds array is required" });
        }

        const scope = await prisma.projectscope.update({
            where: { id },
            data: {
                students: {
                    connect: studentIds.map(sid => ({ id: sid }))
                }
            }
        });
        res.json({ success: true, message: `Added ${studentIds.length} students to scope` });
    } catch (e) {
        next(e);
    }
});

// Bulk Add Students by Roll Number or Email
router.post('/:id/students-bulk', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { identifiers } = req.body; // Array of roll numbers or emails

        if (!Array.isArray(identifiers) || identifiers.length === 0) {
            return res.status(400).json({ error: "identifiers array is required" });
        }

        // Find students by rollNumber OR email
        const students = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                OR: [
                    { rollNumber: { in: identifiers.map(id => String(id)) } },
                    { email: { in: identifiers.map(id => String(id)) } }
                ]
            },
            select: { id: true, rollNumber: true, email: true }
        });

        if (students.length === 0) {
            return res.status(404).json({ error: "No matching students found for the provided identifiers" });
        }

        // Connect found students to the scope
        await prisma.projectscope.update({
            where: { id },
            data: {
                students: {
                    connect: students.map(s => ({ id: s.id }))
                }
            }
        });

        // Calculate which identifiers were not found
        // We normalize to lowercase for emails if needed, but let's stick to exact matches for now
        const foundIdentifiers = new Set([
            ...students.map(s => s.rollNumber),
            ...students.map(s => s.email)
        ].filter(Boolean));

        const notFound = identifiers.filter(id => !foundIdentifiers.has(String(id)));

        res.json({
            success: true,
            addedCount: students.length,
            notFound: notFound
        });
    } catch (e) {
        next(e);
    }
});

// Bulk Remove Students by Roll Number or Email
router.post('/:id/students-remove-bulk', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { identifiers } = req.body; // Array of roll numbers or emails

        if (!Array.isArray(identifiers) || identifiers.length === 0) {
            return res.status(400).json({ error: "identifiers array is required" });
        }

        // Find students by rollNumber OR email
        const students = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                OR: [
                    { rollNumber: { in: identifiers.map(id => String(id)) } },
                    { email: { in: identifiers.map(id => String(id)) } }
                ]
            },
            select: { id: true, rollNumber: true, email: true }
        });

        if (students.length === 0) {
            return res.status(404).json({ error: "No matching students found for the provided identifiers" });
        }

        // Disconnect found students from the scope
        await prisma.projectscope.update({
            where: { id },
            data: {
                students: {
                    disconnect: students.map(s => ({ id: s.id }))
                }
            }
        });

        // Calculate which identifiers were found (and thus removed) or not found
        const foundIdentifiers = new Set([
            ...students.map(s => s.rollNumber),
            ...students.map(s => s.email)
        ].filter(Boolean));

        const notFound = identifiers.filter(id => !foundIdentifiers.has(String(id)));

        res.json({
            success: true,
            removedCount: students.length,
            notFound: notFound
        });
    } catch (e) {
        next(e);
    }
});

// Get Scope Statistics & Student Assignment Status
router.get('/:id/stats', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;

        const scope = await prisma.projectscope.findUnique({
            where: { id },
            include: {
                students: {
                    select: {
                        id: true,
                        name: true,
                        rollNumber: true,
                        email: true,
                        department: true,
                        year: true
                    }
                },
                teams: {
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: { id: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!scope) return res.status(404).json({ error: "Scope not found" });

        // Get IDs of all students who are in any team for THIS scope
        const selectedStudentIds = new Set();
        scope.teams.forEach(team => {
            team.members.forEach(member => {
                selectedStudentIds.add(member.user.id);
            });
        });

        const studentStatus = scope.students.map(student => ({
            ...student,
            isSelected: selectedStudentIds.has(student.id)
        }));

        const selected = studentStatus.filter(s => s.isSelected);
        const pending = studentStatus.filter(s => !s.isSelected);

        res.json({
            scopeId: id,
            counts: {
                total: scope.students.length,
                selected: selected.length,
                pending: pending.length
            },
            selected,
            pending
        });
    } catch (e) {
        next(e);
    }
});

// Remove Students from Scope
router.delete('/:id/students', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { studentIds } = req.body;

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: "studentIds array is required" });
        }

        const scope = await prisma.projectscope.update({
            where: { id },
            data: {
                students: {
                    disconnect: studentIds.map(sid => ({ id: sid }))
                }
            }
        });
        res.json({ success: true, message: `Removed ${studentIds.length} students from scope` });
    } catch (e) {
        next(e);
    }
});

// Delete Scope
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if scope exists
        const scope = await prisma.projectscope.findUnique({ where: { id } });
        if (!scope) return res.status(404).json({ error: "Scope not found" });

        // Check dependencies (Projects & Teams)
        const projectCount = await prisma.project.count({ where: { scopeId: id } });
        if (projectCount > 0) {
            return res.status(400).json({ error: `Cannot delete scope. It has ${projectCount} assigned projects.` });
        }

        const teamCount = await prisma.team.count({ where: { scopeId: id } });
        if (teamCount > 0) {
            return res.status(400).json({ error: `Cannot delete scope. It has ${teamCount} active teams.` });
        }

        // Delete
        await prisma.projectscope.delete({ where: { id } });
        res.json({ success: true, message: "Scope deleted successfully" });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
