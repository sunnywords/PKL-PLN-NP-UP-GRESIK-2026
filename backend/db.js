const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'sleepwell.db');
const db = new Database(dbPath, { timeout: 5000 });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Inisialisasi Tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('ADMIN', 'ANGGOTA')) DEFAULT 'ANGGOTA',
    initials TEXT
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sensor_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    temperature REAL,
    humidity REAL,
    timestamp TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    location TEXT NOT NULL,
    riskLevel INTEGER NOT NULL,
    temperature REAL,
    humidity REAL,
    ldr REAL,
    message TEXT,
    recommendations TEXT,
    sensorQuality INTEGER,
    combinedSummary TEXT,
    sensorQualityStatus TEXT,
    imageData TEXT,
    imagePath TEXT,
    imageName TEXT,
    imageType TEXT,
    notes TEXT,
    duration INTEGER,
    timestamp TEXT NOT NULL
  );
`);

const scanHistoryColumns = db.prepare(`PRAGMA table_info(scan_history)`).all();
if (!scanHistoryColumns.some(column => column.name === 'recommendations')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN recommendations TEXT`);
}
if (!scanHistoryColumns.some(column => column.name === 'sensorQuality')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN sensorQuality INTEGER`);
}
if (!scanHistoryColumns.some(column => column.name === 'ldr')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN ldr REAL`);
}
if (!scanHistoryColumns.some(column => column.name === 'imageData')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN imageData TEXT`);
}
if (!scanHistoryColumns.some(column => column.name === 'imagePath')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN imagePath TEXT`);
}
if (!scanHistoryColumns.some(column => column.name === 'imageName')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN imageName TEXT`);
}
if (!scanHistoryColumns.some(column => column.name === 'imageType')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN imageType TEXT`);
}
if (!scanHistoryColumns.some(column => column.name === 'combinedSummary')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN combinedSummary TEXT`);
}
if (!scanHistoryColumns.some(column => column.name === 'sensorQualityStatus')) {
  db.exec(`ALTER TABLE scan_history ADD COLUMN sensorQualityStatus TEXT`);
}

// Helper Functions
const Scan = {
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO scan_history (deviceId, location, riskLevel, temperature, humidity, ldr, message, recommendations, sensorQuality, combinedSummary, sensorQualityStatus, imageData, imagePath, imageName, imageType, notes, duration, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      data.deviceId,
      data.location,
      data.riskLevel,
      data.temperature,
      data.humidity,
      data.ldr ?? null,
      data.message,
      data.recommendations || null,
      data.sensorQuality ?? null,
      data.combinedSummary || null,
      data.sensorQualityStatus || null,
      data.imageData || null,
      data.imagePath || null,
      data.imageName || null,
      data.imageType || null,
      data.notes,
      data.duration,
      new Date().toISOString()
    );
  },
  getHistory: (deviceId, limit = 500) => {
    const maxLimit = Math.min(Math.max(Number(limit) || 0, 1), 500);
    return db.prepare(`
      SELECT * FROM scan_history 
      WHERE deviceId = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(deviceId, maxLimit);
  }
};

const Automation = {
  get: (deviceId) => {
    return db.prepare(`SELECT * FROM automations WHERE deviceId = ?`).get(deviceId);
  },
  upsert: (data) => {
    const stmt = db.prepare(`
      INSERT INTO automations (deviceId, isScheduleActive, startTime, endTime, isClimateActive, tempThreshold)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        isScheduleActive = excluded.isScheduleActive,
        startTime = excluded.startTime,
        endTime = excluded.endTime,
        isClimateActive = excluded.isClimateActive,
        tempThreshold = excluded.tempThreshold
    `);
    return stmt.run(data.deviceId, data.isScheduleActive, data.startTime, data.endTime, data.isClimateActive, data.tempThreshold);
  }
};

const SensorLog = {
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO sensor_logs (deviceId, temperature, humidity, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(data.deviceId, data.temperature, data.humidity, data.timestamp);
  },
  getHistory: (deviceId, limit = 24) => {
    return db.prepare(`
      SELECT *, 
             strftime('%Y-%m-%d %H:', timestamp) || 
             (CASE WHEN strftime('%M', timestamp) < '30' THEN '00' ELSE '30' END) as time_group
      FROM sensor_logs 
      WHERE deviceId = ? 
      GROUP BY time_group
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(deviceId, limit);
  }
};

const User = {
  findOne: (criteria) => {
    const key = Object.keys(criteria)[0];
    const value = criteria[key];
    return db.prepare(`SELECT * FROM users WHERE ${key} = ?`).get(value);
  },
  create: async (userData) => {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, username, password, role, initials)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(userData.name, userData.username, hashedPassword, userData.role, userData.initials);
  },
  findAll: () => {
    return db.prepare(`SELECT id, name, username, role, initials FROM users`).all();
  },
  delete: (id) => {
    return db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  }
};

const Device = {
  findAll: () => {
    return db.prepare(`SELECT * FROM devices`).all();
  },
  create: (deviceData) => {
    const stmt = db.prepare(`INSERT INTO devices (deviceId, name) VALUES (?, ?)`);
    return stmt.run(deviceData.deviceId, deviceData.name);
  },
  delete: (id) => {
    return db.prepare(`DELETE FROM devices WHERE id = ?`).run(id);
  }
};

const Alert = {
  create: (data) => {
    const stmt = db.prepare(`
      INSERT INTO alerts (deviceId, type, message, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(data.deviceId, data.type, data.message, new Date().toISOString());
  },
  getRecent: (deviceId, limit = 10) => {
    return db.prepare(`
      SELECT * FROM alerts 
      WHERE deviceId = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(deviceId, limit);
  }
};

module.exports = { db, User, Device, SensorLog, Scan, Alert };
