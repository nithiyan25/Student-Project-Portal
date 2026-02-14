const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const filePath = process.argv[2];
    const scopeName = process.argv[3] || 'mini project';

    if (!filePath) {
        console.error('Please provide the path to the Excel/CSV file. Usage: node scripts/bulk_add_projects.js path/to/file.xlsx ["scope name"]');
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
        console.log('No data found in the file.');
        return;
    }

    console.log(`Found ${data.length} rows. Starting incremental import to scope: "${scopeName}"...`);

    // 1. Find scope
    const scope = await prisma.projectscope.findFirst({
        where: { name: scopeName }
    });

    if (!scope) {
        console.error(`Scope "${scopeName}" not found! Please ensure the scope exists first.`);
        process.exit(1);
    }

    // Load existing project titles to prevent duplicates (Efficient check)
    console.log('Loading existing projects for duplicate check...');
    const existingProjects = await prisma.project.findMany({
        where: { scopeId: scope.id },
        select: { title: true }
    });
    const dbTitles = new Set(existingProjects.map(p => p.title.toLowerCase().trim()));
    const seenInFile = new Set();

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

    let projectsCreated = 0;
    let projectsSkipped = 0;

    for (const row of data) {
        const title = getVal(row, 'title', 'project', 'projecttitle')?.toString().trim();
        if (!title) {
            console.warn('Skipping row without title.');
            continue;
        }

        const normalizedTitle = title.toLowerCase().trim();

        // 2. Uniqueness Check (DB and internal file)
        if (dbTitles.has(normalizedTitle) || seenInFile.has(normalizedTitle)) {
            projectsSkipped++;
            continue;
        }

        seenInFile.add(normalizedTitle);

        // 3. Create Project
        try {
            await prisma.project.create({
                data: {
                    title: title,
                    category: getVal(row, 'category', 'type') || 'General',
                    maxTeamSize: parseInt(getVal(row, 'maxteamsize', 'size', 'teamsize')) || 4,
                    status: (getVal(row, 'status') || 'AVAILABLE').toUpperCase(),
                    session: getVal(row, 'session')?.toString() || null,
                    description: getVal(row, 'description', 'desc', 'abstract') || 'Imported project',
                    techStack: getVal(row, 'techstack', 'technology', 'stack') || null,
                    srs: getVal(row, 'srs', 'document', 'srslink') || null,
                    scopeId: scope.id
                }
            });
            console.log(`Added: ${title}`);
            projectsCreated++;
        } catch (e) {
            console.error(`Error adding project ${title}:`, e.message);
        }
    }

    console.log('-----------------------------------');
    console.log('Incremental Import Complete!');
    console.log(`New Projects Added: ${projectsCreated}`);
    console.log(`Duplicates Skipped: ${projectsSkipped}`);
    console.log('-----------------------------------');
}

main()
    .catch(e => {
        console.error('Error during import:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
