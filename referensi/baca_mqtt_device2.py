import paho.mqtt.client as mqtt
import json
from datetime import datetime

# --- KONFIGURASI HIVEMQ CLOUD ---
MQTT_HOST = "4ecff5933a704e218192a9a9390c3580.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USER = "ayamA"
MQTT_PASS = "Al280805."

# --- DEVICE ID ---
DEVICE_ID = "mold-scanner-04"

# --- TOPICS ---
TOPIC_SENSOR = f"doc/data/{DEVICE_ID}/sensor"
TOPIC_STATUS = f"doc/data/{DEVICE_ID}/status"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Terhubung ke broker HiveMQ!")
        print(f"📡 Mendengarkan data untuk device: {DEVICE_ID}")
        client.subscribe(TOPIC_SENSOR)
        client.subscribe(TOPIC_STATUS)
        print(f"   - {TOPIC_SENSOR}")
        print(f"   - {TOPIC_STATUS}")
        print("-" * 50)
    else:
        print(f"❌ Gagal terhubung, return code {rc}")

def on_message(client, userdata, msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    topic = msg.topic
    
    try:
        payload = json.loads(msg.payload.decode())
        print(f"[{timestamp}] TOPIC: {topic}")
        print(json.dumps(payload, indent=2))
        print("-" * 50)
    except json.JSONDecodeError:
        print(f"[{timestamp}] TOPIC: {topic}")
        print(f"Payload (Raw): {msg.payload.decode()}")
        print("-" * 50)

# Konfigurasi MQTT Client dengan TLS
client = mqtt.Client()
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.tls_set()

client.on_connect = on_connect
client.on_message = on_message

try:
    print("Mencoba menyambungkan ke broker...")
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_forever()
except KeyboardInterrupt:
    print("\n[!] Dihentikan oleh user.")
    client.disconnect()
except Exception as e:
    print(f"\n[!] Error: {e}")
