const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { reviewValidation, commonValidations } = require('../middleware/validation');
const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');
const { addDurationExcludingSundays } = require('../utils/timerUtils');
const crypto = require('crypto');


const router = express.Router();

router.get('/assignments', authenticate, authorize(['FACULTY', 'ADMIN']), commonValidations.pagination, async (req, res, next) => {
    try {
        const { search, scopeId, category, department, status, phase, active, sortBy } = req.query;
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        let conditions = [];

        // Apply filters
        if (scopeId && scopeId !== 'ALL') {
            conditions.push({ project: { scopeId } });
        }
        if (active === 'true') {
            conditions.push({ project: { scope: { isActive: true } } });
        } else if (active === 'false') {
            conditions.push({ project: { scope: { isActive: false } } });
        }

        if (category) {
            conditions.push({ project: { category: { equals: category } } });
        }
        if (department) {
            conditions.push({
                members: {
                    some: {
                        user: { department: { equals: department } }
                    }
                }
            });
        }
        if (search) {
            conditions.push({
                OR: [
                    { project: { title: { contains: search } } },
                    { members: { some: { user: { name: { contains: search } } } } },
                    { members: { some: { user: { rollNumber: { contains: search } } } } },
                    { project: { assignedFaculty: { some: { faculty: { name: { contains: search } } } } } }
                ]
            });
        }

        if (phase && phase !== 'ALL') {
            const phaseInt = parseInt(phase);
            conditions.push({
                OR: [
                    { reviews: { some: { reviewPhase: phaseInt } } },
                    { submissionPhase: phaseInt }
                ]
            });
        }

        if (status && status !== 'ALL') {
            conditions.push({ status });
        } else if (req.user.role === 'FACULTY') {
            // Faculty only see active reviewable statuses by default
            conditions.push({ status: { in: ['NOT_COMPLETED', 'IN_PROGRESS', 'COMPLETED', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW'] } });
        }

        let teams, total, statusCounts;

        const includeConfig = {
            project: {
                include: {
                    assignedFaculty: {
                        include: { faculty: true }
                    },
                    scope: true
                }
            },

            members: {
                include: {
                    user: {
                        include: {
                            labsession_sessionstudents: {
                                where: {
                                    endTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                                },
                                include: { venue: true },
                                orderBy: { startTime: 'asc' },
                                take: 1
                            }
                        }
                    }
                },
                where: { approved: true }
            },
            reviews: {
                include: {
                    faculty: { select: { id: true, name: true, rollNumber: true, email: true } },
                    reviewMarks: true
                },
                orderBy: { createdAt: 'desc' }
            }
        };

        if (req.user.role === 'ADMIN') {
            const where = { AND: conditions };
            const countsWhere = { AND: conditions.filter(c => !c.status || (c.status && c.status.in)) };

            [teams, total, statusCounts] = await Promise.all([
                prisma.team.findMany({
                    where,
                    skip,
                    take: limit,
                    include: includeConfig,
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.team.count({ where }),
                prisma.team.groupBy({
                    by: ['status'],
                    where: countsWhere,
                    _count: { _all: true }
                })
            ]);
        } else {
            // Faculty logic - restricted by assignment
            const now = new Date();
            const facultyAssignments = await prisma.reviewassignment.findMany({
                where: {
                    facultyId: req.user.id
                },
                select: { projectId: true, reviewPhase: true, mode: true, accessStartsAt: true, accessExpiresAt: true }
            });

            const assignedProjectIds = facultyAssignments.map(a => a.projectId);
            conditions.push({ projectId: { in: assignedProjectIds } });

            const where = { AND: conditions };
            const countsWhere = { AND: conditions.filter(c => !c.status || (c.status && c.status.in)) };

            [teams, total, statusCounts] = await Promise.all([
                prisma.team.findMany({
                    where,
                    skip,
                    take: limit,
                    include: includeConfig,
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.team.count({ where }),
                prisma.team.groupBy({
                    by: ['status'],
                    where: countsWhere,
                    _count: { _all: true }
                })
            ]);

            // Expand teams for faculty assignments
            let expandedTeams = [];
            for (const assignment of facultyAssignments) {
                const projectTeams = teams.filter(t => t.projectId === assignment.projectId);
                for (const team of projectTeams) {
                    const isCompleted = team.reviews.some(r =>
                        r.facultyId === req.user.id &&
                        r.reviewPhase === assignment.reviewPhase &&
                        r.status === 'COMPLETED'
                    );
                    expandedTeams.push({
                        ...team,
                        assignmentId: `${team.id}-${assignment.reviewPhase}`,
                        assignedPhase: assignment.reviewPhase,
                        reviewMode: assignment.mode,
                        isPhaseCompletedByFaculty: isCompleted,
                        reviewDeadline: assignment.accessExpiresAt,
                        reviewAccessStarted: assignment.accessStartsAt
                    });
                }
            }
            teams = expandedTeams;

            // Sort by Time Left if requested
            if (sortBy === 'timeLeft') {
                teams.sort((a, b) => {
                    const getEarliestEnd = (t) => {
                        const ends = t.members
                            .map(m => m.user.labsession_sessionstudents?.[0]?.endTime)
                            .filter(Boolean)
                            .map(d => new Date(d));

                        const sessionEnd = ends.length > 0 ? Math.min(...ends) : Infinity;
                        const reviewDeadline = t.reviewDeadline ? new Date(t.reviewDeadline).getTime() : Infinity;

                        return Math.min(sessionEnd, reviewDeadline);
                    };

                    const endA = getEarliestEnd(a);
                    const endB = getEarliestEnd(b);

                    if (endA === endB) return 0;
                    return endA < endB ? -1 : 1;
                });
            }
        }

        const counts = {
            TOTAL: total,
            READY_FOR_REVIEW: statusCounts.find(c => c.status === 'READY_FOR_REVIEW')?._count._all || 0,
            COMPLETED: statusCounts.find(c => c.status === 'COMPLETED')?._count._all || 0,
            IN_PROGRESS: statusCounts.find(c => c.status === 'IN_PROGRESS')?._count._all || 0,
            CHANGES_REQUIRED: statusCounts.find(c => c.status === 'CHANGES_REQUIRED')?._count._all || 0,
            NOT_COMPLETED: statusCounts.find(c => c.status === 'NOT_COMPLETED')?._count._all || 0,
            PENDING: statusCounts.find(c => c.status === 'PENDING')?._count._all || 0,
            APPROVED: statusCounts.find(c => c.status === 'APPROVED')?._count._all || 0,
        };

        res.json({
            teams,
            counts,
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
// Submit Review (Faculty or Admin)
router.post('/', authenticate, authorize(['FACULTY', 'ADMIN']), reviewValidation.submit, async (req, res, next) => {
    const { teamId, projectId, content, status, individualMarks, reviewPhase } = req.body;
    console.log('[DEBUG] Submit Review Request:', { teamId, projectId, status, reviewPhase, individualMarksCount: individualMarks?.length });
    try {
        // Validation: Content is REQUIRED for faculty unless everyone is absent
        const allAbsent = individualMarks && Array.isArray(individualMarks) && individualMarks.length > 0 && individualMarks.every(m => !!m.isAbsent);
        if (req.user.role === 'FACULTY' && !allAbsent && (!content || content.trim() === "")) {
            return res.status(400).json({ error: "Review feedback description is required for faculty." });
        }

        // Check if user has permission to review this project (AND phase)
        let phaseToRecord = reviewPhase ? parseInt(reviewPhase) : null;

        if (req.user.role === 'FACULTY') {
            const [assignment, team] = await Promise.all([
                prisma.reviewassignment.findFirst({
                    where: {
                        projectId: projectId,
                        facultyId: req.user.id
                    }
                }),
                prisma.team.findUnique({
                    where: { id: teamId },
                    select: { guideId: true, guideStatus: true, subjectExpertId: true, expertStatus: true }
                })
            ]);

            const isGuide = team?.guideId === req.user.id && team?.guideStatus === 'APPROVED';
            const isExpert = team?.subjectExpertId === req.user.id && team?.expertStatus === 'APPROVED';

            if (!assignment && !isGuide && !isExpert) {
                return res.status(403).json({ error: "You are not assigned to review this project nor are you a Guide/Expert for this team." });
            }

            // Enforce access window for regular assignments (Guides/Experts have permanent access)
            if (assignment && !isGuide && !isExpert) {
                const now = new Date();
                if (assignment.accessStartsAt && now < assignment.accessStartsAt) {
                    return res.status(403).json({ error: `Review access has not started yet. Starts at: ${assignment.accessStartsAt.toLocaleString()}` });
                }
                if (assignment.accessExpiresAt && now > assignment.accessExpiresAt) {
                    return res.status(403).json({ error: `Review access has expired. Expired at: ${assignment.accessExpiresAt.toLocaleString()}` });
                }
            }

            // NOTE: Phase matching check removed to allow faculty with any assignment to review subsequent phases.
            // The assignment's reviewPhase is used as fallback if no phase is provided.

            // Record the phase: prioritize provided reviewPhase, then assignment.reviewPhase, else default to 1 (for guide/expert)
            if (!phaseToRecord) {
                phaseToRecord = assignment?.reviewPhase || 1;
            }
        }
        // Admins can review any project (no check needed)

        // Check if a completed review already exists for this phase
        const existingCompletedReview = await prisma.review.findFirst({
            where: {
                teamId: teamId,
                reviewPhase: phaseToRecord,
                status: 'COMPLETED'
            }
        });

        if (existingCompletedReview) {
            return res.status(400).json({ error: "Review for this phase is already completed. You cannot edit it." });
        }

        // Fetch project to get category
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { category: true }
        });

        // Find rubric for this category and phase
        const rubric = await prisma.rubric.findFirst({
            where: {
                category: project?.category || 'General',
                phase: phaseToRecord || 1
            }
        });
        console.log('[DEBUG] Rubric found:', { found: !!rubric, name: rubric?.name, totalMarks: rubric?.totalMarks });

        // If status is COMPLETED, enforce rubric marks if rubric exists
        if (status === 'COMPLETED' && rubric && individualMarks) {
            const criteria = JSON.parse(rubric.criteria);
            for (const m of individualMarks) {
                const totalCalculated = Object.values(m.criterionMarks || {}).reduce((acc, val) => acc + (parseInt(val) || 0), 0);
                if (totalCalculated !== parseInt(m.marks)) {
                    // We can either auto-fix it or error out. Let's enforce consistency.
                    // return res.status(400).json({ error: `Marks mismatch for student ${m.studentId}. Calculated: ${totalCalculated}, Provided: ${m.marks}` });
                }

                // Validate against max marks
                console.log(`[DEBUG] Comparing marks for student ${m.studentId}:`, { marks: parseInt(m.marks), rubricMax: rubric.totalMarks });
                if (parseInt(m.marks) > rubric.totalMarks) {
                    return res.status(400).json({ error: `Marks for student ${m.studentId} exceed rubric maximum of ${rubric.totalMarks}` });
                }
            }
        }

        // If no rubric, default max marks to 100
        if (status === 'COMPLETED' && !rubric && individualMarks) {
            const defaultMaxMarks = 100;
            for (const m of individualMarks) {
                if (parseInt(m.marks) > defaultMaxMarks) {
                    return res.status(400).json({ error: `Marks for student ${m.studentId} exceed maximum of ${defaultMaxMarks} (no rubric defined)` });
                }
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // Check if there's an active review to close
            // Check if there's an active review for THIS faculty to close/update
            // We also allow updating a COMPLETED review if it was done recently (e.g. within 24h) 
            // to support the "give absent then present" override logic.
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const activeReview = await tx.review.findFirst({
                where: {
                    teamId: teamId,
                    facultyId: req.user.id,
                    reviewPhase: phaseToRecord, // Ensure it's for the same phase
                    OR: [
                        { completedAt: null },
                        { completedAt: { gte: twentyFourHoursAgo } }
                    ]
                },
                orderBy: { createdAt: 'desc' }
            });

            let review;

            // Reuse existing pending review if it exists (don't create duplicate)
            if (activeReview) {
                review = await tx.review.update({
                    where: { id: activeReview.id },
                    data: {
                        content: content || (status === 'COMPLETED' ? "Final review completed." : activeReview.content),
                        status: status || activeReview.status,
                        reviewPhase: phaseToRecord || activeReview.reviewPhase,
                        completedAt: status === 'COMPLETED' ? new Date() : null
                    }
                });
            } else {
                // Create a new review record if none exists
                review = await tx.review.create({
                    data: {
                        facultyId: req.user.id,
                        teamId,
                        projectId,
                        content: content || (status === 'COMPLETED' ? "Final review completed." : ""),
                        status: status || null,
                        reviewPhase: phaseToRecord,
                        completedAt: status === 'COMPLETED' ? new Date() : null
                    }
                });
            }

            // Handle Individual Marks
            if (review && individualMarks && Array.isArray(individualMarks)) {
                // Remove old marks if this was an update (always clean up for the review being processed)
                await tx.reviewmark.deleteMany({
                    where: { reviewId: review.id }
                });

                // individualMarks: [{ studentId, marks }]
                await tx.reviewmark.createMany({
                    data: individualMarks.map(m => ({
                        id: crypto.randomUUID(),
                        reviewId: review.id,
                        studentId: m.studentId,
                        marks: parseInt(m.marks) || 0,
                        isAbsent: !!m.isAbsent,
                        criterionMarks: m.criterionMarks ? JSON.stringify(m.criterionMarks) : null
                    }))
                });
            }

            if (status) {
                await tx.team.update({
                    where: { id: teamId },
                    data: { status: status }
                });

                // Auto-extend faculty access when marking as CHANGES_REQUIRED
                if (status === 'CHANGES_REQUIRED' && req.user.role === 'FACULTY') {
                    await tx.reviewassignment.updateMany({
                        where: {
                            projectId: projectId,
                            facultyId: req.user.id,
                            reviewPhase: phaseToRecord
                        },
                        data: {
                            accessExpiresAt: addDurationExcludingSundays(Date.now(), 24 * 60 * 60 * 1000) // Extend by 24 hours
                        }
                    });
                }
            } else if (individualMarks && individualMarks.length > 0) {
                // FALLBACK: If marks are saved but status wasn't provided, ensure team is out of PENDING
                const currentTeam = await tx.team.findUnique({ where: { id: teamId } });
                if (currentTeam?.status === 'PENDING') {
                    await tx.team.update({
                        where: { id: teamId },
                        data: { status: 'COMPLETED' }
                    });
                }
            }
            // Return full review with marks
            return await tx.review.findUnique({
                where: { id: review.id },
                include: { reviewMarks: true }
            });
        });
        res.json(result);
    } catch (e) {
        next(e);
    }
});

// UPDATE REVIEW feedback/status
router.patch('/:id', authenticate, authorize(['ADMIN']), reviewValidation.update, async (req, res, next) => {
    const { id } = req.params;
    try {
        const { content, status } = req.body;
        const updateData = {};
        if (content !== undefined) updateData.content = content;
        if (status !== undefined) updateData.status = status;

        const updatedReview = await prisma.review.update({
            where: { id },
            data: updateData
        });
        res.json(updatedReview);
    } catch (e) {
        next(e);
    }
});

// UPDATE INDIVIDUAL MARK
// CREATE INDIVIDUAL MARK (if it doesn't exist)
router.post('/marks', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { reviewId, studentId, marks } = req.body;

        // Check if mark already exists
        const existing = await prisma.reviewmark.findFirst({
            where: { reviewId, studentId }
        });

        if (existing) {
            const updated = await prisma.reviewmark.update({
                where: { id: existing.id },
                data: { marks: parseInt(marks) }
            });
            return res.json(updated);
        }

        const newMark = await prisma.reviewmark.create({
            data: {
                id: crypto.randomUUID(),
                reviewId,
                studentId,
                marks: parseInt(marks)
            }
        });
        res.json(newMark);
    } catch (e) {
        next(e);
    }
});

router.patch('/marks/:id', authenticate, authorize(['ADMIN']), reviewValidation.updateMark, async (req, res, next) => {
    const { id } = req.params;
    try {
        const { marks } = req.body;
        const updatedMark = await prisma.reviewmark.update({
            where: { id },
            data: { marks: parseInt(marks) }
        });
        res.json(updatedMark);
    } catch (e) {
        next(e);
    }
});

// DELETE REVIEW (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), reviewValidation.delete, async (req, res, next) => {
    const { id } = req.params;
    try {
        await prisma.review.delete({
            where: { id }
        });
        res.json({ message: "Review deleted successfully" });
    } catch (e) {
        if (e.code === 'P2025') {
            return res.status(404).json({ error: "Review not found" });
        }
        next(e);
    }
});

module.exports = router;
