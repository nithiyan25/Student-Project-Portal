
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing LabSession Scope Relation (Verbose)...");

        // Test 'scope'
        try {
            const s1 = await prisma.labsession.findMany({
                take: 1,
                include: {
                    scope: true
                }
            });
            console.log("scope query RESULT:", s1.length);
        } catch (e) {
            console.log("scope query FAILED:", e.message.split('\n')[0]);
        }

        // Test 'projectscope'
        try {
            const s2 = await prisma.labsession.findMany({
                take: 1,
                include: {
                    projectscope: true
                }
            });
            console.log("projectscope query RESULT:", s2.length);
        } catch (e) {
            console.log("projectscope query FAILED:", e.message.split('\n')[0]);
        }

    } catch (e) {
        console.error("Global Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
