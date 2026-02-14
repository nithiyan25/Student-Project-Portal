const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Please provide the path to the Excel file. Usage: node scripts/update_projects.js path/to/file.xlsx');
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

    console.log(`Found ${data.length} rows. Updating project metadata...`);

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

    let projectsUpdated = 0;
    let projectsSkipped = 0;

    for (const row of data) {
        const title = getVal(row, 'title', 'project', 'projecttitle');
        if (!title) {
            console.warn('Skipping row without title.');
            continue;
        }

        // Clean up data
        const updateData = {
            category: getVal(row, 'category', 'type') || 'General',
            maxTeamSize: parseInt(getVal(row, 'maxteamsize', 'size', 'teamsize')) || 4,
            status: (getVal(row, 'status') || 'AVAILABLE').toUpperCase(),
            session: getVal(row, 'session')?.toString() || null,
            description: getVal(row, 'description', 'desc', 'abstract') || null,
            techStack: getVal(row, 'techstack', 'technology', 'stack') || null,
            srs: getVal(row, 'srs', 'document', 'srslink') || null
        };

        try {
            const result = await prisma.project.updateMany({
                where: { title: { equals: title.trim() } },
                data: updateData
            });

            if (result.count > 0) {
                console.log(`Updated project: ${title}`);
                projectsUpdated++;
            } else {
                console.warn(`Project not found in DB: ${title}`);
                projectsSkipped++;
            }
        } catch (e) {
            console.error(`Error updating project ${title}:`, e.message);
        }
    }

    console.log('-----------------------------------');
    console.log('Update Complete!');
    console.log(`Projects Updated: ${projectsUpdated}`);
    console.log(`Projects Not Found: ${projectsSkipped}`);
    console.log('-----------------------------------');
}

main()
    .catch(e => {
        console.error('Error during script execution:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
