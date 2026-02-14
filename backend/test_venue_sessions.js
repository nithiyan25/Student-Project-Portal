
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Venue Sessions Query (Fix Verification)...");

        // Check if prisma.labsession exists
        if (!prisma.labsession) {
            console.error("prisma.labsession is undefined!");
            if (prisma.labSession) console.log("BUT prisma.labSession exists!");
            else console.log("Neither labsession nor labSession exists on prisma client.");
            return;
        }

        // Test with correct model accessor and field name
        const sessions = await prisma.labsession.findMany({
            take: 1,
            include: {
                user_sessionstudents: true // corrected field name
            }
        });

        console.log("Sessions found:", sessions.length);
        if (sessions.length > 0) {
            console.log("First session students count:", sessions[0].user_sessionstudents ? sessions[0].user_sessionstudents.length : 0);
        }
    } catch (e) {
        console.error("Error fetching sessions:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
