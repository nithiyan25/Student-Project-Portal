const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Please provide the path to the Excel file. Usage: node scripts/restore_from_excel.js path/to/file.xlsx');
        process.exit(1);
    }

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
    }

    console.log(`Reading file: ${absolutePath}`);
    const workbook = XLSX.readFile(absolutePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
        console.log('No data found in the Excel file.');
        return;
    }

    console.log(`Found ${data.length} rows. Starting restoration...`);

    // 1. Ensure "mini project" scope exists
    let scope = await prisma.projectscope.findFirst({
        where: { name: 'mini project' }
    });

    if (!scope) {
        console.log('Creating "mini project" scope...');
        scope = await prisma.projectscope.create({
            data: {
                name: 'mini project',
                description: 'Restored from Excel data',
                updatedAt: new Date()
            }
        });
    }

    // Helper to find column value by loose name
    const getVal = (row, ...names) => {
        const keys = Object.keys(row);
        for (const name of names) {
            const cleanName = name.toLowerCase().replace(/[\s_]/g, '');
            const key = keys.find(k => k.toLowerCase().replace(/[\s_]/g, '') === cleanName);
            if (key) return row[key];
        }
        return null;
    };

    // Group rows by project title
    const projectGroups = {};
    data.forEach(row => {
        const projectTitle = getVal(row, 'project', 'title') || 'Unassigned Project';
        if (!projectGroups[projectTitle]) {
            projectGroups[projectTitle] = [];
        }
        projectGroups[projectTitle].push(row);
    });

    let projectsCreated = 0;
    let usersCreated = 0;
    let teamsCreated = 0;

    for (const [title, members] of Object.entries(projectGroups)) {
        console.log(`Processing project: ${title} (${members.length} members)`);

        // 2. Create Project
        const project = await prisma.project.create({
            data: {
                title: title,
                category: 'General',
                maxTeamSize: Math.max(members.length, 3),
                status: 'ASSIGNED',
                scopeId: scope.id,
                description: 'Restored from Excel'
            }
        });
        projectsCreated++;

        // 3. Create Team
        const team = await prisma.team.create({
            data: {
                projectId: project.id,
                scopeId: scope.id,
                status: 'APPROVED'
            }
        });
        teamsCreated++;

        // 4. Create Users and Team Members
        for (let i = 0; i < members.length; i++) {
            const m = members[i];
            const email = getVal(m, 'email')?.toString().trim();
            if (!email) {
                console.warn(`Skipping student without email: ${getVal(m, 'name', 'student')}`);
                continue;
            }

            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        name: getVal(m, 'name', 'student', 'studentname') || 'Unknown Student',
                        rollNumber: getVal(m, 'rollnumber', 'roll', 'id')?.toString().trim() || null,
                        department: getVal(m, 'department', 'dept')?.toString() || null,
                        year: parseInt(getVal(m, 'year')) || null,
                        role: 'STUDENT'
                    }
                });
                usersCreated++;
            }

            await prisma.teammember.create({
                data: {
                    userId: user.id,
                    teamId: team.id,
                    approved: true,
                    isLeader: i === 0 // First student in list becomes leader
                }
            });
        }
    }

    console.log('-----------------------------------');
    console.log('Restoration Complete!');
    console.log(`Projects Created: ${projectsCreated}`);
    console.log(`Users Created/Found: ${usersCreated}`);
    console.log(`Teams Created: ${teamsCreated}`);
    console.log('-----------------------------------');
}

main()
    .catch(e => {
        console.error('Error during restoration:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
