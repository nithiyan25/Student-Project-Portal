const prisma = require('./src/utils/prisma');

async function syncStatuses() {
    try {
        console.log('--- Syncing Team Status with Completed Reviews ---');

        // Find teams with completed reviews but non-completed status
        const teamsToUpdate = await prisma.team.findMany({
            where: {
                status: { not: 'COMPLETED' },
                reviews: {
                    some: { status: 'COMPLETED' }
                }
            }
        });

        console.log(`Found ${teamsToUpdate.length} teams that need status syncing.`);

        for (const t of teamsToUpdate) {
            console.log(`Updating Team ${t.id} status to COMPLETED...`);
            await prisma.team.update({
                where: { id: t.id },
                data: { status: 'COMPLETED' }
            });
        }

        console.log('Sync complete.');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

syncStatuses();
