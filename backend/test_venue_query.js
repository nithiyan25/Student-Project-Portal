
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Venue Query...");
        const venues = await prisma.venue.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { sessions: true } }
            }
        });
        console.log("Venues found:", venues);
    } catch (e) {
        console.error("Error fetching venues:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
