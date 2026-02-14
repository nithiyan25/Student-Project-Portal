
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing LabSession Scope Relation...");

        // Test 'scope' (Current Code - EXPECTED TO FAIL)
        try {
            await prisma.labsession.findMany({
                take: 1,
                include: {
                    scope: true
                }
            });
            console.log("SUCCESS: 'scope' field exists.");
        } catch (e) {
            console.log("FAILURE: 'scope' field failed.");
        }

        // Test 'projectscope' (Schema Name - EXPECTED TO PASS)
        try {
            await prisma.labsession.findMany({
                take: 1,
                include: {
                    projectscope: true
                }
            });
            console.log("SUCCESS: 'projectscope' field exists.");
        } catch (e) {
            console.log("FAILURE: 'projectscope' field failed.");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
