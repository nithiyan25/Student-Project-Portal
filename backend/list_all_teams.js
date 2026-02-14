const prisma = require('./src/utils/prisma');

async function listTeams() {
    try {
        const teams = await prisma.team.findMany({
            include: {
                project: { select: { title: true } },
                members: { include: { user: { select: { name: true } } } }
            }
        });

        console.log(`Total Teams: ${teams.length}`);
        teams.forEach(t => {
            const memberNames = t.members.map(m => m.user.name).join(', ');
            console.log(`- Team ID: ${t.id} | Status: ${t.status} | Project: ${t.project?.title || 'None'} | Members: ${memberNames}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

listTeams();
