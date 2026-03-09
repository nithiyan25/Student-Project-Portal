const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLL_NUMBERS = [
    '7376231BM103', '7376231BM118', '7376231BM128', '7376231CD124', '7376231CD141',
    '7376231CS104', '7376231CS107', '7376231CS146', '7376231CS159', '7376231CS166',
    '7376231CS172', '7376231CS212', '7376231CS260', '7376231CS277', '7376231CS297',
    '7376231CS300', '7376231CS306', '7376231CS310', '7376231CS329', '7376231CS331',
    '7376231CS333', '7376231CS334', '7376231CS341', '7376231CS344', '7376231CS347',
    '7376231CS350', '7376231ME137', '7376231ME158', '7376231MZ103', '7376231MZ116',
    '7376231MZ127', '7376231MZ143', '7376231SE114', '7376231SE117', '7376232AD154',
    '7376232AD201', '7376232AG148', '7376232AL103', '7376232AL203', '7376232AL215',
    '7376232CT104', '7376232IT110', '7376232IT153', '7376232IT161', '7376232IT170',
    '7376232IT186', '7376232IT265', '7376241CS503', '7376241MZ505', '7376242AD502',
    '7376242AD510'
];

// March 5, 2026 7:00 PM IST = 1:30 PM UTC
const NEW_EXPIRY = new Date('2026-03-05T13:30:00.000Z');

async function extendReviewTime() {
    try {
        const miniProjectScope = await prisma.projectscope.findFirst({
            where: { name: { contains: 'Mini Project' } }
        });

        console.log(`\nExtending review time to: March 5, 2026 7:00 PM IST`);
        console.log(`Only for the CURRENT VENUE FACULTY assignments.\n`);

        const students = await prisma.user.findMany({
            where: { rollNumber: { in: ROLL_NUMBERS } },
            select: {
                id: true, rollNumber: true, name: true,
                teamMemberships: {
                    select: { team: { select: { projectId: true } } }
                },
                labsession_sessionstudents: {
                    where: { scopeId: miniProjectScope.id },
                    select: {
                        facultyId: true,
                        user_labsession_facultyIdTouser: { select: { name: true } },
                        venue: { select: { name: true } }
                    },
                    orderBy: { startTime: 'desc' }
                }
            }
        });

        let updated = 0;
        let skipped = 0;

        for (const student of students) {
            const projectId = student.teamMemberships[0]?.team?.projectId;
            const session = student.labsession_sessionstudents[0];

            if (!projectId || !session) {
                console.log(`  ⚠️ ${student.rollNumber} | ${student.name} - No project/session, skipping.`);
                skipped++;
                continue;
            }

            const facultyId = session.facultyId;
            const facultyName = session.user_labsession_facultyIdTouser?.name || 'Unknown';
            const venueName = session.venue?.name || 'Unknown';

            // Update ONLY the assignment for this specific venue faculty
            const result = await prisma.reviewassignment.updateMany({
                where: {
                    projectId: projectId,
                    facultyId: facultyId,
                    reviewPhase: 1
                },
                data: { accessExpiresAt: NEW_EXPIRY }
            });

            if (result.count > 0) {
                console.log(`  ✅ ${student.rollNumber} | ${student.name} → ${facultyName} (${venueName}) - Extended`);
                updated++;
            } else {
                console.log(`  ⚠️ ${student.rollNumber} | ${student.name} → No matching assignment for ${facultyName}`);
                skipped++;
            }
        }

        console.log(`\n========================================`);
        console.log(`  SUMMARY`);
        console.log(`========================================`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`New expiry: March 5, 2026 7:00 PM IST`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

extendReviewTime();
