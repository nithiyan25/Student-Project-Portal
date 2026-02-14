const prisma = require('./src/utils/prisma');

async function checkConsistency() {
    try {
        console.log('--- Checking Team and Review Status Consistency ---');

        // Find teams that have COMPLETED reviews but are NOT marked as COMPLETED themselves
        const teams = await prisma.team.findMany({
            where: {
                status: { not: 'COMPLETED' },
                reviews: {
                    some: { status: 'COMPLETED' }
                }
            },
            include: {
                project: { select: { title: true } },
                reviews: {
                    where: { status: 'COMPLETED' },
                    select: { id: true, facultyId: true, reviewPhase: true }
                }
            }
        });

        if (teams.length === 0) {
            console.log('No inconsistent teams found where team.status is not COMPLETED but has COMPLETED reviews.');

            // Let's also check for teams that are PENDING but have ANY reviews
            const pendingTeams = await prisma.team.findMany({
                where: { status: 'PENDING' },
                include: {
                    project: { select: { title: true } },
                    reviews: { select: { id: true, status: true, reviewPhase: true } }
                }
            });
            console.log(`\nFound ${pendingTeams.length} PENDING teams. Checking their reviews...`);
            pendingTeams.forEach(t => {
                console.log(`Team: ${t.project?.title || 'Unknown'}, Reviews: ${t.reviews.length}`);
                t.reviews.forEach(r => console.log(` - Review Phase ${r.reviewPhase}: ${r.status}`));
            });
        } else {
            console.log(`Found ${teams.length} teams with inconsistent status:`);
            teams.forEach(t => {
                console.log(`\nTeam ID: ${t.id}`);
                console.log(`Project: ${t.project?.title}`);
                console.log(`Current Team Status: ${t.status}`);
                console.log(`Completed Reviews: ${t.reviews.length}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkConsistency();
