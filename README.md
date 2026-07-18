# 🛡️ FungiGuard AI - Portable Mold Scanner & Forecaster

Selamat datang di repositori **FungiGuard AI**! Sistem ini dirancang untuk mendeteksi risiko pertumbuhan jamur di berbagai area menggunakan sensor IoT (ESP32) dan kecerdasan buatan (Machine Learning).

---

## 🚀 Cara Menjalankan Sistem (Quick Start)

Untuk menjalankan sistem secara keseluruhan, ikuti langkah-langkah berikut:

### 1. Jalankan Backend (Server & Database)
Server ini berfungsi mengelola data dari MQTT (HiveMQ Cloud) dan menyimpannya ke database SQLite.
1. Buka terminal baru.
2. Masuk ke folder backend: `cd backend`
3. Jalankan server: `npm run dev`
   - **URL Backend**: `http://localhost:3000`
   - **Status**: Cek apakah muncul pesan `[MQTT] ✅ Terhubung ke HiveMQ Cloud Broker`.

### 2. Jalankan Frontend (Dashboard Web)
Dashboard web digunakan untuk memantau data secara real-time dan melakukan analisis AI.
1. Buka terminal baru lagi.
2. Masuk ke folder root (SleepWell-Website): `cd ..` (jika tadi di backend)
3. Jalankan web: `npm run dev`
   - **URL Web**: `http://localhost:5173`
4. Login menggunakan akun yang sudah terdaftar.

### 3. Persiapan Hardware (ESP32)
1. Buka folder `esp/mold_scanner_pro/` di Arduino IDE.
2. Pastikan library berikut sudah terinstall:
   - `WiFiManager`
   - `PubSubClient` (untuk MQTT)
   - `ArduinoJson`
   - `DHT sensor library`
3. Flash file `mold_scanner_pro.ino` ke ESP32 kamu.
4. **Baud Rate**: Set Serial Monitor ke `9600`.

---

## 💡 Fitur Utama

- **Majority Voting AI**: Hasil scan tidak hanya berdasarkan data instan, tapi hasil voting dari puluhan sampel selama durasi scan (15s/30s/1menit) untuk hasil yang sangat stabil.
- **Smart LED Indicator**:
  - **NYALA TERUS (Solid)**: Semua sensor (DHT & LDR) sehat. ✅✅
  - **KEDIP-KEDIP (Blinking)**: Salah satu sensor error. ⚠️
  - **MATI (Off)**: Semua sensor error. ❌❌
- **Live Device Logs**: Pantau data mentah (JSON) langsung dari ESP32 di bagian bawah dashboard web.
- **WiFi Manager**: Ganti jaringan WiFi langsung dari dashboard web tanpa flash ulang.

---

## 📁 Struktur Folder

- `/backend`: Node.js server, API, dan integrasi MQTT.
- `/src`: Source code Frontend (React + Tailwind).
- `/esp`: Firmware untuk perangkat ESP32.
- `/referensi`: Model AI `.pkl` dan script inferensi asli.

---

**Dibuat dengan ❤️ untuk Kompetisi IoT Lomba**
