const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { syncTeamReviewsWithSession } = require('../utils/assignmentUtils');
const router = express.Router();

// --- VENUE MANAGEMENT ---

// GET /api/venues - List all venues
router.get('/', authenticate, async (req, res) => {
    try {
        const venues = await prisma.venue.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { labsession: true } }
            }
        });
        res.json(venues);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch venues' });
    }
});

// POST /api/venues - Create a venue
router.post('/', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { name, location, capacity } = req.body;
        if (!name) return res.status(400).json({ error: 'Venue name is required' });

        const venue = await prisma.venue.create({
            data: { name, location, capacity: capacity ? parseInt(capacity) : null }
        });
        res.status(201).json(venue);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create venue' });
    }
});

// PUT /api/venues/:id - Update venue
router.put('/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { name, location, capacity } = req.body;
        const venue = await prisma.venue.update({
            where: { id: req.params.id },
            data: { name, location, capacity: capacity ? parseInt(capacity) : null }
        });
        res.json(venue);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update venue' });
    }
});

// DELETE /api/venues/:id - Delete venue
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        await prisma.venue.delete({ where: { id: req.params.id } });
        res.json({ message: 'Venue deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete venue' });
    }
});

// --- SESSION MANAGEMENT ---

// GET /api/venues/sessions/unassigned - Get students not in any session for a date
router.get('/sessions/unassigned', authenticate, async (req, res) => {
    try {
        const { date, scopeId } = req.query;

        if (!date || !scopeId) {
            return res.status(400).json({ error: 'Date and Scope ID are required' });
        }

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // 1. Get all students in this scope
        // Students are linked to scope via 'projectscopetouser' relation (User.scopes)
        const allStudentsInScope = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                scopes: {
                    some: { id: scopeId }
                }
            },
            select: {
                id: true,
                name: true,
                rollNumber: true,
                email: true,
                teamMemberships: {
                    include: {
                        team: {
                            include: { project: { select: { title: true, category: true } } }
                        }
                    }
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        // 2. Get all sessions on this date (regardless of venue)
        // We want to exclude students who are busy in ANY session this day.
        const scheduledSessions = await prisma.labsession.findMany({
            where: {
                startTime: { gte: start, lte: end }
            },
            select: {
                user_sessionstudents: { select: { id: true } }
            }
        });

        // Collect IDs of scheduled students
        const scheduledStudentIds = new Set();
        scheduledSessions.forEach(session => {
            session.user_sessionstudents.forEach(s => scheduledStudentIds.add(s.id));
        });

        // 3. Filter out scheduled students
        const unassignedStudents = allStudentsInScope.filter(s => !scheduledStudentIds.has(s.id));

        // Format response
        const response = unassignedStudents.map(s => {
            const team = s.teamMemberships[0]?.team;
            return {
                id: s.id,
                name: s.name,
                rollNumber: s.rollNumber,
                email: s.email,
                projectTitle: team?.project?.title || 'No Project',
                projectCategory: team?.project?.category || 'N/A'
            };
        });

        res.json(response);
    } catch (error) {
        console.error('Failed to fetch unassigned students:', error);
        res.status(500).json({ error: 'Failed to fetch unassigned students' });
    }
});

// GET /api/venues/sessions - List sessions (with filters)
router.get('/sessions', authenticate, async (req, res) => {
    try {
        const { start, end, venueId, scopeId } = req.query;

        const where = {};
        if (venueId) where.venueId = venueId;
        if (scopeId) where.scopeId = scopeId;
        if (start && end) {
            where.startTime = { gte: new Date(start) };
            where.endTime = { lte: new Date(end) };
        }

        if (req.query.search) {
            const search = req.query.search.toLowerCase();
            where.OR = [
                { venue: { name: { contains: search } } }, // Venue Name
                { venue: { location: { contains: search } } }, // Venue Location
                { user_labsession_facultyIdTouser: { name: { contains: search } } }, // Faculty Name
                { user_labsession_facultyIdTouser: { email: { contains: search } } }, // Faculty Email
                {
                    user_sessionstudents: {
                        some: {
                            OR: [
                                { name: { contains: search } }, // Student Name
                                { rollNumber: { contains: search } }, // Student Roll No
                                { email: { contains: search } } // Student Email
                            ]
                        }
                    }
                }
            ];
        }

        const sessions = await prisma.labsession.findMany({
            where,
            include: {
                venue: true,
                user_labsession_facultyIdTouser: { select: { id: true, name: true, email: true, rollNumber: true } },
                user_sessionstudents: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        rollNumber: true,
                        teamMemberships: {
                            where: { approved: true },
                            include: {
                                team: {
                                    include: {
                                        project: true,
                                        reviews: {
                                            where: { status: 'COMPLETED' },
                                            select: {
                                                reviewPhase: true,
                                                reviewMarks: {
                                                    select: { studentId: true, marks: true, criterionMarks: true, isAbsent: true }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                projectscope: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        // Map projectscope to scope and user_labsession_facultyIdTouser to faculty for frontend compatibility
        const response = sessions.map(s => ({
            ...s,
            scope: s.projectscope,
            faculty: s.user_labsession_facultyIdTouser,
            students: s.user_sessionstudents,
            projectscope: undefined,
            user_labsession_facultyIdTouser: undefined,
            user_sessionstudents: undefined
        }));

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// POST /api/venues/sessions - Create/Book a session
router.post('/sessions', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { venueId, facultyId, scopeId, startTime, endTime, title, studentIds } = req.body;

        if (!venueId || !facultyId || !scopeId || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (start >= end) {
            return res.status(400).json({ error: 'Invalid time range' });
        }

        /* Venue conflict check removed to allow multiple staff in one venue */

        // Conflict Detection: Faculty
        const facultyConflict = await prisma.labsession.findFirst({
            where: {
                facultyId,
                OR: [
                    { startTime: { lt: end, gte: start } },
                    { endTime: { gt: start, lte: end } }
                ]
            }
        });

        if (facultyConflict) {
            return res.status(409).json({ error: 'Faculty is already busy at this time' });
        }

        // Create Session
        const session = await prisma.labsession.create({
            data: {
                venueId,
                facultyId,
                scopeId,
                startTime: start,
                endTime: end,
                title,
                user_sessionstudents: studentIds && studentIds.length > 0 ? {
                    connect: studentIds.map(id => ({ id }))
                } : undefined
            },
            include: { venue: true, user_labsession_facultyIdTouser: true, user_sessionstudents: true }
        });

        const mappedSession = {
            ...session,
            faculty: session.user_labsession_facultyIdTouser,
            students: session.user_sessionstudents,
            user_labsession_facultyIdTouser: undefined,
            user_sessionstudents: undefined
        };

        res.status(201).json(mappedSession);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create session' });
    }
});

// PUT /api/venues/sessions/:id - Update session (change faculty/students)
router.put('/sessions/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { facultyId, studentIds } = req.body;
        const sessionId = req.params.id;

        // Get current session
        const currentSession = await prisma.labsession.findUnique({
            where: { id: sessionId },
            include: { user_sessionstudents: true }
        });

        if (!currentSession) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // If changing faculty, check for conflicts
        if (facultyId && facultyId !== currentSession.facultyId) {
            const facultyConflict = await prisma.labsession.findFirst({
                where: {
                    id: { not: sessionId },
                    facultyId,
                    OR: [
                        { startTime: { lt: currentSession.endTime, gte: currentSession.startTime } },
                        { endTime: { gt: currentSession.startTime, lte: currentSession.endTime } }
                    ]
                }
            });

            if (facultyConflict) {
                return res.status(409).json({ error: 'Faculty is already busy at this time' });
            }
        }

        // Update session
        const updateData = {};
        if (facultyId) updateData.facultyId = facultyId;

        // Handle students update
        if (studentIds) {
            // Disconnect all existing students first, then connect new ones
            updateData.user_sessionstudents = {
                set: studentIds.map(id => ({ id }))
            };
        }

        const updatedSession = await prisma.$transaction(async (tx) => {
            const result = await tx.labsession.update({
                where: { id: sessionId },
                data: updateData,
                include: { venue: true, user_labsession_facultyIdTouser: true, user_sessionstudents: true }
            });

            // If faculty changed OR students changed, sync reviews
            if (facultyId || studentIds) {
                const affectedStudentIds = studentIds || result.user_sessionstudents.map(s => s.id);
                const activeFacultyId = facultyId || result.facultyId;
                await syncTeamReviewsWithSession(tx, affectedStudentIds, activeFacultyId, req.user.id);
            }

            return result;
        });

        const mappedSession = {
            ...updatedSession,
            faculty: updatedSession.user_labsession_facultyIdTouser,
            students: updatedSession.user_sessionstudents,
            user_labsession_facultyIdTouser: undefined,
            user_sessionstudents: undefined
        };

        res.json(mappedSession);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});

// POST /api/venues/sessions/copy - Copy all sessions from one day to another
router.post('/sessions/copy', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { fromDate, toDate, scopeId } = req.body;

        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'fromDate and toDate are required' });
        }

        const startFrom = new Date(fromDate);
        startFrom.setHours(0, 0, 0, 0);
        const endFrom = new Date(fromDate);
        endFrom.setHours(23, 59, 59, 999);

        // Fetch sessions to copy
        const sessionsToCopy = await prisma.labsession.findMany({
            where: {
                startTime: { gte: startFrom, lte: endFrom },
                ...(scopeId && { scopeId })
            },
            include: { user_sessionstudents: true }
        });

        if (sessionsToCopy.length === 0) {
            return res.status(404).json({ error: 'No sessions found on the source date' });
        }

        const targetDate = new Date(toDate);
        const results = { copied: 0, skipped: 0, errors: [] };

        for (const session of sessionsToCopy) {
            // Calculate new times
            const newStart = new Date(targetDate);
            newStart.setHours(session.startTime.getHours(), session.startTime.getMinutes(), 0, 0);

            const newEnd = new Date(targetDate);
            newEnd.setHours(session.endTime.getHours(), session.endTime.getMinutes(), 0, 0);

            // Check faculty conflict on target date
            const conflict = await prisma.labsession.findFirst({
                where: {
                    facultyId: session.facultyId,
                    OR: [
                        { startTime: { lt: newEnd, gte: newStart } },
                        { endTime: { gt: newStart, lte: newEnd } }
                    ]
                }
            });

            if (conflict) {
                results.skipped++;
                continue;
            }

            try {
                await prisma.labsession.create({
                    data: {
                        venueId: session.venueId,
                        facultyId: session.facultyId,
                        scopeId: session.scopeId,
                        startTime: newStart,
                        endTime: newEnd,
                        title: session.title,
                        user_sessionstudents: {
                            connect: session.user_sessionstudents.map(s => ({ id: s.id }))
                        }
                    }
                });
                results.copied++;
            } catch (err) {
                console.error('Failed to copy session:', err);
                results.errors.push(session.id);
            }
        }

        res.json({
            message: `Copy complete: ${results.copied} sessions copied, ${results.skipped} skipped due to conflicts.`,
            ...results
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to copy sessions' });
    }
});

// POST /api/venues/swap - Swap all sessions between two venues on a day
router.post('/swap', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        const { venueAId, venueBId, date } = req.body;

        if (!venueAId || !venueBId || !date) {
            return res.status(400).json({ error: 'venueAId, venueBId, and date are required' });
        }

        if (venueAId === venueBId) {
            return res.status(400).json({ error: 'Cannot swap a venue with itself' });
        }

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // Perform swap in a transaction
        await prisma.$transaction(async (tx) => {
            // Get IDs first to avoid moving the same session twice
            const sessionsA = await tx.labsession.findMany({
                where: { venueId: venueAId, startTime: { gte: start, lte: end } },
                select: { id: true }
            });

            const sessionsB = await tx.labsession.findMany({
                where: { venueId: venueBId, startTime: { gte: start, lte: end } },
                select: { id: true }
            });

            // Update A to B
            if (sessionsA.length > 0) {
                await tx.labsession.updateMany({
                    where: { id: { in: sessionsA.map(s => s.id) } },
                    data: { venueId: venueBId }
                });
            }

            // Update B to A
            if (sessionsB.length > 0) {
                await tx.labsession.updateMany({
                    where: { id: { in: sessionsB.map(s => s.id) } },
                    data: { venueId: venueAId }
                });
            }
        });

        res.json({ message: 'Venues swapped successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to swap venues' });
    }
});

// DELETE /api/venues/sessions/:id - Cancel session
router.delete('/sessions/:id', authenticate, authorize(['ADMIN']), async (req, res) => {
    try {
        await prisma.labsession.delete({ where: { id: req.params.id } });
        res.json({ message: 'Session cancelled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel session' });
    }
});

module.exports = router;
