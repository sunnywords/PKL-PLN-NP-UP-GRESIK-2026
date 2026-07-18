import paho.mqtt.client as mqtt
import json
import joblib
import pandas as pd
import os
import time
from threading import Lock

# --- KONFIGURASI MQTT ---
MQTT_HOST = "4ecff5933a704e218192a9a9390c3580.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USER = "ayamA"
MQTT_PASS = "Al280805."
MQTT_TOPIC = "doc/data/+/sensor"

# --- GLOBAL VARIABLES ---
is_scanning = False
predictions = []
data_lock = Lock()
current_device = "Unknown"

# --- LOAD MODEL ---
MODEL_PATH = "mold_risk_model.pkl"
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "../backend/ai/mold_risk_model.pkl"

print(f"[*] Loading model dari: {MODEL_PATH}")
try:
    model = joblib.load(MODEL_PATH)
    print("[+] Model berhasil dimuat!")
except Exception as e:
    print(f"[-] ERROR: Gagal memuat model. ({e})")
    exit()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[+] Terhubung ke HiveMQ Cloud Broker!")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"[-] Gagal terhubung, rc: {rc}")

def on_message(client, userdata, msg):
    global is_scanning, predictions, current_device
    if not is_scanning:
        return

    try:
        payload = json.loads(msg.payload.decode())
        current_device = payload.get("deviceId", "Unknown")
        
        temp = float(payload["dht"]["temperature"])
        hum = float(payload["dht"]["humidity"])
        ldr = float(payload["ldr"])
        
        input_data = pd.DataFrame([[temp, hum, ldr]], columns=['temp', 'hum', 'ldr'])
        pred = model.predict(input_data)[0]
        
        with data_lock:
            predictions.append(int(pred))
            
        risk_text = ["LOW", "MEDIUM", "HIGH"][int(pred)]
        print(f"[SCAN] Data: {temp}°C, {hum}%, LDR: {ldr} | Risk: {risk_text}", end='\r')

    except Exception:
        pass

# --- SETUP MQTT ---
client = mqtt.Client()
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.tls_set()
client.on_connect = on_connect
client.on_message = on_message

print("[*] Menghubungkan ke broker...")
client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()

# --- MAIN LOOP ---
try:
    while True:
        print("\n" + "="*40)
        print("      FUNGIGUARD AI - MQTT PRO SCANNER")
        print("="*40)
        print("1. Mulai Scan (1 Menit)")
        print("2. Mulai Scan (3 Menit)")
        print("3. Keluar")
        
        pilihan = input("\nPilih menu (1/2/3): ")
        
        if pilihan == '3':
            break
        elif pilihan not in ['1', '2']:
            print("Pilihan tidak valid!")
            continue
            
        duration = 60 if pilihan == '1' else 180
        
        print(f"\n[!] Scanning dimulai selama {duration} detik...")
        print("[!] Sila arahkan alat ke area target.")
        
        with data_lock:
            predictions = []
            is_scanning = True
        
        start_time = time.time()
        while (time.time() - start_time) < duration:
            time.sleep(1)
            remaining = int(duration - (time.time() - start_time))
            print(f"Sisa waktu: {remaining}s | Sampel: {len(predictions)}", end='\r')
            
        with data_lock:
            is_scanning = False
        
        print("\n" + "-"*40)
        if not predictions:
            print("[-] Gagal: Tidak ada data yang diterima selama scan.")
            continue
            
        # VOTING MAYORITAS
        final_risk = max(set(predictions), key=predictions.count)
        risk_labels = {
            0: "LOW (Lingkungan Aman & Bersih)", 
            1: "MEDIUM (Waspada: Kondisi Mendukung Pertumbuhan Jamur)", 
            2: "HIGH (BAHAYA: Risiko Tinggi Pertumbuhan Jamur!)"
        }
        
        print("\n" + "*"*40)
        print("            KESIMPULAN SCAN (MQTT)")
        print("*"*40)
        print(f" DEVICE ID   : {current_device}")
        print(f" HASIL AKHIR : {risk_labels[final_risk]}")
        print(f" TOTAL DATA  : {len(predictions)} poin")
        print("*"*40)
        
        if final_risk == 2:
            print("\n[!] REKOMENDASI:")
            print("1. Gunakan dehumidifier untuk menurunkan kelembaban.")
            print("2. Bersihkan area dengan cairan antifungal.")
            print("3. Tingkatkan pencahayaan di area tersebut.")
        elif final_risk == 1:
            print("\n[!] SARAN:")
            print("1. Buka ventilasi udara agar sirkulasi lebih lancar.")
            print("2. Cek secara berkala jika ada kebocoran air.")
        else:
            print("\n[+] CATATAN:")
            print("Kondisi ruangan sangat baik. Pertahankan kebersihan area ini.")

except KeyboardInterrupt:
    print("\n[!] Dihentikan.")
finally:
    client.loop_stop()
    client.disconnect()

