/**
 * Centralized utility to calculate the current phase for a team.
 * 
 * Logic Priority:
 * 1. Priority 1 (Active Duty): If there's an active review assignment unexpired, that's the phase.
 * 2. Priority 2 (Lowest Incomplete): If a phase is NOT successfully reviewed AND the deadline hasn't passed (or is overridden), that's the current goal.
 * 3. Priority 3 (Active Submission): If the team has a submissionPhase pinned (e.g. they submitted for P2), respect it unless P1 was re-opened.
 * 4. Fallback: Last passed phase + 1.
 */

function calculateTeamPhase(team, now = new Date()) {
    if (!team || !team.scope) return null;

    const totalPhases = team.scope.numberOfPhases || 3;
    const projectPhases = team.project?.assignedFaculty || [];
    const deadlines = team.scope.deadlines || [];
    const reviews = team.reviews || [];
    const overrides = team.deadlineOverrides || [];

    // 1. Identify successful reviews
    const successfullyReviewedPhases = new Set(
        reviews
            .filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED')
            .map(r => r.reviewPhase)
    );

    // 2. Identify passed phases (expired deadline + no override + no late submission)
    const passedDeadlines = new Set(
        deadlines
            .filter(d => {
                const hasOverride = overrides.some(o => o.phase === d.phase);
                const isDeadlinePassed = new Date(d.deadline) < now;
                return isDeadlinePassed && !d.allowLateSubmission && !hasOverride;
            })
            .map(d => d.phase)
    );

    // 3. Identify phases missed by faculty assignment (if any and not overridden)
    const passedAssignments = new Set(
        projectPhases
            .filter(a => a.accessExpiresAt && new Date(a.accessExpiresAt) < now)
            .map(a => a.reviewPhase)
            .filter(p => !overrides.some(o => o.phase === p))
    );

    const passedPhases = new Set([...passedDeadlines, ...passedAssignments]);

    // 4. Priority 1: Active Assignment (Unexpired)
    // We prioritize what the admin/system explicitly assigned for "right now"
    const activeAssignment = projectPhases.find(a => {
        if (!a.accessExpiresAt) return false;
        if (successfullyReviewedPhases.has(a.reviewPhase)) return false;
        return new Date(a.accessExpiresAt) > now;
    });

    if (activeAssignment) {
        return Math.min(activeAssignment.reviewPhase, totalPhases);
    }

    // 5. Priority 2: Lowest Incomplete & Available Phase
    // This handles re-opened phases (deadline extended or override added)
    for (let p = 1; p <= totalPhases; p++) {
        if (!successfullyReviewedPhases.has(p) && !passedPhases.has(p)) {
            return p;
        }
    }

    // 6. Priority 3: Submission Phase (Respect if it's within bounds)
    if (team.submissionPhase && team.submissionPhase <= totalPhases && !successfullyReviewedPhases.has(team.submissionPhase)) {
        return team.submissionPhase;
    }

    // 7. Fallback: Next after the highest passed phase
    const highestPassed = Math.max(0, ...Array.from(passedPhases), ...Array.from(successfullyReviewedPhases));
    const next = highestPassed + 1;

    return next > totalPhases ? null : next;
}

module.exports = {
    calculateTeamPhase
};
