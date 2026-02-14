const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    const departments = await prisma.user.groupBy({
        by: ['department'],
        _count: { id: true },
        orderBy: { department: 'asc' }
    });

    console.log('Current Departments After Merge:');
    console.log('================================');
    departments.forEach(d => {
        console.log(`${d.department}: ${d._count.id} users`);
    });
    console.log('================================');
    console.log(`Total unique departments: ${departments.length}`);

    await prisma.$disconnect();
}

verify();
