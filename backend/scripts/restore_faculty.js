const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Please provide the path to the Excel file. Usage: node scripts/restore_faculty.js path/to/file.xlsx');
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

    console.log(`Found ${data.length} rows. Starting faculty restoration...`);

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

    let facultyCreated = 0;
    let facultyUpdated = 0;

    for (const row of data) {
        const email = getVal(row, 'email')?.toString().trim();
        if (!email) {
            console.warn(`Skipping faculty without email: ${getVal(row, 'name', 'faculty')}`);
            continue;
        }

        const name = getVal(row, 'name', 'facultyname', 'faculty') || 'Unknown Faculty';
        const rollNumber = getVal(row, 'facultyid', 'id', 'faculty_id')?.toString().trim() || null;

        const userData = {
            email,
            name,
            rollNumber,
            role: 'FACULTY'
        };

        try {
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                await prisma.user.update({
                    where: { email },
                    data: { ...userData, role: existingUser.role === 'ADMIN' ? 'ADMIN' : 'FACULTY' }
                });
                console.log(`Updated faculty: ${email}`);
                facultyUpdated++;
            } else {
                await prisma.user.create({ data: userData });
                console.log(`Created faculty: ${email}`);
                facultyCreated++;
            }
        } catch (e) {
            console.error(`Error processing faculty ${email}:`, e.message);
        }
    }

    console.log('-----------------------------------');
    console.log('Faculty Restoration Complete!');
    console.log(`Faculty Created: ${facultyCreated}`);
    console.log(`Faculty Updated: ${facultyUpdated}`);
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
