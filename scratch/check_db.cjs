const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'backend', 'sleepwell.db');
const db = new Database(dbPath);

try {
    const scans = db.prepare('SELECT * FROM scan_history ORDER BY timestamp DESC LIMIT 5').all();
    console.log('--- SCAN HISTORY (Last 5) ---');
    console.log(JSON.stringify(scans, null, 2));
} catch (e) {
    console.error('Error reading DB:', e.message);
}
