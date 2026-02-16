const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testReopen() {
    try {
        // 1. Find a completed review
        const review = await prisma.review.findFirst({
            where: { status: 'COMPLETED' },
            include: { team: true }
        });

        if (!review) {
            console.log("No completed review found to test with.");
            return;
        }

        console.log(`Testing with Review ID: ${review.id}, Team ID: ${review.teamId}`);
        console.log(`Initial Status: ${review.status}, CompletedAt: ${review.completedAt}`);

        // 2. Perform re-open logic (simulating the route)
        const updatedReview = await prisma.review.update({
            where: { id: review.id },
            data: {
                completedAt: null,
                status: 'IN_PROGRESS'
            }
        });

        if (review.team.status === 'COMPLETED') {
            await prisma.team.update({
                where: { id: review.teamId },
                data: { status: 'IN_PROGRESS' }
            });
        }

        const now = new Date();
        const access = await prisma.reviewassignment.updateMany({
            where: {
                projectId: review.projectId,
                facultyId: review.facultyId,
                reviewPhase: review.reviewPhase
            },
            data: {
                accessExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
            }
        });

        console.log("Re-open logic applied.");

        // 3. Verify
        const finalReview = await prisma.review.findUnique({ where: { id: review.id } });
        const finalTeam = await prisma.team.findUnique({ where: { id: review.teamId } });
        const finalAccess = await prisma.reviewassignment.findFirst({
            where: {
                projectId: review.projectId,
                facultyId: review.facultyId,
                reviewPhase: review.reviewPhase
            }
        });

        console.log(`Final Status: ${finalReview.status}, CompletedAt: ${finalReview.completedAt}`);
        console.log(`Final Team Status: ${finalTeam.status}`);
        console.log(`Extended Access: ${finalAccess.accessExpiresAt}`);

        if (finalReview.status === 'IN_PROGRESS' && finalReview.completedAt === null) {
            console.log("SUCCESS: Review re-opened correctly.");
        } else {
            console.log("FAILURE: Review status or completedAt not reset.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

testReopen();
