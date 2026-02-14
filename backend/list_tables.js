const mysql = require('mysql2/promise');

async function listTables() {
    const connection = await mysql.createConnection({
        host: '10.10.12.99',
        user: 'root',
        password: process.argv[2],
        database: 'student_portal_db',
        port: 3312
    });

    const [rows] = await connection.execute("SHOW TABLES");
    console.log(rows.map(row => Object.values(row)[0]));
    await connection.end();
}

listTables().catch(console.error);
