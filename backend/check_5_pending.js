const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- Targeted Diagnostic: checking 5 PENDING teams ---');
    const teams = await prisma.team.findMany({
        where: { status: 'PENDING' },
        select: {
            id: true,
            scopeId: true,
            status: true,
            members: {
                select: {
                    user: {
                        select: { name: true, rollNumber: true }
                    }
                }
            },
            reviews: {
                select: {
                    id: true,
                    status: true,
                    reviewMarks: true
                }
            }
        }
    });

    console.log(`Found ${teams.length} teams with status=PENDING`);

    for (const t of teams) {
        const student = t.members[0]?.user;
        const studentName = student ? `${student.name} (${student.rollNumber})` : 'No Student';

        let totalMarks = 0;
        t.reviews.forEach(r => {
            r.reviewMarks.forEach(m => {
                if (t.members.some(mem => mem.user.id === m.studentId)) {
                    // This is a bit simplified, but let's just see if marks exist
                }
            });
            totalMarks += r.reviewMarks.length;
        });

        console.log(`Team ${t.id}: Scope=${t.scopeId}, Student=${studentName}, ReviewsCount=${t.reviews.length}, TotalMarksEntries=${totalMarks}`);
    }
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
