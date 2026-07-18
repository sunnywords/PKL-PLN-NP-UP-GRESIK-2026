const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'sleepwell.db'));
db.exec('DELETE FROM sensor_logs;');
console.log('Sensor logs cleared.');
process.exit(0);
