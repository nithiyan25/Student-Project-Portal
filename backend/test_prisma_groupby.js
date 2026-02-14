const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testGroupBy() {
    console.log('Testing groupBy with status...');
    try {
        // 1. Simple groupBy
        console.log('Attempting simple groupBy...');
        const result1 = await prisma.team.groupBy({
            by: ['status'],
            _count: { _all: true }
        });
        console.log('Simple Result:', JSON.stringify(result1, null, 2));

        // 2. groupBy with empty AND (Admin status ALL case)
        console.log('Attempting groupBy with empty AND...');
        const result2 = await prisma.team.groupBy({
            by: ['status'],
            where: { AND: [] },
            _count: { _all: true }
        });
        console.log('Empty AND Result:', JSON.stringify(result2, null, 2));

        // 3. Test if accessing counts as I did would fail
        const readyCount = result1.find(c => c.status === 'READY_FOR_REVIEW')?._count._all || 0;
        console.log('Ready for Review count access check:', readyCount);

    } catch (e) {
        console.error('FAILED:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testGroupBy();
