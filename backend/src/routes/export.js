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
        const validSheets = ['students', 'faculty', 'admins', 'projects', 'teams', 'facultyAssignments', 'reviewHistory', 'studentScores', 'venueSchedule'];
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

        if (sheets.includes('venueSchedule')) {
            fetchPromises.push(prisma.labsession.findMany({
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
                                            project: { select: { title: true, category: true } }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    projectscope: { select: { id: true, name: true } }
                },
                orderBy: { startTime: 'asc' }
            }));
            dataKeys.push('venueSchedule');
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

        // Sheet 9: Venue Schedule
        if (sheets.includes('venueSchedule') && data.venueSchedule) {
            const venueData = [];
            data.venueSchedule.forEach(session => {
                session.user_sessionstudents?.forEach(student => {
                    const project = student.teamMemberships?.[0]?.team?.project;
                    venueData.push({
                        'Date': new Date(session.startTime).toLocaleDateString(),
                        'Start Time': new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        'End Time': new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        'Venue': session.venue?.name || 'N/A',
                        'Location': session.venue?.location || 'N/A',
                        'Faculty': session.user_labsession_facultyIdTouser?.name || 'N/A',
                        'Faculty ID': session.user_labsession_facultyIdTouser?.rollNumber || 'N/A',
                        'Scope': session.projectscope?.name || 'N/A',
                        'Student Name': student.name,
                        'Student Roll': student.rollNumber || 'N/A',
                        'Student Email': student.email,
                        'Project Title': project?.title || 'No Project',
                        'Project Category': project?.category || 'N/A'
                    });
                });
            });
            const venueSheet = XLSX.utils.json_to_sheet(venueData.length > 0 ? venueData : [{ 'Info': 'No venue schedules found' }]);
            XLSX.utils.book_append_sheet(workbook, venueSheet, 'Venue Schedule');
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
        console.log('[Export] student-stats route HIT', req.query);
        const { status, department, year, phase, assignment, search, scopeId, facultySearch } = req.query;

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
            const studentTeams = student.teamMemberships.map(tm => tm.team);

            // Prioritize the team matching the batch filter (scopeId)
            let selectedTeam = null;
            if (scopeId && scopeId !== 'ALL') {
                selectedTeam = studentTeams.find(t => t.scopeId === scopeId || t.project?.scopeId === scopeId);
            }

            // If no match or ALL, pick the most recent
            if (!selectedTeam && studentTeams.length > 0) {
                selectedTeam = studentTeams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
            }

            const teamMembership = student.teamMemberships.find(tm => tm.teamId === selectedTeam?.id);
            const team = selectedTeam;
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

            // Collect team members info
            const teamMembers = (team?.members || []).map(m => ({
                name: m.user?.name || 'N/A',
                rollNumber: m.user?.rollNumber || 'N/A'
            }));

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
                projectDescription: team?.project?.description || '',
                teamStatus: team?.status || 'N/A',
                teamMembers,
                overallScore,
                ...Array.from({ length: 10 }, (_, i) => i + 1).reduce((acc, p) => ({
                    ...acc,
                    [`phase${p}`]: getPhaseStatus(p),
                    [`phase${p}Score`]: phaseMarksMap.get(p) || '-'
                }), {}),
                scopeId: team?.scopeId || team?.project?.scopeId || student.scopes?.[0]?.id,
                teamReviews // Pass teamReviews for filtering
            };
        });

        // Apply filters
        const searchLower = search ? search.toLowerCase() : '';
        const facultySearchLower = facultySearch ? facultySearch.toLowerCase() : '';

        const filteredStudents = processedStudents.filter(s => {
            const matchesSearch = !search ||
                s.name.toLowerCase().includes(searchLower) ||
                s.email.toLowerCase().includes(searchLower) ||
                (s.rollNumber && s.rollNumber.toLowerCase().includes(searchLower)) ||
                (s.department && s.department.toLowerCase().includes(searchLower)) ||
                (s.project && s.project.toLowerCase().includes(searchLower)) ||
                (s.projectDescription && s.projectDescription.toLowerCase().includes(searchLower));

            // Faculty Filter - check if any review in this student's team was given by the searched faculty
            const matchesFaculty = !facultySearch || (s.teamReviews || []).some(r =>
                r.faculty?.name?.toLowerCase().includes(facultySearchLower)
            );

            const matchesStatus = !status || status === 'ALL' ||
                (status === 'IN_TEAM' && s.isInTeam) ||
                (status === 'NO_TEAM' && !s.isInTeam);

            const matchesDept = !department || department === 'ALL' || s.department === department;

            const matchesYear = !year || year === 'ALL' || String(s.year) === year;

            const isANC = Array.from({ length: 10 }, (_, i) => i + 1).some(p => s[`phase${p}`] === 'IN_PROGRESS');

            const matchesPhase = !phase || phase === 'ALL' ||
                (phase.startsWith('P') && (s[`phase${phase.substring(1)}`] === 'COMPLETED' || s[`phase${phase.substring(1)}`] === 'IN_PROGRESS')) ||
                (phase === 'NOT_STARTED' && s.phase1 === 'NOT_STARTED' && !isANC);

            const matchesAssignment = !assignment || assignment === 'ALL' ||
                (assignment === 'ASSIGNED' && isANC) ||
                (assignment === 'NOT_ASSIGNED' && !isANC);

            const matchesScope = !scopeId || scopeId === 'ALL' || s.scopeId === scopeId;

            return matchesSearch && matchesFaculty && matchesStatus && matchesDept && matchesYear && matchesPhase && matchesAssignment && matchesScope;
        });

        console.log(`[Export Debug] Total students fetched: ${students.length}, Processed: ${processedStudents.length}, After filters: ${filteredStudents.length}`);
        console.log(`[Export Debug] Filters: status=${status}, department=${department}, year=${year}, phase=${phase}, assignment=${assignment}, scopeId=${scopeId}, search=${search}, facultySearch=${facultySearch}`);

        // Create workbook
        const workbook = XLSX.utils.book_new();

        // Determine max team size for dynamic member columns
        const maxTeamMembers = Math.max(1, ...filteredStudents.map(s => (s.teamMembers || []).length));

        // Prepare data for Excel
        const excelData = filteredStudents.map((s, index) => {
            // Build dynamic member columns
            const memberCols = {};
            for (let i = 0; i < maxTeamMembers; i++) {
                const member = s.teamMembers?.[i];
                memberCols[`Member ${i + 1} Name`] = member?.name || '';
                memberCols[`Member ${i + 1} Roll`] = member?.rollNumber || '';
            }

            return {
                'S.No': index + 1,
                'Name': s.name,
                'Roll Number': s.rollNumber,
                'Email': s.email,
                'Department': s.department,
                'Year': s.year,
                'Team Status': s.isInTeam ? s.teamStatus : 'No Team',
                'Project': s.project,
                'Project Description': s.projectDescription,
                'Role': s.isInTeam ? (s.isLeader ? 'Leader' : 'Member') : '-',
                ...memberCols,
                'Overall Score': s.overallScore,
                ...Array.from({ length: numPhases }, (_, i) => i + 1).reduce((acc, p) => ({
                    ...acc,
                    [`Phase ${p} Status`]: s[`phase${p}`],
                    [`Phase ${p} Score`]: s[`phase${p}Score`]
                }), {})
            };
        });

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

// Export Projects with Filters
router.get('/projects', authenticate, authorize(['ADMIN']), async (req, res, next) => {
    try {
        const { status, scopeId, category, search, hasSRS } = req.query;

        const where = {};
        if (status && status !== 'ALL') where.status = status;
        if (scopeId && scopeId !== 'ALL') where.scopeId = scopeId;
        if (category && category !== 'ALL') where.category = category;

        if (hasSRS === 'true' || hasSRS === 'HAS_SRS') {
            where.AND = [
                ...(where.AND || []),
                { srs: { not: null } },
                { srs: { not: "" } }
            ];
        } else if (hasSRS === 'false' || hasSRS === 'NO_SRS') {
            where.OR = [
                { srs: null },
                { srs: "" }
            ];
        }

        if (search) {
            where.OR = [
                ...(where.OR || []),
                { title: { contains: search } },
                { description: { contains: search } },
                { category: { contains: search } },
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

        const projects = await prisma.project.findMany({
            where,
            include: {
                scope: true,
                teams: {
                    include: {
                        members: {
                            include: { user: true }
                        }
                    }
                }
            },
            orderBy: { title: 'asc' }
        });

        const workbook = XLSX.utils.book_new();
        const projectsData = projects.map(p => ({
            'Title': p.title,
            'Tech Stack': p.techStack || 'N/A',
            'SRS Document': p.srs || 'N/A',
            'Category': p.category,
            'Size': p.maxTeamSize,
            'Scope': p.scope?.name || 'General',
            'Status': p.status,
            'Assigned To': p.teams.flatMap(t => t.members.map(m => `${m.user.name} (${m.user.rollNumber || 'N/A'})`)).join(', ') || 'Unassigned'
        }));

        const worksheet = XLSX.utils.json_to_sheet(projectsData.length > 0 ? projectsData : [{ 'Info': 'No projects found' }]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const filename = `projects_export_${new Date().toISOString().split('T')[0]}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
