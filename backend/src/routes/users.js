const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { userValidation, commonValidations } = require('../middleware/validation');
const { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } = require('../utils/constants');
const crypto = require('crypto');


const router = express.Router();

// CREATE USER
router.post('/', authenticate, authorize(['ADMIN']), userValidation.create, async (req, res, next) => {
    try {
        const { name, email, role, rollNumber, department, year } = req.body;

        const safeRollNumber = rollNumber && rollNumber.trim() !== "" ? rollNumber.trim() : undefined;

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                role,
                rollNumber: safeRollNumber,
                department,
                year: year ? parseInt(year) : null
            }
        });
        res.json(newUser);
    } catch (e) {
        next(e);
    }
});

// BULK CREATE USERS
router.post('/bulk', authenticate, authorize(['ADMIN']), userValidation.bulkCreate, async (req, res, next) => {
    try {
        const users = req.body.users;

        const data = users.map(u => ({
            id: crypto.randomUUID(),
            name: u.name,
            email: u.email,
            role: u.role,
            rollNumber: u.rollNumber && u.rollNumber.trim() !== "" ? u.rollNumber.trim() : null,
            department: u.department || null,
            year: u.year ? parseInt(u.year) : null,
            isGuide: u.isGuide === true || u.isGuide === 'true',
            isSubjectExpert: u.isSubjectExpert === true || u.isSubjectExpert === 'true'
        }));

        // Chunking to handle large imports (e.g. 1900+) safely with database limits
        const chunkSize = 100;
        let totalCreated = 0;
        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const result = await prisma.user.createMany({
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

// Bulk Update Faculty Roles (Guide/Expert)
router.post('/bulk-roles', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { emails, roleType } = req.body; // roleType: 'GUIDE' or 'EXPERT'

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: "Emails array is required" });
        }

        if (!['GUIDE', 'EXPERT'].includes(roleType)) {
            return res.status(400).json({ error: "Invalid role type" });
        }

        const updateData = roleType === 'GUIDE' ? { isGuide: true } : { isSubjectExpert: true };

        const result = await prisma.user.updateMany({
            where: {
                email: { in: emails },
                role: 'FACULTY'
            },
            data: updateData
        });

        res.json({ success: true, count: result.count, message: `Updated ${result.count} faculty members.` });
    } catch (e) {
        next(e);
    }
});

router.get('/faculty-list', authenticate, async (req, res, next) => {
    const { scopeId } = req.query;
    try {
        const faculty = await prisma.user.findMany({
            where: { role: 'FACULTY' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isGuide: true,
                isSubjectExpert: true
            }
        });

        if (scopeId) {
            const teamsInScope = await prisma.team.findMany({
                where: { scopeId: scopeId },
                select: { guideId: true, subjectExpertId: true, guideStatus: true, expertStatus: true }
            });

            const occupancyMap = {};
            teamsInScope.forEach(t => {
                // Only count approved assignments for the limit? 
                // Actually, user said "requests", but usually limit applies to actual commitments.
                // However, if we allow 10 requests, they might all get approved.
                // Let's count APPROVED and PENDING as both take up "slots" in terms of availability.
                if (t.guideId && (t.guideStatus === 'APPROVED' || t.guideStatus === 'PENDING')) {
                    occupancyMap[t.guideId] = (occupancyMap[t.guideId] || 0) + 1;
                }
                if (t.subjectExpertId && (t.expertStatus === 'APPROVED' || t.expertStatus === 'PENDING')) {
                    occupancyMap[t.subjectExpertId] = (occupancyMap[t.subjectExpertId] || 0) + 1;
                }
            });

            faculty.forEach(f => {
                f.batchOccupancy = occupancyMap[f.id] || 0;
            });
        }

        res.json({ users: faculty });
    } catch (e) {
        next(e);
    }
});

// GET ALL USERS (with pagination)
router.get('/', authenticate, authorize(['ADMIN']), commonValidations.pagination, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || DEFAULT_PAGE;
        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const skip = (page - 1) * limit;

        const { search, role, sortBy = 'createdAt', order = 'desc' } = req.query;
        const where = {};
        if (role) {
            where.role = role;
        }
        if (req.query.scopeId && req.query.scopeId !== 'ALL') {
            where.scopes = { some: { id: req.query.scopeId } };
        }
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { rollNumber: { contains: search } }
            ];
        }

        // Validate sortBy field
        const allowedSortFields = ['name', 'email', 'rollNumber', 'createdAt', 'role'];
        const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const orderByOrder = order === 'asc' ? 'asc' : 'desc';

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                include: { scopes: true },
                orderBy: { [orderByField]: orderByOrder }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            users,
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

// DELETE USER
router.delete('/:id', authenticate, authorize(['ADMIN']), userValidation.delete, async (req, res, next) => {
    const { id } = req.params;
    try {
        // Check 1: Is member of a team?
        const teamMembership = await prisma.teammember.findFirst({ where: { userId: id } });
        if (teamMembership) {
            return res.status(400).json({ error: "Cannot delete user who is in a team. Remove them from team first." });
        }

        // Check 2: Is assigned as Guide or Subject Expert?
        const assignedTeam = await prisma.team.findFirst({
            where: {
                OR: [
                    { guideId: id },
                    { subjectExpertId: id }
                ]
            }
        });

        if (assignedTeam) {
            return res.status(400).json({ error: "Cannot delete faculty who is assigned as a Guide or Subject Expert to a team. Unassign them first." });
        }

        // Check 3: Is assigned to any Lab Sessions?
        const assignedSession = await prisma.labsession.findFirst({
            where: { facultyId: id }
        });
        if (assignedSession) {
            return res.status(400).json({ error: "Cannot delete faculty who has assigned lab sessions. Delete or reassign the sessions first." });
        }

        // Check 4: Has submitted any Reviews?
        const submittedReview = await prisma.review.findFirst({
            where: { facultyId: id }
        });
        if (submittedReview) {
            return res.status(400).json({ error: "Cannot delete faculty who has submitted reviews. Delete the reviews first." });
        }

        await prisma.user.delete({ where: { id } });
        res.json({ success: true, message: "User deleted successfully" });
    } catch (e) {
        next(e);
    }
});

// BULK DELETE USERS
router.post('/bulk-delete', authenticate, authorize(['ADMIN']), userValidation.bulkDelete, async (req, res, next) => {
    try {
        const { ids } = req.body;

        // Check if any of these users are in teams
        const usersInTeams = await prisma.teammember.findMany({
            where: { userId: { in: ids } },
            select: { userId: true }
        });

        const idsInTeams = usersInTeams.map(u => u.userId);
        const deletableIds = ids.filter(id => !idsInTeams.includes(id));

        if (deletableIds.length === 0 && ids.length > 0) {
            return res.status(400).json({
                error: "None of the selected users could be deleted because they are all in teams."
            });
        }

        const result = await prisma.user.deleteMany({
            where: { id: { in: deletableIds } }
        });

        res.json({
            success: true,
            deletedCount: result.count,
            failedCount: ids.length - result.count,
            message: `Successfully deleted ${result.count} users.${idsInTeams.length > 0 ? ` ${idsInTeams.length} users were skipped because they are in teams.` : ''}`
        });
    } catch (e) {
        next(e);
    }
});

// UPDATE USER
router.patch('/:id', authenticate, authorize(['ADMIN']), userValidation.update, async (req, res, next) => {
    const { id } = req.params;
    try {
        const { name, email, rollNumber, department, year } = req.body;
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (rollNumber !== undefined) updateData.rollNumber = rollNumber && rollNumber.trim() !== "" ? rollNumber.trim() : null;
        if (department !== undefined) updateData.department = department;
        if (year !== undefined) updateData.year = year ? parseInt(year) : null;

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });
        res.json(updatedUser);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
