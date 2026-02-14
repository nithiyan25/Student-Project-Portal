
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Testing Venue Query (Fix Verification)...");
        const venues = await prisma.venue.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { labsession: true } }
            }
        });
        console.log("Venues found:", venues.length);
        if (venues.length > 0) {
            console.log("First venue sample:", venues[0]);
        }
    } catch (e) {
        console.error("Error fetching venues:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
