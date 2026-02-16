const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function remediateSundayExpirations() {
    console.log('Searching for assignments expiring on Sundays...');

    try {
        const assignments = await prisma.reviewassignment.findMany({
            where: {
                accessExpiresAt: {
                    not: null
                }
            }
        });

        let updatedCount = 0;
        for (const assignment of assignments) {
            const expiry = new Date(assignment.accessExpiresAt);
            if (expiry.getDay() === 0) { // 0 = Sunday
                const newExpiry = new Date(expiry.getTime() + 24 * 60 * 60 * 1000); // Add 24 hours

                console.log(`Updating Assignment ID: ${assignment.id}`);
                console.log(`  Old Expiry: ${expiry.toLocaleString()} (Sunday)`);
                console.log(`  New Expiry: ${newExpiry.toLocaleString()} (Monday)`);

                await prisma.reviewassignment.update({
                    where: { id: assignment.id },
                    data: { accessExpiresAt: newExpiry }
                });
                updatedCount++;
            }
        }

        console.log(`\nSuccessfully updated ${updatedCount} assignments.`);
    } catch (error) {
        console.error('Error during remediation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

remediateSundayExpirations();
