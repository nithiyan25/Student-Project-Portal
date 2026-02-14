require('dotenv').config();
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000/api';

async function testTeamSearch() {
    console.log('--- Testing Team Search & Pagination (Auth Enabled) ---');

    // Create Token
    const payload = { id: 'test-admin', role: 'ADMIN' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        // 1. Test Default Pagination (Page 1, Limit 10)
        console.log('\n1. Fetching Page 1 (Limit 10)...');
        const res1 = await fetch(`${BASE_URL}/admin/teams?page=1&limit=10`, { headers });
        const data1 = await res1.json();

        console.log(`   Status: ${res1.status}`);
        if (data1.teams) {
            console.log(`   Count: ${data1.teams.length}`);
            console.log(`   Total Teams in DB: ${data1.pagination?.total}`);
            if (data1.teams.length > 10) console.error('FAIL: Limit not respected');
            else console.log('PASS: Limit respected');
        } else {
            console.error('FAIL: No teams returned', data1);
        }

        // 2. Test Search (e.g., search for a project title or student name)
        const searchTerm = 'a';
        console.log(`\n2. Searching for "${searchTerm}"...`);
        const res2 = await fetch(`${BASE_URL}/admin/teams?page=1&limit=10&search=${searchTerm}`, { headers });
        const data2 = await res2.json();
        console.log(`   Count: ${data2.teams?.length}`);

        // 3. Test Status Filter
        const status = 'NOT_COMPLETED';
        console.log(`\n3. Filtering by status: ${status}...`);
        const res3 = await fetch(`${BASE_URL}/admin/teams?page=1&limit=10&status=${status}`, { headers });
        const data3 = await res3.json();
        console.log(`   Count: ${data3.teams?.length}`);

        if (data3.teams) {
            const allMatch = data3.teams.every(t => t.status === status);
            if (allMatch) console.log('PASS: Status filtering correct');
            else console.error('FAIL: Found teams with wrong status');
        }

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

testTeamSearch();
