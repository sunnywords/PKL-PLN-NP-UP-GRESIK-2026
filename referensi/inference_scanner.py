import joblib
import pandas as pd
import numpy as np
import time
import serial
import serial.tools.list_ports
import os
from datetime import datetime

# 1. KONFIGURASI SERIAL & MODEL
BAUD_RATE = 9600
MODEL_PATH = 'mold_risk_model.pkl'

def connect_serial():
    """Fungsi untuk mendeteksi dan menghubungkan ke Serial Port secara otomatis"""
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("Error: Tidak ada perangkat IoT terdeteksi di USB!")
        return None
    
    # Menampilkan daftar port yang tersedia
    print("\nPort USB Terdeteksi:")
    for i, p in enumerate(ports):
        print(f"{i+1}. {p.device} ({p.description})")
    
    try:
        pilihan = int(input("\nPilih nomor port perangkat Arduino/ESP (misal: 1): ")) - 1
        if pilihan < 0 or pilihan >= len(ports):
            print("Pilihan tidak valid.")
            return None
        target_port = ports[pilihan].device
    except ValueError:
        print("Masukkan angka!")
        return None
    
    try:
        ser = serial.Serial(target_port, BAUD_RATE, timeout=2)
        print(f"-> Berhasil terhubung ke {target_port}")
        # Tunggu inisialisasi serial (beberapa board restart saat konek)
        time.sleep(2)
        return ser
    except Exception as e:
        print(f"Error Koneksi: {e}")
        return None

def get_sensor_from_serial(ser):
    """Membaca dan memparsing data dari Serial (Format yang diharapkan: temp;hum;ldr)"""
    try:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            # Pisahkan data berdasarkan ';'
            data = line.split(';')
            if len(data) == 3:
                temp = float(data[0])
                hum = float(data[1])
                ldr = float(data[2])
                return temp, hum, ldr
    except Exception as e:
        # print(f"Debug: Skip line kotor ({e})")
        pass
    return None, None, None

def run_scanner():
    print("\n" + "="*40)
    print("      FUNGIGUARD AI REAL-TIME SCANNER")
    print("="*40)

    if not os.path.exists(MODEL_PATH):
        print(f"Error: Model '{MODEL_PATH}' tidak ditemukan!")
        print("Pastikan kamu sudah menjalankan script training terlebih dahulu.")
        return

    # Inisialisasi Koneksi & Model
    ser = connect_serial()
    if not ser: return
    
    print("-> Loading AI Model...")
    model = joblib.load(MODEL_PATH)
    
    # 2. PILIH DURASI
    print("\nPilih Durasi Deteksi:")
    print("1. 1 Menit (Cepat)")
    print("2. 3 Menit (Sangat Akurat)")
    pilihan = input("Masukkan pilihan (1/2): ")
    
    duration_sec = 60 if pilihan == '1' else 180
    start_time = time.time()
    
    predictions = []
    print(f"\n-> Pemindaian Dimulai (Durasi: {duration_sec}s)")
    print("-> Sila arahkan alat ke area yang ingin diperiksa...")
    print("-" * 40)

    try:
        while (time.time() - start_time) < duration_sec:
            temp, hum, ldr = get_sensor_from_serial(ser)
            
            if temp is not None:
                # Prediksi menggunakan model LightGBM (Hanya 3 Sensor Utama)
                input_data = pd.DataFrame([[temp, hum, ldr]], 
                                         columns=['temp', 'hum', 'ldr'])
                
                risk_level = model.predict(input_data)[0]
                predictions.append(risk_level)
                
                # Tampilkan info real-time ke console
                elapsed = int(time.time() - start_time)
                rem = max(0, duration_sec - elapsed)
                
                risk_text = ["LOW", "MEDIUM", "HIGH"][int(risk_level)]
                print(f"Sisa Waktu: {rem:3d}s | Sensor: {temp:4.1f}C, {hum:4.1f}%, {ldr:5.0f} | Risk: {risk_text}", end='\r')
            
            time.sleep(0.5) # Sampling cepat agar data lebih padat

    except KeyboardInterrupt:
        print("\n\nScanning dibatalkan oleh pengguna.")

    # 3. KESIMPULAN AKHIR
    ser.close()
    print("\n" + "-" * 40)
    
    if not predictions:
        print("Error: Tidak ada data yang masuk dari sensor.")
        print("Pastikan format output Arduino adalah: Serial.println(temp + \";\" + hum + \";\" + ldr);")
        return

    # Voting mayoritas untuk hasil paling stabil
    final_risk = max(set(predictions), key=predictions.count)
    risk_labels = {
        0: "LOW (Lingkungan Aman & Bersih)", 
        1: "MEDIUM (Waspada: Kondisi Mendukung Pertumbuhan Jamur)", 
        2: "HIGH (BAHAYA: Risiko Tinggi Pertumbuhan Jamur!)"
    }
    
    print("\n" + "*"*40)
    print("            KESIMPULAN SCAN")
    print("*"*40)
    print(f"HASIL AKHIR  : {risk_labels[final_risk]}")
    print(f"TOTAL SAMPEL : {len(predictions)} data poin")
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

if __name__ == "__main__":
    run_scanner()
