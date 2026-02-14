const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { teamValidation } = require('../middleware/validation');

const router = express.Router();

// Create Team (Student) - First member who creates it
router.post('/', authenticate, authorize(['STUDENT']), async (req, res, next) => {
    const userId = req.user.id;
    const { scopeId } = req.body;
    try {
        // Optional: Check if student is already in a team for this scope
        if (scopeId) {
            const existing = await prisma.teammember.findFirst({
                where: { userId, team: { scopeId } }
            });
            if (existing) return res.status(400).json({ error: "You are already in a team for this batch." });
        }

        const team = await prisma.team.create({
            data: {
                scopeId,
                members: { create: { userId, approved: true, isLeader: true } }
            }
        });
        res.json(team);
    } catch (e) {
        next(e);
    }
});

// Invite Member - Any team member can invite
router.post('/invite', authenticate, authorize(['STUDENT']), teamValidation.invite, async (req, res, next) => {
    const { email, teamId } = req.body;
    try {
        if (!teamId) return res.status(400).json({ error: "teamId is required" });

        // Find the team and the current user's year
        const currentMember = await prisma.teammember.findFirst({
            where: { userId: req.user.id, teamId },
            include: {
                team: {
                    include: {
                        members: true,
                        project: true,
                        projectRequests: {
                            where: { status: 'PENDING' },
                            include: { project: true }
                        }
                    }
                },
                user: true // Get current user's year
            }
        });

        if (!currentMember) return res.status(404).json({ error: "You are not a member of this team" });


        const userToInvite = await prisma.user.findUnique({
            where: { email },
            include: { scopes: { select: { id: true } } } // Fetch assigned scopes
        });
        if (!userToInvite) return res.status(404).json({ error: "User not found" });
        if (userToInvite.role !== 'STUDENT') return res.status(400).json({ error: "Can only invite students" });

        // Enforce Batch (Scope) Assignment
        // The invited user MUST be assigned to the same batch (scope) as the team
        if (currentMember.team.scopeId) {
            const isAssignedToBatch = userToInvite.scopes.some(s => s.id === currentMember.team.scopeId);
            if (!isAssignedToBatch) {
                return res.status(400).json({
                    error: "Cannot invite student. They are not assigned to this project batch."
                });
            }

            // Check if user is already in a team for this scope
            const existingTeamForScope = await prisma.teammember.findFirst({
                where: {
                    userId: userToInvite.id,
                    team: { scopeId: currentMember.team.scopeId }
                }
            });
            if (existingTeamForScope) {
                return res.status(400).json({ error: "User is already in a team for this project batch." });
            }
        }

        if (currentMember.team.project || (currentMember.team.projectRequests && currentMember.team.projectRequests.length > 0)) {
            const project = currentMember.team.project || currentMember.team.projectRequests[0].project;
            const currentCount = currentMember.team.members.length;
            const max = project.maxTeamSize;
            // Count includes both approved and pending members
            if (currentCount >= max) {
                return res.status(400).json({ error: `Cannot invite. Team size limit of ${max} reached for project "${project.title}".` });
            }
        }

        // Enforce Same-Year Restraint
        if (currentMember.user.year && userToInvite.year && currentMember.user.year !== userToInvite.year) {
            return res.status(400).json({
                error: `Academic Year Mismatch: You are Year ${currentMember.user.year}, but ${userToInvite.name} is Year ${userToInvite.year}.`
            });
        }

        // Check if user is already invited/member of THIS specific team
        const existingMember = await prisma.teammember.findFirst({
            where: { teamId, userId: userToInvite.id }
        });
        if (existingMember) return res.status(400).json({ error: "User is already an invitee or member of this team" });

        await prisma.teammember.create({
            data: { teamId: currentMember.teamId, userId: userToInvite.id, approved: false }
        });
        res.json({ message: "Invited" });
    } catch (e) {
        next(e);
    }
});

// Get My Teams (Multiple possible now)
router.get('/my-teams', authenticate, async (req, res, next) => {
    try {
        const memberships = await prisma.teammember.findMany({
            where: { userId: req.user.id },
            include: {
                team: {
                    include: {
                        members: { include: { user: true } },
                        guide: true,
                        subjectExpert: true,
                        scope: {
                            include: { deadlines: true }
                        },

                        project: {
                            include: {
                                scope: true,

                                assignedFaculty: {
                                    include: { faculty: true }
                                }
                            }
                        },
                        projectRequests: {
                            include: { project: { include: { scope: true } } },
                            orderBy: { requestedAt: 'desc' }
                        },
                        reviews: {
                            include: {
                                faculty: true,
                                reviewMarks: true
                            },
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });

        const now = new Date();
        for (const membership of memberships) {
            const team = membership.team;

            // Enrich team with currentPhase logic based on deadlines
            const passedPhases = new Set([
                ...(team.reviews || []).filter(r => r.status && r.status !== 'PENDING').map(r => r.reviewPhase),
                ...(team.project?.assignedFaculty || [])
                    .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
                    .map(a => a.reviewPhase),
                ...(team.scope?.deadlines || [])
                    .filter(d => new Date(d.deadline) < now)
                    .map(d => d.phase)

            ]);
            const reviewedPhaseSet = new Set(
                (team.reviews || []).filter(r => r.status === 'COMPLETED' || r.status === 'NOT_COMPLETED').map(r => r.reviewPhase)
            );
            const activeAssignment = (team.project?.assignedFaculty || []).find(a => {
                if (!a.accessExpiresAt) return false;
                if (reviewedPhaseSet.has(a.reviewPhase)) return false;
                return new Date(a.accessExpiresAt) > now;
            });
            team.currentPhase = activeAssignment?.reviewPhase || (Math.max(0, ...Array.from(passedPhases)) + 1);

            if (team.project && team.project.assignedFaculty.length > 0 && team.project.scopeId) {
                for (const assignment of team.project.assignedFaculty) {
                    if (assignment.mode === 'OFFLINE') {
                        const session = await prisma.labsession.findFirst({
                            where: {
                                facultyId: assignment.facultyId,
                                scopeId: team.project.scopeId
                            },
                            include: { venue: true },
                            orderBy: { startTime: 'desc' }
                        });

                        if (session && session.venue) {
                            assignment.venue = session.venue;
                        }
                    }
                }
            }
        }

        res.json(memberships.map(m => m.team));
    } catch (e) {
        next(e);
    }
});

// Backward compatibility (returns the first team)
router.get('/my-team', authenticate, async (req, res, next) => {
    try {
        const member = await prisma.teammember.findFirst({
            where: { userId: req.user.id },
            include: {
                team: {
                    include: {
                        members: { include: { user: true } },
                        guide: true,
                        subjectExpert: true,
                        scope: {
                            include: { deadlines: true }
                        },

                        project: {
                            include: {
                                scope: {
                                    include: { deadlines: true }
                                },

                                assignedFaculty: {
                                    include: { faculty: true }
                                }
                            }
                        },
                        projectRequests: {
                            include: { project: { include: { scope: true } } },
                            orderBy: { requestedAt: 'desc' }
                        },
                        reviews: {
                            include: {
                                faculty: true,
                                reviewMarks: true
                            },
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        });

        if (!member || !member.team) return res.json(null);

        const team = member.team;
        const now = new Date();

        // Enrich team with currentPhase logic based on deadlines
        const passedPhases = new Set([
            ...(team.reviews || []).filter(r => r.status && r.status !== 'PENDING').map(r => r.reviewPhase),
            ...(team.project?.assignedFaculty || [])
                .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
                .map(a => a.reviewPhase),
            ...(team.scope?.deadlines || [])
                .filter(d => new Date(d.deadline) < now)
                .map(d => d.phase)

        ]);
        const reviewedPhaseSet = new Set(
            (team.reviews || []).filter(r => r.status === 'COMPLETED' || r.status === 'NOT_COMPLETED').map(r => r.reviewPhase)
        );
        const activeAssignment = (team.project?.assignedFaculty || []).find(a => {
            if (!a.accessExpiresAt) return false;
            if (reviewedPhaseSet.has(a.reviewPhase)) return false;
            return new Date(a.accessExpiresAt) > now;
        });
        team.currentPhase = activeAssignment?.reviewPhase || (Math.max(0, ...Array.from(passedPhases)) + 1);

        if (team.project && team.project.assignedFaculty.length > 0 && team.project.scopeId) {
            for (const assignment of team.project.assignedFaculty) {
                if (assignment.mode === 'OFFLINE') {
                    const session = await prisma.labsession.findFirst({
                        where: {
                            facultyId: assignment.facultyId,
                            scopeId: team.project.scopeId
                        },
                        include: { venue: true },
                        orderBy: { startTime: 'desc' }
                    });

                    if (session && session.venue) {
                        assignment.venue = session.venue;
                    }
                }
            }
        }

        res.json(team);
    } catch (e) {
        next(e);
    }
});

// Get My Pending Invitations
router.get('/my-invitations', authenticate, authorize(['STUDENT']), async (req, res, next) => {
    try {
        const pendingMemberships = await prisma.teammember.findMany({
            where: {
                userId: req.user.id,
                approved: false
            },
            include: {
                team: {
                    include: {
                        members: { include: { user: true } },
                        project: true
                    }
                }
            }
        });

        const invitations = pendingMemberships.map(membership => {
            // Get first approved member as representative (Lead usually)
            const lead = membership.team.members.find(m => m.isLeader)?.user ||
                membership.team.members.find(m => m.approved)?.user ||
                { name: 'Unknown', rollNumber: 'N/A' };

            // The current student being invited
            const member = membership.team.members.find(m => m.userId === req.user.id)?.user ||
                { name: 'Unknown', email: 'N/A', rollNumber: 'N/A' };

            return {
                teamId: membership.teamId,
                memberName: member.name,
                memberEmail: member.email,
                memberRollNumber: member.rollNumber,
                teamLeadName: lead.name,
                teamLeadRollNumber: lead.rollNumber,
                teamSize: membership.team.members.length,
                projectTitle: membership.team.project?.title || null,
                status: membership.team.status
            };
        });

        res.json(invitations);
    } catch (e) {
        next(e);
    }
});

// Accept Invite
router.post('/accept', authenticate, authorize(['STUDENT']), teamValidation.acceptReject, async (req, res, next) => {
    const { teamId } = req.body;
    try {
        await prisma.teammember.update({
            where: { userId_teamId: { userId: req.user.id, teamId } },
            data: { approved: true }
        });
        const allMembers = await prisma.teammember.findMany({ where: { teamId } });
        if (allMembers.every(m => m.approved)) {
            await prisma.team.update({ where: { id: teamId }, data: { status: 'APPROVED' } });
        }
        res.json({ success: true });
    } catch (e) {
        next(e);
    }
});

// Reject Invite
router.post('/reject', authenticate, authorize(['STUDENT']), teamValidation.acceptReject, async (req, res, next) => {
    const { teamId } = req.body;
    try {
        const membership = await prisma.teammember.findFirst({
            where: {
                userId: req.user.id,
                teamId: teamId,
                approved: false
            }
        });

        if (!membership) {
            return res.status(404).json({ error: "Invitation not found or already accepted" });
        }

        await prisma.teammember.delete({
            where: {
                id: membership.id
            }
        });

        res.json({ success: true, message: "Invitation rejected successfully" });
    } catch (e) {
        next(e);
    }
});

// Select Project - Any approved team member can select
router.post('/select-project', authenticate, authorize(['STUDENT']), teamValidation.selectProject, async (req, res, next) => {
    const { projectId, teamId } = req.body;
    try {
        // Verify user is an approved member of this team
        const member = await prisma.teammember.findFirst({
            where: { userId: req.user.id, teamId, approved: true }
        });

        if (!member) {
            return res.status(403).json({ error: "You must be an approved team member" });
        }

        // Check if team already has a pending or approved request
        const existingRequest = await prisma.projectrequest.findFirst({
            where: {
                teamId,
                status: { in: ['PENDING', 'APPROVED'] }
            }
        });

        if (existingRequest) {
            return res.status(400).json({
                error: existingRequest.status === 'PENDING'
                    ? "You already have a pending project request awaiting admin approval"
                    : "You already have an approved project request"
            });
        }

        // Check if project is available
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (project.status !== 'AVAILABLE') {
            return res.status(400).json({ error: "Project is no longer available" });
        }

        // Check team size
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { members: { where: { approved: true } } }
        });
        if (team.members.length > project.maxTeamSize) {
            return res.status(400).json({ error: "Team size exceeds project maximum" });
        }

        // Submit request and update project status in transaction
        await prisma.$transaction([
            prisma.projectrequest.create({
                data: {
                    teamId,
                    projectId,
                    requestedBy: req.user.id,
                    status: 'PENDING'
                }
            }),
            prisma.project.update({
                where: { id: projectId },
                data: { status: 'REQUESTED' }
            })
        ]);

        res.json({
            success: true,
            message: "Project selection request submitted. Awaiting admin approval. "
        });
    } catch (error) {
        next(error);
    }
});

// DELETE TEAM (Admin Only)
router.delete('/:id', authenticate, authorize(['ADMIN']), teamValidation.delete, async (req, res, next) => {
    const { id } = req.params;
    try {
        await prisma.$transaction(async (tx) => {
            const team = await tx.team.findUnique({
                where: { id },
                include: {
                    project: true,
                    projectRequests: { where: { status: 'PENDING' } }
                }
            });

            if (!team) {
                throw new Error("Team not found");
            }

            // If project is already assigned, reset it to AVAILABLE
            if (team.projectId) {
                await tx.project.update({
                    where: { id: team.projectId },
                    data: { status: 'AVAILABLE' }
                });
            }

            // If there's a pending request (project status is REQUESTED), reset those projects to AVAILABLE
            if (team.projectRequests && team.projectRequests.length > 0) {
                for (const request of team.projectRequests) {
                    await tx.project.update({
                        where: { id: request.projectId },
                        data: { status: 'AVAILABLE' }
                    });
                }
            }

            await tx.teammember.deleteMany({ where: { teamId: id } });
            await tx.review.deleteMany({ where: { teamId: id } });
            await tx.team.delete({ where: { id } });
        });

        res.json({ success: true, message: "Team deleted successfully and project unassigned" });
    } catch (e) {
        next(e);
    }
});

// Submit for Review (Student)
router.post('/submit-for-review', authenticate, authorize(['STUDENT']), async (req, res, next) => {
    try {
        const { resubmissionNote, teamId } = req.body;
        if (!teamId) return res.status(400).json({ error: "teamId is required" });

        const membership = await prisma.teammember.findFirst({
            where: { userId: req.user.id, teamId, approved: true },
            include: {
                team: {
                    include: {

                        reviews: { where: { status: { in: ['COMPLETED', 'NOT_COMPLETED'] } } },
                        project: {
                            include: { assignedFaculty: true }
                        }
                    }
                }
            }
        });

        if (!membership) return res.status(404).json({ error: "You are not an approved member of this team" });

        const team = membership.team;

        // SEQ CHECK: Ensure Requirements Met
        if (!team.projectId) {
            return res.status(400).json({ error: "No project assigned. Cannot submit." });
        }
        if (team.scope) {
            if (team.scope.requireGuide) {
                if (!team.guideId) return res.status(400).json({ error: "You must assign a Guide before submitting." });
                if (team.guideStatus !== 'APPROVED') return res.status(400).json({ error: "Your Guide has not approved the request yet. Submission is blocked until Guide approval." });
            }
            if (team.scope.requireSubjectExpert) {
                if (!team.subjectExpertId) return res.status(400).json({ error: "You must assign a Subject Expert before submitting." });
                if (team.expertStatus !== 'APPROVED') return res.status(400).json({ error: "Your Subject Expert has not approved the request yet. Submission is blocked until Expert approval." });
            }
        }

        // Allow COMPLETED status so teams can submit for subsequent phases
        const allowedStatuses = ['CHANGES_REQUIRED', 'IN_PROGRESS', 'NOT_COMPLETED', 'COMPLETED'];
        if (!allowedStatuses.includes(team.status)) {
            return res.status(400).json({ error: "Team status does not allow submission for review. Current status: " + team.status });
        }

        // Calculate Next Phase
        // Support flexible progression: check for active assignments first, 
        // fallback to completed count + 1.
        const reviewedPhaseSetForSubmit = new Set(
            team.reviews.map(r => r.reviewPhase)
        );
        const activeAssignment = team.project.assignedFaculty?.find(a => {
            if (!a.accessExpiresAt) return false;
            if (reviewedPhaseSetForSubmit.has(a.reviewPhase)) return false; // Skip completed or missed phases
            return new Date(a.accessExpiresAt) > new Date();
        });

        const completedReviewsCount = team.reviews.length;

        // Count unique phases that are either handled by a review (non-pending), MISSED (expired slot), or PASSED DEADLINE
        const passedPhases = new Set([
            ...team.reviews.filter(r => r.status && r.status !== 'PENDING').map(r => r.reviewPhase),
            ...(team.project.assignedFaculty || [])
                .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < new Date())
                .map(a => a.reviewPhase),

        ]);

        const nextPhase = activeAssignment?.reviewPhase || (Math.max(0, ...Array.from(passedPhases)) + 1);

        if (team.scope && nextPhase > team.scope.numberOfPhases) {
            return res.status(400).json({ error: "All phases for this batch are already completed." });
        }

        await prisma.$transaction(async (tx) => {
            // Find the latest "Changes Required" review that isn't already completed
            // If resubmitting, we might update the existing review or just create a new state
            // For this new flow, we just update the TEAM status to READY_FOR_REVIEW
            // and maybe store the phase. 

            // If there's a CHANGES_REQUIRED review, we are addressing it.
            const latestFeedback = await tx.review.findFirst({
                where: {
                    teamId: team.id,
                    status: 'CHANGES_REQUIRED',
                    completedAt: null
                },
                orderBy: { createdAt: 'desc' }
            });

            if (latestFeedback) {
                await tx.review.update({
                    where: { id: latestFeedback.id },
                    data: {
                        resubmittedAt: new Date(),
                        resubmissionNote: `Faculty Instructions: "${latestFeedback.content}" \n\nStudent Note: "${resubmissionNote || ''}"`,
                        status: 'READY_FOR_REVIEW'
                        // If we update review status, it disappears from faculty "Changes Required" list
                        // Let's keep the Review entity for history, but the Team Status is key trigger.
                    }
                });

                // AUTO-REASSIGN: Refresh the same faculty's assignment for 24 hours
                // This ensures the faculty who gave "Changes Required" can immediately review the resubmission
                if (team.projectId && latestFeedback.facultyId) {
                    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day (24 hours) from now

                    // Find existing assignment for this faculty and project (Matching the Phase)
                    const existingAssignment = await tx.reviewassignment.findFirst({
                        where: {
                            projectId: team.projectId,
                            facultyId: latestFeedback.facultyId,
                            reviewPhase: latestFeedback.reviewPhase || nextPhase
                        }
                    });

                    if (existingAssignment) {
                        // Refresh the access expiration
                        await tx.reviewassignment.update({
                            where: { id: existingAssignment.id },
                            data: { accessExpiresAt: newExpiry }
                        });
                    } else {
                        // Create new assignment (in case original expired or was deleted)
                        await tx.reviewassignment.create({
                            data: {
                                projectId: team.projectId,
                                facultyId: latestFeedback.facultyId,
                                assignedBy: 'SYSTEM_AUTO_REASSIGN',
                                reviewPhase: latestFeedback.reviewPhase || nextPhase,
                                accessExpiresAt: newExpiry
                            }
                        });
                    }
                }
            }

            await tx.team.update({
                where: { id: team.id },
                data: {
                    status: 'READY_FOR_REVIEW',
                    submissionPhase: nextPhase
                }
            });
        });

        res.json({ success: true, message: "Project submitted for review successfully" });
    } catch (e) {
        console.error("Submit for Review Error:", e);
        next(e);
    }
});

// Mark project request as read
router.post('/mark-project-request-read', authenticate, authorize(['STUDENT']), async (req, res, next) => {
    const { requestId } = req.body;
    try {
        const request = await prisma.projectrequest.findUnique({
            where: { id: requestId },
            include: { team: { include: { members: true } } }
        });

        if (!request) return res.status(404).json({ error: "Request not found" });

        // Verify user is a member of the team
        const isMember = request.team.members.some(m => m.userId === req.user.id);
        if (!isMember) return res.status(403).json({ error: "Unauthorized" });

        await prisma.projectrequest.update({
            where: { id: requestId },
            data: { isRead: true }
        });

        res.json({ success: true, message: "Request marked as read" });
    } catch (e) {
        next(e);
    }
});


// Select Guide
router.post('/select-guide', authenticate, authorize(['STUDENT']), async (req, res, next) => {
    const { guideId, teamId } = req.body;
    try {
        const member = await prisma.teammember.findFirst({
            where: { userId: req.user.id, teamId, approved: true }
        });
        if (!member) return res.status(403).json({ error: "Not a team member" });

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { scope: true }
        });

        // SEQ CHECK 1: Project must be selected first
        if (!team.projectId) {
            return res.status(400).json({ error: "You must select a project before assigning a guide." });
        }

        // PREVENT OVERRIDE: If already approved (by Admin or Faculty), don't allow student to change
        if (team.guideStatus === 'APPROVED') {
            return res.status(400).json({ error: "Guide is already approved and cannot be changed by the team. Please contact Admin for changes." });
        }

        const guide = await prisma.user.findUnique({ where: { id: guideId } });
        if (!guide || guide.role !== 'FACULTY' || !guide.isGuide) {
            return res.status(400).json({ error: "Invalid guide selection. Faculty must be an eligible guide." });
        }

        if (team.subjectExpertId === guideId) {
            return res.status(400).json({ error: "Guide must be different from Subject Expert." });
        }

        await prisma.team.update({
            where: { id: teamId },
            data: {
                guideId,
                guideStatus: 'PENDING'
            }
        });

        res.json({ success: true, message: "Guide selected successfully" });
    } catch (e) {
        next(e);
    }
});

// Select Subject Expert
router.post('/select-expert', authenticate, authorize(['STUDENT']), async (req, res, next) => {
    const { expertId, teamId } = req.body;
    try {
        const member = await prisma.teammember.findFirst({
            where: { userId: req.user.id, teamId, approved: true }
        });
        if (!member) return res.status(403).json({ error: "Not a team member" });

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { scope: true }
        });

        // SEQ CHECK 1: Project must be selected first
        if (!team.projectId) {
            return res.status(400).json({ error: "You must select a project before assigning a subject expert." });
        }

        // SEQ CHECK 2: Guide must be selected first (if required by scope)
        if (team.scope && team.scope.requireGuide && !team.guideId) {
            return res.status(400).json({ error: "You must assign a Guide before assigning a Subject Expert." });
        }

        // PREVENT OVERRIDE: If already approved, don't allow student to change
        if (team.expertStatus === 'APPROVED') {
            return res.status(400).json({ error: "Subject Expert is already approved and cannot be changed by the team. Please contact Admin for changes." });
        }

        const expert = await prisma.user.findUnique({ where: { id: expertId } });
        if (!expert || expert.role !== 'FACULTY' || !expert.isSubjectExpert) {
            return res.status(400).json({ error: "Invalid expert selection. Faculty must be an eligible subject expert." });
        }

        if (team.guideId === expertId) {
            return res.status(400).json({ error: "Subject Expert must be different from Guide." });
        }

        await prisma.team.update({
            where: { id: teamId },
            data: {
                subjectExpertId: expertId,
                expertStatus: 'PENDING'
            }
        });

        res.json({ success: true, message: "Subject Expert selected successfully" });
    } catch (e) {
        next(e);
    }
});

// Update Team Status (Admin Only)
router.patch('/:id/status', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        const validStatuses = ['PENDING', 'APPROVED', 'NOT_COMPLETED', 'IN_PROGRESS', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW', 'COMPLETED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const team = await prisma.team.findUnique({
            where: { id },
            include: { project: true }
        });

        if (!team) return res.status(404).json({ error: "Team not found" });

        const result = await prisma.$transaction(async (tx) => {
            // Update Team Status
            const updatedTeam = await tx.team.update({
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

            // ACTION: If Admin resets status to 'NOT_COMPLETED' or 'IN_PROGRESS', 
            // we must cancel any existing PENDING/READY reviews so the student can validly resubmit.
            // Otherwise the frontend "hasPendingReview" check blocks them.
            if (['NOT_COMPLETED', 'IN_PROGRESS', 'PENDING'].includes(status)) {
                await tx.review.updateMany({
                    where: {
                        teamId: id,
                        status: { in: ['PENDING', 'READY_FOR_REVIEW'] }
                    },
                    data: { status: 'NOT_COMPLETED' }
                });
            }

            // Dependency Handling
            if (status === 'CHANGES_REQUIRED') {
                // Targeted Extension: Only extend assignments for the CURRENT phase
                if (team.projectId) {
                    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

                    // Determine which phase to extend: latest review or latest assignment
                    const latestReview = await tx.review.findFirst({
                        where: { teamId: id },
                        orderBy: { createdAt: 'desc' }
                    });

                    await tx.reviewassignment.updateMany({
                        where: {
                            projectId: team.projectId,
                            reviewPhase: latestReview?.reviewPhase || undefined
                        },
                        data: { accessExpiresAt: newExpiry }
                    });
                }
            } else if (status === 'COMPLETED') {
                // Update Project Status if team is completed
                if (team.projectId) {
                    await tx.project.update({
                        where: { id: team.projectId },
                        data: { status: 'COMPLETED' }
                    });
                }
            }

            return updatedTeam;
        });

        res.json(result);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
