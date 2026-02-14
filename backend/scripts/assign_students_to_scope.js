const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Finding "mini project" scope...');
    const scope = await prisma.projectscope.findFirst({
        where: { name: 'mini project' }
    });

    if (!scope) {
        console.error('Scope "mini project" not found! Please run the restoration script first.');
        return;
    }

    console.log('Finding all students...');
    const students = await prisma.user.findMany({
        where: {
            role: 'STUDENT'
        },
        select: { id: true }
    });

    if (students.length === 0) {
        console.log('No students found to assign.');
        return;
    }

    console.log(`Found ${students.length} students. Assigning to "mini project" scope...`);

    // Prisma connect handles the many-to-many relationship
    await prisma.projectscope.update({
        where: { id: scope.id },
        data: {
            students: {
                connect: students.map(s => ({ id: s.id }))
            }
        }
    });

    console.log('-----------------------------------');
    console.log('Assignment Complete!');
    console.log(`${students.length} students are now assigned to "mini project".`);
    console.log('-----------------------------------');
}

main()
    .catch(e => {
        console.error('Error during assignment:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
