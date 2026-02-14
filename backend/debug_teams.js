const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const teams = await prisma.team.findMany({
            include: {
                project: true
            }
        });

        console.log(`Total Teams: ${teams.length}`);
        const statusCounts = teams.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {});
        console.log('Status Counts:', statusCounts);

        const teamsWithProjects = teams.filter(t => t.projectId).length;
        console.log(`Teams with Projects: ${teamsWithProjects}`);

        const teamsInReviewTab = teams.filter(t =>
            ['NOT_COMPLETED', 'IN_PROGRESS', 'COMPLETED', 'CHANGES_REQUIRED', 'READY_FOR_REVIEW'].includes(t.status)
        ).length;
        console.log(`Teams that should show in Reviews Tab: ${teamsInReviewTab}`);

        if (teams.length > 0) {
            console.log('\nSample Teams:');
            teams.slice(0, 5).forEach(t => {
                console.log(`- ID: ${t.id}, Status: ${t.status}, Project: ${t.project?.title || 'None'}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
