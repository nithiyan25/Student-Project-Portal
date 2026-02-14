const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testGroupByWithRelation() {
    console.log('Testing groupBy with relation filter...');
    try {
        const result = await prisma.team.groupBy({
            by: ['status'],
            where: {
                members: {
                    some: {
                        user: {
                            department: 'CS'
                        }
                    }
                }
            },
            _count: { _all: true }
        });
        console.log('Result:', result);
    } catch (e) {
        console.error('ERROR DETECTED:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

testGroupByWithRelation();
