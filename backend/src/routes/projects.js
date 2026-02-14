const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { projectValidation, commonValidations } = require('../middleware/validation');
const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');
const crypto = require('crypto');


const router = express.Router();

// CREATE PROJECT
router.post('/', authenticate, authorize(['ADMIN']), projectValidation.create, async (req, res, next) => {
    try {
        const projectData = {
            ...req.body,
            maxTeamSize: parseInt(req.body.maxTeamSize),
            scopeId: req.body.scopeId || null
        };
        const project = await prisma.project.create({ data: projectData });
        res.json(project);
    } catch (e) {
        next(e);
    }
});

// BULK CREATE PROJECTS
router.post('/bulk', authenticate, authorize(['ADMIN']), projectValidation.bulkCreate, async (req, res, next) => {
    try {
        const projects = req.body.projects;

        const data = projects.map(p => ({
            id: crypto.randomUUID(),
            title: p.title,
            category: p.category,
            maxTeamSize: parseInt(p.maxTeamSize) || 4,
            description: p.description || "",
            techStack: p.techStack || "",
            srs: p.srs || "",
            scopeId: p.scopeId || null
        }));

        // Chunking to handle large imports safely
        const chunkSize = 100;
        let totalCreated = 0;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const result = await prisma.project.createMany({
                data: chunk,
                skipDuplicates: true
            });
            totalCreated += result.count;
        }

        res.json({ success: true, count: totalCreated });
    } catch (e) {
        next(e);
    }
});

// GET ALL UNIQUE CATEGORIES
router.get('/categories', authenticate, async (req, res, next) => {
    try {
        const categories = await prisma.project.findMany({
            select: { category: true },
            distinct: ['category']
        });
        res.json(categories.map(c => c.category));
    } catch (e) {
        next(e);
    }
});

// GET ALL PROJECTS (with pagination and filtering)
router.get('/', authenticate, commonValidations.pagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        // Optional filters and Sorting
        const { status, category, session, search, sortBy = 'createdAt', order = 'desc', scopeId, hasSRS } = req.query;
        const where = {};

        if (status && status !== 'ALL') where.status = status;
        if (scopeId && scopeId !== 'ALL') where.scopeId = scopeId;
        if (category && category !== 'ALL') where.category = category;
        if (session) where.session = session;

        if (hasSRS === 'true') {
            where.AND = [
                ...(where.AND || []),
                { srs: { not: null } },
                { srs: { not: "" } }
            ];
        } else if (hasSRS === 'false') {
            where.OR = [
                { srs: null },
                { srs: "" }
            ];
        }
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
                {
                    teams: {
                        some: {
                            members: {
                                some: {
                                    user: {
                                        OR: [
                                            { name: { contains: search } },
                                            { rollNumber: { contains: search } }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            ];
        }

        // Student-specific filtering: Only show projects from ASSIGNED scopes (or no scope)
        if (req.user.role === 'STUDENT') {
            // 1. Fetch Assigned Scopes
            const userWithScopes = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { scopes: { select: { id: true } } }
            });
            const assignedScopeIds = userWithScopes?.scopes.map(s => s.id) || [];

            // 2. Fetch User's Active Project Participations to EXCLUDE those scopes
            // We need to find which scopes the user already has a "Project" in (via Team or Request)
            const userTeams = await prisma.teammember.findMany({
                where: { userId: req.user.id },
                include: {
                    team: {
                        select: {
                            projectId: true,
                            project: { select: { scopeId: true } },
                            projectRequests: {
                                where: { status: { in: ['PENDING', 'APPROVED'] } },
                                select: { project: { select: { scopeId: true } } }
                            }
                        }
                    }
                }
            });

            const excludedScopeIds = new Set();
            userTeams.forEach(tm => {
                const team = tm.team;
                // If team has a project assigned
                if (team.project?.scopeId) excludedScopeIds.add(team.project.scopeId);

                // If team has a pending/approved request
                team.projectRequests?.forEach(req => {
                    if (req.project?.scopeId) excludedScopeIds.add(req.project.scopeId);
                });
            });

            // 3. Build Query - Only exclude scopes where student already has a project
            // If excludedScopeIds is empty, we don't need to filter by it
            const excludedScopeIdsArray = Array.from(excludedScopeIds);

            if (assignedScopeIds.length === 0) {
                // If student has no assigned scopes, they see no projects
                where.id = 'none';
            } else {
                let scopeCondition;
                if (excludedScopeIdsArray.length > 0) {
                    // Filter: projects in assigned scopes AND not in excluded scopes
                    scopeCondition = {
                        AND: [
                            {
                                AND: [
                                    { scopeId: { in: assignedScopeIds } },
                                    { scope: { isActive: true } }
                                ]
                            },
                            { scopeId: { notIn: excludedScopeIdsArray } }
                        ]
                    };
                } else {
                    // No exclusions needed - just filter by assigned scopes
                    scopeCondition = {
                        AND: [
                            { scopeId: { in: assignedScopeIds } },
                            { scope: { isActive: true } }
                        ]
                    };
                }


                if (where.id !== 'none') {
                    if (search) {
                        delete where.OR;
                        where.AND = [
                            {
                                OR: [
                                    { title: { contains: search } },
                                    { description: { contains: search } }
                                ]
                            },
                            scopeCondition
                        ];
                    } else {
                        delete where.OR;
                        Object.assign(where, scopeCondition);
                    }
                }
            }
        }

        // Validate sortBy field
        const allowedSortFields = ['title', 'category', 'status', 'maxTeamSize', 'createdAt'];
        const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const orderByOrder = order === 'asc' ? 'asc' : 'desc';

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [orderByField]: orderByOrder },
                include: {
                    teams: {
                        include: {
                            members: {
                                where: { approved: true },
                                include: { user: true }
                            }
                        }
                    },
                    scope: true
                }
            }),
            prisma.project.count({ where })
        ]);

        res.json({
            projects,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        next(e);
    }
});

// DELETE PROJECT
router.delete('/:id', authenticate, authorize(['ADMIN']), projectValidation.delete, async (req, res, next) => {
    const { id } = req.params;
    try {
        const assignedTeam = await prisma.team.findFirst({ where: { projectId: id } });
        if (assignedTeam) {
            return res.status(400).json({ error: "Cannot delete project that is assigned to a team. Delete the team first or unassign the project." });
        }

        await prisma.project.delete({ where: { id } });
        res.json({ success: true, message: "Project deleted successfully" });
    } catch (e) {
        next(e);
    }
});

// BULK DELETE PROJECTS
router.post('/bulk-delete', authenticate, authorize(['ADMIN']), projectValidation.bulkDelete, async (req, res, next) => {
    try {
        const { ids } = req.body;

        // Check if any of these projects are assigned to teams
        const assignedTeams = await prisma.team.findMany({
            where: { projectId: { in: ids } },
            select: { projectId: true }
        });

        const assignedProjectIds = assignedTeams.map(t => t.projectId);
        const deletableIds = ids.filter(id => !assignedProjectIds.includes(id));

        if (deletableIds.length === 0 && ids.length > 0) {
            return res.status(400).json({
                error: "None of the selected projects could be deleted because they are all assigned to teams."
            });
        }

        const result = await prisma.project.deleteMany({
            where: { id: { in: deletableIds } }
        });

        res.json({
            success: true,
            deletedCount: result.count,
            failedCount: ids.length - result.count,
            message: `Successfully deleted ${result.count} projects.${assignedProjectIds.length > 0 ? ` ${assignedProjectIds.length} projects were skipped because they are assigned to teams.` : ''}`
        });
    } catch (e) {
        next(e);
    }
});

// UPDATE PROJECT
router.patch('/:id', authenticate, authorize(['ADMIN', 'FACULTY']), projectValidation.update, async (req, res, next) => {
    const { id } = req.params;
    try {
        const { title, category, maxTeamSize, description, status, techStack, srs, scopeId } = req.body;
        const updateData = {};

        // ADMIN Access: Allow all fields
        if (req.user.role === 'ADMIN') {
            if (title !== undefined) updateData.title = title;
            if (category !== undefined) updateData.category = category;
            if (maxTeamSize !== undefined) updateData.maxTeamSize = parseInt(maxTeamSize);
            if (description !== undefined) updateData.description = description;
            if (status !== undefined) updateData.status = status;
            if (techStack !== undefined) updateData.techStack = techStack;
            if (srs !== undefined) updateData.srs = srs;
            if (scopeId !== undefined) updateData.scopeId = scopeId;
        }
        // FACULTY Access: Check Role/Schedule & Restrict Fields
        else if (req.user.role === 'FACULTY') {
            // 1. Check if Guide/Expert for any team assigned to this project
            const isMentor = await prisma.team.findFirst({
                where: {
                    projectId: id,
                    OR: [
                        { guideId: req.user.id },
                        { subjectExpertId: req.user.id }
                    ]
                }
            });

            // 2. Check if Assigned Reviewer for this project
            const isReviewer = await prisma.reviewassignment.findFirst({
                where: {
                    projectId: id,
                    facultyId: req.user.id
                }
            });

            // 3. Check for Active Lab Session TODAY with any student from this project
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const session = await prisma.labsession.findFirst({
                where: {
                    facultyId: req.user.id,
                    startTime: { gte: todayStart },
                    endTime: { lte: todayEnd },
                    students: {
                        some: {
                            teamMemberships: {
                                some: {
                                    team: { projectId: id }
                                }
                            }
                        }
                    }
                }
            });

            if (!isMentor && !isReviewer && !session) {
                return res.status(403).json({ error: "Access denied. You must be a guide, expert, reviewer, or scheduled supervisor to edit this project." });
            }

            // Allow only SRS and Tech Stack
            if (techStack !== undefined) updateData.techStack = techStack;
            if (srs !== undefined) updateData.srs = srs;

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ error: "No allowed fields to update. Faculty can only edit SRS and Tech Stack." });
            }
        }

        const updatedProject = await prisma.project.update({
            where: { id },
            data: updateData
        });
        res.json(updatedProject);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
