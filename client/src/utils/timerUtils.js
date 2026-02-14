const COLLEGE_START_HOUR = 8;
const COLLEGE_START_MINUTE = 45;
const COLLEGE_END_HOUR = 16;
const COLLEGE_END_MINUTE = 20;

/**
 * Calculates total seconds within college working hours between two dates.
 * Working days: Mon-Sat (Sunday = 0 is excluded)
 * Working hours: 08:45 to 16:20
 */
export function getCollegeSecondsBetween(start, end) {
    if (!start || !end || start >= end) return 0;

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
 * Checks if a given date is within college working hours.
 */
export function isCollegeWorkingHour(date = new Date()) {
    const day = date.getDay();
    if (day === 0) return false;

    const currentHour = date.getHours();
    const currentMinute = date.getMinutes();
    const timeInMinutes = currentHour * 60 + currentMinute;

    const startInMinutes = COLLEGE_START_HOUR * 60 + COLLEGE_START_MINUTE;
    const endInMinutes = COLLEGE_END_HOUR * 60 + COLLEGE_END_MINUTE;

    return timeInMinutes >= startInMinutes && timeInMinutes < endInMinutes;
}
