
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Venue Sessions Query (Full Fix Verification)...");

        // Simulate the query in venue.js with ALL fixed names
        const sessions = await prisma.labsession.findMany({
            include: {
                venue: true,
                user_labsession_facultyIdTouser: { select: { id: true, name: true, email: true, rollNumber: true } },
                user_sessionstudents: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        rollNumber: true,
                        teamMemberships: {
                            where: { approved: true },
                            include: {
                                team: {
                                    include: {
                                        project: true,
                                        reviews: {
                                            where: { status: 'COMPLETED' },
                                            select: {
                                                reviewPhase: true,
                                                reviewMarks: {
                                                    select: { studentId: true, marks: true, criterionMarks: true, isAbsent: true }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                projectscope: { select: { id: true, name: true } }
            },
            orderBy: { startTime: 'asc' }
        });

        console.log("Full session query SUCCESS. Found:", sessions.length);

    } catch (e) {
        console.log("Full session query FAILED:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
