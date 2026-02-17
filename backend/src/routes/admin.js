const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { adminValidation, commonValidations } = require('../middleware/validation');
const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');
const { addDurationExcludingSundays } = require('../utils/timerUtils');
const { reassignPendingReview } = require('../utils/assignmentUtils');
const { spawn } = require('child_process');
const { URL } = require('url');

const router = express.Router();

// GET ALL TEAMS (For Admin/Faculty View with pagination)
router.get('/teams', authenticate, authorize(['ADMIN', 'FACULTY']), commonValidations.pagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        const [teams, total] = await Promise.all([
            prisma.team.findMany({
                skip,
                take: limit,
                where: {
                    AND: [
                        // Search Filter (Project Title OR Member Name OR Member Roll Number)
                        req.query.search ? {
                            OR: [
                                { project: { title: { contains: req.query.search } } }, // Removed mode: 'insensitive' for MySQL compatibility if needed, or keep if using Postgres/compatible MySQL collation. Prisma usually handles it.
                                { members: { some: { user: { name: { contains: req.query.search } } } } },
                                { members: { some: { user: { rollNumber: { contains: req.query.search } } } } }
                            ]
                        } : {},
                        // Status Filter
                        req.query.status && req.query.status !== 'ALL' ? { status: req.query.status } : {},
                        // Scope Filter
                        req.query.scopeId && req.query.scopeId !== 'ALL' ? { scopeId: req.query.scopeId } : {}
                    ]
                },
                include: {
                    members: {
                        include: { user: true },
                        where: { approved: true }
                    },
                    project: {
                        include: { scope: true }
                    },
                    scope: true,

                    guide: true,
                    subjectExpert: true,
                    reviews: {
                        include: {
                            reviewMarks: true,
                            faculty: true
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.team.count({
                where: {
                    AND: [
                        req.query.search ? {
                            OR: [
                                { project: { title: { contains: req.query.search } } },
                                { members: { some: { user: { name: { contains: req.query.search } } } } },
                                { members: { some: { user: { rollNumber: { contains: req.query.search } } } } }
                            ]
                        } : {},
                        req.query.status && req.query.status !== 'ALL' ? { status: req.query.status } : {},
                        req.query.scopeId && req.query.scopeId !== 'ALL' ? { scopeId: req.query.scopeId } : {}
                    ]
                }
            })
        ]);

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

// RE-OPEN COMPLETED REVIEW
router.post('/reviews/:id/reopen', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { id } = req.params;
    try {
        const review = await prisma.review.findUnique({
            where: { id },
            include: { team: true }
        });

        if (!review) return res.status(404).json({ error: "Review not found" });

        // Reset review 
        await prisma.review.update({
            where: { id },
            data: {
                completedAt: null,
                status: 'IN_PROGRESS'
            }
        });

        // Also update team status back to IN_PROGRESS if it was COMPLETED
        if (review.team.status === 'COMPLETED') {
            await prisma.team.update({
                where: { id: review.teamId },
                data: { status: 'IN_PROGRESS' }
            });
        }

        // Extend faculty access by 24 hours to ensure they can edit it
        await prisma.reviewassignment.updateMany({
            where: {
                projectId: review.projectId,
                facultyId: review.facultyId,
                reviewPhase: review.reviewPhase
            },
            data: {
                accessExpiresAt: addDurationExcludingSundays(Date.now(), 24 * 60 * 60 * 1000)
            }
        });

        res.json({ message: "Review re-opened successfully" });
    } catch (e) {
        next(e);
    }
});

// BULK UPDATE TEAM STATUS
router.post('/teams/bulk-status', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { teamIds, status } = req.body;

    try {
        const validStatuses = ['PENDING', 'APPROVED', 'NOT_COMPLETED', 'IN_PROGRESS', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        if (!Array.isArray(teamIds) || teamIds.length === 0) {
            return res.status(400).json({ error: "No team IDs provided" });
        }

        const results = await prisma.$transaction(async (tx) => {
            const updatedTeams = [];

            for (const id of teamIds) {
                const team = await tx.team.findUnique({
                    where: { id },
                    include: { project: true }
                });

                if (!team) continue;

                // Update Team Status
                await tx.team.update({
                    where: { id },
                    data: { status }
                });

                // If status is not PENDING, ensure all members and assigned faculty are approved
                if (status !== 'PENDING') {
                    await tx.teammember.updateMany({
                        where: { teamId: id },
                        data: { approved: true }
                    });

                    // Auto-approve Guide and Expert if they are assigned
                    await tx.team.update({
                        where: { id },
                        data: {
                            guideStatus: team.guideId ? 'APPROVED' : undefined,
                            expertStatus: team.subjectExpertId ? 'APPROVED' : undefined
                        }
                    });
                }

                // If reset, cancel pending/ready reviews
                if (['NOT_COMPLETED', 'IN_PROGRESS', 'PENDING'].includes(status)) {
                    await tx.review.updateMany({
                        where: {
                            teamId: id,
                            status: { in: ['PENDING', 'READY_FOR_REVIEW'] }
                        },
                        data: { status: 'NOT_COMPLETED' }
                    });
                }

                // Changes Required Extension
                if (status === 'CHANGES_REQUIRED' && team.projectId) {
                    const newExpiry = addDurationExcludingSundays(Date.now(), 24 * 60 * 60 * 1000);

                    const latestReview = await tx.review.findFirst({
                        where: { teamId: id },
                        orderBy: { createdAt: 'desc' }
                    });

                    await tx.reviewassignment.updateMany({
                        where: {
                            projectId: team.projectId,
                            reviewPhase: latestReview ? latestReview.reviewPhase : undefined
                        },
                        data: { accessExpiresAt: newExpiry }
                    });
                }

                updatedTeams.push(id);
            }
            return updatedTeams;
        }, {
            timeout: 30000
        });

        res.json({ message: `Successfully updated ${results.length} teams`, count: results.length });
    } catch (e) {
        next(e);
    }
});

// GET SINGLE TEAM BY ID (For Admin/Faculty)
router.get('/teams/:id', authenticate, authorize(['ADMIN', 'FACULTY']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const team = await prisma.team.findUnique({
            where: { id },
            include: {
                members: {
                    include: { user: true },
                    where: { approved: true }
                },
                project: {
                    include: { scope: true }
                },
                scope: {
                    include: {
                        deadlines: true
                    }
                },
                guide: true,
                subjectExpert: true,
                reviews: {
                    include: {
                        reviewMarks: true,
                        faculty: true
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!team) return res.status(404).json({ error: "Team not found" });

        // FACULTY Permission Check
        if (req.user.role === 'FACULTY') {
            const isGuide = team.guideId === req.user.id;
            const isExpert = team.subjectExpertId === req.user.id;

            // Is Assigned Reviewer?
            const isReviewer = await prisma.reviewassignment.findFirst({
                where: {
                    projectId: team.projectId,
                    facultyId: req.user.id
                }
            });

            // Has ACTIVE or UPCOMING Lab Session with any team member?
            const now = new Date();
            const session = await prisma.labsession.findFirst({
                where: {
                    facultyId: req.user.id,
                    endTime: { gte: now }, // Active or Future
                    user_sessionstudents: {
                        some: {
                            id: { in: team.members.map(m => m.user.id) }
                        }
                    }
                }
            });

            if (!isGuide && !isExpert && !isReviewer && !session) {
                return res.status(403).json({
                    error: "Access denied. You can only view details of teams you guide, expert, review, or are currently supervising."
                });
            }
        }

        res.json(team);
    } catch (e) {
        next(e);
    }
});



// GET PENDING REVIEW ASSIGNMENTS
router.get('/pending-reviews', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const now = new Date();
        const { search, phase, scopeId, activeSession } = req.query;

        // Build Prisma Where Clause for Search & Scope
        const whereClause = {
            status: 'READY_FOR_REVIEW'
        };

        if (scopeId && scopeId !== 'ALL') {
            whereClause.scopeId = scopeId;
        }

        if (search) {
            whereClause.OR = [
                { project: { title: { contains: search } } }, // Removed mode: 'insensitive' for compatibility
                { members: { some: { user: { name: { contains: search } } } } },
                { members: { some: { user: { rollNumber: { contains: search } } } } },
                { project: { assignedFaculty: { some: { faculty: { name: { contains: search } } } } } } // Search by assigned faculty too? Maybe not needed but good to have. User asked for "Faculty Name" - technically this is for *pending* reviews, so maybe they mean the Guide? Or any faculty associated? Let's stick to Project/Student/Faculty(Guide?)
                // Actually user said "search box with name , roll number , project name , faculty name". 
                // For pending reviews, "Faculty Name" could mean the Guide.
            ];
            // Add Guide search
            whereClause.OR.push({ guide: { name: { contains: search } } });
        }

        const teams = await prisma.team.findMany({
            where: whereClause,
            include: {
                project: {
                    include: {
                        assignedFaculty: true // Include existing assignments
                    }
                },
                scope: true,
                guide: true, // Include guide for display/search
                members: { include: { user: true } },
                reviews: {
                    include: { faculty: true }
                }
            }
        });

        // Filter out teams that already have a valid assignment
        // AND apply 'phase' and 'activeSession' filters
        let teamsNeedingAssignment = teams.filter(team => {
            if (!team.project) return true; // No project, needs assignment (edge case)

            const passedPhases = new Set([
                ...(team.reviews || []).filter(r => r.status && r.status !== 'PENDING').map(r => r.reviewPhase),
                ...(team.project?.assignedFaculty || [])
                    .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
                    .map(a => a.reviewPhase),
                ...(team.deadlineGroup?.deadlines || [])
                    .filter(d => new Date(d.deadline) < now)
                    .map(d => d.phase)
            ]);
            const nextPhase = Math.max(team.submissionPhase || 0, Math.max(0, ...Array.from(passedPhases)) + 1);

            // Filter by Phase (if provided)
            if (phase && phase !== 'ALL' && nextPhase !== parseInt(phase)) {
                return false;
            }

            // Check if there's a valid (non-expired) assignment specifically for the target phase
            const hasValidAssignmentForPhase = team.project.assignedFaculty?.some(a =>
                a.reviewPhase === nextPhase && (a.accessExpiresAt === null || new Date(a.accessExpiresAt) > now)
            );

            // If already has valid assignment for this phase, don't show in pending list
            return !hasValidAssignmentForPhase;
        });

        // Enrich with suggested faculty based on active lab session
        const enrichedTeams = await Promise.all(teamsNeedingAssignment.map(async (team) => {
            const passedPhases = new Set([
                ...(team.reviews || []).filter(r => r.status && r.status !== 'PENDING').map(r => r.reviewPhase),
                ...(team.project?.assignedFaculty || [])
                    .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
                    .map(a => a.reviewPhase),
                ...(team.deadlineGroup?.deadlines || [])
                    .filter(d => new Date(d.deadline) < now)
                    .map(d => d.phase)
            ]);
            const nextPhase = Math.max(team.submissionPhase || 0, Math.max(0, ...Array.from(passedPhases)) + 1);

            const studentIds = team.members.map(m => m.userId);

            // Find ANY active session for the team members
            const activeSessionData = await prisma.labsession.findFirst({
                where: {
                    user_sessionstudents: { some: { id: { in: studentIds } } },
                    endTime: { gte: new Date() } // Active or Future
                },
                include: { user_labsession_facultyIdTouser: true },
                orderBy: { startTime: 'asc' }
            });

            return {
                ...team,
                nextPhase,
                suggestedFaculty: activeSessionData ? activeSessionData.user_labsession_facultyIdTouser : null
            };
        }));

        // Filter by Active Session (if provided)
        let finalResult = enrichedTeams;
        if (activeSession && activeSession !== 'ALL') {
            const wantActive = activeSession === 'true';
            finalResult = finalResult.filter(t => wantActive ? t.suggestedFaculty !== null : t.suggestedFaculty === null);
        }

        res.json(finalResult);
    } catch (e) {
        next(e);
    }
});

// GET ABSENTEES (Students marked absent or who missed their session)
router.get('/absentees', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { scopeId, phase, department } = req.query;
        const now = new Date();

        // 1. Fetch Explicit Absentees (from reviewmark)
        const explicitAbsentees = await prisma.reviewmark.findMany({
            where: {
                isAbsent: true,
                ...(phase && phase !== 'ALL' ? { review: { reviewPhase: parseInt(phase) } } : {}),
                ...(scopeId && scopeId !== 'ALL' ? { review: { team: { scopeId } } } : {}),
                ...(department && department !== 'ALL' ? { student: { department } } : {})
            },
            include: {
                student: true,
                review: {
                    include: {
                        faculty: true,
                        team: {
                            include: {
                                project: true,
                                scope: true
                            }
                        }
                    }
                }
            }
        });

        // 2. Fetch Implicit Absentees (Expired assignments with no review)
        const expiredAssignments = await prisma.reviewassignment.findMany({
            where: {
                accessExpiresAt: { lt: now },
                ...(scopeId && scopeId !== 'ALL' ? { project: { scopeId } } : {}),
                ...(phase && phase !== 'ALL' ? { reviewPhase: parseInt(phase) } : {})
            },
            include: {
                project: {
                    include: {
                        teams: {
                            include: {
                                members: {
                                    include: { user: true },
                                    where: { approved: true }
                                },
                                reviews: true
                            }
                        }
                    }
                },
                faculty: true
            }
        });

        const implicitAbsentees = [];
        for (const assignment of expiredAssignments) {
            if (!assignment.project?.teams) continue;

            for (const team of assignment.project.teams) {
                // Check if THIS team in THE project has a review for THIS specific phase
                const hasReview = team.reviews.some(r => r.reviewPhase === assignment.reviewPhase);

                if (!hasReview) {
                    for (const member of team.members) {
                        if (department && department !== 'ALL' && member.user.department !== department) continue;

                        // Avoid duplicates if a student is already marked absent explicitly
                        const isAlreadyExplicit = explicitAbsentees.some(ea => ea.studentId === member.user.id && ea.review.reviewPhase === assignment.reviewPhase);
                        if (isAlreadyExplicit) continue;

                        implicitAbsentees.push({
                            student: member.user,
                            type: 'MISSED_DEADLINE',
                            phase: assignment.reviewPhase,
                            teamId: team.id,
                            projectTitle: assignment.project.title,
                            facultyName: assignment.faculty?.name || "N/A",
                            facultyId: assignment.facultyId,
                            scopeId: team.scopeId,
                            assignedAt: assignment.assignedAt,
                            expiresAt: assignment.accessExpiresAt
                        });
                    }
                }
            }
        }

        // 3. (Removed Deadline Absentees logic as it depended on PhaseDeadline/DeadlineGroup)

        // 3. Merge and format (Adjusted logic to skip deadline absentees for now or use Scope deadlines if valid, but for revert just removing group logic)
        const report = await Promise.all([
            ...explicitAbsentees.map(async (a) => {
                // Find session active during review creation
                const session = await prisma.labsession.findFirst({
                    where: {
                        facultyId: a.review.facultyId,
                        scopeId: a.review.team?.scopeId,
                        startTime: { lte: a.createdAt },
                        endTime: { gte: a.createdAt }
                    },
                    include: { venue: true }
                });

                return {
                    student: a.student,
                    type: 'MARKED_ABSENT',
                    phase: a.review.reviewPhase,
                    teamId: a.review.teamId,
                    projectTitle: a.review.team.project?.title,
                    facultyName: a.review.faculty?.name,
                    date: a.createdAt,
                    sessionName: session?.title || "Off-session Review",
                    venue: session?.venue?.name || "N/A",
                    timeSlot: session ? `${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "N/A"
                };
            }),
            ...implicitAbsentees.map(async (a) => {
                // Find session active when assignment was created (assignedAt)
                const session = await prisma.labsession.findFirst({
                    where: {
                        facultyId: a.facultyId,
                        scopeId: a.scopeId,
                        startTime: { lte: a.assignedAt },
                        endTime: { gte: a.assignedAt }
                    },
                    include: { venue: true }
                });

                return {
                    ...a,
                    sessionName: session?.title || "Missed Deadline",
                    venue: session?.venue?.name || "N/A",
                    timeSlot: session ? `${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "N/A"
                };
            })
        ]);

        res.json(report);
    } catch (e) {
        next(e);
    }
});

// AUTO-ASSIGN REVIEWS
router.post('/auto-assign-reviews', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { teamIds, manualAssignments = {} } = req.body;
    try {
        const results = [];
        let successCount = 0;
        let failCount = 0;

        const now = new Date();

        for (const teamId of teamIds) {
            const team = await prisma.team.findUnique({
                where: { id: teamId },
                include: {
                    members: { include: { user: true } },
                    project: { include: { assignedFaculty: true } },
                    reviews: true,
                }
            });

            if (!team) {
                results.push({ teamId, message: 'Team not found', status: 'failed' });
                failCount++;
                continue;
            }

            let facultyIdToAssign = manualAssignments[teamId];
            let assignedVia = 'manual override';

            if (!facultyIdToAssign) {
                // Find Active Session / Faculty
                const studentIds = team.members.map(m => m.userId);

                // Try to find session happening EXACTLY NOW
                let activeSession = await prisma.labsession.findFirst({
                    where: {
                        user_sessionstudents: { some: { id: { in: studentIds } } },
                        startTime: { lte: now },
                        endTime: { gte: now }
                    },
                    include: { user_labsession_facultyIdTouser: true },
                    orderBy: { startTime: 'desc' }
                });

                // Fallback: Find earliest future session today
                if (!activeSession) {
                    const endOfDay = new Date(now);
                    endOfDay.setHours(23, 59, 59, 999);

                    activeSession = await prisma.labsession.findFirst({
                        where: {
                            user_sessionstudents: { some: { id: { in: studentIds } } },
                            startTime: { gt: now, lte: endOfDay }
                        },
                        include: { user_labsession_facultyIdTouser: true },
                        orderBy: { startTime: 'asc' }
                    });
                }

                if (activeSession) {
                    facultyIdToAssign = activeSession.facultyId;
                    assignedVia = `active session (${activeSession.user_labsession_facultyIdTouser.name})`;
                }
            }

            if (!facultyIdToAssign) {
                results.push({ teamId, teamName: team.project?.title || teamId, message: 'No active lab session found and no manual override provided', status: 'failed' });
                failCount++;
                continue;
            }

            // Determine Phase - account for missed phases
            const passedPhases = new Set([
                ...(team.reviews || []).filter(r => r.status && r.status !== 'PENDING').map(r => r.reviewPhase),
                ...(team.project?.assignedFaculty || [])
                    .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
                    .map(a => a.reviewPhase)
            ]);
            const nextPhase = Math.max(team.submissionPhase || 0, Math.max(0, ...Array.from(passedPhases)) + 1);

            // Perform assignment/reassignment using utility
            const assignmentMethod = await reassignPendingReview(tx, team, facultyIdToAssign, nextPhase, now, req.user.id);
            assignedVia += assignmentMethod;

            // Update Team Status
            await prisma.team.update({
                where: { id: team.id },
                data: { status: 'IN_PROGRESS' }
            });

            results.push({ teamId, teamName: team.project?.title || team.id, message: `Assigned via ${assignedVia} (Phase ${nextPhase})`, status: 'success' });
            successCount++;
        }

        res.json({ success: true, successCount, failCount, results });
    } catch (e) {
        next(e);
    }
});

// AUTO-ASSIGN GUIDE REVIEWS (New Route)
router.post('/auto-assign-guide-reviews', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { scopeId, phase } = req.body;

    if (!scopeId || !phase) {
        return res.status(400).json({ error: "Scope ID and Phase are required" });
    }

    try {
        // Find teams with project and guide assigned
        const teams = await prisma.team.findMany({
            where: {
                scopeId: scopeId === 'ALL' ? undefined : scopeId,
                projectId: { not: null },
                guideId: { not: null }
            },
            include: {
                project: true,
                reviews: {
                    where: { reviewPhase: parseInt(phase) }
                }
            }
        });

        const results = [];
        let successCount = 0;
        let failCount = 0;
        const now = new Date();

        for (const team of teams) {
            // Skip if review for this phase already exists
            if (team.reviews.length > 0) {
                results.push({ teamId: team.id, teamName: team.project?.title || team.id, message: `Review for Phase ${phase} already exists`, status: 'skipped' });
                continue;
            }

            try {
                // 1. Create Review Entry
                await prisma.review.create({
                    data: {
                        teamId: team.id,
                        facultyId: team.guideId,
                        reviewPhase: parseInt(phase),
                        status: 'PENDING',
                        content: "",
                        projectId: team.projectId
                    }
                });

                // 2. Upsert Review Assignment (Enforce OFFLINE mode)
                await prisma.reviewassignment.upsert({
                    where: {
                        projectId_facultyId_reviewPhase: {
                            projectId: team.projectId,
                            facultyId: team.guideId,
                            reviewPhase: parseInt(phase)
                        }
                    },
                    update: {
                        mode: 'OFFLINE', // Ensure offline mode
                        assignedAt: now
                    },
                    create: {
                        projectId: team.projectId,
                        facultyId: team.guideId,
                        reviewPhase: parseInt(phase),
                        mode: 'OFFLINE', // Ensure offline mode
                        assignedBy: req.user.id,
                        accessStartsAt: now,
                        accessExpiresAt: null
                    }
                });

                // 3. Update Team Status to IN_PROGRESS (not REVIEW_IN_PROGRESS which is invalid)
                await prisma.team.update({
                    where: { id: team.id },
                    data: { status: 'IN_PROGRESS' }
                });

                results.push({ teamId: team.id, teamName: team.project?.title || team.id, message: "Assigned to Guide", status: 'success' });
                successCount++;
            } catch (err) {
                console.error(`Error assigning to team ${team.id}:`, err);
                results.push({ teamId: team.id, teamName: team.project?.title || team.id, message: err.message, status: 'failed' });
                failCount++;
            }
        }

        res.json({ success: true, message: `Processed ${teams.length} teams. Success: ${successCount}, Failed: ${failCount}`, results });
    } catch (e) {
        next(e);
    }
});

// GET TEAMS ELIGIBLE FOR MANUAL PHASE ASSIGNMENT
router.get('/eligible-review-teams', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { scopeId, phase } = req.query;

    if (!scopeId || !phase) {
        return res.status(400).json({ error: "Scope ID and Phase are required" });
    }

    try {
        const phaseNum = parseInt(phase);

        let where = {};
        if (scopeId && scopeId !== 'ALL') {
            where = {
                OR: [
                    { scopeId: scopeId },
                    { project: { scopeId: scopeId } },
                    { projectRequests: { some: { project: { scopeId: scopeId } } } }
                ]
            };
        }

        // Find all teams in this scope
        const allTeams = await prisma.team.findMany({
            where,
            include: {
                project: true,
                projectRequests: {
                    include: { project: true },
                    where: { status: 'PENDING' }
                },
                members: {
                    include: { user: true },
                    where: { approved: true }
                },
                reviews: {
                    where: {
                        reviewPhase: phaseNum,
                        status: 'COMPLETED'
                    }
                }
            }
        });

        // Filter for teams that do NOT have a completed review for this phase
        // AND are NOT already marked as READY_FOR_REVIEW (since they show up in the standard tab)
        const eligibleTeams = allTeams.filter(team =>
            team.reviews.length === 0 && team.status !== 'READY_FOR_REVIEW'
        );

        res.json(eligibleTeams);
    } catch (e) {
        next(e);
    }
});

// GET DASHBOARD STATS (Aggregated)
router.get('/stats', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const scopeId = req.query.scopeId; // Optional filter
        const projectFilter = scopeId && scopeId !== 'ALL' ? { scopeId } : {};
        const teamFilter = scopeId && scopeId !== 'ALL' ? { project: { scopeId } } : {};

        const [
            studentCount,
            facultyCount,
            adminCount,
            studentsWithoutTeam,
            totalProjects,
            availableProjects,
            requestedProjects,
            assignedProjects,
            teamsTotal,
            teamsNotCompleted,
            teamsReadyForReview,
            teamsChangesRequired,
            teamsCompleted,
            usersForMatrix
        ] = await Promise.all([
            prisma.user.count({ where: { role: 'STUDENT' } }),
            prisma.user.count({ where: { role: 'FACULTY' } }),
            prisma.user.count({ where: { role: 'ADMIN' } }),
            prisma.user.count({ where: { role: 'STUDENT', teamMemberships: { none: {} } } }),
            prisma.project.count({ where: projectFilter }),
            prisma.project.count({ where: { status: 'AVAILABLE', ...projectFilter } }),
            prisma.project.count({ where: { status: 'REQUESTED', ...projectFilter } }),
            prisma.project.count({ where: { status: 'ASSIGNED', ...projectFilter } }),
            prisma.team.count({ where: teamFilter }),
            prisma.team.count({ where: { status: 'NOT_COMPLETED', ...teamFilter } }),
            prisma.team.count({ where: { status: 'READY_FOR_REVIEW', ...teamFilter } }),
            prisma.team.count({ where: { status: 'CHANGES_REQUIRED', ...teamFilter } }),
            prisma.team.count({ where: { status: 'COMPLETED', ...teamFilter } }),
            // Fetch minimal user data for matrix and breakdowns to avoid heavy processing
            prisma.user.findMany({
                where: { role: 'STUDENT' },
                select: {
                    id: true,
                    department: true,
                    year: true,
                    teamMemberships: { select: { id: true } }
                }
            })
        ]);

        // Process granular stats in JS
        const students = usersForMatrix;
        const departments = [...new Set(students.map(u => u.department || 'Unassigned'))].sort();
        const years = [1, 2, 3, 4];

        const deptStats = departments.map(dept => {
            const deptStudents = students.filter(u => (u.department || 'Unassigned') === dept);
            return {
                name: dept,
                total: deptStudents.length,
                pending: deptStudents.filter(u => u.teamMemberships.length === 0).length
            };
        });

        const yearStats = years.map(year => {
            const yearStudents = students.filter(u => u.year === year);
            return {
                name: `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year`,
                total: yearStudents.length,
                pending: yearStudents.filter(u => u.teamMemberships.length === 0).length
            };
        });

        const matrix = departments.map(dept => {
            const row = { name: dept };
            years.forEach(year => {
                row[year] = students.filter(u => (u.department || 'Unassigned') === dept && u.year === year).length;
            });
            return row;
        });

        // Calculate phase-based statistics
        const phaseTeamFilter = scopeId && scopeId !== 'ALL' ? { projectId: { not: null }, project: { scopeId } } : { projectId: { not: null } };
        const allTeamsWithProjects = await prisma.team.findMany({
            where: phaseTeamFilter,
            include: {
                reviews: {
                    select: {
                        reviewPhase: true,
                        status: true,
                        createdAt: true
                    }
                }
            }
        });

        // Determine the number of phases to report on
        let numPhases = 3; // Minimum fallback
        if (scopeId && scopeId !== 'ALL') {
            const scope = await prisma.projectscope.findUnique({ where: { id: scopeId } });
            if (scope) numPhases = scope.numberOfPhases;
        } else {
            // Find max phases among all scopes if no specific scope selected
            const maxPhasesResult = await prisma.projectscope.aggregate({
                _max: { numberOfPhases: true }
            });
            numPhases = maxPhasesResult._max.numberOfPhases || 4;
        }

        const phaseStats = Array.from({ length: numPhases }, (_, i) => i + 1).map(phase => {
            const teamsAttendedPhase = allTeamsWithProjects.filter(t => t.reviews.some(r => r.reviewPhase === phase));
            const teamsCompletedPhase = allTeamsWithProjects.filter(t => {
                const phaseReviews = t.reviews.filter(r => r.reviewPhase === phase);
                if (phaseReviews.length === 0) return false;
                const latestInPhase = phaseReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                return latestInPhase.status === 'COMPLETED';
            });

            return {
                phase,
                total: allTeamsWithProjects.length,
                attended: teamsAttendedPhase.length,
                notAttended: allTeamsWithProjects.length - teamsAttendedPhase.length,
                completed: teamsCompletedPhase.length
            };
        });

        // Calculate detailed student phase completion report
        const studentsForReport = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: {
                id: true,
                name: true,
                rollNumber: true,
                department: true,
                year: true,
                teamMemberships: {
                    include: {
                        team: {
                            include: {
                                project: true,
                                reviews: {
                                    select: {
                                        reviewPhase: true,
                                        status: true,
                                        createdAt: true,
                                        reviewMarks: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const studentPhaseReport = studentsForReport.map(student => {
            const teamMembership = student.teamMemberships[0];
            const team = teamMembership?.team;

            const getPhaseStatus = (phase) => {
                if (!team || !team.reviews) return 'NOT_STARTED';
                const phaseReviews = team.reviews.filter(r => r.reviewPhase === phase);
                if (phaseReviews.length === 0) return 'NOT_STARTED';

                const latest = phaseReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                return latest.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
            };

            const getPhaseMarks = (phase) => {
                if (!team || !team.reviews) return null;
                const phaseReviews = team.reviews.filter(r => r.reviewPhase === phase);
                if (phaseReviews.length === 0) return null;

                const latest = phaseReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                const studentMark = latest.reviewMarks?.find(m => m.studentId === student.id);

                return studentMark ? {
                    total: studentMark.marks,
                    breakdown: studentMark.criterionMarks ? JSON.parse(studentMark.criterionMarks) : null
                } : null;
            };

            const reportData = {
                id: student.id,
                name: student.name,
                rollNumber: student.rollNumber,
                department: student.department || 'Unassigned',
                year: student.year,
                projectTitle: team?.project?.title || null,
                phaseMarks: {}
            };

            // Add statuses and marks dynamically for all phases
            for (let ph = 1; ph <= numPhases; ph++) {
                reportData[`phase${ph}`] = getPhaseStatus(ph);
                reportData.phaseMarks[ph] = getPhaseMarks(ph);
            }

            return reportData;
        });

        res.json({
            stats: {
                students: studentCount,
                studentsWithoutTeam,
                faculty: facultyCount,
                admins: adminCount,
                totalProjects,
                availableProjects,
                requestedProjects,
                assignedProjects,
                teamsTotal,
                teamsNotCompleted,
                teamsReadyForReview,
                teamsChangesRequired,
                teamsCompleted,
                phaseStats,
                studentPhaseReport
            },
            deptStats,
            yearStats,
            matrix
        });
    } catch (e) {
        next(e);
    }
});

// Admin: Assign Faculty to Project (With Phase and Mode)
router.post('/assign-faculty', authenticate, authorize(['ADMIN']), adminValidation.assignFaculty, async (req, res, next) => {
    const { projectId, facultyId, accessDurationHours, reviewPhase = 1, mode = 'OFFLINE', accessStartsAt } = req.body;
    try {
        const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
        if (!faculty || faculty.role !== 'FACULTY') {
            return res.status(400).json({ error: "Invalid faculty member" });
        }

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return res.status(404).json({ error: "Project not found" });
        }

        // Calculate expiration time if duration provided
        let accessExpiresAt = null;
        const startTime = accessStartsAt ? new Date(accessStartsAt) : new Date();

        if (accessDurationHours && accessDurationHours > 0) {
            accessExpiresAt = new Date(startTime.getTime() + accessDurationHours * 60 * 60 * 1000);
        }

        // Upsert reviewassignment with Phase and Mode
        const assignment = await prisma.reviewassignment.upsert({
            where: {
                projectId_facultyId_reviewPhase: {
                    projectId,
                    facultyId,
                    reviewPhase: parseInt(reviewPhase)
                }
            },
            update: {
                accessStartsAt: accessStartsAt ? new Date(accessStartsAt) : null,
                accessExpiresAt,
                assignedAt: new Date(),
                assignedBy: req.user.id,
                mode: mode.toUpperCase()
            },
            create: {
                projectId,
                facultyId,
                reviewPhase: parseInt(reviewPhase),
                assignedBy: req.user.id,
                accessStartsAt: accessStartsAt ? new Date(accessStartsAt) : null,
                accessExpiresAt,
                mode: mode.toUpperCase()
            },
            include: {
                faculty: true,
                project: true
            }
        });

        res.json({ success: true, assignment });
    } catch (e) {
        next(e);
    }
});

// Admin: Bulk Assign Faculty to Projects
router.post('/bulk-assign-faculty', authenticate, authorize(['ADMIN']), adminValidation.bulkAssignFaculty, async (req, res, next) => {
    let { projectIds, facultyIds, accessDurationHours, reviewPhase = 1, distributeEvenly = false, mode = 'OFFLINE', accessStartsAt, useVenueFaculty, scopeId, studentRollNumbers } = req.body;

    try {
        // Deduplicate input arrays
        projectIds = Array.isArray(projectIds) ? [...new Set(projectIds)] : [];
        facultyIds = Array.isArray(facultyIds) ? [...new Set(facultyIds)] : [];

        // If student roll numbers provided, resolve them to project IDs
        if (studentRollNumbers && Array.isArray(studentRollNumbers) && studentRollNumbers.length > 0) {
            const students = await prisma.user.findMany({
                where: {
                    rollNumber: { in: studentRollNumbers },
                    role: 'STUDENT'
                },
                include: {
                    teamMemberships: {
                        where: { approved: true },
                        include: { team: true }
                    }
                }
            });

            const resolvedProjectIds = new Set();
            const notFoundRolls = [];
            const noProjectRolls = [];

            // Create a lookup for quick verification
            const foundRolls = new Set(students.map(s => s.rollNumber));
            studentRollNumbers.forEach(roll => {
                if (!foundRolls.has(roll)) notFoundRolls.push(roll);
            });

            students.forEach(student => {
                const team = student.teamMemberships[0]?.team;
                if (team && team.projectId) {
                    resolvedProjectIds.add(team.projectId);
                } else {
                    noProjectRolls.push(student.rollNumber);
                }
            });

            projectIds = [...new Set([...projectIds, ...resolvedProjectIds])];

            if (notFoundRolls.length > 0 || noProjectRolls.length > 0) {
                // We can choose to return warnings or fail. Let's return warnings in the response if possible,
                // but since this is a void/status response, maybe we just log it or fail if CRITICAL.
                // For now, let's proceed with valid ones but maybe log/warn.
                // Or better, if NO projects are resolved and projectIds is empty, error out.
                console.warn(`Bulk Assign: Some roll numbers skipped. Not Found: ${notFoundRolls.length}, No Project: ${noProjectRolls.length}`);
            }
        }

        let assignmentPairs = [];

        if (useVenueFaculty === true || useVenueFaculty === 'true') {
            if (!scopeId) {
                return res.status(400).json({ error: "Scope ID is required for venue-based assignment" });
            }

            // For each project, find the faculty assigned to the team's lab sessions
            for (const projectId of projectIds) {
                const team = await prisma.team.findFirst({
                    where: {
                        OR: [
                            { projectId: projectId },
                            { projectRequests: { some: { projectId: projectId, status: 'PENDING' } } }
                        ]
                    },
                    include: { members: true }
                });

                if (team) {
                    const memberIds = team.members.map(m => m.userId);
                    // Find session in this scope that includes any of these members
                    const session = await prisma.labsession.findFirst({
                        where: {
                            scopeId: scopeId,
                            user_sessionstudents: { some: { id: { in: memberIds } } }
                        },
                        select: { facultyId: true }
                    });

                    if (session) {
                        assignmentPairs.push({ projectId, facultyId: session.facultyId });
                    }
                }
            }

            if (assignmentPairs.length === 0) {
                return res.status(400).json({
                    error: "No matching lab sessions found for the selected teams in this batch. Please assign faculty manually."
                });
            }
        } else {
            // Find all faculty users and verify they are actually faculty
            const facultyUsers = await prisma.user.findMany({
                where: {
                    id: { in: facultyIds },
                    role: 'FACULTY'
                }
            });

            if (facultyUsers.length !== facultyIds.length) {
                return res.status(400).json({
                    error: "Invalid faculty members",
                    details: "One or more faculty IDs are either invalid, duplicates, or not assigned the FACULTY role."
                });
            }

            if (distributeEvenly) {
                // Round-robin distribution
                assignmentPairs = projectIds.map((projectId, index) => ({
                    projectId,
                    facultyId: facultyIds[index % facultyIds.length]
                }));
            } else {
                // Many-to-many distribution
                assignmentPairs = projectIds.flatMap(projectId =>
                    facultyIds.map(facultyId => ({
                        projectId,
                        facultyId
                    }))
                );
            }
        }

        // Final deduplication of assignment pairs to prevent transaction conflicts
        const uniqueAssignments = [];
        const seenPairs = new Set();
        for (const pair of assignmentPairs) {
            const key = `${pair.projectId}-${pair.facultyId}`;
            if (!seenPairs.has(key)) {
                uniqueAssignments.push(pair);
                seenPairs.add(key);
            }
        }
        assignmentPairs = uniqueAssignments;

        let accessExpiresAt = null;
        const startTime = accessStartsAt ? new Date(accessStartsAt) : new Date();

        if (accessDurationHours && accessDurationHours > 0) {
            accessExpiresAt = new Date(startTime.getTime() + accessDurationHours * 60 * 60 * 1000);
        }

        // Use transaction to perform bulk upserts
        const results = await prisma.$transaction(
            assignmentPairs.map(({ projectId, facultyId }) =>
                prisma.reviewassignment.upsert({
                    where: {
                        projectId_facultyId_reviewPhase: {
                            projectId,
                            facultyId,
                            reviewPhase: parseInt(reviewPhase)
                        }
                    },
                    update: {
                        assignedBy: req.user.id,
                        accessStartsAt: accessStartsAt ? new Date(accessStartsAt) : null,
                        accessExpiresAt,
                        mode: mode.toUpperCase()
                    },
                    create: {
                        projectId,
                        facultyId,
                        reviewPhase: parseInt(reviewPhase),
                        assignedBy: req.user.id,
                        accessStartsAt: accessStartsAt ? new Date(accessStartsAt) : null,
                        accessExpiresAt,
                        mode: mode.toUpperCase()
                    }
                })
            )
        );

        res.json({
            success: true,
            count: results.length,
            message: `Successfully assigned ${facultyIds.length} faculty members to ${projectIds.length} projects.`
        });
    } catch (e) {
        next(e);
    }
});

// Admin: Remove Faculty Assignment
router.delete('/unassign-faculty/:assignmentId', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { assignmentId } = req.params;
    try {
        await prisma.reviewassignment.delete({
            where: { id: assignmentId }
        });
        res.json({ success: true, message: "Faculty unassigned successfully" });
    } catch (e) {
        next(e);
    }
});

// Admin: Bulk Remove Faculty Assignments
router.post('/bulk-unassign-faculty', authenticate, authorize(['ADMIN']), adminValidation.bulkUnassignFaculty, async (req, res, next) => {
    const { assignmentIds } = req.body;
    try {
        const result = await prisma.reviewassignment.deleteMany({
            where: {
                id: { in: assignmentIds }
            }
        });
        res.json({
            success: true,
            count: result.count,
            message: `Successfully removed ${result.count} faculty assignments.`
        });
    } catch (e) {
        next(e);
    }
});

// Get All Faculty Assignments (Admin only with pagination)
router.get('/faculty-assignments', authenticate, authorize(['ADMIN']), commonValidations.pagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        const { search, expired } = req.query;
        const now = new Date();

        const whereClause = {
            AND: [
                search ? {
                    OR: [
                        { faculty: { name: { contains: search } } },
                        { faculty: { rollNumber: { contains: search } } },
                        { project: { title: { contains: search } } },
                        { project: { teams: { some: { members: { some: { user: { name: { contains: search } } } } } } } },
                        { project: { teams: { some: { members: { some: { user: { rollNumber: { contains: search } } } } } } } }
                    ]
                } : {},
                expired === 'true' ? {
                    accessExpiresAt: { lt: now }
                } : {}
            ]
        };

        const [assignments, total] = await Promise.all([
            prisma.reviewassignment.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    faculty: true,
                    project: {
                        include: {
                            teams: {
                                include: {
                                    members: {
                                        where: { approved: true },
                                        include: { user: true }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { assignedAt: 'desc' }
            }),
            prisma.reviewassignment.count({ where: whereClause })
        ]);

        res.json({
            assignments,
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

// Admin: Select faculty assignments by student roll numbers (across ALL pages)
router.post('/faculty-assignments/select-by-roll', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { rollNumbers, expired } = req.body;

        if (!rollNumbers || !Array.isArray(rollNumbers) || rollNumbers.length === 0) {
            return res.status(400).json({ error: 'rollNumbers array is required' });
        }

        const normalizedRolls = rollNumbers.map(r => r.trim().toLowerCase()).filter(Boolean);
        if (normalizedRolls.length === 0) {
            return res.status(400).json({ error: 'No valid roll numbers provided' });
        }

        const now = new Date();

        // Include both original and uppercased versions for practical case-insensitive matching
        const allVariants = [...new Set([...normalizedRolls, ...normalizedRolls.map(r => r.toUpperCase())])];

        // Build where clause - optionally filter by expired status too
        const whereClause = {
            AND: [
                {
                    project: {
                        teams: {
                            some: {
                                members: {
                                    some: {
                                        approved: true,
                                        user: {
                                            rollNumber: { in: allVariants }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                expired === true ? { accessExpiresAt: { lt: now } } : {}
            ]
        };

        const matchingAssignments = await prisma.reviewassignment.findMany({
            where: whereClause,
            select: { id: true }
        });

        res.json({
            ids: matchingAssignments.map(a => a.id),
            count: matchingAssignments.length
        });
    } catch (e) {
        next(e);
    }
});

// Admin: Toggle Temporary Admin Access for Faculty (REAL ADMINS ONLY)
router.post('/toggle-temp-admin', authenticate, adminValidation.toggleTempAdmin, async (req, res, next) => {

    const { userId, grant, allowedTabs } = req.body;

    // Only real admins can grant/revoke temp admin access
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: "Only permanent admins can manage temporary admin access" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (user.role !== 'FACULTY') {
            return res.status(400).json({ error: "Only faculty can be granted temporary admin access" });
        }

        // Prepare update data
        const updateData = {
            isTemporaryAdmin: grant,
            // Store allowed tabs as JSON string
            // meaningful change: if allowedTabs is provided (even empty), store it. 
            // Only store null if it's strictly undefined or we want legacy behavior (which we don't for new toggles)
            tempAdminTabs: grant && Array.isArray(allowedTabs)
                ? JSON.stringify(allowedTabs)
                : null
        };

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        res.json({
            success: true,
            message: grant
                ? `Temporary admin access granted with ${allowedTabs?.length || 'all'} tab(s)`
                : "Temporary admin access revoked",
            user: {
                ...updatedUser,
                tempAdminTabs: updatedUser.tempAdminTabs ? JSON.parse(updatedUser.tempAdminTabs) : null
            }
        });
    } catch (e) {
        next(e);
    }
});

// Get current user's admin permissions (for temp admins)
router.get('/my-permissions', authenticate, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                role: true,
                isTemporaryAdmin: true,
                tempAdminTabs: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Real admins have full access
        if (user.role === 'ADMIN') {
            return res.json({
                isAdmin: true,
                isTemporaryAdmin: false,
                allowedTabs: null, // null means all tabs
                hasFullAccess: true
            });
        }

        // Temp admin faculty
        if (user.isTemporaryAdmin) {
            return res.json({
                isAdmin: false,
                isTemporaryAdmin: true,
                allowedTabs: user.tempAdminTabs ? JSON.parse(user.tempAdminTabs) : null,
                hasFullAccess: !user.tempAdminTabs // null tabs means full access
            });
        }

        // Regular user - no admin access
        res.json({
            isAdmin: false,
            isTemporaryAdmin: false,
            allowedTabs: [],
            hasFullAccess: false
        });
    } catch (e) {
        next(e);
    }
});

// Admin: Update Faculty Roles (isGuide, isSubjectExpert)
router.post('/update-faculty-roles', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { userId, isGuide, isSubjectExpert } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'FACULTY') {
            return res.status(404).json({ error: "Faculty not found" });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                isGuide: isGuide !== undefined ? isGuide : user.isGuide,
                isSubjectExpert: isSubjectExpert !== undefined ? isSubjectExpert : user.isSubjectExpert
            }
        });

        res.json({ success: true, user: updatedUser });
    } catch (e) {
        next(e);
    }
});

// Admin: Create Team Manually
router.post('/create-team', authenticate, authorize(['ADMIN']), adminValidation.createTeam, async (req, res, next) => {
    const { memberEmail, scopeId } = req.body;
    try {
        const member = await prisma.user.findUnique({ where: { email: memberEmail } });
        if (!member) {
            return res.status(404).json({ error: "Student not found" });
        }
        if (member.role !== 'STUDENT') {
            return res.status(400).json({ error: "Only students can be in teams" });
        }

        const existingMembership = await prisma.teammember.findFirst({
            where: {
                userId: member.id,
                team: { scopeId: scopeId || null }
            }
        });
        if (existingMembership) {
            return res.status(400).json({ error: "Student is already in a team for this project batch" });
        }

        const team = await prisma.team.create({
            data: {
                scopeId,
                members: { create: { userId: member.id, approved: true, isLeader: true } }
            },
            include: { members: { include: { user: true } } }
        });

        res.json({ success: true, team });
    } catch (e) {
        next(e);
    }
});

// Admin: Add Member to Team
router.post('/add-member', authenticate, authorize(['ADMIN']), adminValidation.addMember, async (req, res, next) => {
    const { teamId, memberEmail } = req.body;
    try {
        const student = await prisma.user.findUnique({ where: { email: memberEmail } });
        if (!student) {
            return res.status(404).json({ error: "Student not found" });
        }
        if (student.role !== 'STUDENT') {
            return res.status(400).json({ error: "Only students can be team members" });
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                members: { include: { user: true } },
                project: true
            }
        });

        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        const existingMembership = await prisma.teammember.findFirst({
            where: {
                userId: student.id,
                team: { scopeId: team.scopeId }
            }
        });
        if (existingMembership) {
            return res.status(400).json({ error: "Student is already in a team for this project batch" });
        }

        // Enforce Same-Year Restraint for Admin Additions
        if (team.members.length > 0) {
            const firstMember = team.members[0].user;
            if (firstMember.year && student.year && firstMember.year !== student.year) {
                return res.status(400).json({
                    error: `Year Mismatch: Team is Year ${firstMember.year}, but student is Year ${student.year}.`
                });
            }
        }

        if (team.project && team.members.length >= team.project.maxTeamSize) {
            return res.status(400).json({ error: `Team is full. Max size: ${team.project.maxTeamSize}` });
        }

        await prisma.teammember.create({
            data: { teamId, userId: student.id, approved: true }
        });

        const allMembers = await prisma.teammember.findMany({ where: { teamId } });
        if (allMembers.every(m => m.approved) && team.status === 'PENDING') {
            await prisma.team.update({ where: { id: teamId }, data: { status: 'APPROVED' } });
        }

        res.json({ success: true, message: "Member added to team" });
    } catch (e) {
        next(e);
    }
});

// Admin: Assign Project to Team
router.post('/assign-project', authenticate, authorize(['ADMIN']), adminValidation.assignProject, async (req, res, next) => {
    const { teamId, projectId } = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            const project = await tx.project.findUnique({ where: { id: projectId } });
            if (!project) {
                throw new Error("Project not found");
            }
            if (project.status !== 'AVAILABLE') {
                throw new Error("Project is already assigned");
            }

            const team = await tx.team.findUnique({
                where: { id: teamId },
                include: { members: true }
            });
            if (!team) {
                throw new Error("Team not found");
            }
            if (team.projectId) {
                throw new Error("Team already has a project assigned");
            }
            if (team.members.length > project.maxTeamSize) {
                throw new Error(`Team size (${team.members.length}) exceeds project limit (${project.maxTeamSize})`);
            }

            // Verify all members are available for this new scope
            for (const m of team.members) {
                const otherTeam = await tx.teammember.findFirst({
                    where: {
                        userId: m.userId,
                        team: {
                            id: { not: teamId },
                            scopeId: project.scopeId
                        }
                    }
                });
                if (otherTeam) {
                    throw new Error(`Member "${m.userId}" is already in another team for this project batch (${project.scopeId})`);
                }
            }

            await tx.project.update({
                where: { id: projectId },
                data: { status: 'ASSIGNED' }
            });
            await tx.team.update({
                where: { id: teamId },
                data: { projectId, scopeId: project.scopeId, status: 'NOT_COMPLETED' }
            });
        });

        res.json({ success: true, message: "Project assigned to team" });
    } catch (error) {
        next(error);
    }
});

// Admin: Remove Member from Team
router.post('/remove-member', authenticate, authorize(['ADMIN']), adminValidation.removeMember, async (req, res, next) => {
    const { teamId, userId } = req.body;
    try {
        const result = await prisma.$transaction(async (tx) => {
            // Get the member being removed
            const memberToRemove = await tx.teammember.findFirst({
                where: { userId, teamId },
                include: { team: true }
            });

            if (!memberToRemove || memberToRemove.teamId !== teamId) {
                throw new Error("Student not found in this team");
            }

            // Remove the member
            await tx.teammember.delete({ where: { id: memberToRemove.id } });

            // Check remaining members
            const remainingMembers = await tx.teammember.findMany({
                where: { teamId }
            });

            if (remainingMembers.length === 0) {
                // Delete team if empty
                const team = await tx.team.findUnique({ where: { id: teamId } });
                if (team.projectId) {
                    await tx.project.update({
                        where: { id: team.projectId },
                        data: { status: 'AVAILABLE' }
                    });
                }
                await tx.team.delete({ where: { id: teamId } });
                return { message: "Team deleted (no members left)" };
            } else if (memberToRemove.isLeader) {
                // If leader removed, promote the next member
                await tx.teammember.update({
                    where: { id: remainingMembers[0].id },
                    data: { isLeader: true }
                });
                return { message: "Member removed, new leader assigned" };
            }

            return { message: "Member removed successfully" };
        });

        res.json({ success: true, ...result });
    } catch (e) {
        next(e);
    }
});

// Admin: Change Team Leader
router.post('/change-leader', authenticate, authorize(['ADMIN']), adminValidation.changeLeader, async (req, res, next) => {
    const { teamId, newLeaderId } = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            // Verify new leader is in the team
            const member = await tx.teammember.findFirst({
                where: { teamId, userId: newLeaderId }
            });

            if (!member) {
                throw new Error("New leader must be a member of the team");
            }

            // Demote current leader
            await tx.teammember.updateMany({
                where: { teamId, isLeader: true },
                data: { isLeader: false }
            });

            // Promote new leader
            await tx.teammember.update({
                where: { id: member.id },
                data: { isLeader: true }
            });
        });

        res.json({ success: true, message: "Team leader updated" });
    } catch (e) {
        next(e);
    }
});

// Admin: Unassign Project from Team
router.post('/unassign-project', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { teamId } = req.body;
    try {
        await prisma.$transaction(async (tx) => {
            const team = await tx.team.findUnique({
                where: { id: teamId },
                include: { project: true }
            });

            if (!team) {
                throw new Error("Team not found");
            }

            if (team.projectId) {
                // Free the project
                await tx.project.update({
                    where: { id: team.projectId },
                    data: { status: 'AVAILABLE' }
                });
            }

            // Clear project from team and reset status
            await tx.team.update({
                where: { id: teamId },
                data: {
                    projectId: null,
                    status: 'APPROVED' // Reset to approved (members exist but no project)
                }
            });
        });

        res.json({ success: true, message: "Project unassigned successfully" });
    } catch (e) {
        next(e);
    }
});

// Admin: Assign Faculty Guide/Expert to Team
router.post('/assign-team-faculty', authenticate, authorize(['ADMIN']), adminValidation.assignTeamFaculty, async (req, res, next) => {
    const { teamId, facultyId, role } = req.body;
    try {
        const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
        if (!faculty || faculty.role !== 'FACULTY') {
            return res.status(400).json({ error: "Invalid faculty member" });
        }

        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        const updateData = {};
        if (role === 'GUIDE') {
            updateData.guideId = facultyId;
            updateData.guideStatus = 'APPROVED'; // Admin assignment automatically approves
        } else if (role === 'EXPERT') {
            updateData.subjectExpertId = facultyId;
            updateData.expertStatus = 'APPROVED'; // Admin assignment automatically approves
        }

        // Also check if we need to remove the faculty from other roles in this team?
        // E.g. can't be both guide and expert?
        if (role === 'GUIDE' && team.subjectExpertId === facultyId) {
            return res.status(400).json({ error: "Faculty cannot be both Guide and Subject Expert for the same team." });
        }
        if (role === 'EXPERT' && team.guideId === facultyId) {
            return res.status(400).json({ error: "Faculty cannot be both Subject Expert and Guide for the same team." });
        }

        // Check batch-wise limit (Max 4 teams per batch as Guide OR Expert)
        const teamCountInBatch = await prisma.team.count({
            where: {
                scopeId: team.scopeId,
                NOT: { id: teamId },
                OR: [
                    { guideId: facultyId, guideStatus: { in: ['APPROVED', 'PENDING'] } },
                    { subjectExpertId: facultyId, expertStatus: { in: ['APPROVED', 'PENDING'] } }
                ]
            }
        });

        if (teamCountInBatch >= 4) {
            return res.status(400).json({ error: `Faculty has reached the maximum limit of 4 teams for this batch.` });
        }

        await prisma.team.update({
            where: { id: teamId },
            data: updateData
        });

        res.json({ success: true, message: `${role === 'GUIDE' ? 'Guide' : 'Subject Expert'} assigned and approved successfully` });
    } catch (e) {
        next(e);
    }
});

// Admin: Unassign Faculty from Team
router.post('/unassign-team-faculty', authenticate, authorize(['ADMIN']), adminValidation.unassignTeamFaculty, async (req, res, next) => {
    const { teamId, role } = req.body;
    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        const updateData = {};
        if (role === 'GUIDE') {
            updateData.guideId = null;
            updateData.guideStatus = 'PENDING'; // Reset status to PENDING (waiting for new assignment)
        } else if (role === 'EXPERT') {
            updateData.subjectExpertId = null;
            updateData.expertStatus = 'PENDING'; // Reset status
        }

        await prisma.team.update({
            where: { id: teamId },
            data: updateData
        });

        res.json({ success: true, message: `${role === 'GUIDE' ? 'Guide' : 'Subject Expert'} unassigned successfully` });
    } catch (e) {
        next(e);
    }
});

// Admin: Update Faculty Access Duration
router.post('/update-faculty-access', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { assignmentId, accessDurationHours, accessStartsAt } = req.body;
    try {
        const assignment = await prisma.reviewassignment.findUnique({
            where: { id: assignmentId }
        });

        if (!assignment) {
            return res.status(404).json({ error: "Assignment not found" });
        }

        // Calculate new expiration time
        let accessExpiresAt = null;
        const startTime = accessStartsAt ? new Date(accessStartsAt) : (assignment.accessStartsAt || new Date());

        if (accessDurationHours && accessDurationHours > 0) {
            accessExpiresAt = new Date(startTime.getTime() + accessDurationHours * 60 * 60 * 1000);
        }

        const updatedAssignment = await prisma.reviewassignment.update({
            where: { id: assignmentId },
            data: {
                accessStartsAt: accessStartsAt ? new Date(accessStartsAt) : assignment.accessStartsAt,
                accessExpiresAt
            },
            include: {
                faculty: true,
                project: true
            }
        });

        res.json({ success: true, assignment: updatedAssignment });
    } catch (e) {
        next(e);
    }
});

// Admin: Bulk Update Faculty Access Duration
router.post('/bulk-update-faculty-access', authenticate, authorize(['ADMIN']), adminValidation.bulkUpdateFacultyAccess, async (req, res, next) => {
    const { assignmentIds, accessDurationHours, accessStartsAt } = req.body;
    try {
        let accessExpiresAt = null;
        const startTime = accessStartsAt ? new Date(accessStartsAt) : new Date();

        if (accessDurationHours && accessDurationHours > 0) {
            accessExpiresAt = new Date(startTime.getTime() + accessDurationHours * 60 * 60 * 1000);
        }

        const data = { accessExpiresAt };
        if (accessStartsAt) {
            data.accessStartsAt = new Date(accessStartsAt);
        }

        const result = await prisma.reviewassignment.updateMany({
            where: {
                id: { in: assignmentIds }
            },
            data
        });

        res.json({
            success: true,
            count: result.count,
            message: `Successfully updated access duration for ${result.count} faculty assignments.`
        });
    } catch (e) {
        next(e);
    }
});

// Admin: Direct Solo Project Assignment (One-step for Size 1 projects)
router.post('/assign-solo-project', authenticate, authorize(['ADMIN']), adminValidation.assignSoloProject, async (req, res, next) => {
    const { studentId, projectId } = req.body;
    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Validate Project
            const project = await tx.project.findUnique({ where: { id: projectId } });
            if (!project) throw new Error("Project not found");
            if (project.status !== 'AVAILABLE') throw new Error("Project is not available");
            if (project.maxTeamSize !== 1) throw new Error("This method is only for solo projects (Size 1)");

            // 2. Validate Student
            const student = await tx.user.findUnique({ where: { id: studentId } });
            if (!student || student.role !== 'STUDENT') throw new Error("Invalid student");

            const existingMembership = await tx.teammember.findFirst({
                where: {
                    userId: studentId,
                    team: { scopeId: project.scopeId }
                }
            });
            if (existingMembership) throw new Error(`Student is already in a team for the batch: ${project.scopeId || 'Default'}`);

            // 3. Create Solo Team
            const team = await tx.team.create({
                data: {
                    projectId: projectId,
                    scopeId: project.scopeId,
                    status: 'NOT_COMPLETED',
                    members: {
                        create: {
                            userId: studentId,
                            approved: true,
                            isLeader: true
                        }
                    }
                }
            });

            // 4. Mark Project as Assigned
            await tx.project.update({
                where: { id: projectId },
                data: { status: 'ASSIGNED' }
            });

            return team;
        });

        res.json({ success: true, team: result });
    } catch (e) {
        next(e);
    }
});

// GET PROJECT REQUESTS (Admin)
router.get('/project-requests', authenticate, authorize(['ADMIN']), commonValidations.pagination, async (req, res, next) => {
    try {
        const { status, scopeId, search, category, department } = req.query;
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        const where = {};
        const conditions = [];

        if (status && status !== 'ALL') {
            conditions.push({ status });
        }
        if (scopeId && scopeId !== 'ALL') {
            conditions.push({ project: { scopeId } });
        }
        if (category) {
            conditions.push({ project: { category: { equals: category } } });
        }
        if (department) {
            conditions.push({
                team: {
                    members: {
                        some: {
                            user: { department: { equals: department } }
                        }
                    }
                }
            });
        }
        if (search) {
            conditions.push({
                OR: [
                    { project: { title: { contains: search } } },
                    { team: { members: { some: { user: { name: { contains: search } } } } } },
                    { team: { members: { some: { user: { rollNumber: { contains: search } } } } } }
                ]
            });
        }

        if (conditions.length > 0) {
            where.AND = conditions;
        }

        // Base where for counts (everything except status)
        const countsWhere = { AND: conditions.filter(c => !c.status) };

        const [requests, total, statusCounts] = await Promise.all([
            prisma.projectrequest.findMany({
                where,
                skip,
                take: limit,
                include: {
                    team: {
                        include: {
                            members: {
                                where: { approved: true },
                                include: { user: true }
                            }
                        }
                    },
                    project: {
                        include: {
                            scope: true
                        }
                    }
                },
                orderBy: { requestedAt: 'desc' }
            }),
            prisma.projectrequest.count({ where }),
            prisma.projectrequest.groupBy({
                by: ['status'],
                where: countsWhere,
                _count: { _all: true }
            })
        ]);

        const counts = {
            PENDING: statusCounts.find(c => c.status === 'PENDING')?._count._all || 0,
            APPROVED: statusCounts.find(c => c.status === 'APPROVED')?._count._all || 0,
            REJECTED: statusCounts.find(c => c.status === 'REJECTED')?._count._all || 0,
            ALL: statusCounts.reduce((acc, c) => acc + c._count._all, 0)
        };

        res.json({
            requests,
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

// APPROVE PROJECT REQUEST (Admin)
router.post('/approve-project-request', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { requestId } = req.body;

        const request = await prisma.projectrequest.findUnique({
            where: { id: requestId },
            include: {
                project: true,
                team: {
                    include: {
                        members: { where: { approved: true } }
                    }
                }
            }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request has already been processed' });
        }

        // Check if project is still available or requested by this team
        if (request.project.status !== 'AVAILABLE' && request.project.status !== 'REQUESTED') {
            return res.status(400).json({ error: 'Project is no longer available' });
        }

        // Check team size
        if (request.team.members.length > request.project.maxTeamSize) {
            return res.status(400).json({ error: 'Team size exceeds project maximum' });
        }

        // Approve and assign project in transaction
        await prisma.$transaction(async (tx) => {
            // Update request status
            await tx.projectrequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    reviewedBy: req.user.id,
                    reviewedAt: new Date()
                }
            });

            // Assign project to team
            await tx.project.update({
                where: { id: request.projectId },
                data: { status: 'ASSIGNED' }
            });

            await tx.team.update({
                where: { id: request.teamId },
                data: {
                    projectId: request.projectId,
                    status: 'NOT_COMPLETED'
                }
            });

            // Reject any other pending requests for this project
            await tx.projectrequest.updateMany({
                where: {
                    projectId: request.projectId,
                    status: 'PENDING',
                    id: { not: requestId }
                },
                data: {
                    status: 'REJECTED',
                    reviewedBy: req.user.id,
                    reviewedAt: new Date(),
                    rejectionReason: 'Project was assigned to another team'
                }
            });
        });

        res.json({ success: true, message: 'Project request approved and assigned' });
    } catch (e) {
        next(e);
    }
});

// REJECT PROJECT REQUEST (Admin)
router.post('/reject-project-request', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { requestId, rejectionReason } = req.body;

        const request = await prisma.projectrequest.findUnique({
            where: { id: requestId }
        });

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request has already been processed' });
        }

        await prisma.$transaction([
            prisma.projectrequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    reviewedBy: req.user.id,
                    reviewedAt: new Date(),
                    rejectionReason: rejectionReason || 'No reason provided'
                }
            }),
            prisma.project.update({
                where: { id: request.projectId },
                data: { status: 'AVAILABLE' }
            })
        ]);

        res.json({ success: true, message: 'Project request rejected' });
    } catch (e) {
        next(e);
    }
});

// BULK APPROVE PROJECT REQUESTS (Admin)
router.post('/bulk-approve-project-requests', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { requestIds } = req.body;
        if (!Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({ error: 'No request IDs provided' });
        }

        const BATCH_SIZE = 50;
        const processed = [];
        const errors = [];

        for (let i = 0; i < requestIds.length; i += BATCH_SIZE) {
            const batch = requestIds.slice(i, i + BATCH_SIZE);

            // Process each batch in a separate transaction
            await prisma.$transaction(async (tx) => {
                for (const requestId of batch) {
                    try {
                        const request = await tx.projectrequest.findUnique({
                            where: { id: requestId },
                            include: {
                                project: true,
                                team: {
                                    include: {
                                        members: { where: { approved: true } }
                                    }
                                }
                            }
                        });

                        // Check if project is still available or requested by this team
                        if (request && request.status === 'PENDING' && (request.project.status === 'AVAILABLE' || request.project.status === 'REQUESTED')) {
                            // Update request status
                            await tx.projectrequest.update({
                                where: { id: requestId },
                                data: {
                                    status: 'APPROVED',
                                    reviewedBy: req.user.id,
                                    reviewedAt: new Date()
                                }
                            });

                            // Assign project to team
                            await tx.project.update({
                                where: { id: request.projectId },
                                data: { status: 'ASSIGNED' }
                            });

                            await tx.team.update({
                                where: { id: request.teamId },
                                data: {
                                    projectId: request.projectId,
                                    status: 'NOT_COMPLETED'
                                }
                            });

                            // Reject any other pending requests for this project
                            await tx.projectrequest.updateMany({
                                where: {
                                    projectId: request.projectId,
                                    status: 'PENDING',
                                    id: { not: requestId }
                                },
                                data: {
                                    status: 'REJECTED',
                                    reviewedBy: req.user.id,
                                    reviewedAt: new Date(),
                                    rejectionReason: 'Project was assigned to another team'
                                }
                            });
                            processed.push(requestId);
                        }
                    } catch (err) {
                        console.error(`Error processing request ${requestId}:`, err);
                        errors.push({ requestId, error: err.message });
                    }
                }
            }, {
                timeout: 30000 // Increase timeout for the batch transaction
            });
        }

        res.json({
            success: true,
            message: `Processed ${requestIds.length} requests. Successfully approved ${processed.length}.`,
            approvedCount: processed.length,
            errorCount: errors.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (e) {
        next(e);
    }
});

// BULK REJECT PROJECT REQUESTS (Admin)
router.post('/bulk-reject-project-requests', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { requestIds, rejectionReason } = req.body;
        if (!Array.isArray(requestIds) || requestIds.length === 0) {
            return res.status(400).json({ error: 'No request IDs provided' });
        }

        const BATCH_SIZE = 100;
        const results = [];

        for (let i = 0; i < requestIds.length; i += BATCH_SIZE) {
            const batch = requestIds.slice(i, i + BATCH_SIZE);
            const batchResults = await prisma.$transaction(async (tx) => {
                const processed = [];
                for (const requestId of batch) {
                    const request = await tx.projectrequest.findUnique({
                        where: { id: requestId }
                    });

                    if (request && request.status === 'PENDING') {
                        await tx.projectrequest.update({
                            where: { id: requestId },
                            data: {
                                status: 'REJECTED',
                                reviewedBy: req.user.id,
                                reviewedAt: new Date(),
                                rejectionReason: rejectionReason || 'Bulk rejection by Admin'
                            }
                        });

                        await tx.project.update({
                            where: { id: request.projectId },
                            data: { status: 'AVAILABLE' }
                        });
                        processed.push(requestId);
                    }
                }
                return processed;
            });
            results.push(...batchResults);
        }

        res.json({ success: true, message: `Successfully rejected ${results.length} requests`, rejectedCount: results.length });
    } catch (e) {
        next(e);
    }
});

// GET Detailed Faculty Stats
router.get('/faculty-stats', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { search } = req.query;
        const where = { role: 'FACULTY' };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { rollNumber: { contains: search } }
            ];
        }

        const facultyMembers = await prisma.user.findMany({
            where,
            include: {
                guidedTeams: {
                    where: { guideStatus: 'APPROVED' },
                    include: {
                        project: true,
                        members: { include: { user: true } }
                    }
                },
                expertTeams: {
                    where: { expertStatus: 'APPROVED' },
                    include: {
                        project: true,
                        members: { include: { user: true } }
                    }
                },
                reviews: { // Reviews created by this faculty
                    include: {
                        team: {
                            include: {
                                project: true,
                                members: {
                                    include: { user: true },
                                    where: { approved: true }
                                }
                            }
                        },
                        reviewMarks: true
                    },
                    orderBy: { createdAt: 'desc' }
                },
                assignedReviews: { // Projects assigned to review
                    include: {
                        project: true
                    }
                }
            }
        });

        // Transform for frontend
        const stats = facultyMembers.map(f => {
            const students = [];
            f.guidedTeams.forEach(t => {
                t.members.forEach(m => {
                    if (m.approved) students.push({ ...m.user, role: 'GUIDE', project: t.project?.title });
                });
            });
            f.expertTeams.forEach(t => {
                t.members.forEach(m => {
                    if (m.approved) students.push({ ...m.user, role: 'EXPERT', project: t.project?.title });
                });
            });

            // Calculate average marks given
            let totalMarksGiven = 0;
            let totalMarksPossible = 0;
            let reviewsWithMarks = 0;

            f.reviews.forEach(r => {
                if (r.reviewMarks && r.reviewMarks.length > 0) {
                    reviewsWithMarks++;
                    r.reviewMarks.forEach(m => {
                        totalMarksGiven += m.marks;
                        // Attempt to parse criterion marks to find total scale
                        let scale = 100;
                        if (m.criterionMarks) {
                            try {
                                const cm = typeof m.criterionMarks === 'string' ? JSON.parse(m.criterionMarks) : m.criterionMarks;
                                if (cm._total) scale = cm._total;
                            } catch (e) { }
                        }
                        totalMarksPossible += scale;
                    });
                }
            });

            const avgMarksPercentage = totalMarksPossible > 0
                ? ((totalMarksGiven / totalMarksPossible) * 100).toFixed(1)
                : 0;

            return {
                id: f.id,
                name: f.name,
                email: f.email,
                rollNumber: f.rollNumber,
                department: f.department,
                isGuide: f.isGuide,
                isSubjectExpert: f.isSubjectExpert,
                teamsCount: f.guidedTeams.length + f.expertTeams.length,
                studentsCount: students.length,
                studentsDetails: students,
                reviewsCount: f.reviews.length,
                allReviews: f.reviews, // Full history
                averageMarksPercentage: avgMarksPercentage,
                assignmentsCount: f.assignedReviews.length,
                quotaStatus: (f.guidedTeams.length + f.expertTeams.length) + '/4',
                role: 'FACULTY',
                isTemporaryAdmin: f.isTemporaryAdmin,
                tempAdminTabs: f.tempAdminTabs
            };
        });

        res.json(stats);
    } catch (e) {
        next(e);
    }
});





// Auto-assign Guide Reviews for a whole batch
router.post('/auto-assign-guide-reviews', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { scopeId, reviewPhase, durationHours, accessStartsAt } = req.body;
    try {
        if (!scopeId || !reviewPhase) {
            return res.status(400).json({ error: "scopeId and reviewPhase are required" });
        }

        // 1. Find all teams in the scope that have a guide assigned
        const teams = await prisma.team.findMany({
            where: {
                project: { scopeId: scopeId },
                guideId: { not: null }
            },
            select: {
                projectId: true, // Need Project ID for ReviewAssignment
                guideId: true,
                project: { select: { title: true } }
            }
        });

        if (teams.length === 0) {
            return res.status(404).json({ error: "No teams with assigned guides found in this scope." });
        }

        // 2. Prepare assignments
        const assignments = teams.map(t => ({
            projectId: t.projectId,
            facultyId: t.guideId,
            reviewPhase: parseInt(reviewPhase)
        }));

        let accessExpiresAt = null;
        const startTime = accessStartsAt ? new Date(accessStartsAt) : new Date();

        if (durationHours && durationHours > 0) {
            accessExpiresAt = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
        }

        // 3. Upsert assignments
        const results = await prisma.$transaction(
            assignments.map(({ projectId, facultyId, reviewPhase }) =>
                prisma.reviewassignment.upsert({
                    where: {
                        projectId_facultyId_reviewPhase: {
                            projectId,
                            facultyId,
                            reviewPhase
                        }
                    },
                    update: {
                        assignedBy: req.user.id,
                        accessStartsAt: accessStartsAt ? new Date(accessStartsAt) : null,
                        accessExpiresAt,
                        assignedAt: new Date()
                    },
                    create: {
                        projectId,
                        facultyId,
                        reviewPhase,
                        assignedBy: req.user.id,
                        accessStartsAt: accessStartsAt ? new Date(accessStartsAt) : null,
                        accessExpiresAt,
                        assignedAt: new Date()
                    }
                })
            )
        );

        res.json({
            success: true,
            count: results.length,
            message: `Successfully released reviews for ${results.length} guides in this batch.`
        });

    } catch (e) {
        next(e);
    }
});

// GET Student Project Request Status Categorization
router.get('/student-project-status', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { scopeId } = req.query;
        const where = { role: 'STUDENT' };

        // Fetch all students with their team memberships and requests
        const students = await prisma.user.findMany({
            where,
            include: {
                teamMemberships: {
                    include: {
                        team: {
                            include: {
                                project: true,
                                projectRequests: {
                                    include: {
                                        project: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Filter by scope if provided
        let filteredStudents = students;
        if (scopeId && scopeId !== 'ALL') {
            filteredStudents = students.filter(student => {
                // Check if student is assigned to this scope (direct link)
                if (student.scopes?.some(s => s.id === scopeId)) return true;

                // Check if student's team is in this scope
                const teamMembership = student.teamMemberships[0];
                if (teamMembership?.team?.scopeId === scopeId) return true;
                if (teamMembership?.team?.project?.scopeId === scopeId) return true;

                return false;
            });
        }

        const categorized = {
            accepted: [],
            requested: [],
            notRequested: []
        };

        filteredStudents.forEach(student => {
            const teamMembership = student.teamMemberships[0];
            const team = teamMembership?.team;

            const studentData = {
                id: student.id,
                name: student.name,
                email: student.email,
                rollNumber: student.rollNumber,
                department: student.department,
                year: student.year,
                teamId: team?.id || null,
                projectTitle: team?.project?.title || null
            };

            if (team?.projectId) {
                categorized.accepted.push(studentData);
            } else if (team?.projectRequests?.some(r => r.status === 'PENDING')) {
                const pendingRequest = team.projectRequests.find(r => r.status === 'PENDING');
                categorized.requested.push({
                    ...studentData,
                    requestedProject: pendingRequest.project?.title || 'Unknown'
                });
            } else {
                categorized.notRequested.push(studentData);
            }
        });

        res.json(categorized);
    } catch (e) {
        next(e);
    }
});

// DATABASE BACKUP DOWNLOAD
router.get('/backup/download', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        // Strict identity check for Super Admin
        if (req.user.name !== 'Super Admin' || req.user.email !== 'nithiyan.al23@bitsathy.ac.in') {
            return res.status(403).json({ error: "Access denied. Only the Super Admin can perform database backups." });
        }

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            return res.status(500).json({ error: "DATABASE_URL not configured" });
        }

        // Parse connection string: mysql://user:pass@host:port/db
        const url = new URL(dbUrl);
        const username = url.username || 'root';
        const password = url.password || '';
        const host = url.hostname || 'localhost';
        const port = url.port || '3306';
        const database = url.pathname.replace('/', '');

        if (!database) {
            return res.status(500).json({ error: "Database name not found in URL" });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${database}-${timestamp}.sql`;

        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const mysqldump = spawn('mysqldump', [
            `--user=${username}`,
            `--password=${password}`,
            `--host=${host}`,
            `--port=${port}`,
            '--column-statistics=0', // Handle older MySQL/MariaDB version differences if needed
            '--single-transaction',
            '--routines',
            '--triggers',
            database
        ]);

        mysqldump.stdout.pipe(res);

        mysqldump.stderr.on('data', (data) => {
            console.error(`mysqldump stderr: ${data}`);
        });

        mysqldump.on('close', (code) => {
            if (code !== 0) {
                console.error(`mysqldump exited with code ${code}`);
                // If we haven't sent the headers yet (unlikely since we piped), we could send an error
                // but since we piped, the response is already 200 and streaming.
            }
        });

        req.on('close', () => {
            mysqldump.kill();
        });

    } catch (e) {
        next(e);
    }
});

module.exports = router;
