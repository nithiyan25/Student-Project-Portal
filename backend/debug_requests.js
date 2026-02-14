const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const requests = await prisma.projectrequest.findMany({
            include: {
                team: { include: { members: { include: { user: true } } } },
                project: { include: { scope: true } }
            }
        });
        console.log(`Requests: ${requests.length}`);
        requests.forEach(r => {
            console.log(`ID: ${r.id}, Status: ${r.status}, Team: ${r.team?.id}, Project: ${r.project?.title}`);
            if (r.team) {
                console.log(`  Team Members: ${r.team.members.length}`);
                r.team.members.forEach(m => console.log(`    - ${m.user.name} (${m.user.rollNumber}), Approved: ${m.approved}`));
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
