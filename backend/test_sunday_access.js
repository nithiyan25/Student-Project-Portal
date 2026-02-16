const { addDurationExcludingSundays } = require('./src/utils/timerUtils');

function test(name, startStr, durationHours, expectedStr) {
    const start = new Date(startStr);
    const durationMs = durationHours * 60 * 60 * 1000;
    const result = addDurationExcludingSundays(start, durationMs);

    const resultStr = result.toLocaleString();
    console.log(`${name}:`);
    console.log(`  Start:    ${start.toLocaleString()} (${getDayName(start)})`);
    console.log(`  Duration: ${durationHours}h`);
    console.log(`  Expected: ~${expectedStr}`);
    console.log(`  Result:   ${resultStr} (${getDayName(result)})`);

    // Simple check (manual review usually better for dates due to localestring formatting)
    const success = getDayName(result) !== 'Sunday';
    console.log(`  Status:   ${success ? 'PASS (Not Sunday)' : 'FAIL (Is Sunday)'}`);
    console.log('-----------------------------------');
}

function getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
}

console.log('Verifying Sunday-Aware Access Durations...\n');

// Case 1: Friday -> Saturday (Success, no Sunday skip needed)
test('Friday to Saturday', '2026-02-13T10:00:00', 24, 'Saturday');

// Case 2: Saturday -> Monday (Success, Sunday skipped)
test('Saturday to Monday', '2026-02-14T10:00:00', 24, 'Monday');

// Case 3: Friday to Monday (Success, spans Sunday)
test('Friday to Monday (48h)', '2026-02-13T10:00:00', 48, 'Monday');

// Case 4: Sunday starting -> Tuesday (Success, Sunday skipped)
test('Starting on Sunday', '2026-02-15T10:00:00', 24, 'Tuesday');

// Case 5: Thursday 48h -> Monday (Covers Sunday)
test('Thursday 48h (Ends Sat -> becomes Sat? No, Fri->Sat, Sat->Sun -> Mon)', '2026-02-12T10:00:00', 48, 'Saturday (Literal: Saturday)');
// Wait, Thurs + 48h is Saturday 10am. No Sunday touched.
test('Thursday 72h (Literal: Sunday -> Monday)', '2026-02-12T10:00:00', 72, 'Monday');
