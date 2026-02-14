
const cron = require('node-cron');
const prisma = require('../utils/prisma');

// Run every night at midnight (00:00)
// For testing, you can change this to run every minute '*/1 * * * *'
const startScheduler = () => {
    console.log('Scheduler initialized: Nightly Review Reassignment Job planned for 00:00.');

    cron.schedule('0 0 * * *', async () => {
        console.log('Running Nightly Review Reassignment Job...');
        try {
            // 1. Find Reviews that are PENDING or EXPIRED (if we had expiration logic)
            // For now, let's look for teams that are 'READY_FOR_REVIEW' but have NO pending review 
            // OR reviews that are 'PENDING' but created more than 24 hours ago (optional policy)

            // Simple logic: Find teams 'READY_FOR_REVIEW' that don't have a 'PENDING' review
            // This acts as a fallback if the manual tool wasn't used, or if we want fully auto.
            // But the user requested "reassigning incomplete reviews".

            // Let's assume 'incomplete' means 'PENDING' reviews that passed the lab session time? 
            // OR simply finding "next" session for any pending review.

            // Logic:
            // Find all reviews with status 'PENDING'
            const pendingReviews = await prisma.review.findMany({
                where: { status: 'PENDING' },
                include: { team: { include: { members: true, project: true } } }
            });

            console.log(`Found ${pendingReviews.length} pending reviews to check.`);

            for (const review of pendingReviews) {
                const reviewDate = new Date(review.scheduledAt);
                const now = new Date();

                // Stale if scheduled more than 16 hours ago (allows for same-day sessions but flags yesterday's)
                const isStale = (now.getTime() - reviewDate.getTime()) > 16 * 60 * 60 * 1000;

                if (isStale) {
                    console.log(`Review ${review.id} for Team ${review.team.project?.title || review.teamId} is stale. Searching for next session...`);

                    const studentIds = review.team.members.map(m => m.userId);

                    // Look for the absolute next session (starting from now)
                    const nextSession = await prisma.labsession.findFirst({
                        where: {
                            user_sessionstudents: { some: { id: { in: studentIds } } },
                            startTime: { gt: now }
                        },
                        include: { user_labsession_facultyIdTouser: true },
                        orderBy: { startTime: 'asc' }
                    });

                    if (nextSession) {
                        console.log(`[REASSIGN] Moving review ${review.id} from ${reviewDate.toISOString()} to ${nextSession.startTime.toISOString()} (Faculty: ${nextSession.user_labsession_facultyIdTouser.name})`);

                        await prisma.review.update({
                            where: { id: review.id },
                            data: {
                                facultyId: nextSession.facultyId,
                                scheduledAt: nextSession.startTime,
                            }
                        });

                        // Ensure the new faculty has a reviewassignment
                        if (review.team.projectId) {
                            const existingAssignment = await prisma.reviewassignment.findFirst({
                                where: {
                                    projectId: review.team.projectId,
                                    facultyId: nextSession.facultyId,
                                    reviewPhase: review.reviewPhase
                                }
                            });

                            if (!existingAssignment) {
                                await prisma.reviewassignment.create({
                                    data: {
                                        projectId: review.team.projectId,
                                        facultyId: nextSession.facultyId,
                                        reviewPhase: review.reviewPhase,
                                        mode: 'OFFLINE',
                                        accessStartsAt: nextSession.startTime,
                                        accessExpiresAt: null
                                    }
                                });
                            }
                        }
                    } else {
                        console.warn(`[WARN] No future session found for stale review ${review.id} (Team: ${review.team.project?.title || review.teamId}). Manual intervention may be needed.`);
                    }
                }
            }
        } catch (error) {
            console.error('Error in Nightly Reassignment Job:', error);
        }
    });
};

module.exports = startScheduler;
