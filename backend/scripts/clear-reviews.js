const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING REVIEW DATA CLEANUP ---');

    try {
        // 1. Delete all ReviewMarks
        console.log('Deleting all ReviewMarks...');
        const deletedMarks = await prisma.reviewmark.deleteMany({});
        console.log(`Successfully deleted ${deletedMarks.count} review marks.`);

        // 2. Delete all Reviews
        console.log('Deleting all Reviews...');
        const deletedReviews = await prisma.review.deleteMany({});
        console.log(`Successfully deleted ${deletedReviews.count} reviews.`);

        // 3. Delete all ReviewAssignments
        console.log('Deleting all ReviewAssignments...');
        const deletedAssignments = await prisma.reviewassignment.deleteMany({});
        console.log(`Successfully deleted ${deletedAssignments.count} review assignments.`);

        // 4. Reset all Team statuses to APPROVED
        // This allows them to start fresh from clicking "Ready for Review" (Phase 1)
        console.log('Resetting all team statuses to APPROVED...');
        const updatedTeams = await prisma.team.updateMany({
            data: {
                status: 'APPROVED',
                guideStatus: 'PENDING',
                expertStatus: 'PENDING'
            }
        });
        console.log(`Successfully reset status for ${updatedTeams.count} teams.`);

        // 5. Reset TeamMember approval status (optional but often requested for full reset)
        console.log('Approving all team members to ensure they can proceed...');
        await prisma.teammember.updateMany({
            data: { approved: true }
        });

        console.log('--- CLEANUP COMPLETED SUCCESSFULLY ---');
    } catch (error) {
        console.error('ERROR DURING CLEANUP:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
