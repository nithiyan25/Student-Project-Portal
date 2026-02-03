const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { reviewValidation, commonValidations } = require('../middleware/validation');
const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');
const crypto = require('crypto');


const router = express.Router();

// Faculty Assignments - Get projects assigned to faculty (with pagination)
router.get('/assignments', authenticate, authorize(['FACULTY', 'ADMIN']), commonValidations.pagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        let teams, total;

        if (req.user.role === 'ADMIN') {
            // Admins see all teams
            teams = await prisma.team.findMany({
                where: { status: { in: ['NOT_COMPLETED', 'IN_PROGRESS', 'COMPLETED', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW'] } },
                skip,
                take: limit,
                include: {
                    project: {
                        include: {
                            assignedFaculty: {
                                include: { faculty: true }
                            },
                            scope: true
                        }
                    },
                    members: {
                        include: { user: true },
                        where: { approved: true }
                    },
                    reviews: {
                        include: {
                            faculty: { select: { id: true, name: true, rollNumber: true, email: true } },
                            reviewMarks: true
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            total = await prisma.team.count({
                where: { status: { in: ['NOT_COMPLETED', 'IN_PROGRESS', 'COMPLETED', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW'] } }
            });
        } else {
            // Faculty see only projects assigned to them with valid (non-expired) access
            const now = new Date();
            const facultyAssignments = await prisma.reviewassignment.findMany({
                where: {
                    facultyId: req.user.id,
                    OR: [
                        { accessExpiresAt: null },  // Permanent access
                        { accessExpiresAt: { gt: now } }  // Not yet expired
                    ]
                },
                select: { projectId: true, reviewPhase: true, mode: true }
            });

            const assignedProjectIds = facultyAssignments.map(a => a.projectId);

            teams = await prisma.team.findMany({
                where: {
                    projectId: { in: assignedProjectIds }
                },
                skip,
                take: limit,
                include: {
                    project: {
                        include: {
                            assignedFaculty: {
                                include: { faculty: true }
                            },
                            scope: true
                        }
                    },
                    members: {
                        include: { user: true },
                        where: { approved: true }
                    },
                    reviews: {
                        include: {
                            faculty: { select: { id: true, name: true } },
                            reviewMarks: true
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            total = await prisma.team.count({
                where: {
                    projectId: { in: assignedProjectIds }
                }
            });

            // Attach specific assigned phase AND completion status for the requesting faculty
            const expandedTeams = [];

            // 1. Add formal assignments
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
                        isPhaseCompletedByFaculty: isCompleted
                    });
                }
            }



            teams = expandedTeams;
        }

        res.json({
            teams,
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
    try {
        // Validation: Content is REQUIRED for faculty, optional for Admins
        if (req.user.role === 'FACULTY' && (!content || content.trim() === "")) {
            return res.status(400).json({ error: "Review feedback description is required for faculty." });
        }

        // Check if user has permission to review this project (AND phase)
        let phaseToRecord = reviewPhase ? parseInt(reviewPhase) : null;

        if (req.user.role === 'FACULTY') {
            const assignment = await prisma.reviewassignment.findFirst({
                where: {
                    projectId: projectId,
                    facultyId: req.user.id
                }
            });

            if (!assignment) {
                return res.status(403).json({ error: "You are not assigned to review this project. Please ask the Admin to release the reviews." });
            }

            // If phase is provided, verify assignment
            if (reviewPhase && assignment.reviewPhase && assignment.reviewPhase !== parseInt(reviewPhase)) {
                return res.status(403).json({ error: `You are assigned to Phase ${assignment.reviewPhase}, but trying to submit Phase ${reviewPhase}` });
            }

            // Record the phase from assignment if not provided or to ensure consistency
            if (assignment.reviewPhase) {
                phaseToRecord = assignment.reviewPhase;
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

        const result = await prisma.$transaction(async (tx) => {
            // Check if there's an active review to close
            const activeReview = await tx.review.findFirst({
                where: {
                    teamId: teamId,
                    completedAt: null
                },
                orderBy: { createdAt: 'desc' }
            });

            // "Close" the active review cycle if it matches the current phase
            if (activeReview) {
                if (phaseToRecord && activeReview.reviewPhase && activeReview.reviewPhase !== phaseToRecord) {
                    // Non-blocking for now, or we can enforce it. 
                    // Let's just close it to maintain a clean single-active-review invariant.
                }
                await tx.review.update({
                    where: { id: activeReview.id },
                    data: { completedAt: new Date() }
                });
            }

            // Always create a new review record to preserve history
            const review = await tx.review.create({
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

            // Handle Individual Marks
            if (review && individualMarks && Array.isArray(individualMarks)) {
                // Remove old marks if this was an update
                if (activeReview && status === 'COMPLETED') {
                    await tx.reviewmark.deleteMany({
                        where: { reviewId: review.id }
                    });
                }

                // individualMarks: [{ studentId, marks }]
                await tx.reviewmark.createMany({
                    data: individualMarks.map(m => ({
                        id: crypto.randomUUID(),
                        reviewId: review.id,
                        studentId: m.studentId,
                        marks: parseInt(m.marks),
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
                            facultyId: req.user.id
                        },
                        data: {
                            accessExpiresAt: null // Set to permanent access
                        }
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

module.exports = router;
