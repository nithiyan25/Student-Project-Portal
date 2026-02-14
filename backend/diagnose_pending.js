const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Diagnostic: Checking Student Review Status ---');

    // Get all students
    const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        include: {
            teamMemberships: {
                include: {
                    team: {
                        include: {
                            reviews: {
                                include: {
                                    reviewMarks: true
                                },
                                orderBy: { createdAt: 'desc' }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log(`Total Students: ${students.length}`);

    let pendingCount = 0;
    let completedCount = 0;
    const pendingStudents = [];

    students.forEach(student => {
        const team = student.teamMemberships[0]?.team;
        if (!team) return;

        const latestReview = team.reviews[0]; // Most recent review
        if (!latestReview) return;

        const marksForThisStudent = latestReview.reviewMarks.find(m => m.studentId === student.id);
        const hasMarks = marksForThisStudent !== undefined;
        const isCompleted = latestReview.status === 'COMPLETED';

        if (isCompleted) {
            completedCount++;
        } else {
            pendingCount++;
            pendingStudents.push({
                id: student.id,
                name: student.name,
                rollNumber: student.rollNumber,
                status: latestReview.status,
                hasMarks: hasMarks,
                marks: marksForThisStudent?.marks
            });
        }
    });

    console.log(`Finished Reviews (COMPLETED): ${completedCount}`);
    console.log(`Pending Reviews (NOT COMPLETED): ${pendingCount}`);

    if (pendingStudents.length > 0) {
        console.log('\n--- Details of Pending Students ---');
        pendingStudents.forEach(s => {
            console.log(`[${s.rollNumber}] ${s.name}: Status=${s.status}, HasMarks=${s.hasMarks}, Marks=${s.marks}`);
        });
    }

    console.log('\n--- End of Diagnostic ---');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
