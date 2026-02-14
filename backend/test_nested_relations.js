
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Venue Sessions Nested Relations...");

        // Step 1: teamMemberships
        console.log("Step 1: user_sessionstudents -> teamMemberships");
        await prisma.labsession.findMany({
            take: 1,
            include: {
                user_sessionstudents: {
                    select: {
                        id: true,
                        teamMemberships: {
                            where: { approved: true } // just checking relation validity
                        }
                    }
                }
            }
        });
        console.log("Step 1 Passed.");

        // Step 2: teamMemberships -> team -> project
        console.log("Step 2: ... -> team -> project");
        await prisma.labsession.findMany({
            take: 1,
            include: {
                user_sessionstudents: {
                    select: {
                        id: true,
                        teamMemberships: {
                            include: {
                                team: {
                                    include: { project: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        console.log("Step 2 Passed.");

        // Step 3: ... -> reviews
        console.log("Step 3: ... -> reviews");
        await prisma.labsession.findMany({
            take: 1,
            include: {
                user_sessionstudents: {
                    select: {
                        id: true,
                        teamMemberships: {
                            include: {
                                team: {
                                    include: {
                                        reviews: {
                                            select: {
                                                reviewPhase: true
                                                // reviewMarks: true // Commented out for now
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        console.log("Step 3 Passed.");

        // Step 4: ... -> reviews -> reviewMarks
        console.log("Step 4: ... -> reviews -> reviewMarks");
        await prisma.labsession.findMany({
            take: 1,
            include: {
                user_sessionstudents: {
                    select: {
                        id: true,
                        teamMemberships: {
                            include: {
                                team: {
                                    include: {
                                        reviews: {
                                            select: {
                                                reviewPhase: true,
                                                reviewMarks: { // This is the suspected one
                                                    select: { studentId: true, marks: true }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        console.log("Step 4 Passed.");

    } catch (e) {
        console.error("Error at step:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
