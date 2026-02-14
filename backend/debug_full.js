const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const projects = await prisma.project.count();
        console.log(`Total Projects: ${projects}`);

        const teams = await prisma.team.findMany({
            include: { project: true }
        });
        console.log(`Total Teams: ${teams.length}`);

        teams.forEach(t => {
            console.log(`Team ${t.id}: Status=${t.status}, ProjectID=${t.projectId}, ProjectTitle=${t.project?.title || 'NONE'}`);
        });

        const requests = await prisma.projectrequest.findMany({
            include: { team: true, project: true }
        });
        console.log(`Total Project Requests: ${requests.length}`);
        requests.forEach(r => {
            console.log(`Request ${r.id}: Status=${r.status}, Team=${r.team?.id}, Project=${r.project?.title}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
