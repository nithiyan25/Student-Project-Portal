const prisma = require('./src/utils/prisma');
const fs = require('fs');

async function exhaustiveCheck() {
    const rollNo = '7376231CS253';
    const now = new Date();
    let out = "";

    try {
        const user = await prisma.user.findUnique({
            where: { rollNumber: rollNo },
            include: {
                teamMemberships: {
                    include: {
                        team: {
                            include: {
                                project: true,
                                reviews: { include: { faculty: true } },
                                members: { include: { user: true } }
                            }
                        }
                    }
                },
                labsession_sessionstudents: {
                    include: {
                        venue: true,
                        user_labsession_facultyIdTouser: true
                    },
                    orderBy: { startTime: 'asc' }
                }
            }
        });

        if (!user) {
            fs.writeFileSync('student_exhaustive.txt', 'NOT FOUND');
            return;
        }

        out += `STUDENT: ${user.name} | Roll: ${user.rollNumber} | ID: ${user.id}\n\n`;

        out += "--- ALL SESSIONS ON RECORD ---\n";
        user.labsession_sessionstudents.forEach((s, i) => {
            out += `${i + 1}. [${s.startTime.toISOString()} - ${s.endTime.toISOString()}] | Venue: ${s.venue.name} | Faculty: ${s.user_labsession_facultyIdTouser.name} (${s.facultyId})\n`;
        });

        const activeTeam = user.teamMemberships.find(m => m.approved)?.team;
        if (activeTeam) {
            out += `\n--- TEAM: ${activeTeam.id} ---\n`;
            out += `Project: ${activeTeam.project?.title} (${activeTeam.projectId})\n`;

            out += "\n--- REVIEWS (Review Table) ---\n";
            activeTeam.reviews.forEach(r => {
                out += `Phase ${r.reviewPhase}: ${r.status} | Faculty: ${r.faculty.name} (${r.facultyId})\n`;
            });

            if (activeTeam.projectId) {
                out += "\n--- REVIEW ASSIGNMENTS (ReviewAssignment Table) ---\n";
                const afs = await prisma.reviewassignment.findMany({
                    where: { projectId: activeTeam.projectId },
                    include: { faculty: true }
                });
                afs.forEach(af => {
                    out += `Phase ${af.reviewPhase}: Faculty: ${af.faculty.name} (${af.facultyId}) | Access: ${af.accessStartsAt?.toISOString()} - ${af.accessExpiresAt?.toISOString()}\n`;
                });
            }
        }

        fs.writeFileSync('student_exhaustive.txt', out);
        console.log('Success');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

exhaustiveCheck();
