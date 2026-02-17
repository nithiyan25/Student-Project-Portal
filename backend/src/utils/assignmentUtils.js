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

    // 1. Check for EXISTING Pending Review for this phase
    const existingReview = await tx.review.findFirst({
        where: {
            teamId: team.id,
            reviewPhase: nextPhase,
            status: 'PENDING'
        }
    });

    // 2. Re-assignment Logic
    if (existingReview) {
        if (existingReview.facultyId !== facultyIdToAssign) {
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
    const accessExpiresAt = addDurationExcludingSundays(now, 24 * 60 * 60 * 1000);

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

        await reassignPendingReview(tx, team, facultyIdToAssign, nextPhase, now, adminId);

        // Ensure team status is IN_PROGRESS
        await tx.team.update({
            where: { id: team.id },
            data: { status: 'IN_PROGRESS' }
        });
    }
}

module.exports = {
    reassignPendingReview,
    syncTeamReviewsWithSession
};
