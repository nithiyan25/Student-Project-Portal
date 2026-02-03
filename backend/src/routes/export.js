const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');
const { authenticate, authorize } = require('../middleware/auth');

// Export all data to Excel
router.get('/all', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        // Get selected sheets from query parameter (comma-separated)
        const sheetsParam = req.query.sheets;
        const selectedSheets = sheetsParam ? sheetsParam.split(',') : [
            'students', 'faculty', 'admins', 'projects', 'teams',
            'facultyAssignments', 'reviewHistory', 'studentScores'
        ];

        // Validate sheet names
        const validSheets = ['students', 'faculty', 'admins', 'projects', 'teams', 'facultyAssignments', 'reviewHistory', 'studentScores'];
        const sheets = selectedSheets.filter(s => validSheets.includes(s));

        if (sheets.length === 0) {
            return res.status(400).json({ error: 'No valid sheets selected' });
        }

        // Conditionally fetch data based on selected sheets
        const fetchPromises = [];
        const dataKeys = [];

        if (sheets.includes('students')) {
            fetchPromises.push(prisma.user.findMany({
                where: { role: 'STUDENT' },
                orderBy: { name: 'asc' }
            }));
            dataKeys.push('students');
        }

        if (sheets.includes('faculty')) {
            fetchPromises.push(prisma.user.findMany({
                where: { role: 'FACULTY' },
                orderBy: { name: 'asc' }
            }));
            dataKeys.push('faculty');
        }

        if (sheets.includes('admins')) {
            fetchPromises.push(prisma.user.findMany({
                where: { role: 'ADMIN' },
                orderBy: { name: 'asc' }
            }));
            dataKeys.push('admins');
        }

        if (sheets.includes('projects')) {
            fetchPromises.push(prisma.project.findMany({
                include: {
                    teams: {
                        include: {
                            members: {
                                where: { approved: true },
                                include: { user: true }
                            }
                        }
                    }
                },
                orderBy: { title: 'asc' }
            }));
            dataKeys.push('projects');
        }

        if (sheets.includes('teams')) {
            fetchPromises.push(prisma.team.findMany({
                include: {
                    project: true,
                    members: {
                        where: { approved: true },
                        include: { user: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }));
            dataKeys.push('teams');
        }

        if (sheets.includes('facultyAssignments')) {
            fetchPromises.push(prisma.reviewassignment.findMany({
                include: {
                    faculty: true,
                    project: true
                },
                orderBy: { assignedAt: 'desc' }
            }));
            dataKeys.push('facultyAssignments');
        }

        if (sheets.includes('reviewHistory') || sheets.includes('studentScores')) {
            fetchPromises.push(prisma.review.findMany({
                include: {
                    faculty: true,
                    team: {
                        include: {
                            project: true,
                            members: {
                                where: { approved: true },
                                include: { user: true }
                            }
                        }
                    },
                    reviewMarks: {
                        include: { student: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }));
            dataKeys.push('reviews');
        }

        // Fetch all selected data
        const results = await Promise.all(fetchPromises);
        const data = {};
        dataKeys.forEach((key, i) => { data[key] = results[i]; });

        // Create workbook
        const workbook = XLSX.utils.book_new();

        // Sheet 1: Students
        if (sheets.includes('students') && data.students) {
            const studentsData = data.students.map(s => ({
                'Name': s.name,
                'Email': s.email,
                'Roll Number': s.rollNumber || 'N/A',
                'Department': s.department || 'N/A',
                'Year': s.year || 'N/A',
                'Created At': new Date(s.createdAt).toLocaleDateString()
            }));
            const studentsSheet = XLSX.utils.json_to_sheet(studentsData);
            XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');
        }

        // Sheet 2: Faculty
        if (sheets.includes('faculty') && data.faculty) {
            const facultyData = data.faculty.map(f => ({
                'Name': f.name,
                'Email': f.email,
                'Faculty ID': f.rollNumber || 'N/A',
                'Created At': new Date(f.createdAt).toLocaleDateString()
            }));
            const facultySheet = XLSX.utils.json_to_sheet(facultyData);
            XLSX.utils.book_append_sheet(workbook, facultySheet, 'Faculty');
        }

        // Sheet 3: Admins
        if (sheets.includes('admins') && data.admins) {
            const adminsData = data.admins.map(a => ({
                'Name': a.name,
                'Email': a.email,
                'Created At': new Date(a.createdAt).toLocaleDateString()
            }));
            const adminsSheet = XLSX.utils.json_to_sheet(adminsData);
            XLSX.utils.book_append_sheet(workbook, adminsSheet, 'Admins');
        }

        // Sheet 4: Projects
        if (sheets.includes('projects') && data.projects) {
            const projectsData = data.projects.map(p => ({
                'Title': p.title,
                'Category': p.category,
                'Max Team Size': p.maxTeamSize,
                'Status': p.status,
                'Session': p.session || 'N/A',
                'Description': p.description || 'N/A',
                'Teams Count': p.teams.length,
                'Students Assigned': p.teams.flatMap(t => t.members.map(m => m.user.name)).join(', ') || 'None',
                'Created At': new Date(p.createdAt).toLocaleDateString()
            }));
            const projectsSheet = XLSX.utils.json_to_sheet(projectsData);
            XLSX.utils.book_append_sheet(workbook, projectsSheet, 'Projects');
        }

        // Sheet 5: Teams
        if (sheets.includes('teams') && data.teams) {
            const teamsData = data.teams.map(t => ({
                'Project': t.project?.title || 'Unassigned',
                'Status': t.status,
                'Team Members': t.members.map(m => `${m.user.name} (${m.user.rollNumber || 'N/A'})`).join(', '),
                'Member Count': t.members.length,
                'Created At': new Date(t.createdAt).toLocaleDateString()
            }));
            const teamsSheet = XLSX.utils.json_to_sheet(teamsData);
            XLSX.utils.book_append_sheet(workbook, teamsSheet, 'Teams');
        }

        // Sheet 6: Faculty Assignments
        if (sheets.includes('facultyAssignments') && data.facultyAssignments) {
            const assignmentsData = data.facultyAssignments.map(a => ({
                'Faculty': a.faculty?.name || 'N/A',
                'Faculty ID': a.faculty?.rollNumber || 'N/A',
                'Project': a.project?.title || 'N/A',
                'Review Phase': a.reviewPhase || 'N/A',
                'Access Expires': a.accessExpiresAt ? new Date(a.accessExpiresAt).toLocaleString() : 'Permanent',
                'Assigned At': new Date(a.assignedAt).toLocaleDateString()
            }));
            const assignmentsSheet = XLSX.utils.json_to_sheet(assignmentsData);
            XLSX.utils.book_append_sheet(workbook, assignmentsSheet, 'Faculty Assignments');
        }

        // Sheet 7: Review History
        if (sheets.includes('reviewHistory') && data.reviews) {
            const reviewsData = data.reviews.map(r => ({
                'Faculty': r.faculty?.name || 'N/A',
                'Faculty ID': r.faculty?.rollNumber || 'N/A',
                'Project': r.team?.project?.title || 'N/A',
                'Team Members': r.team?.members.map(m => m.user.name).join(', ') || 'N/A',
                'Review Phase': r.reviewPhase || 'N/A',
                'Status': r.status || 'N/A',
                'Feedback': r.content || 'N/A',
                'Completed': r.completedAt ? 'Yes' : 'No',
                'Created At': new Date(r.createdAt).toLocaleString()
            }));
            const reviewsSheet = XLSX.utils.json_to_sheet(reviewsData);
            XLSX.utils.book_append_sheet(workbook, reviewsSheet, 'Review History');
        }

        // Sheet 8: Individual Student Scores
        if (sheets.includes('studentScores') && data.reviews) {
            const scoresData = [];
            data.reviews.forEach(r => {
                if (r.reviewMarks && r.reviewMarks.length > 0) {
                    r.reviewMarks.forEach(mark => {
                        scoresData.push({
                            'Student': mark.student?.name || 'N/A',
                            'Roll Number': mark.student?.rollNumber || 'N/A',
                            'Project': r.team?.project?.title || 'N/A',
                            'Faculty': r.faculty?.name || 'N/A',
                            'Review Phase': r.reviewPhase || 'N/A',
                            'Marks': mark.marks,
                            'Review Date': new Date(r.createdAt).toLocaleDateString()
                        });
                    });
                }
            });
            const scoresSheet = XLSX.utils.json_to_sheet(scoresData.length > 0 ? scoresData : [{ 'Info': 'No scores recorded yet' }]);
            XLSX.utils.book_append_sheet(workbook, scoresSheet, 'Student Scores');
        }

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        const filename = `portal_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        res.send(buffer);
    } catch (e) {
        next(e);
    }
});

// Export Individual Student Statistics with Filters
router.get('/student-stats', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { status, department, year, phase, search, scopeId } = req.query;

        // Determine the number of phases to report on
        let numPhases = 3;
        if (scopeId && scopeId !== 'ALL') {
            const scope = await prisma.projectscope.findUnique({ where: { id: scopeId } });
            if (scope) numPhases = scope.numberOfPhases;
        } else {
            const maxPhasesResult = await prisma.projectscope.aggregate({
                _max: { numberOfPhases: true }
            });
            numPhases = maxPhasesResult._max.numberOfPhases || 4;
        }

        // Fetch all students with their team data
        const students = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            include: {
                scopes: true,
                teamMemberships: {
                    include: {
                        team: {
                            include: {
                                project: true,
                                members: {
                                    where: { approved: true },
                                    include: { user: true }
                                },
                                reviews: {
                                    include: {
                                        faculty: true,
                                        reviewMarks: {
                                            include: { student: true }
                                        }
                                    },
                                    orderBy: { createdAt: 'desc' }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Process students with team and review data
        const processedStudents = students.map(student => {
            const teamMembership = student.teamMemberships[0];
            const team = teamMembership?.team;
            const teamReviews = team?.reviews || [];

            // Calculate phase-specific marks (one per phase)
            const phaseMarksMap = new Map();
            teamReviews.forEach(r => {
                const phase = r.reviewPhase || 1;
                const mark = r.reviewMarks?.find(m => m.studentId === student.id);
                if (mark && mark.marks !== undefined && mark.marks !== null && !phaseMarksMap.has(phase)) {
                    phaseMarksMap.set(phase, mark.marks);
                }
            });

            const studentMarks = Array.from(phaseMarksMap.values());
            const overallScore = studentMarks.length > 0
                ? (studentMarks.reduce((a, b) => a + b, 0) / studentMarks.length).toFixed(1)
                : "-";

            // Get phase completion status
            const getPhaseStatus = (phase) => {
                if (!team?.reviews) return 'NOT_STARTED';
                const phaseReviews = team.reviews.filter(r => r.reviewPhase === phase);
                if (phaseReviews.length === 0) return 'NOT_STARTED';
                const latest = phaseReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                return latest.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';
            };

            return {
                id: student.id,
                name: student.name,
                email: student.email,
                rollNumber: student.rollNumber || 'N/A',
                department: student.department || 'Unassigned',
                year: student.year || 'N/A',
                isInTeam: !!team,
                isLeader: teamMembership?.isLeader || false,
                project: team?.project?.title || 'No Project',
                teamStatus: team?.status || 'N/A',
                overallScore,
                ...Array.from({ length: 10 }, (_, i) => i + 1).reduce((acc, p) => ({
                    ...acc,
                    [`phase${p}`]: getPhaseStatus(p),
                    [`phase${p}Score`]: phaseMarksMap.get(p) || '-'
                }), {}),
                scopeId: team?.scopeId || team?.project?.scopeId || student.scopes?.[0]?.id
            };
        });

        // Apply filters
        const searchLower = search ? search.toLowerCase() : '';
        const filteredStudents = processedStudents.filter(s => {
            const matchesSearch = !search ||
                s.name.toLowerCase().includes(searchLower) ||
                s.email.toLowerCase().includes(searchLower) ||
                s.rollNumber.toLowerCase().includes(searchLower) ||
                s.department.toLowerCase().includes(searchLower);

            const matchesStatus = !status || status === 'ALL' ||
                (status === 'IN_TEAM' && s.isInTeam) ||
                (status === 'NO_TEAM' && !s.isInTeam);

            const matchesDept = !department || department === 'ALL' || s.department === department;

            const matchesYear = !year || year === 'ALL' || String(s.year) === year;

            const matchesPhase = !phase || phase === 'ALL' ||
                (phase.startsWith('P') && s[`phase${phase.substring(1)}`] === 'COMPLETED') ||
                (phase === 'NOT_STARTED' && s.phase1 === 'NOT_STARTED');

            const matchesScope = !scopeId || scopeId === 'ALL' || s.scopeId === scopeId;

            return matchesSearch && matchesStatus && matchesDept && matchesYear && matchesPhase && matchesScope;
        });

        // Create workbook
        const workbook = XLSX.utils.book_new();

        // Prepare data for Excel
        const excelData = filteredStudents.map((s, index) => ({
            'S.No': index + 1,
            'Name': s.name,
            'Roll Number': s.rollNumber,
            'Email': s.email,
            'Department': s.department,
            'Year': s.year,
            'Team Status': s.isInTeam ? s.teamStatus : 'No Team',
            'Project': s.project,
            'Role': s.isInTeam ? (s.isLeader ? 'Leader' : 'Member') : '-',
            'Overall Score': s.overallScore,
            ...Array.from({ length: numPhases }, (_, i) => i + 1).reduce((acc, p) => ({
                ...acc,
                [`Phase ${p} Status`]: s[`phase${p}`],
                [`Phase ${p} Score`]: s[`phase${p}Score`]
            }), {})
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData.length > 0 ? excelData : [{ 'Info': 'No students match the selected filters' }]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Statistics');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        const filterSuffix = [status, department, year, phase].filter(f => f && f !== 'ALL').join('_') || 'all';
        const filename = `student_statistics_${filterSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        res.send(buffer);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
