#include <DHT.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <WebServer.h>

// --- WIFI AP SETTINGS ---
const char* ap_ssid = "ESP32_Data_Logger";
const char* ap_pass = "12345678";

// --- SENSOR & PIN ---
#define DHTPIN 26
#define DHTTYPE DHT11
#define LDRPIN 34
#define LED_PIN 21

// --- IDENTITAS ALAT ---
const String myDeviceID = "mold-scanner-04";

DHT dht(DHTPIN, DHTTYPE);
WebServer server(80);

// --- FUNGSI: DOWNLOAD DATA ---
void handleDownload() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (LittleFS.exists("/data.csv")) {
    File file = LittleFS.open("/data.csv", "r");
    server.sendHeader("Content-Disposition", "attachment; filename=data.csv");
    server.streamFile(file, "text/csv");
    file.close();
  } else {
    server.send(404, "text/plain", "File tidak ditemukan.");
  }
}

// --- FUNGSI: STATUS ONLINE ---
void handleStatus() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", String("{\"deviceId\":\"") + myDeviceID + "\",\"status\":\"online\",\"system\":\"ready\",\"heartbeat\":true}");
}

// --- FUNGSI: HAPUS DATA (RESET) ---
void handleReset() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  File file = LittleFS.open("/data.csv", "w");
  if (file) {
    file.println("timestamp_ms,temp,hum,ldr,scan_status,image_uploaded");
    file.close();
    server.send(200, "text/plain", "Data berhasil di-reset!");
    Serial.println("Log: Data di-reset oleh user.");
  } else {
    server.send(500, "text/plain", "Gagal me-reset data.");
  }
}

// --- FUNGSI: LED INDIKATOR ---
// Mode: true = kedua sensor OK (nyala terus), false = error (blink cepat)
void updateLED(bool allSensorsOK) {
  if (allSensorsOK) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS gagal mount");
    return;
  }

  WiFi.mode(WIFI_AP);
  WiFi.softAP(ap_ssid, ap_pass);
  Serial.println("WiFi: " + String(ap_ssid));
  Serial.println("IP: " + WiFi.softAPIP().toString());

  server.on("/download", handleDownload);
  server.on("/reset", handleReset);
  server.on("/status", handleStatus);
  server.begin();

  if (!LittleFS.exists("/data.csv")) {
    File file = LittleFS.open("/data.csv", "w");
    if (file) {
      file.println("timestamp_ms,temp,hum,ldr,scan_status,image_uploaded");
      file.close();
    }
  }
}

void loop() {
  server.handleClient();

  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate >= 5000) {
    lastUpdate = millis();

    float t = dht.readTemperature();
    float h = dht.readHumidity();
    int ldr = analogRead(LDRPIN);

    if (isnan(t) || isnan(h)) {
      Serial.println("Gagal baca DHT!");
      updateLED(false);
      return;
    }

    bool ldrOK = (ldr > 0);
    if (!ldrOK) {
      Serial.println("Gagal baca LDR!");
      updateLED(false);
      return;
    }

    updateLED(true);

    String scanStatus = "unknown";
    String imageUploaded = "false";
    
    if (!isnan(t) && !isnan(h) && ldr > 0) {
      scanStatus = "ok";
    } else {
      scanStatus = "error";
    }

    String data = String(millis()) + "," + String(t) + "," + String(h) + "," + String(ldr) + "," + scanStatus + "," + imageUploaded;
    File file = LittleFS.open("/data.csv", "a");
    if (file) {
      file.println(data);
      file.close();
      Serial.println("Saved: " + data);
    }
  }
}
