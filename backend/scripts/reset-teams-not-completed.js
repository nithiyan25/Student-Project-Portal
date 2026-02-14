const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING BULK STATUS UPDATE ---');

    try {
        console.log('Updating all team statuses to NOT_COMPLETED...');
        const updatedTeams = await prisma.team.updateMany({
            data: {
                status: 'NOT_COMPLETED'
            }
        });
        console.log(`Successfully updated ${updatedTeams.count} teams to NOT_COMPLETED.`);
        console.log('--- RESET COMPLETED SUCCESSFULLY ---');
    } catch (error) {
        console.error('ERROR DURING STATUS UPDATE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
