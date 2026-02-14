const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get Pending Requests
router.get('/requests', authenticate, authorize(['FACULTY']), async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Find teams where I am requested as Guide
        const guideRequests = await prisma.team.findMany({
            where: {
                guideId: userId,
                guideStatus: 'PENDING'
            },
            include: {
                project: true,
                members: {
                    include: {
                        user: {
                            include: {
                                labsession_sessionstudents: {
                                    where: { endTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                                    include: { venue: true },
                                    orderBy: { startTime: 'asc' },
                                    take: 1
                                }
                            }
                        }
                    }
                },
                subjectExpert: true
            }
        });

        // Find teams where I am requested as Subject Expert
        const expertRequests = await prisma.team.findMany({
            where: {
                subjectExpertId: userId,
                expertStatus: 'PENDING'
            },
            include: {
                project: true,
                members: {
                    include: {
                        user: {
                            include: {
                                labsession_sessionstudents: {
                                    where: { endTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                                    include: { venue: true },
                                    orderBy: { startTime: 'asc' },
                                    take: 1
                                }
                            }
                        }
                    }
                },
                guide: true
            }
        });

        // Transform and combine
        const requests = [
            ...guideRequests.map(t => ({ ...t, requestType: 'GUIDE' })),
            ...expertRequests.map(t => ({ ...t, requestType: 'EXPERT' }))
        ];

        res.json(requests);
    } catch (e) {
        next(e);
    }
});

// Respond to Request (Approve/Reject)
router.post('/respond', authenticate, authorize(['FACULTY']), async (req, res, next) => {
    const { teamId, requestType, action } = req.body; // requestType: 'GUIDE' | 'EXPERT', action: 'APPROVE' | 'REJECT'
    const userId = req.user.id;

    if (!['GUIDE', 'EXPERT'].includes(requestType) || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: "Invalid parameters" });
    }

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: "Team not found" });

        // Verify it is actually me requested
        if (requestType === 'GUIDE') {
            if (team.guideId !== userId) return res.status(403).json({ error: "You are not the requested guide" });
            if (team.guideStatus !== 'PENDING') return res.status(400).json({ error: "Request is not pending" });
        } else {
            if (team.subjectExpertId !== userId) return res.status(403).json({ error: "You are not the requested expert" });
            if (team.expertStatus !== 'PENDING') return res.status(400).json({ error: "Request is not pending" });
        }

        if (action === 'APPROVE') {
            // Fetch team with project to get scopeId
            const teamWithProject = await prisma.team.findUnique({
                where: { id: teamId },
                include: { project: true }
            });
            const scopeId = teamWithProject?.project?.scopeId;

            // ENFORCE LIMIT: Max 4 teams PER BATCH (Guide + Expert combined)
            const approvedAsGuide = await prisma.team.count({
                where: {
                    guideId: userId,
                    guideStatus: 'APPROVED',
                    project: { scopeId: scopeId }
                }
            });
            const approvedAsExpert = await prisma.team.count({
                where: {
                    subjectExpertId: userId,
                    expertStatus: 'APPROVED',
                    project: { scopeId: scopeId }
                }
            });

            if (approvedAsGuide + approvedAsExpert >= 4) {
                return res.status(400).json({ error: "You have reached the maximum limit of 4 teams for this batch (Guide + Expert roles combined)." });
            }

            // Update status
            const updateField = requestType === 'GUIDE' ? 'guideStatus' : 'expertStatus';
            await prisma.team.update({
                where: { id: teamId },
                data: { [updateField]: 'APPROVED' }
            });
        } else {
            // Reject
            // When rejecting, should we reset the ID to null? 
            // Better to keep it so history shows rejection, but maybe resets for student UI to allow re-selection?
            // Student UI logic: if rejected, allow selection. 
            // For now, just set status REJECTED.
            const updateField = requestType === 'GUIDE' ? 'guideStatus' : 'expertStatus';
            await prisma.team.update({
                where: { id: teamId },
                data: { [updateField]: 'REJECTED' }
            });
        }

        res.json({ success: true, message: `Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}` });
    } catch (e) {
        next(e);
    }
});

// Get My Approved Teams
router.get('/my-teams', authenticate, authorize(['FACULTY']), async (req, res, next) => {
    try {
        const userId = req.user.id;

        const teams = await prisma.team.findMany({
            where: {
                OR: [
                    { guideId: userId, guideStatus: 'APPROVED' },
                    { subjectExpertId: userId, expertStatus: 'APPROVED' }
                ]
            },
            include: {
                project: { include: { scope: true } },
                members: {
                    include: {
                        user: {
                            include: {
                                labsession_sessionstudents: {
                                    where: { endTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
                                    include: { venue: true },
                                    orderBy: { startTime: 'asc' },
                                    take: 1
                                }
                            }
                        }
                    }
                },
                guide: true,
                subjectExpert: true,
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        faculty: { select: { id: true, name: true, role: true, rollNumber: true } },
                        reviewMarks: true
                    }
                }
            }
        });

        // Add a field to indicate my role in this team
        const teamsWithRole = teams.map(t => ({
            ...t,
            myRole: t.guideId === userId ? 'GUIDE' : 'EXPERT'
        }));

        res.json(teamsWithRole);

    } catch (e) {
        next(e);
    }
});

module.exports = router;
