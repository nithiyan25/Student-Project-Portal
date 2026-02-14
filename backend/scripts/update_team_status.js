const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Updating all teams to status: NOT_COMPLETED...');

    const result = await prisma.team.updateMany({
        data: {
            status: 'NOT_COMPLETED'
        }
    });

    console.log('-----------------------------------');
    console.log('Update Complete!');
    console.log(`Updated ${result.count} teams.`);
    console.log('-----------------------------------');
}

main()
    .catch(e => {
        console.error('Error during update:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
