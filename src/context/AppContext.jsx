import { createContext, useContext, useEffect, useState, useRef } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [token, setToken] = useState(sessionStorage.getItem('sleepwell_token') || null);
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('sleepwell_user')) || null);
  
  // New Multi-Device State
  const [devices, setDevices] = useState({});
  const [activeDeviceId, setActiveDeviceId] = useState(sessionStorage.getItem('activeDeviceId') || null);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [espHttpOnline, setEspHttpOnline] = useState(false);
  const [espHttpLastSeen, setEspHttpLastSeen] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    if (activeDeviceId) {
      sessionStorage.setItem('activeDeviceId', activeDeviceId);
    }
  }, [activeDeviceId]);
  
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);

  // Force local backend host to avoid routing to ESP32 AP when laptop connects to its Wi‑Fi
  const API_HOST = 'localhost';
  const WS_URL = `ws://${API_HOST}:3000`;
  const API_URL = `http://${API_HOST}:3000`;
  const ESP_STATUS_URL = 'http://192.168.4.1/status';

  const fetchDevices = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        setDevices(prev => {
          const newDevices = { ...prev };
          data.devices.forEach(d => {
            if (!newDevices[d.deviceId]) {
              newDevices[d.deviceId] = {
                id: d.deviceId,
                name: d.name,
                system: false,
                sensors: [],
                dht: { temperature: 0, humidity: 0 },
                lastSeen: 0,
                isRegistered: true
              };
            } else {
              newDevices[d.deviceId].name = d.name;
              newDevices[d.deviceId].isRegistered = true;
            }
          });
          
          return newDevices;
        });

        const registeredIds = data.devices.map(d => d.deviceId);
        if (data.devices.length > 0) {
          setActiveDeviceId(prevActive => {
            if (!prevActive || !registeredIds.some(id => id.toLowerCase() === prevActive.toLowerCase())) {
              return data.devices[0].deviceId;
            }
            const matchedCasing = registeredIds.find(id => id.toLowerCase() === prevActive.toLowerCase());
            return matchedCasing || prevActive;
          });
        }
      }
    } catch (e) {
      console.error("Gagal fetch devices", e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDevices();
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const checkEspHttpStatus = async () => {
      try {
        const res = await fetch(ESP_STATUS_URL, { cache: 'no-store' });
        const data = await res.json();
        const online = res.ok && data?.status === 'online';
        console.log("ESP32 STATUS:", data);
        console.log("ESP ONLINE:", online);

        if (cancelled) return;

        setEspHttpOnline(online);
        if (online) {
          const seenAt = Date.now();
          setEspHttpLastSeen(seenAt);

          if (data?.deviceId) {
            setDevices(prev => {
              const targetKey = Object.keys(prev).find(
                key => key.toLowerCase() === data.deviceId.toLowerCase()
              ) || data.deviceId;

              return {
                ...prev,
                [targetKey]: {
                  ...(prev[targetKey] || {}),
                  id: targetKey,
                  system: data.system === 'ready',
                  lastSeen: seenAt,
                  httpOnline: true,
                  wifi_ssid: data.wifi_ssid || prev[targetKey]?.wifi_ssid || 'ESP32_Data_Logger',
                  dht: {
                    temperature: data.temperature || 0,
                    humidity: data.humidity || 0
                  },

                  ldr: data.ldr || 0
                }
              };
            });
            setActiveDeviceId(prevActive => {
              if (prevActive && prevActive.toLowerCase() === data.deviceId.toLowerCase()) {
                return prevActive;
              }
              return data.deviceId;
            });
          }
        }
      } catch (e) {
        if (cancelled) return;
        setEspHttpOnline(false);
      }
    };

    checkEspHttpStatus();
    const timer = setInterval(checkEspHttpStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    function connect() {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setIsConnected(true);
      };

      ws.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'device_update' || msg.type === 'device_status') {
            const devId = msg.deviceId;
            setDevices(prev => {
              const updated = {
                ...prev,
                [devId]: {
                  ...(prev[devId] || {}),
                  ...msg.data,
                  lastSeen: msg.data.lastUpdate || 0
                }
              };
              
              // Jika ada data wifi_list, simpan ke field khusus
              if (msg.data && msg.data.wifi_list) {
                  updated[devId].wifi_list = msg.data.wifi_list;
              }

              // AUTO-SELECT: Jika belum ada alat aktif, set alat yang baru lapor ini jadi aktif
              setActiveDeviceId(prevActive => prevActive || devId);
              
              return updated;
            });
          }
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        setTimeout(connect, 3000);
      };
    }
    
    connect();

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [token]); // removed activeDeviceId dependency to avoid re-connecting on active change
  
  useEffect(() => {
    let lastAlertTime = localStorage.getItem('last_alert_time') || new Date().toISOString();
    
    const checkAlerts = async () => {
      if (!token || !activeDeviceId) return;
      try {
        const res = await fetch(`${API_URL}/api/alerts/${activeDeviceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.ok && data.alerts.length > 0) {
          const newest = data.alerts[0].timestamp;
          if (newest > lastAlertTime) {
            setHasNewAlert(true);
          }
        }
      } catch (e) {
        console.error('Check alerts error:', e);
      }
    };

    const alertTimer = setInterval(checkAlerts, 10000); // Cek tiap 10 detik
    checkAlerts(); // Cek langsung saat mount/active change
    
    return () => clearInterval(alertTimer);
  }, [token, activeDeviceId]);

  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('sleepwell_token', data.token); // Tetap simpan di localStorage jika user minta persist
        localStorage.setItem('sleepwell_user', JSON.stringify(data.user));
        sessionStorage.setItem('sleepwell_token', data.token);
        sessionStorage.setItem('sleepwell_user', JSON.stringify(data.user));
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Terjadi kesalahan' };
    } catch (e) {
      return { ok: false, error: 'Gagal menghubungi server. Pastikan backend sudah jalan!' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setDevices({});
    setActiveDeviceId(null);
    localStorage.removeItem('sleepwell_token');
    localStorage.removeItem('sleepwell_user');
    sessionStorage.removeItem('sleepwell_token');
    sessionStorage.removeItem('sleepwell_user');
    if (ws.current) ws.current.close();
  };

  const sendCommand = async (payload) => {
    if (!token || !activeDeviceId) return;
    try {
      await fetch(`${API_URL}/api/control`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ deviceId: activeDeviceId, ...payload })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const activeDevice = devices[activeDeviceId] || {};
  const espLastSeenRaw = activeDevice.lastSeen || espHttpLastSeen || 0;
  const espLastSeen = typeof espLastSeenRaw === 'string' ? new Date(espLastSeenRaw).getTime() : espLastSeenRaw;
  const mqttDeviceOnline = espLastSeen > 0 && (now - espLastSeen) < 15000;
  const isDeviceOnline = mqttDeviceOnline || espHttpOnline;
  const state = {
    system: activeDevice.system || false,
    dht: activeDevice.dht || { temperature: 0, humidity: 0 },
    sensors: activeDevice.sensors || [],
    lampColor: activeDevice.lampColor || 'putih',
    lampBrightness: activeDevice.lampBrightness || 0,
    ldr: activeDevice.ldr || 0,
    wifi_ssid: activeDevice.wifi_ssid || 'Disconnected',
    rssi: activeDevice.rssi || 0,
    wifi_list: activeDevice.wifi_list || []
  };
  const mergedDeviceOnline = isDeviceOnline || (espLastSeen > 0 && (now - espLastSeen) < 15000);

  return (
    <AppContext.Provider value={{ 
        devices, 
        activeDeviceId, 
        setActiveDeviceId, 
        state, 
        isConnected, 
        espLastSeen,
        isDeviceOnline: mergedDeviceOnline,
        espHttpOnline,
        token, 
        user,
        login, 
        logout, 
        sendCommand,
        fetchDevices,
        hasNewAlert,
        setHasNewAlert
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
