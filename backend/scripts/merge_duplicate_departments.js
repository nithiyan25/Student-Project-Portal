const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mapping of duplicate department names to their canonical (normalized) names
const departmentMappings = {
    // Case variations - normalize to Title Case
    'AGRICULTURAL ENGINEERING': 'Agricultural Engineering',
    'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE': 'Artificial Intelligence and Data Science',
    'ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING': 'Artificial Intelligence and Machine Learning',
    'BIOMEDICAL ENGINEERING': 'Biomedical Engineering',
    'BIOTECHNOLOGY': 'Biotechnology',
    'COMPUTER SCIENCE AND BUSINESS SYSTEMS': 'Computer Science and Business Systems',
    'COMPUTER SCIENCE AND DESIGN': 'Computer Science and Design',
    'COMPUTER SCIENCE AND ENGINEERING': 'Computer Science and Engineering',
    'COMPUTER TECHNOLOGY': 'Computer Technology',
    'ELECTRICAL AND ELECTRONICS ENGINEERING': 'Electrical and Electronics Engineering',
    'ELECTRONICS AND COMMUNICATION ENGINEERING': 'Electronics and Communication Engineering',
    'ELECTRONICS AND INSTRUMENTATION ENGINEERING': 'Electronics and Instrumentation Engineering',
    'INFORMATION SCIENCE AND ENGINEERING': 'Information Science and Engineering',
    'INFORMATION TECHNOLOGY': 'Information Technology',
    'MECHANICAL ENGINEERING': 'Mechanical Engineering',
    'MECHATRONICS ENGINEERING': 'Mechatronics',
    // Typo corrections
    'Artifical Intelligence and Data Science': 'Artificial Intelligence and Data Science',
    'Artifical Intelligence and Machine Learning': 'Artificial Intelligence and Machine Learning',
};

async function main() {
    console.log('===========================================');
    console.log('Merging Duplicate Departments');
    console.log('===========================================\n');

    // First, let's see what departments exist
    console.log('Fetching current department distribution...\n');
    const departments = await prisma.user.groupBy({
        by: ['department'],
        _count: { id: true },
        orderBy: { department: 'asc' }
    });

    console.log('Current departments:');
    departments.forEach(d => {
        console.log(`  - "${d.department}": ${d._count.id} users`);
    });
    console.log('');

    // Process each mapping
    let totalUpdated = 0;
    for (const [oldName, newName] of Object.entries(departmentMappings)) {
        const result = await prisma.user.updateMany({
            where: { department: oldName },
            data: { department: newName }
        });

        if (result.count > 0) {
            console.log(`Updated ${result.count} users: "${oldName}" → "${newName}"`);
            totalUpdated += result.count;
        }
    }

    console.log('');
    console.log('===========================================');
    console.log(`Total users updated: ${totalUpdated}`);
    console.log('===========================================\n');

    // Show final department distribution
    console.log('Final department distribution:\n');
    const finalDepartments = await prisma.user.groupBy({
        by: ['department'],
        _count: { id: true },
        orderBy: { department: 'asc' }
    });

    finalDepartments.forEach(d => {
        console.log(`  - "${d.department}": ${d._count.id} users`);
    });
    console.log('');
}

main()
    .catch(e => {
        console.error('Error during merge:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
