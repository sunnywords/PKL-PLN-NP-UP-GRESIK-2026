const mqtt = require('mqtt');

// KONFIGURASI HIVEMQ CLOUD (Sesuai dengan ESP32)
const options = {
    host: '4ecff5933a704e218192a9a9390c3580.s1.eu.hivemq.cloud',
    port: 8883,
    protocol: 'mqtts',
    username: 'ayamA',
    password: 'Al280805.',
    rejectUnauthorized: false // Agar tidak error sertifikat SSL di Node.js
};

const client = mqtt.connect(options);

const baseTopic = 'doc/data';
let sensorDataHandler = null;
let statusDataHandler = null;

client.on('connect', () => {
    console.log('[MQTT] ✅ Terhubung ke HiveMQ Cloud Broker');
    // Subscribe ke semua data sensor dan status dari semua device
    client.subscribe(`${baseTopic}/+/sensor`);
    client.subscribe(`${baseTopic}/+/status`);
});

client.on('message', (topic, message) => {
    try {
        const parts = topic.split('/');
        const deviceId = parts[2];
        const type = parts[3];
        const data = JSON.parse(message.toString());

        if (type === 'sensor' && sensorDataHandler) {
            sensorDataHandler(deviceId, data);
        } else if (type === 'status' && statusDataHandler) {
            statusDataHandler(deviceId, data);
        }
    } catch (e) {
        console.error('[MQTT] Error parsing message:', e.message);
    }
});

client.on('error', (err) => {
    console.error('[MQTT] ❌ Error:', err.message);
});

module.exports = {
    onSensorData: (handler) => { sensorDataHandler = handler; },
    onStatusData: (handler) => { statusDataHandler = handler; },
    publishControl: (payload, deviceId) => {
        const topic = `${baseTopic}/${deviceId}/control`;
        client.publish(topic, JSON.stringify(payload));
    }
};
