const prisma = require('./prisma');
const { addDurationExcludingSundays } = require('./timerUtils');

/**
 * Reassigns pending reviews for a team to a new faculty.
 * @param {Object} tx - Prisma transaction client
 * @param {Object} team - Team object with project and members
 * @param {string} facultyIdToAssign - ID of the new faculty to assign
 * @param {number} nextPhase - The phase for which to reassign
 * @param {Date} now - Current timestamp
 * @param {string} adminId - ID of the admin performing the action
 * @returns {Promise<string>} - Description of assignment method
 */
async function reassignPendingReview(tx, team, facultyIdToAssign, nextPhase, now, adminId) {
    let assignedVia = '';

    // 1. NEW GUARD: Check if there's already a completed review for this phase
    const completedReview = await tx.review.findFirst({
        where: {
            teamId: team.id,
            reviewPhase: nextPhase,
            status: { in: ['COMPLETED', 'APPROVED'] }
        }
    });

    if (completedReview) {
        return ' (Skipped: Review already completed for this phase)';
    }

    // 2. Check for EXISTING Pending Review for this phase
    const existingReview = await tx.review.findFirst({
        where: {
            teamId: team.id,
            reviewPhase: nextPhase,
            status: 'PENDING'
        }
    });

    // 2. Re-assignment Logic
    let previousExpiresAt = null;

    if (existingReview) {
        if (existingReview.facultyId !== facultyIdToAssign) {
            // Check previous assignment to preserve remaining time or prevent reassignment if expired
            if (team.projectId) {
                const previousAssignment = await tx.reviewassignment.findUnique({
                    where: {
                        projectId_facultyId_reviewPhase: {
                            projectId: team.projectId,
                            facultyId: existingReview.facultyId,
                            reviewPhase: nextPhase
                        }
                    }
                });

                if (previousAssignment && previousAssignment.accessExpiresAt) {
                    previousExpiresAt = previousAssignment.accessExpiresAt;
                    if (new Date(previousExpiresAt) < now) {
                        // The original assignment has already expired, do not allow new faculty to get time
                        return ` (Skipped: Existing assignment expired)`;
                    }
                }
            }

            // Transfer the review to the new faculty
            await tx.review.update({
                where: { id: existingReview.id },
                data: { facultyId: facultyIdToAssign }
            });

            // Expire access for the OLD faculty
            await tx.reviewassignment.updateMany({
                where: {
                    projectId: team.projectId,
                    facultyId: existingReview.facultyId,
                    reviewPhase: nextPhase
                },
                data: { accessExpiresAt: now } // Expire immediately
            });

            assignedVia = ` (Transferred from previous faculty)`;
        }
    } else {
        // Create Review if it doesn't exist
        await tx.review.create({
            data: {
                teamId: team.id,
                facultyId: facultyIdToAssign,
                reviewPhase: nextPhase,
                status: 'PENDING',
                content: "",
                projectId: team.projectId || ''
            }
        });
    }

    // Upsert Review Assignment to ensure faculty can see it in their dashboard
    // Use the previous expiration time if available, otherwise give 24 hours
    const accessExpiresAt = previousExpiresAt
        ? previousExpiresAt
        : addDurationExcludingSundays(now, 24 * 60 * 60 * 1000);

    if (team.projectId) {
        await tx.reviewassignment.upsert({
            where: {
                projectId_facultyId_reviewPhase: {
                    projectId: team.projectId,
                    facultyId: facultyIdToAssign,
                    reviewPhase: nextPhase
                }
            },
            update: {
                mode: 'OFFLINE',
                assignedAt: now,
                accessExpiresAt // Refresh expiration
            },
            create: {
                projectId: team.projectId,
                facultyId: facultyIdToAssign,
                reviewPhase: nextPhase,
                mode: 'OFFLINE',
                assignedBy: adminId,
                accessStartsAt: now,
                accessExpiresAt
            }
        });
    }

    return assignedVia;
}

/**
 * Automatically reassigns reviews for all teams associated with a set of students
 * based on their new session/faculty.
 * @param {Object} tx - Prisma transaction client
 * @param {string[]} studentIds - List of student user IDs
 * @param {string} facultyIdToAssign - ID of the new faculty
 * @param {string} adminId - ID of the admin
 */
async function syncTeamReviewsWithSession(tx, studentIds, facultyIdToAssign, adminId) {
    const now = new Date();

    // Find all teams these students belong to
    const teams = await tx.team.findMany({
        where: {
            members: { some: { userId: { in: studentIds } } },
            projectId: { not: null }
        },
        include: {
            members: { include: { user: true } },
            reviews: true,
            project: { include: { assignedFaculty: true } }
        }
    });

    for (const team of teams) {
        // Determine Phase
        const passedPhases = new Set([
            ...(team.reviews || []).map(r => r.reviewPhase),
            ...(team.project?.assignedFaculty || [])
                .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
                .map(a => a.reviewPhase)
        ]);
        const nextPhase = Math.max(team.submissionPhase || 0, Math.max(0, ...Array.from(passedPhases)));

        // Check if there is an active (unexpired) assignment for this phase
        const hasActiveAssignment = team.project?.assignedFaculty?.some(a =>
            a.reviewPhase === nextPhase && a.accessExpiresAt && new Date(a.accessExpiresAt) > now
        );

        if (!hasActiveAssignment) {
            // Unassigned or already expired -> Skip transferring this team entirely
            continue;
        }

        const assignmentMethod = await reassignPendingReview(tx, team, facultyIdToAssign, nextPhase, now, adminId);

        // Ensure team status is IN_PROGRESS
        if (!assignmentMethod.includes('Skipped')) {
            await tx.team.update({
                where: { id: team.id },
                data: { status: 'IN_PROGRESS' }
            });
        }
    }
}

module.exports = {
    reassignPendingReview,
    syncTeamReviewsWithSession
};
