const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSearchQuery() {
    console.log('--- Testing Search Query Logic ---');

    const search = 'KOVARSHINI';
    const conditions = [
        {
            OR: [
                { project: { title: { contains: search } } },
                { members: { some: { user: { name: { contains: search } } } } },
                { members: { some: { user: { rollNumber: { contains: search } } } } }
            ]
        }
    ];

    const where = { AND: conditions };
    console.log('Testing findMany with search...');
    try {
        const teams = await prisma.team.findMany({
            where,
            take: 5
        });
        console.log('findMany success, found:', teams.length);
    } catch (e) {
        console.error('findMany FAILED:', e.message);
    }

    console.log('\nTesting groupBy with search...');
    try {
        const statusCounts = await prisma.team.groupBy({
            by: ['status'],
            where,
            _count: { _all: true }
        });
        console.log('groupBy success:', JSON.stringify(statusCounts));
    } catch (e) {
        console.error('groupBy FAILED:', e.message);
    }

    await prisma.$disconnect();
}

testSearchQuery();
