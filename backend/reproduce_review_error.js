
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Review Assignments Query (Fix Verification)...");

        // Minimal query with CORRCT field name
        const teams = await prisma.team.findMany({
            take: 1,
            include: {
                members: {
                    include: {
                        user: {
                            include: {
                                labsession_sessionstudents: {
                                    take: 1
                                }
                            }
                        }
                    }
                }
            }
        });

        console.log("Teams found:", teams.length);
    } catch (e) {
        console.error("Error fetching teams:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
