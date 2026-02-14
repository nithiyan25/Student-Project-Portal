const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

const { getCollegeSecondsBetween } = require('../utils/timerUtils');

// Helper to enrich scope with dynamic timer data
const enrichScopeWithTimer = (scope) => {
    const serverNow = new Date();
    if (!scope.isTimerRunning || !scope.timerLastUpdated) {
        return {
            ...scope,
            serverTime: serverNow,
            currentRemainingSeconds: scope.timerRemainingSeconds || 0
        };
    }

    const elapsed = getCollegeSecondsBetween(new Date(scope.timerLastUpdated), serverNow);
    const currentRemaining = Math.max(0, (scope.timerRemainingSeconds || 0) - elapsed);

    return {
        ...scope,
        serverTime: serverNow,
        currentRemainingSeconds: currentRemaining
    };
};

// List Scopes
router.get('/', authenticate, async (req, res, next) => {
    try {
        const scopes = await prisma.projectscope.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { projects: true, students: true } },

                teams: {
                    select: { status: true }
                }
            }
        });

        const enrichedScopes = scopes.map(scope => {
            const timerEnriched = enrichScopeWithTimer(scope);

            // Calculate team status counts
            const statusCounts = (scope.teams || []).reduce((acc, team) => {
                acc[team.status] = (acc[team.status] || 0) + 1;
                return acc;
            }, {});

            // Add metadata about completed but potentially unpublished results
            const completedCount = statusCounts['COMPLETED'] || 0;

            // Clean up the teams array before sending to avoid large response
            delete timerEnriched.teams;

            return {
                ...timerEnriched,
                teamStatusCounts: statusCounts,
                completedTeamsCount: completedCount
            };
        });

        res.json(enrichedScopes);
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
                    include: {

                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        const scopes = userWithScopes?.scopes || [];
        res.json(scopes.map(enrichScopeWithTimer));
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
            const { name, description, type, isActive, requireGuide, requireSubjectExpert, timerTotalHours } = req.body;
            const scope = await prisma.projectscope.create({
                data: {
                    name,
                    description,
                    type,
                    isActive: isActive !== undefined ? isActive : true,
                    resultsPublished: req.body.resultsPublished === true,
                    requireGuide: requireGuide === true,
                    requireSubjectExpert: requireSubjectExpert === true,
                    numberOfPhases: req.body.numberOfPhases ? parseInt(req.body.numberOfPhases) : 4,
                    timerTotalHours: timerTotalHours ? parseFloat(timerTotalHours) : null,
                    timerRemainingSeconds: timerTotalHours ? Math.floor(parseFloat(timerTotalHours) * 3600) : 0,
                    updatedAt: new Date()
                }
            });
            res.json(enrichScopeWithTimer(scope));
        } catch (e) {
            next(e);
        }
    }
);

// Update Scope (PATCH)
router.patch('/:id', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            name, description, type, isActive, requireGuide, requireSubjectExpert,
            timerTotalHours, timerAction
        } = req.body;

        const currentScope = await prisma.projectscope.findUnique({ where: { id } });
        if (!currentScope) return res.status(404).json({ error: "Scope not found" });

        const updateData = { updatedAt: new Date() };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (requireGuide !== undefined) updateData.requireGuide = requireGuide;
        if (requireSubjectExpert !== undefined) updateData.requireSubjectExpert = requireSubjectExpert;
        if (req.body.resultsPublished !== undefined) updateData.resultsPublished = req.body.resultsPublished;
        if (req.body.numberOfPhases !== undefined) updateData.numberOfPhases = parseInt(req.body.numberOfPhases);

        // Timer Logic
        if (timerTotalHours !== undefined) {
            updateData.timerTotalHours = parseFloat(timerTotalHours);
            // If timer is not running, also update remaining seconds
            if (!currentScope.isTimerRunning && !timerAction) {
                updateData.timerRemainingSeconds = Math.floor(parseFloat(timerTotalHours) * 3600);
            }
        }

        if (timerAction === 'START') {
            updateData.isTimerRunning = true;
            updateData.timerLastUpdated = new Date();
        } else if (timerAction === 'PAUSE') {
            if (currentScope.isTimerRunning && currentScope.timerLastUpdated) {
                const elapsed = getCollegeSecondsBetween(new Date(currentScope.timerLastUpdated), new Date());
                updateData.timerRemainingSeconds = Math.max(0, (currentScope.timerRemainingSeconds || 0) - elapsed);
                updateData.isTimerRunning = false;
                updateData.timerLastUpdated = new Date();
            }
        } else if (timerAction === 'RESET') {
            const hours = timerTotalHours !== undefined ? parseFloat(timerTotalHours) : currentScope.timerTotalHours;
            updateData.timerRemainingSeconds = Math.floor((hours || 0) * 3600);
            updateData.isTimerRunning = false;
            updateData.timerLastUpdated = null;
        }

        const scope = await prisma.projectscope.update({
            where: { id },
            data: updateData
        });
        res.json(enrichScopeWithTimer(scope));
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





// --- Deadline Management ---

// Get Deadlines for a Scope
router.get('/:id/deadlines', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const deadlines = await prisma.phaseDeadline.findMany({
            where: { scopeId: id },
            orderBy: { phase: 'asc' }
        });
        res.json(deadlines);
    } catch (e) {
        next(e);
    }
});

// Update/Create Deadlines for a Scope
router.post('/:id/deadlines', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { deadlines } = req.body; // Array of { phase: Int, deadline: DateString }

        if (!Array.isArray(deadlines)) {
            return res.status(400).json({ error: "deadlines array is required" });
        }

        await prisma.$transaction(async (tx) => {
            for (const d of deadlines) {
                await tx.phaseDeadline.upsert({
                    where: {
                        scopeId_phase: {
                            scopeId: id,
                            phase: parseInt(d.phase)
                        }
                    },
                    update: {
                        deadline: new Date(d.deadline)
                    },
                    create: {
                        scopeId: id,
                        phase: parseInt(d.phase),
                        deadline: new Date(d.deadline)
                    }
                });
            }
        });

        const updated = await prisma.phaseDeadline.findMany({
            where: { scopeId: id },
            orderBy: { phase: 'asc' }
        });
        res.json(updated);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
