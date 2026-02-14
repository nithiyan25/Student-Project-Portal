
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Simple Relation...");

        // Test just the relation
        const sessions = await prisma.labsession.findMany({
            take: 1,
            include: {
                user_sessionstudents: true
            }
        });

        console.log("Sessions found:", sessions.length);
    } catch (e) {
        console.error("Error fetching sessions:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
