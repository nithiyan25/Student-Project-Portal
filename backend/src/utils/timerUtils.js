/**
 * Timer Utilities for College Hours
 * College Hours: 08:45 to 16:20
 * Working Days: Monday to Saturday (Sundays excluded)
 */

const COLLEGE_START_HOUR = 8;
const COLLEGE_START_MINUTE = 45;
const COLLEGE_END_HOUR = 16;
const COLLEGE_END_MINUTE = 20;

/**
 * Calculates the total college seconds between two dates
 * @param {Date} start 
 * @param {Date} end 
 * @returns {number} total seconds
 */
function getCollegeSecondsBetween(start, end) {
    if (start >= end) return 0;

    let totalSeconds = 0;
    let current = new Date(start);

    while (current < end) {
        const day = current.getDay(); // 0 = Sunday

        if (day !== 0) { // Not Sunday
            const dayStart = new Date(current);
            dayStart.setHours(COLLEGE_START_HOUR, COLLEGE_START_MINUTE, 0, 0);

            const dayEnd = new Date(current);
            dayEnd.setHours(COLLEGE_END_HOUR, COLLEGE_END_MINUTE, 0, 0);

            // Determine the active window for today
            const activeStart = new Date(Math.max(current, dayStart));
            const activeEnd = new Date(Math.min(end, dayEnd));

            if (activeStart < activeEnd) {
                totalSeconds += (activeEnd - activeStart) / 1000;
            }
        }

        // Move to the start of the next day
        current.setDate(current.getDate() + 1);
        current.setHours(COLLEGE_START_HOUR, COLLEGE_START_MINUTE, 0, 0);
    }

    return Math.max(0, Math.floor(totalSeconds));
}

/**
 * Adds a duration (in ms) to a start date, skipping Sundays.
 * If the resulting end date falls on a Sunday, it is pushed to Monday.
 * If the period spans a Sunday, an extra 24 hours is added.
 * @param {Date|number} startDate 
 * @param {number} durationMs 
 * @returns {Date}
 */
function addDurationExcludingSundays(startDate, durationMs) {
    const start = new Date(startDate);
    let end = new Date(start.getTime() + durationMs);

    // Iterate through days to find Sundays
    let iterationDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    // We check each day from start to end (inclusive of end)
    while (iterationDate <= end) {
        if (iterationDate.getDay() === 0) { // Sunday
            // Found a Sunday, extend the end date by 24h
            end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        }
        iterationDate.setDate(iterationDate.getDate() + 1);
    }

    return end;
}

module.exports = {
    getCollegeSecondsBetween,
    addDurationExcludingSundays,
    COLLEGE_START_HOUR,
    COLLEGE_START_MINUTE,
    COLLEGE_END_HOUR,
    COLLEGE_END_MINUTE
};
