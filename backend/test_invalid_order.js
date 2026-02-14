const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testInvalidOrder() {
    console.log('Testing orderBy on non-existent updatedAt field in team...');
    try {
        const teams = await prisma.team.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        console.log('Found:', teams.length);
    } catch (e) {
        console.error('ERROR CONFIRMED:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testInvalidOrder();
