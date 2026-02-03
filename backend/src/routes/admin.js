const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { adminValidation, commonValidations } = require('../middleware/validation');
const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');

const router = express.Router();

// GET ALL TEAMS (For Admin View with pagination)
router.get('/teams', authenticate, authorize(['ADMIN']), commonValidations.pagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        const [teams, total] = await Promise.all([
            prisma.team.findMany({
                skip,
                take: limit,
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
            prisma.team.count()
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
    const { projectIds, facultyIds, accessDurationHours, reviewPhase = 1, distributeEvenly = false, mode = 'OFFLINE', accessStartsAt } = req.body;

    try {
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
                details: "One or more faculty IDs are either invalid or not assigned the FACULTY role."
            });
        }

        let accessExpiresAt = null;
        const startTime = accessStartsAt ? new Date(accessStartsAt) : new Date();

        if (accessDurationHours && accessDurationHours > 0) {
            accessExpiresAt = new Date(startTime.getTime() + accessDurationHours * 60 * 60 * 1000);
        }

        // Determine assignment pairs based on distribution mode
        let assignmentPairs = [];
        if (distributeEvenly) {
            // Round-robin distribution: each project gets exactly one faculty member from the pool
            assignmentPairs = projectIds.map((projectId, index) => ({
                projectId,
                facultyId: facultyIds[index % facultyIds.length]
            }));
        } else {
            // Many-to-many distribution: every project gets every faculty member
            assignmentPairs = projectIds.flatMap(projectId =>
                facultyIds.map(facultyId => ({
                    projectId,
                    facultyId
                }))
            );
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

        const [assignments, total] = await Promise.all([
            prisma.reviewassignment.findMany({
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
            prisma.reviewassignment.count()
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
            // Store allowed tabs as JSON string, or null if revoking
            tempAdminTabs: grant && allowedTabs && allowedTabs.length > 0
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
        const { status, scopeId } = req.query;
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        const where = {};
        if (status && status !== 'ALL') {
            where.status = status;
        }
        if (scopeId && scopeId !== 'ALL') {
            where.project = { scopeId };
        }

        const [requests, total] = await Promise.all([
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
            prisma.projectrequest.count({ where })
        ]);

        res.json({
            requests,
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

        const results = await prisma.$transaction(async (tx) => {
            const processed = [];
            for (const requestId of requestIds) {
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

        res.json({ success: true, message: `Successfully rejected ${results.length} requests`, rejectedCount: results.length });
    } catch (e) {
        next(e);
    }
});

// GET Detailed Faculty Stats
router.get('/faculty-stats', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const facultyMembers = await prisma.user.findMany({
            where: { role: 'FACULTY' },
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
                        team: { include: { project: true } },
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
                latestReviews: f.reviews.slice(0, 5), // Top 5 recent
                assignmentsCount: f.assignedReviews.length,
                quotaStatus: (f.guidedTeams.length + f.expertTeams.length) + '/4',
                role: 'FACULTY',
                isTemporaryAdmin: f.isTemporaryAdmin
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

module.exports = router;
