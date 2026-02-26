const fs = require('fs');
const prisma = require('../utils/prisma');

async function main() {
    const rollNumber = '7376231MZ121';
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    const user = await prisma.user.findUnique({
        where: { rollNumber },
        include: {
            teamMemberships: {
                include: {
                    team: {
                        include: {
                            project: true,
                            reviews: {
                                include: {
                                    reviewMarks: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!user) {
        log(`ERROR: User ${rollNumber} not found`);
        return;
    }

    log(`USER: ${user.name} (${user.rollNumber})`);

    // Explicit Absences
    const explicitAbsences = await prisma.reviewmark.findMany({
        where: { studentId: user.id, isAbsent: true },
        include: { review: true }
    });

    explicitAbsences.forEach(a => {
        log(`EXPLICIT_ABSENT: Phase ${a.review.reviewPhase}, ReviewID ${a.review.id}`);
    });

    // Implicit Absences (Missed Deadlines)
    for (const membership of user.teamMemberships) {
        const team = membership.team;
        if (!team.project) continue;

        log(`TEAM: ${team.id} (${team.project.title})`);

        const assignments = await prisma.reviewassignment.findMany({
            where: { projectId: team.projectId }
        });

        const now = new Date();
        for (const assignment of assignments) {
            const hasReview = team.reviews.some(r => r.reviewPhase === assignment.reviewPhase);
            const isExpired = assignment.accessExpiresAt && new Date(assignment.accessExpiresAt) < now;

            if (!hasReview && isExpired) {
                log(`IMPLICIT_ABSENT: Phase ${assignment.reviewPhase} (Deadline: ${assignment.accessExpiresAt})`);
            } else {
                log(`STATUS: Phase ${assignment.reviewPhase}, HasReview=${hasReview}, Expired=${isExpired}`);
            }
        }
    }

    fs.writeFileSync('result.txt', output);
}

main()
    .catch(e => {
        console.error(e);
        fs.writeFileSync('result.txt', e.stack);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

