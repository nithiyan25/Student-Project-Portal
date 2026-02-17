const prisma = require('./src/utils/prisma');

async function checkVenue() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const sessions = await prisma.labsession.findMany({
            where: {
                venue: { name: 'ME 102' },
                startTime: { lte: endOfDay },
                endTime: { gte: startOfDay }
            },
            include: {
                user_labsession_facultyIdTouser: true,
                user_sessionstudents: {
                    select: { name: true, rollNumber: true }
                }
            }
        });

        console.log(`--- SESSIONS IN ME 102 TODAY (${now.toDateString()}) ---`);
        if (sessions.length === 0) {
            console.log('No sessions found in this venue today.');
        } else {
            sessions.forEach((s, i) => {
                const isActive = now >= s.startTime && now <= s.endTime;
                console.log(`\nSession ${i + 1}: ${isActive ? '[ACTIVE NOW]' : ''}`);
                console.log(`  Faculty: ${s.user_labsession_facultyIdTouser.name} (${s.facultyId})`);
                console.log(`  Timing: ${s.startTime.toISOString()} to ${s.endTime.toISOString()}`);
                console.log(`  Student Count: ${s.user_sessionstudents.length}`);

                const targetStudent = s.user_sessionstudents.find(st => st.rollNumber === '7376231CS253');
                if (targetStudent) {
                    console.log(`  *** STUDENT 7376231CS253 (${targetStudent.name}) IS IN THIS SESSION ***`);
                }
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkVenue();
