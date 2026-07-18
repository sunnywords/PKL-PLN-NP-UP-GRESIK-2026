// ============================================================
//  INKUBATOR BACKEND — server.js (SQLite Version)
// ============================================================

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { WebSocketServer } = require('ws');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const fs         = require('fs');
const mqttBridge = require('./mqtt/client');
const { db, User, Device, SensorLog, Scan, Alert } = require('./db');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

// Fungsi untuk menjalankan Prediksi AI menggunakan script Python
async function runAIPrediction(deviceId, temp, hum, ldr) {
    return new Promise((resolve) => {
        const pythonProcess = spawn('python', [path.join(__dirname, 'ai', 'predict.py')]);
        let result = '';
// ... (rest of function unchanged, just fixing the variable)

        pythonProcess.stdin.write(JSON.stringify({ temp, hum, ldr }));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.on('close', () => {
            try {
                const prediction = JSON.parse(result);
                if (prediction.error) {
                    console.error('[AI] Error:', prediction.error);
                    resolve(null);
                } else {
                    resolve(prediction);
                }
            } catch (e) {
                resolve(null);
            }
        });
    });
}

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');
const scansUploadsDir = path.join(uploadsDir, 'scans');

fs.mkdirSync(scansUploadsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

function saveImageDataUriToFile(imageData, imageName = '') {
  if (!imageData || typeof imageData !== 'string') return null;

  const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const base64Data = match[2];
  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  const extension = extensionMap[mimeType] || 'png';
  const safeName = (imageName || 'scan').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 30);
  const fileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName}.${extension}`;
  const filePath = path.join(scansUploadsDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return {
    imagePath: `/uploads/scans/${fileName}`,
    imageType: mimeType,
  };
}

function migrateLegacyScanImages() {
  try {
    const legacyScans = db
      .prepare(`
        SELECT id, imageData, imageName
        FROM scan_history
        WHERE imageData IS NOT NULL
          AND imageData != ''
          AND (imagePath IS NULL OR imagePath = '')
      `)
      .all();

    if (legacyScans.length === 0) {
      console.log('[MIGRATION] Tidak ada gambar legacy untuk dipindahkan');
      return 0;
    }

    const updateLegacyScan = db.prepare(`
      UPDATE scan_history
      SET imageData = NULL,
          imagePath = ?,
          imageType = ?
      WHERE id = ?
    `);

    let migratedCount = 0;

    for (const scan of legacyScans) {
      const savedImage = saveImageDataUriToFile(scan.imageData, scan.imageName || `scan_${scan.id}`);
      if (!savedImage) continue;

      updateLegacyScan.run(savedImage.imagePath, savedImage.imageType, scan.id);
      migratedCount += 1;
    }

    console.log(`[MIGRATION] Berhasil memindahkan ${migratedCount} gambar legacy ke folder uploads/scans`);
    return migratedCount;
  } catch (error) {
    console.error('[MIGRATION] Gagal memindahkan gambar legacy:', error.message);
    return 0;
  }
}

// ============================================================
//  DATABASE SEEDING
// ============================================================
async function seedAdmin() {
  const adminExists = User.findOne({ username: 'admin' });
  if (!adminExists) {
    await User.create({
      name: 'Admin SleepWell',
      username: 'admin',
      password: 'admin',
      role: 'ADMIN',
      initials: 'AD'
    });
    console.log('👤 Admin default siap: username: admin / password: admin (SQLite)');
  }
}

seedAdmin();
migrateLegacyScanImages();

// ============================================================
//  MIDDLEWARE
// ============================================================
app.use(cors());
// Terima payload besar (gambar base64) — perlu agar upload scan tidak melebihi batas default
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// ============================================================
//  AUTH MIDDLEWARE
// ============================================================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ ok: false, error: 'Akses ditolak' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ ok: false, error: 'Token tidak valid' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ ok: false, error: 'Hanya Admin yang diizinkan' });
  }
  next();
};

const devices = {}; // Real-time state

function getDeviceState(id) {
  if (!devices[id]) {
    devices[id] = {
      id: id,
      system: false,
      sensors: [],
      dht: { temperature: 0, humidity: 0 },
      lastUpdate: null
    };
  }
  return devices[id];
}

// ============================================================
//  WEBSOCKET SERVER
// ============================================================
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WS] Client terhubung');
  Object.keys(devices).forEach(id => {
    ws.send(JSON.stringify({ type: 'device_update', deviceId: id, data: devices[id] }));
  });
  ws.on('close', () => console.log('[WS] Client terputus'));
});

function broadcast(type, deviceId, data) {
  const msg = JSON.stringify({ type, deviceId, data });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ============================================================
//  MQTT BRIDGE
// ============================================================
mqttBridge.onSensorData((deviceId, data) => {
  const dState = getDeviceState(deviceId);

  // AUTO-REGISTER DEVICE IF NOT EXISTS
  if (!dState.isRegisteredChecked) {
      try {
          const allDevices = Device.findAll();
          const exists = allDevices.some(d => d.deviceId === deviceId);
          if (!exists) {
              console.log(`[DB] Mendaftarkan perangkat baru otomatis: ${deviceId}`);
              Device.create({ deviceId, name: `Scanner ${deviceId.slice(-4)}` });
          }
          dState.isRegisteredChecked = true;
      } catch (e) {
          console.error('[DB] Gagal auto-register device:', e.message);
      }
  }

  if (data.sensors) {
      dState.sensors = data.sensors;
      // Deteksi Sensor Mati (Misal kalau ada yang 0)
      const deadSensors = data.sensors.filter(s => s === 0).length;
      if (deadSensors > 0) {
          Alert.create({ deviceId, type: 'danger', message: `Bahaya: ${deadSensors} sensor tidak merespon / mati!` });
      }
  }
  if (data.dht) {
      dState.dht = data.dht;
      // SIMPAN KE LOG DATABASE
      try {
          SensorLog.create({
              deviceId,
              temperature: data.dht.temperature,
              humidity: data.dht.humidity,
              timestamp: new Date().toISOString()
          });

          // JALANKAN PREDIKSI AI JIKA ADA DATA LDR
          if (typeof data.ldr !== 'undefined') {
              dState.ldr = data.ldr;
              console.log(`[MQTT] 🔦 LDR Update: ${data.ldr}`);
              
              runAIPrediction(deviceId, data.dht.temperature, data.dht.humidity, data.ldr)
                  .then(prediction => {
                      if (prediction) {
                          dState.aiRisk = prediction.riskLevel;
                          dState.aiLabel = prediction.label;
                          broadcast('device_update', deviceId, dState);
                      }
                  });
          }
      } catch (e) {
          console.error('[DB] Gagal simpan log:', e.message);
      }
  }
  if (typeof data.system !== 'undefined') dState.system = data.system;
  
  // Update WiFi info dari sensor payload juga
  if (data.wifi_ssid) dState.wifi_ssid = data.wifi_ssid;
  if (typeof data.rssi !== 'undefined') dState.rssi = data.rssi;
  
  dState.lastUpdate = Date.now();
  broadcast('device_update', deviceId, dState); 
});

mqttBridge.onStatusData((deviceId, data) => {
  const dState = getDeviceState(deviceId);
  if (typeof data.system       !== 'undefined') dState.system        = data.system;
  if (data.lampColor) dState.lampColor = data.lampColor;
  if (typeof data.lampBrightness !== 'undefined') dState.lampBrightness = data.lampBrightness;
  
  // FIX: Terima wifi_list dengan format fleksibel dari ESP32
  if (data.wifi_ssid) dState.wifi_ssid = data.wifi_ssid;
  if (typeof data.rssi !== 'undefined') dState.rssi = data.rssi;
  
  // Terima wifi_list dari kedua format: { type:'wifi_list', networks:[...] } ATAU { wifi_list:[...] }
  if (data.type === 'wifi_list' && data.networks) {
      dState.wifi_list = data.networks;
      console.log(`[MQTT] 📶 WiFi list diterima: ${data.networks.length} jaringan`);
  } else if (data.wifi_list && Array.isArray(data.wifi_list)) {
      dState.wifi_list = data.wifi_list;
      console.log(`[MQTT] 📶 WiFi list diterima: ${data.wifi_list.length} jaringan`);
  }

  dState.lastUpdate = Date.now();
  broadcast('device_status', deviceId, dState);
});

// ============================================================
//  REST API ENDPOINTS
// ============================================================

app.get('/api/status', (req, res) => {
  res.json({ ok: true, devices });
});

app.post('/api/control', (req, res) => {
  const { deviceId, ...payload } = req.body;
  if (!deviceId) return res.status(400).json({ ok: false, error: 'deviceId wajib diisi' });
  mqttBridge.publishControl(payload, deviceId);
  res.json({ ok: true, message: `Perintah terkirim ke ${deviceId}`, payload });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/history/:deviceId', authenticate, async (req, res) => {
  try {
    const history = SensorLog.getHistory(req.params.deviceId, 24);
    res.json({ ok: true, history });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Gagal mengambil riwayat' });
  }
});

app.get('/api/alerts/:deviceId', authenticate, (req, res) => {
    try {
        const alerts = Alert.getRecent(req.params.deviceId, 10);
        res.json({ ok: true, alerts });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Gagal mengambil riwayat peringatan' });
    }
});

app.post('/api/scans', authenticate, (req, res) => {
    console.log('[API] Menerima Hasil Scan:', req.body);
    try {
        if (!req.body.deviceId || !req.body.location) {
            return res.status(400).json({ ok: false, error: 'Data tidak lengkap' });
        }
    const scanPayload = { ...req.body };
    if (scanPayload.imageData) {
      const savedImage = saveImageDataUriToFile(scanPayload.imageData, scanPayload.imageName);
      if (savedImage) {
        scanPayload.imagePath = savedImage.imagePath;
        scanPayload.imageType = savedImage.imageType;
        scanPayload.imageData = null;
      }
    }
    Scan.create(scanPayload);
        console.log('[API] ✅ Berhasil simpan ke DB');
        res.json({ ok: true });
    } catch (err) {
        console.error('[API] ❌ Gagal simpan scan:', err.message);
        res.status(400).json({ ok: false, error: 'Gagal menyimpan hasil pemindaian: ' + err.message });
    }
});

app.delete('/api/scans/:id', authenticate, (req, res) => {
    const { id } = req.params;
    console.log(`[API] 🗑️ Mencoba menghapus scan ID: ${id}`);
    try {
        const info = db.prepare('DELETE FROM scan_history WHERE id = ?').run(id);
        if (info.changes > 0) {
            console.log(`[API] ✅ Berhasil menghapus scan ID: ${id}`);
            res.json({ ok: true, message: 'Riwayat berhasil dihapus' });
        } else {
            console.warn(`[API] ⚠️ Scan ID ${id} tidak ditemukan`);
            res.status(404).json({ ok: false, error: 'Data tidak ditemukan' });
        }
    } catch (e) {
        console.error(`[API] ❌ Gagal menghapus scan ID ${id}:`, e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

  app.post('/api/admin/migrate-scan-images', authenticate, isAdmin, (req, res) => {
    try {
      const migratedCount = migrateLegacyScanImages();
      res.json({ ok: true, migratedCount: migratedCount || 0 });
    } catch (err) {
      console.error('[API] ❌ Gagal migrasi gambar legacy:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

app.get('/api/scans/:deviceId', authenticate, (req, res) => {
    try {
        const scans = Scan.getHistory(req.params.deviceId, 500);
        res.json({ ok: true, scans });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Gagal mengambil riwayat pemindaian' });
    }
});

app.get('/api/alerts/:deviceId', authenticate, (req, res) => {
    try {
        const alerts = Alert.getRecent(req.params.deviceId, 10);
        res.json({ ok: true, alerts });
    } catch (err) {
        res.status(500).json({ ok: false, error: 'Gagal mengambil riwayat peringatan' });
    }
});

// USER & DEVICE MANAGEMENT (SQLite)

app.get('/api/users', authenticate, isAdmin, async (req, res) => {
  const users = User.findAll();
  res.json({ ok: true, users });
});

app.post('/api/users', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    await User.create({ name, username, password, role, initials });
    res.json({ ok: true, message: 'User berhasil ditambah' });
  } catch (err) {
    console.error('[API] Gagal menambah user:', err.message);
    let errorMsg = 'Gagal menambah user';
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      errorMsg = 'Username sudah terdaftar! Gunakan username lain.';
    }
    res.status(400).json({ ok: false, error: errorMsg });
  }
});

app.delete('/api/users/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const userToDelete = User.findOne({ id: req.params.id });
    if (userToDelete && userToDelete.username === 'admin') {
      return res.status(403).json({ ok: false, error: 'Akun Master Admin tidak boleh dihapus!' });
    }
    User.delete(req.params.id);
    res.json({ ok: true, message: 'User berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Terjadi kesalahan sistem' });
  }
});

app.get('/api/devices', authenticate, async (req, res) => {
  const dbDevices = Device.findAll();
  res.json({ ok: true, devices: dbDevices });
});

app.post('/api/devices', authenticate, isAdmin, async (req, res) => {
  try {
    const { deviceId, name } = req.body;
    Device.create({ deviceId, name });
    res.json({ ok: true, message: 'Perangkat berhasil terdaftar' });
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Gagal mendaftar perangkat' });
  }
});

app.delete('/api/devices/:id', authenticate, isAdmin, async (req, res) => {
  Device.delete(req.params.id);
  res.json({ ok: true, message: 'Perangkat berhasil dihapus' });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = User.findOne({ username });
  
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    res.json({ ok: true, token, user: { name: user.name, role: user.role, username: user.username } });
  } else {
    res.status(401).json({ ok: false, error: 'Username atau Password salah!' });
  }
});

// ============================================================
//  START SERVER
// ============================================================
server.listen(PORT, () => {
  console.log(`\n🚀 SleepWell Backend (SQLite) running on http://localhost:${PORT}`);
  console.log(`🌐 API ready, Database local: sleepwell.db\n`);
});
