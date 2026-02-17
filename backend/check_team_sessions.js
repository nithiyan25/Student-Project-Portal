const prisma = require('./src/utils/prisma');

async function checkTeam() {
    const teamId = 'cml7sn7u403vz126sqqgan5mq';
    const now = new Date();

    try {
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                members: {
                    include: {
                        user: {
                            include: {
                                labsession_sessionstudents: {
                                    include: {
                                        user_labsession_facultyIdTouser: true,
                                        venue: true
                                    }
                                }
                            }
                        }
                    }
                },
                project: true,
                reviews: {
                    include: { faculty: true }
                }
            }
        });

        if (!team) {
            console.log('Team not found');
            return;
        }

        console.log(`=== TEAM: ${team.id} ===`);
        console.log(`Project: ${team.project?.title}`);

        console.log('\n--- TEAM MEMBERS AND THEIR ACTIVE SESSIONS ---');
        team.members.forEach(m => {
            const activeSessions = m.user.labsession_sessionstudents.filter(s => now >= s.startTime && now <= s.endTime);
            console.log(`- Member: ${m.user.name} (${m.user.rollNumber})`);
            if (activeSessions.length === 0) {
                console.log('  No Active Session Right Now.');
            } else {
                activeSessions.forEach(s => {
                    console.log(`  ACTIVE: Venue: ${s.venue.name} | Faculty: ${s.user_labsession_facultyIdTouser.name} (${s.facultyId})`);
                });
            }
        });

        console.log('\n--- PENDING REVIEWS ---');
        team.reviews.filter(r => r.status === 'PENDING').forEach(r => {
            console.log(`- Phase ${r.reviewPhase}: Assigned to ${r.faculty.name} (${r.facultyId})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkTeam();
