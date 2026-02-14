
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Faculty Requests Query...");

        // We need a faculty user ID to test properly, but we can just check if the query structure is valid
        // by running a findFirst on Team with the include structure.

        const team = await prisma.team.findFirst({
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

        console.log("Team query successful. Found:", team ? "Yes" : "No");

    } catch (e) {
        console.error("Error fetching faculty requests:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
