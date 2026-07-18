import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { buildCombinedAnalysis, calculateSensorQuality, getMoldInsights } from '../utils/moldInsights';

export default function DashboardMetrics() {
    const { state, espLastSeen, isConnected, token, activeDeviceId, devices, isDeviceOnline } = useAppContext();
    const [isScanning, setIsScanning] = useState(false);
    const [isScanInProgress, setIsScanInProgress] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanMode, setScanMode] = useState('single');
    const [scanDuration, setScanDuration] = useState(15);
    const [autoIntervalSeconds, setAutoIntervalSeconds] = useState(60);
    const [scanLocation, setScanLocation] = useState('');
    const [scanNotes, setScanNotes] = useState('');
    const [scanHistory, setScanHistory] = useState([]);
    const [selectedScan, setSelectedScan] = useState(null);
    const [scanToDelete, setScanToDelete] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const [predictionSamples, setPredictionSamples] = useState([]);
    const [scanImage, setScanImage] = useState(null);
    const [scanImagePreview, setScanImagePreview] = useState('');
    const [scanImageName, setScanImageName] = useState('');
    const [scanImageType, setScanImageType] = useState('');
    const [recCollapse, setRecCollapse] = useState({ immediate: false, shortTerm: false, longTerm: false, checklist: false, tips: false });

    // --- REFS: selalu punya nilai terbaru, aman dibaca dari timer closure ---
    const predictionSamplesRef = useRef([]);
    const tempRef = useRef(0);
    const humRef = useRef(0);
    const ldrRef = useRef(0);
    const scanLocationRef = useRef('');
    const scanNotesRef = useRef('');
    const scanImageRef = useRef('');
    const scanImageNameRef = useRef('');
    const scanImageTypeRef = useRef('');
    const activeDeviceIdRef = useRef(null);
    const devicesRef = useRef({});
    const tokenRef = useRef(null);
    const timerRef = useRef(null);
    const autoTimeoutRef = useRef(null);


    const durations = [15, 30, 60];
    const autoIntervals = [60, 120, 180];

    // Explicit local backend host to avoid routing to ESP32 AP captive pages
    const API_URL = `http://localhost:3000`;


    const { system, dht, ldr } = state;
    const temp = dht?.temperature || 0;
    const hum = dht?.humidity || 0;


    // Sync semua nilai ke refs setiap render
    useEffect(() => { tempRef.current = temp; }, [temp]);
    useEffect(() => { humRef.current = hum; }, [hum]);
    useEffect(() => { ldrRef.current = state.ldr || 0; }, [state.ldr]);
    useEffect(() => { scanLocationRef.current = scanLocation; }, [scanLocation]);
    useEffect(() => { scanNotesRef.current = scanNotes; }, [scanNotes]);
    useEffect(() => { scanImageRef.current = scanImage || ''; }, [scanImage]);
    useEffect(() => { scanImageNameRef.current = scanImageName; }, [scanImageName]);
    useEffect(() => { scanImageTypeRef.current = scanImageType; }, [scanImageType]);
    useEffect(() => { activeDeviceIdRef.current = activeDeviceId; }, [activeDeviceId]);
    useEffect(() => { devicesRef.current = devices; }, [devices]);
    useEffect(() => { tokenRef.current = token; }, [token]);
    useEffect(() => {
        if (scanMode === 'auto') {
            setScanDuration(15);
        }
    }, [scanMode]);

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Mohon upload file gambar yang valid.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert('Ukuran gambar terlalu besar. Maksimal 2MB agar scan tetap ringan.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setScanImage(reader.result || '');
            setScanImagePreview(reader.result || '');
            setScanImageName(file.name);
            setScanImageType(file.type);
        };
        reader.readAsDataURL(file);
    };

    const clearImageUpload = () => {
        setScanImage('');
        setScanImagePreview('');
        setScanImageName('');
        setScanImageType('');
        scanImageRef.current = '';
        scanImageNameRef.current = '';
        scanImageTypeRef.current = '';
    };

    // Fetch history dari server — terima parameter langsung agar tidak bergantung pada ref timing
    const fetchHistory = async (devId, tok) => {
        let id = devId || activeDeviceIdRef.current;
        
        // Fallback: jika id kosong, coba ambil alat pertama yang tersedia
        if (!id) {
            const availableIds = Object.keys(devicesRef.current);
            if (availableIds.length > 0) {
                id = availableIds[0];
                console.log('[HISTORY] Fallback ke alat pertama:', id);
            }
        }

        const t = tok || tokenRef.current;
        if (!id || !t) { 
            console.warn('[HISTORY] Skip fetch: no deviceId or token yet'); 
            return; 
        }
        
        setHistoryLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/scans/${id}`, {
                headers: { 'Authorization': `Bearer ${t}` }
            });
            const data = await res.json();
            console.log('[HISTORY] Fetch result:', data);
            if (data.ok) setScanHistory(data.scans);
        } catch (e) { console.error('Fetch history err:', e); }
        finally { setHistoryLoading(false); }
    };

    const confirmDelete = (e, id) => {
        e.stopPropagation();
        setScanToDelete(id);
    };

    const performDelete = async () => {
        if (!scanToDelete) return;
        const id = scanToDelete;
        
        try {
            console.log('[DEBUG] Mengirim request DELETE ke:', `${API_URL}/api/scans/${id}`);
            const res = await fetch(`${API_URL}/api/scans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${tokenRef.current}` }
            });
            const data = await res.json();
            console.log('[DEBUG] Respon hapus:', data);
            
            if (data.ok) {
                setScanHistory(prev => prev.filter(s => s.id !== id));
            } else {
                alert('Gagal menghapus: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[DEBUG] Delete scan error:', err);
            alert('Terjadi kesalahan jaringan: ' + err.message);
        } finally {
            setScanToDelete(null);
        }
    };

    // Fetch history saat pertama mount atau activeDeviceId berubah — kirim nilai langsung
    useEffect(() => {
        if (activeDeviceId && token) fetchHistory(activeDeviceId, token);
    }, [activeDeviceId, token]);

    const isAutoMode = scanMode === 'auto';

    const resetScanSession = () => {
        predictionSamplesRef.current = [];
        setPredictionSamples([]);
        setScanProgress(0);
        setScanResult(null);
    };

    const calculateRiskPercent = (riskBand, temperature, humidity, ldr, samples, sensorQuality = 50) => {
        const temp = Number(temperature) || 0;
        const hum = Number(humidity) || 0;
        const light = Number(ldr) || 0;
        const quality = Math.min(Math.max(Number(sensorQuality) || 0, 0), 100);

        const humidityFactor = Math.min(Math.max((hum - 40) / 50, 0), 1);
        const tempFactor = Math.min(Math.max((temp - 20) / 18, 0), 1);
        const lightFactor = Math.min(Math.max((250 - light) / 250, 0), 1);

        const sampleCount = Array.isArray(samples) ? samples.length : 0;
        let sampleConfidence = 0.5;
        if (sampleCount > 0) {
            const counts = {};
            samples.forEach(x => {
                const key = String(x);
                counts[key] = (counts[key] || 0) + 1;
            });
            sampleConfidence = Math.max(...Object.values(counts)) / sampleCount;
        }

        const qualityModifier = (quality - 50) / 100; // -0.5..+0.5
        let base = 15;
        if (riskBand === 1) {
            base = 35;
        } else if (riskBand >= 2) {
            base = 60;
        }

        const dynamicScore = base
            + humidityFactor * 28
            + tempFactor * 18
            + lightFactor * 14
            + sampleConfidence * 12
            + qualityModifier * 12;

        return Math.round(Math.min(100, Math.max(10, dynamicScore)));
    };

    const parseRecommendations = (recs = []) => {
        const groups = { immediate: [], shortTerm: [], longTerm: [], checklist: [], tips: [] };
        if (!Array.isArray(recs)) return groups;
        recs.forEach(r => {
            if (!r) return;
            const s = String(r).trim();
            const m = s.match(/^(IMMEDIATE|SHORT-TERM|LONG-TERM|CHECKLIST):\s*(.*)$/i);
            if (m) {
                let tag = m[1].toLowerCase().replace(/-/g, '');
                const content = (m[2] || '').split(/\s*\|\s*/).map(p => p.trim()).filter(Boolean);
                if (tag === 'immediate') groups.immediate.push(...content);
                else if (tag === 'shortterm') groups.shortTerm.push(...content);
                else if (tag === 'longterm') groups.longTerm.push(...content);
                else if (tag === 'checklist') groups.checklist.push(...content);
            } else {
                groups.tips.push(s);
            }
        });
        return groups;
    };
    const expandRecommendation = (text) => {
        if (!text) return text;
        const s = String(text).trim();
        if (/kondisi\s+ruangan\s+.*baik/i.test(s) || /kondisi\s+ini\s+masih\s+stabil/i.test(s)) {
            return 'Kondisi ruangan saat ini tampak baik — suhu dan kelembapan berada pada rentang aman, serta pencahayaan memadai. Pertahankan rutinitas pembersihan, pastikan sirkulasi udara berfungsi, dan lakukan pemeriksaan berkala untuk memastikan tidak ada perubahan yang meningkatkan risiko pertumbuhan jamur.';
        }
        if (s.length < 60) {
            return s + ' Mohon periksa checklist teknis untuk langkah lanjutan dan lakukan pengecekan lagi jika nilai sensor berubah.';
        }
        return s;
    };
    const getSensorQualityLabel = (value) => {
        const score = Number(value);
        if (!Number.isFinite(score)) return 'Tidak tersedia';
        if (score >= 85) return 'Sangat Baik';
        if (score >= 70) return 'Baik';
        if (score >= 55) return 'Cukup';
        return 'Perlu Dicek';
    };
    const buildRiskCounts = (history) => {
        const counts = { low: 0, medium: 0, high: 0, total: 0 };
        if (!Array.isArray(history) || history.length === 0) return counts;
        history.forEach((item) => {
            const risk = Number(item.riskLevel);
            if (Number.isFinite(risk)) {
                if (risk > 70) counts.high += 1;
                else if (risk > 40) counts.medium += 1;
                else counts.low += 1;
            }
        });
        counts.total = counts.low + counts.medium + counts.high;
        return counts;
    };
    const riskCounts = buildRiskCounts(scanHistory);
    const riskCircleRadius = 50;
    const riskCircleCircumference = 2 * Math.PI * riskCircleRadius;
    const lowSegment = riskCounts.total ? (riskCounts.low / riskCounts.total) * riskCircleCircumference : 0;
    const mediumSegment = riskCounts.total ? (riskCounts.medium / riskCounts.total) * riskCircleCircumference : 0;
    const highSegment = riskCounts.total ? (riskCounts.high / riskCounts.total) * riskCircleCircumference : 0;
    const toggleRec = (key) => setRecCollapse(prev => ({ ...prev, [key]: !prev[key] }));

    const beginScanCycle = () => {
        if (!scanLocation) return;
        if (!activeDeviceIdRef.current) {
            alert('⚠️ Alat belum terdeteksi/terpilih. Mohon pilih ruangan di pojok kanan atas sebelum memulai analisis.');
            setIsScanning(false);
            setIsScanInProgress(false);
            return;
        }

        resetScanSession();
        setIsScanInProgress(true);
        setIsScanning(true);
    };

    const startScan = () => {
        if (!scanLocation || isScanning) return;
        if (!activeDeviceId) {
            alert('⚠️ Alat belum terdeteksi/terpilih. Mohon pilih ruangan di pojok kanan atas sebelum memulai analisis.');
            return;
        }
        beginScanCycle();
    };

    const cancelScan = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
        timerRef.current = null;
        autoTimeoutRef.current = null;
        setIsScanning(false);
        setIsScanInProgress(false);
        setScanProgress(0);
        predictionSamplesRef.current = [];
        setPredictionSamples([]);
    };

    // NGUMPULIN DATA PREDIKSI TIAP ADA UPDATE DARI AI (Selama Scan)
    useEffect(() => {
        if (isScanInProgress && typeof state.aiRisk !== 'undefined') {
            predictionSamplesRef.current = [...predictionSamplesRef.current, state.aiRisk];
            setPredictionSamples(predictionSamplesRef.current);
        }
    }, [state.aiRisk, isScanInProgress]);



    // Menjalankan interval scan
    useEffect(() => {
        if (isScanInProgress) {
            const durationMs = scanDuration * 1000;
            const interval = durationMs / 100;
            
            const timer = setInterval(() => {
                setScanProgress(prev => {
                    const next = prev + 1;
                    if (next >= 100) {
                        clearInterval(timer);
                        return 100;
                    }
                    return next;
                });
            }, interval);
            
            timerRef.current = timer;
            return () => clearInterval(timer);
        }
    }, [isScanInProgress, scanDuration]);

    // Menangani aksi setelah scan selesai
    useEffect(() => {
        if (isScanInProgress && scanProgress === 100) {
            setIsScanInProgress(false);
            const insight = finalizeScanResultFromRefs();
            console.log('[SCANNER] Scan Selesai!', insight);
            
            saveScanResultFromRefs(insight).then(() => {
                setTimeout(() => fetchHistory(activeDeviceIdRef.current, tokenRef.current), 500);
            });

            if (isAutoMode && isScanning) {
                if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current);
                autoTimeoutRef.current = setTimeout(() => {
                    if (!isScanning) return;
                    resetScanSession();
                    setIsScanInProgress(true);
                }, autoIntervalSeconds * 1000);
            } else {
                setIsScanning(false);
            }
        }
    }, [scanProgress, isScanInProgress, isAutoMode, isScanning, autoIntervalSeconds]);

    // Versi dari REFS — aman dipanggil dari timer closure
    const finalizeScanResultFromRefs = () => {
        const samples = predictionSamplesRef.current;
        const currentHum = humRef.current;
        const currentTemp = tempRef.current;
        const currentLdr = ldrRef.current;
        const locName = scanLocationRef.current;

        let finalRisk = 0;
        if (samples.length > 0) {
            const counts = {};
            samples.forEach(x => counts[x] = (counts[x] || 0) + 1);
            finalRisk = parseInt(Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b));
        } else {
            finalRisk = currentHum > 70 ? 2 : currentHum > 50 ? 1 : 0;
        }

        const sensorQuality = calculateSensorQuality({
            samples,
            temperature: currentTemp,
            humidity: currentHum,
            ldr: currentLdr,
        });

        const riskPercent = calculateRiskPercent(
            finalRisk,
            currentTemp,
            currentHum,
            currentLdr,
            samples,
            sensorQuality.score
        );
        const insightBase = getMoldInsights({
            riskLevel: finalRisk,
            temperature: currentTemp,
            humidity: currentHum,
            ldr: currentLdr,
            location: locName,
            notes: scanNotesRef.current,
            sensorQualityDetails: sensorQuality.details
        });
        const insight = {
            ...insightBase,
            risk: riskPercent,
            sensorQuality: sensorQuality.score,
            sensorQualityLabel: sensorQuality.label,
            sensorQualitySamples: sensorQuality.sampleCount,
            sensorQualityDetails: sensorQuality.details,
        };

        const combinedAnalysis = buildCombinedAnalysis({
            insight,
            imageName: scanImageNameRef.current,
            hasImage: Boolean(scanImageRef.current),
        });

        const result = { ...insight, ...combinedAnalysis };
        setScanResult(result);
        return result;
    };

    const saveScanResultFromRefs = async (insight) => {
        let targetId = activeDeviceIdRef.current;
        if (!targetId && Object.keys(devicesRef.current).length > 0)
            targetId = Object.keys(devicesRef.current)[0];

        const finalLocation = scanLocationRef.current;

        const scanData = {
            deviceId: targetId,
            location: finalLocation || 'Unknown',
            riskLevel: insight.risk,    // sudah dalam persentase (15/50/90)
            temperature: tempRef.current,
            humidity: humRef.current,
            ldr: ldrRef.current,
            message: insight.desc,
            recommendations: insight.recommendations.join('\n'),
            sensorQuality: insight.sensorQuality,
            combinedSummary: insight.combinedSummary,
            sensorQualityStatus: insight.sensorQualityStatus,
            imageData: scanImageRef.current || null,
            imageName: scanImageNameRef.current || null,
            imageType: scanImageTypeRef.current || null,
            notes: scanNotesRef.current,
            duration: scanDuration
        };

        console.log('[SCANNER] Menyimpan hasil scan ke:', `${API_URL}/api/scans`);
        console.log('[SCANNER] Data:', scanData);

        try {
            const res = await fetch(`${API_URL}/api/scans`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${tokenRef.current}` 
                },
                body: JSON.stringify(scanData)
            });
            const data = await res.json();
            if (!data.ok) {
                console.error('[SCANNER] ❌ Server error:', data.error);
                alert('❌ Gagal menyimpan ke database: ' + (data.error || 'Unknown error'));
            } else {
                console.log('[SCANNER] ✅ Berhasil tersimpan di DB');
                window.dispatchEvent(new Event('scan-completed'));
            }
        } catch (e) {
            console.error('[SCANNER] ❌ Network/Fetch error:', e);
            alert('❌ Gagal menghubungi server backend! Pastikan backend sudah jalan di port 3000.\nError: ' + e.message);
        }
    };


    return (
        <div className="space-y-6">
            <style>
                {`
                @keyframes wave {
                    0% { transform: translateX(-50%) rotate(0deg); }
                    100% { transform: translateX(-50%) rotate(360deg); }
                }
                .liquid-wave {
                    position: absolute;
                    width: 200%;
                    height: 200%;
                    background: rgba(82, 183, 136, 0.6);
                    top: -150%;
                    left: 50%;
                    border-radius: 40%;
                    animation: wave 10s infinite linear;
                    transition: top 0.3s ease;
                }
                `}
            </style>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT: CONFIGURATION */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative overflow-hidden">
                        
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-14 h-14 bg-[#eff6ff] rounded-2xl flex items-center justify-center text-[#1e40af] shadow-inner">
                                <span className="material-symbols-outlined text-3xl font-bold">query_stats</span>
                            </div>
                            <div>
                                <h2 className="font-black text-[#1e3a8a] text-2xl tracking-tight uppercase">Mold Smart Scanner</h2>
                                <p className="text-xs text-gray-400 font-bold tracking-widest">SETUP ANALISIS AREA</p>
                            </div>
                        </div>

                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-6 h-6 rounded-full bg-[#1e3a8a] text-white text-[10px] font-black flex items-center justify-center">1</span>
                                <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-wider">Lokasi Objek</h3>
                            </div>
                                <div className="animate-fade-in">
                                <input 
                                    type="text"
                                    value={scanLocation}
                                    onChange={(e) => setScanLocation(e.target.value)}
                                    placeholder="Isi dimana? (misal: Kamar Mandi, Lemari, dll)..."
                                    className="w-full bg-[#eff6ff] border-2 border-[#3b82f6]/20 rounded-xl px-4 py-3 text-xs font-bold text-[#1e3a8a] focus:border-[#3b82f6] focus:outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-6 h-6 rounded-full bg-[#1e3a8a] text-white text-[10px] font-black flex items-center justify-center">2</span>
                                <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-wider">Foto Pendukung</h3>
                            </div>
                            <div className="rounded-[1.5rem] border-2 border-dashed border-[#3b82f6]/20 bg-[#f8fafc] p-4 space-y-4">
                                <label className="flex flex-col items-center justify-center gap-3 cursor-pointer text-center py-6">
                                    <span className="material-symbols-outlined text-4xl text-[#3b82f6]">image</span>
                                    <div>
                                        <p className="text-sm font-black text-[#1e3a8a]">Upload gambar ruangan</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">JPG, PNG, WEBP maksimal 2MB</p>
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                </label>

                                {scanImagePreview && (
                                    <div className="space-y-3">
                                        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                                            <img src={scanImagePreview} alt={scanImageName || 'Preview gambar'} className="h-56 w-full object-cover" />
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-black text-[#1e3a8a] truncate max-w-[240px]">{scanImageName || 'Gambar terunggah'}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{scanImageType || 'image/*'}</p>
                                            </div>
                                            <button onClick={clearImageUpload} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-50">
                                                Hapus
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* STEP 2: NOTES & DURATION */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-6 h-6 rounded-full bg-[#1e3a8a] text-white text-[10px] font-black flex items-center justify-center">3</span>
                                    <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-wider">Catatan</h3>
                                </div>
                                <textarea 
                                    value={scanNotes}
                                    onChange={(e) => setScanNotes(e.target.value)}
                                    placeholder="Kondisi area..."
                                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-xs font-bold text-[#1e3a8a] focus:border-[#3b82f6] focus:outline-none transition-all placeholder:text-gray-300 resize-none h-[108px]"
                                ></textarea>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-6 h-6 rounded-full bg-[#1e3a8a] text-white text-[10px] font-black flex items-center justify-center">4</span>
                                    <h3 className="text-xs font-black text-[#1e3a8a] uppercase tracking-wider">Mode Scan</h3>
                                </div>
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => setScanMode('single')}
                                                className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border-2 ${scanMode === 'single' ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                    >
                                        Manual 15 / 30 / 60 detik
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setScanMode('auto')}
                                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border-2 ${scanMode === 'auto' ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                    >
                                        Auto scan berulang
                                    </button>
                                </div>

                                {scanMode === 'single' ? (
                                    <div className="mt-4 space-y-2">
                                        {durations.map(d => (
                                            <button 
                                                key={d}
                                                onClick={() => setScanDuration(d)}
                                                className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border-2 ${scanDuration === d ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                            >
                                                {d >= 60 ? '1 MENIT' : `${d} DETIK`}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-[0.2em]">Interval</p>
                                        {autoIntervals.map(i => (
                                            <button 
                                                key={i}
                                                onClick={() => setAutoIntervalSeconds(i)}
                                                className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border-2 ${autoIntervalSeconds === i ? 'bg-[#3b82f6] text-white border-[#3b82f6] shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                            >
                                                {i === 60 ? 'Setiap 1 Menit' : i === 120 ? 'Setiap 2 Menit' : 'Setiap 3 Menit'}
                                            </button>
                                        ))}
                                        <p className="text-[9px] text-gray-500 mt-2">Setiap scan otomatis akan berjalan selama 15 detik lalu menunggu interval yang dipilih sampai menjalankan scan berikutnya.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="relative flex flex-col items-center">
                            {/* FULL-PAGE SCANNING OVERLAY */}
                            {isScanning && (
                                <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#1e3a8a]/90 backdrop-blur-sm animate-fade-in">
                                    <div className="relative flex flex-col items-center gap-8">
                                        {/* Circular Progress Ring */}
                                        <div className="relative w-52 h-52">
                                            <svg className="w-52 h-52 -rotate-90" viewBox="0 0 200 200">
                                                <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12"/>
                                                <circle 
                                                    cx="100" cy="100" r="88" fill="none" 
                                                    stroke="#3b82f6" strokeWidth="12"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${2 * Math.PI * 88}`}
                                                    strokeDashoffset={`${2 * Math.PI * 88 * (1 - scanProgress / 100)}`}
                                                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-5xl font-black text-white">{scanProgress}%</span>
                                                <span className="text-[10px] font-black text-white/80 uppercase tracking-widest mt-1">Analyzing</span>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-black text-lg tracking-widest uppercase animate-pulse">Scanning In Progress</p>
                                            <p className="text-white/60 text-xs font-bold mt-2 uppercase tracking-widest">{scanLocation} • {scanDuration}s</p>
                                        </div>
                                        {/* Animated dots */}
                                        <div className="flex gap-2 mb-2">
                                            {[0,1,2].map(i => (
                                                <span key={i} className="w-2 h-2 rounded-full bg-white/70" style={{ animation: `pulse 1.2s ${i * 0.2}s infinite` }}></span>
                                            ))}
                                        </div>
                                        {/* Cancel Button */}
                                        <button
                                            onClick={cancelScan}
                                            className="px-8 py-3 bg-white/10 hover:bg-red-500/40 border border-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-sm">cancel</span>
                                            Stop Scanning
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={startScan}
                                disabled={!scanLocation || isScanning}
                                className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-xl transition-all flex items-center justify-center gap-3 ${(!scanLocation || isScanning) ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-[#1e3a8a] hover:bg-[#1e40af] text-white active:scale-95 shadow-blue-900/20'}`}
                            >
                                <span className="material-symbols-outlined">analytics</span>
                                Mulai Analisis Pintar
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT: LIVE DATA & RESULTS */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                             Real-time Environment
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-[#eff6ff] p-5 rounded-3xl border border-blue-50 shadow-inner flex flex-col items-center text-center">
                                <span className="material-symbols-outlined text-[#1e40af] text-2xl mb-2">water_drop</span>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lembap</p>
                                <p className="text-2xl font-black text-[#1e3a8a]">{hum.toFixed(0)}%</p>
                            </div>
                            <div className="bg-[#eff6ff] p-5 rounded-3xl border border-blue-50 shadow-inner flex flex-col items-center text-center">
                                <span className="material-symbols-outlined text-orange-400 text-2xl mb-2">thermostat</span>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suhu</p>
                                <p className="text-2xl font-black text-[#1e3a8a]">{temp.toFixed(1)}°C</p>
                            </div>
                            <div className="bg-blue-50/30 p-5 rounded-3xl border border-blue-50 shadow-inner flex flex-col items-center text-center">
                                <span className="material-symbols-outlined text-blue-400 text-2xl mb-2">light_mode</span>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cahaya</p>
                                <p className="text-2xl font-black text-[#1e3a8a]">{state.ldr || 0}</p>
                            </div>
                            <div className="bg-emerald-50/80 p-5 rounded-3xl border border-emerald-100 shadow-inner flex flex-col items-center text-center">
                                <span className="material-symbols-outlined text-emerald-500 text-2xl mb-2">speed</span>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kualitas Sensor</p>
                                <p className="text-2xl font-black text-[#1e3a8a]">{scanResult?.sensorQuality ?? '—'}%</p>
                                <p className="text-[10px] text-gray-500 mt-2">{scanResult ? getSensorQualityLabel(scanResult.sensorQuality) : 'Belum tersedia'}</p>
                            </div>
                        </div>

                    </div>

                    <div className="rounded-[2rem] bg-white/95 p-6 border border-gray-100 shadow-xl">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Trend Analisis</p>
                                <h3 className="text-lg font-black text-[#1e3a8a]">Risk Distribution</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold uppercase text-gray-400">Jumlah Scan</p>
                                <p className="text-sm font-black text-[#1e3a8a]">{riskCounts.total}</p>
                            </div>
                        </div>
                        {riskCounts.total > 0 ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative w-40 h-40">
                                    <svg viewBox="0 0 160 160" className="w-full h-full">
                                        <g transform="translate(80 80) rotate(-90)">
                                            <circle r="50" fill="none" stroke="#e5e7eb" strokeWidth="18" />
                                            <circle
                                                r="50"
                                                fill="none"
                                                stroke="#22c55e"
                                                strokeWidth="18"
                                                strokeLinecap="round"
                                                strokeDasharray={`${lowSegment} ${riskCircleCircumference}`}
                                                strokeDashoffset="0"
                                            />
                                            <circle
                                                r="50"
                                                fill="none"
                                                stroke="#fbbf24"
                                                strokeWidth="18"
                                                strokeLinecap="round"
                                                strokeDasharray={`${mediumSegment} ${riskCircleCircumference}`}
                                                strokeDashoffset={-lowSegment}
                                            />
                                            <circle
                                                r="50"
                                                fill="none"
                                                stroke="#ef4444"
                                                strokeWidth="18"
                                                strokeLinecap="round"
                                                strokeDasharray={`${highSegment} ${riskCircleCircumference}`}
                                                strokeDashoffset={-(lowSegment + mediumSegment)}
                                            />
                                        </g>
                                    </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <p className="text-3xl font-black text-[#1e3a8a]">{riskCounts.total}</p>
                                                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Scan</p>
                                            </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 w-full">
                                    <div className="rounded-2xl bg-[#ecfdf5] p-3 text-center">
                                        <div className="mx-auto mb-2 w-3 h-3 rounded-full bg-[#22c55e]"></div>
                                        <p className="text-[9px] uppercase font-black text-[#16a34a]">Low</p>
                                        <p className="text-sm font-black text-[#065f46]">{riskCounts.low}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[#fef9c3] p-3 text-center">
                                        <div className="mx-auto mb-2 w-3 h-3 rounded-full bg-[#fbbf24]"></div>
                                        <p className="text-[9px] uppercase font-black text-[#92400e]">Medium</p>
                                        <p className="text-sm font-black text-[#7c2d12]">{riskCounts.medium}</p>
                                    </div>
                                    <div className="rounded-2xl bg-[#fee2e2] p-3 text-center">
                                        <div className="mx-auto mb-2 w-3 h-3 rounded-full bg-[#ef4444]"></div>
                                        <p className="text-[9px] uppercase font-black text-[#b91c1c]">High</p>
                                        <p className="text-sm font-black text-[#7f1d1d]">{riskCounts.high}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">Belum ada data scan untuk ditampilkan.</p>
                        )}
                    </div>

                    {/* MOLD RISK RESULT (The Voted Result) */}
                    {scanResult ? (
                        <div className="animate-bounce-in space-y-6">
                            <div className="bg-[#1e3a8a] rounded-[2rem] p-8 shadow-xl flex flex-col items-center text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                                <h3 className="text-[10px] font-black text-green-300/50 uppercase tracking-[0.2em] mb-8 w-full">Stable Scan Result (Voted)</h3>
                                
                                <div className="relative w-40 h-20 overflow-hidden mb-4">
                                    <div className="w-40 h-40 rounded-full border-[15px] border-white/10"></div>
                                    <div 
                                        className={`absolute top-0 left-0 w-40 h-40 rounded-full border-[15px] transition-all duration-1000`}
                                        style={{ 
                                            borderColor: scanResult.risk > 70 ? '#ff4d4d' : scanResult.risk > 40 ? '#f97316' : '#4ade80',
                                            clipPath: `polygon(0 0, 100% 0, 100% 50%, 0 50%)`,
                                            transform: `rotate(${(scanResult.risk / 100) * 180 - 180}deg)`
                                        }}
                                    ></div>
                                </div>
                                <div className="text-center">
                                    <p className="text-4xl font-black mb-1">{scanResult.risk}%</p>
                                    <p className={`text-[10px] font-black uppercase tracking-widest py-1 px-4 rounded-full inline-block ${scanResult.risk > 70 ? 'bg-red-500/20 text-red-400' : scanResult.risk > 40 ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-500/20 text-green-400'}`}>
                                        {scanResult.label}
                                    </p>
                                </div>
                                <p className="text-[8px] font-bold text-green-200/50 mt-4 uppercase">Based on {predictionSamples.length} samples</p>
                            </div>

                            <div className={`${scanResult.bg} rounded-[2rem] p-8 border-4 border-white shadow-2xl`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-xl ${scanResult.bg} flex items-center justify-center shadow-inner border border-white`}>
                                        <span className={`material-symbols-outlined ${scanResult.color}`}>{scanResult.icon}</span>
                                    </div>
                                    <h4 className={`font-black text-[10px] uppercase tracking-[0.2em] ${scanResult.color}`}>Hasil Analisis</h4>
                                </div>
                                <p className="text-lg font-black text-[#1e3a8a] mb-1 leading-tight">{scanResult.combinedTitle}</p>
                                <p className="text-xs font-bold text-[#1e3a8a]/70 leading-relaxed">{scanResult.combinedSummary}</p>
                                <div className="mt-5 grid grid-cols-1 gap-3">
                                    <div className="rounded-2xl bg-white/80 border border-white p-4">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] mb-2">Sensor Summary</p>
                                        <p className="text-xs font-bold text-[#1e3a8a] leading-relaxed">{scanResult.desc}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/80 border border-white p-4">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] mb-2">Foto Pendukung</p>
                                        <p className="text-xs font-bold text-[#1e3a8a] leading-relaxed">{scanResult.imageStatus}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/80 border border-white p-4">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] mb-2">Kualitas Sensor</p>
                                        <p className="text-xs font-bold text-[#1e3a8a] leading-relaxed">{scanResult.sensorQualityStatus}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white/80 border border-white p-4 space-y-3">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]">Rekomendasi tindakan</p>
                                        {/* Long-form recommendations paragraph (detailed) */}
                                        <div className="mb-3">
                                            <p className="text-xs text-[#1e3a8a] leading-relaxed">
                                                {scanResult.combinedSummary}. {scanResult.desc} {scanResult.sensorQualityStatus} {scanResult.imageStatus}
                                            </p>
                                        </div>
                                        {(() => {
                                            const groups = parseRecommendations(scanResult.recommendations || []);
                                            return (
                                                <div className="text-xs font-bold text-[#1e3a8a] leading-relaxed space-y-3">
                                                    {groups.immediate.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2"><span className="material-symbols-outlined text-base">warning</span>IMMEDIATE</p>
                                                                <button onClick={() => toggleRec('immediate')} className="text-xs text-gray-500 hover:text-gray-700">
                                                                    <span className="material-symbols-outlined">{recCollapse.immediate ? 'expand_more' : 'expand_less'}</span>
                                                                </button>
                                                            </div>
                                                            <div style={{ maxHeight: recCollapse.immediate ? '0px' : '500px', overflow: 'hidden', transition: 'max-height 280ms ease' }}>
                                                                <ul className="list-inside list-disc mt-2 space-y-1">
                                                                    {groups.immediate.map((t, i) => (
                                                                        <li key={`imm-${i}`}>{expandRecommendation(t)}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {groups.shortTerm.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2"><span className="material-symbols-outlined text-base">schedule</span>SHORT-TERM</p>
                                                                <button onClick={() => toggleRec('shortTerm')} className="text-xs text-gray-500 hover:text-gray-700">
                                                                    <span className="material-symbols-outlined">{recCollapse.shortTerm ? 'expand_more' : 'expand_less'}</span>
                                                                </button>
                                                            </div>
                                                            <div style={{ maxHeight: recCollapse.shortTerm ? '0px' : '500px', overflow: 'hidden', transition: 'max-height 280ms ease' }}>
                                                                <ul className="list-inside list-disc mt-2 space-y-1">
                                                                    {groups.shortTerm.map((t, i) => (
                                                                        <li key={`short-${i}`}>{expandRecommendation(t)}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {groups.longTerm.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black uppercase text-amber-700 flex items-center gap-2"><span className="material-symbols-outlined text-base">shield</span>LONG-TERM</p>
                                                                <button onClick={() => toggleRec('longTerm')} className="text-xs text-gray-500 hover:text-gray-700">
                                                                    <span className="material-symbols-outlined">{recCollapse.longTerm ? 'expand_more' : 'expand_less'}</span>
                                                                </button>
                                                            </div>
                                                            <div style={{ maxHeight: recCollapse.longTerm ? '0px' : '500px', overflow: 'hidden', transition: 'max-height 280ms ease' }}>
                                                                <ul className="list-inside list-disc mt-2 space-y-1">
                                                                    {groups.longTerm.map((t, i) => (
                                                                        <li key={`long-${i}`}>{expandRecommendation(t)}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {groups.checklist.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black uppercase text-[#2563eb] flex items-center gap-2"><span className="material-symbols-outlined text-base">checklist</span>CHECKLIST</p>
                                                                <button onClick={() => toggleRec('checklist')} className="text-xs text-gray-500 hover:text-gray-700">
                                                                    <span className="material-symbols-outlined">{recCollapse.checklist ? 'expand_more' : 'expand_less'}</span>
                                                                </button>
                                                            </div>
                                                            <div style={{ maxHeight: recCollapse.checklist ? '0px' : '500px', overflow: 'hidden', transition: 'max-height 280ms ease' }}>
                                                                <ul className="list-inside list-disc mt-2 space-y-1">
                                                                    {groups.checklist.map((t, i) => (
                                                                        <li key={`check-${i}`}>{expandRecommendation(t)}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {groups.tips.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-2"><span className="material-symbols-outlined text-base">tips_and_updates</span>TIPS</p>
                                                                <button onClick={() => toggleRec('tips')} className="text-xs text-gray-500 hover:text-gray-700">
                                                                    <span className="material-symbols-outlined">{recCollapse.tips ? 'expand_more' : 'expand_less'}</span>
                                                                </button>
                                                            </div>
                                                            <div style={{ maxHeight: recCollapse.tips ? '0px' : '500px', overflow: 'hidden', transition: 'max-height 280ms ease' }}>
                                                                <ul className="list-inside list-disc mt-2 space-y-1">
                                                                    {groups.tips.map((t, i) => (
                                                                        <li key={`tip-${i}`}>{expandRecommendation(t)}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-[2rem] p-12 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
                             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 text-gray-300 shadow-sm">
                                 <span className="material-symbols-outlined text-3xl">biotech</span>
                             </div>
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menunggu Pemindaian</p>
                             <p className="text-[10px] text-gray-300 mt-2">Silakan isi lokasi dan pilih durasi untuk memulai analisis.</p>
                        </div>
                    )}
                </div>

            </div>
            {/* LIVE DEVICE LOGS (FOOTER SECTION) */}
            <div className="mt-12 bg-[#1e3a8a] rounded-[2.5rem] p-8 shadow-2xl border-4 border-white overflow-hidden relative">

                
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                            <span className="material-symbols-outlined text-green-400">developer_board</span>
                        </div>
                        <div>
                            <h3 className="font-black text-white text-lg tracking-tight">Live Device Logs</h3>
                            <p className="text-[10px] font-bold text-green-300/50 uppercase tracking-[0.2em]">Raw MQTT Data Stream</p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${isDeviceOnline ? 'bg-orange-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <span className={`w-2 h-2 rounded-full ${isDeviceOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isDeviceOnline ? 'text-green-400' : 'text-red-500'}`}>
                            {isDeviceOnline ? 'ESP32 Connected' : 'ESP32 Offline'}
                        </span>
                    </div>
                </div>

                <div className="bg-black/20 backdrop-blur-md rounded-3xl p-6 font-mono text-[11px] space-y-2 border border-white/5 relative z-10 max-h-[200px] overflow-y-auto">
                    <div className="flex gap-4 text-green-400/70 border-b border-white/5 pb-2 mb-4 font-black tracking-widest uppercase">
                        <span className="w-24">Timestamp</span>
                        <span className="w-32">Topic</span>
                        <span>Payload (JSON)</span>
                    </div>
                    
                    {/* Real-time Data Mapping */}
                    <div className="flex gap-4 text-white/90 animate-fade-in py-1 hover:bg-white/5 transition-colors rounded px-2">
                        <span className="w-24 text-white/40">{new Date().toLocaleTimeString()}</span>
                        <span className="w-32 text-blue-300 font-bold">/sensor/data</span>
                        <code className="text-green-300 break-all">
                            {`{"deviceId":"${activeDeviceId || 'mold-scanner-04'}", "temp":${temp.toFixed(1)}, "hum":${hum.toFixed(0)}, "ldr":${state.ldr || 0}, "status":"active"}`}
                        </code>
                    </div>
                    <div className="flex gap-4 text-white/40 py-1 px-2 italic">
                        <span className="w-24">--:--:--</span>
                        <span className="w-32">/system/log</span>
                        <span>Waiting for next hardware heartbeat...</span>
                    </div>
                </div>
            </div>
            {/* SCAN HISTORY SECTION */}
            <div className="mt-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#1e3a8a] rounded-2xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-lg">history</span>
                        </div>
                        <div>
                            <h2 className="font-black text-[#1e3a8a] text-lg tracking-tight uppercase">Riwayat Scan</h2>
                            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Hasil Analisis Tersimpan</p>
                        </div>
                    </div>
                    <button onClick={() => fetchHistory()} disabled={historyLoading}
                        className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all">
                        <span className={`material-symbols-outlined text-gray-400 ${historyLoading ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>

                {historyLoading && scanHistory.length === 0 ? (
                    <div className="text-center py-12 text-gray-300">
                        <span className="material-symbols-outlined text-4xl animate-spin block mb-2">sync</span>
                        <p className="text-xs font-bold">Memuat riwayat...</p>
                    </div>
                ) : scanHistory.length === 0 ? (
                    <div className="bg-gray-50 rounded-[2rem] py-16 text-center border border-dashed border-gray-200">
                        <span className="material-symbols-outlined text-4xl text-gray-200 block mb-3">folder_off</span>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Belum ada riwayat scan</p>
                        <p className="text-[10px] text-gray-300 mt-1 max-w-[200px] mx-auto">Mulai analisis di atas untuk menyimpan hasil scan pertama Anda ke database.</p>
                        <button onClick={() => fetchHistory()} className="mt-4 text-[9px] font-black text-[#1e3a8a] uppercase tracking-widest hover:underline">Cek Ulang Data</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {scanHistory.map((scan) => {
                            const date = new Date(scan.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                            const riskColor = scan.riskLevel > 70 ? 'bg-red-50 text-red-600' : scan.riskLevel > 40 ? 'bg-orange-50 text-orange-600' : 'bg-orange-50 text-green-600';
                            const riskLabel = scan.riskLevel > 70 ? 'HIGH' : scan.riskLevel > 40 ? 'MEDIUM' : 'LOW';
                            return (
                                <div key={scan.id} onClick={() => setSelectedScan(scan)}
                                    className="bg-white rounded-2xl p-5 border border-gray-100 flex items-center gap-5 hover:shadow-md hover:border-orange-100 transition-all cursor-pointer group">
                                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${riskColor}`}>
                                        <span className="text-xl font-black leading-none">{scan.riskLevel}%</span>
                                        <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">{riskLabel}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 bg-[#1e3a8a] text-white text-[9px] font-black rounded-lg uppercase">{scan.location || 'Area'}</span>
                                            <span className="text-[9px] text-gray-300 font-bold">{date}</span>
                                        </div>
                                        <p className="text-xs font-bold text-[#1e3a8a] truncate">{scan.message}</p>
                                        <div className="flex gap-3 mt-1 text-[10px] text-gray-400 font-bold">
                                            <span>🌡 {scan.temperature?.toFixed(1)}°C</span>
                                            <span>💧 {scan.humidity?.toFixed(0)}%</span>
                                            <span>⏱ {scan.duration}s</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 relative z-20">
                                        <button 
                                            onClick={(e) => confirmDelete(e, scan.id)}
                                            className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100 flex items-center justify-center"
                                            title="Hapus Riwayat"
                                        >
                                            <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                        <span className="material-symbols-outlined text-gray-200 group-hover:text-[#1e3a8a] transition-colors self-center">chevron_right</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* DETAIL MODAL */}
            {selectedScan && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-bounce-in">
                        <div className="bg-[#1e3a8a] p-7 text-white relative">
                            <button onClick={() => setSelectedScan(null)}
                                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                            <span className="text-[9px] font-black text-green-300/60 uppercase tracking-widest">Detail Analisis</span>
                            <h2 className="text-2xl font-black mt-1">{selectedScan.location || 'Area'}</h2>
                            <p className="text-[10px] text-green-300/50 mt-1">
                                {new Date(selectedScan.timestamp).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}
                            </p>
                        </div>
                        <div className="p-7 overflow-y-auto space-y-5">
                            {/* Gauge */}
                            <div className="flex flex-col items-center">
                                <div className="relative w-40 h-20 overflow-hidden mb-3">
                                    <div className="w-40 h-40 rounded-full border-[16px] border-gray-100"></div>
                                    <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-[16px] transition-all duration-1000"
                                        style={{ borderColor: selectedScan.riskLevel > 70 ? '#dc2626' : selectedScan.riskLevel > 40 ? '#f97316' : '#10b981',
                                            clipPath:'polygon(0 0,100% 0,100% 50%,0 50%)',
                                            transform:`rotate(${(selectedScan.riskLevel/100)*180-180}deg)` }}>
                                    </div>
                                </div>
                                <p className="text-4xl font-black text-[#1e3a8a]">{selectedScan.riskLevel}%</p>
                                <span className={`text-[10px] font-black uppercase tracking-widest py-1 px-4 rounded-full mt-1 ${
                                    selectedScan.riskLevel > 70 ? 'bg-red-50 text-red-600' : selectedScan.riskLevel > 40 ? 'bg-orange-50 text-orange-600' : 'bg-orange-50 text-green-600'}`}>
                                    {selectedScan.riskLevel > 70 ? 'HIGH RISK' : selectedScan.riskLevel > 40 ? 'MEDIUM RISK' : 'LOW RISK'}
                                </span>
                            </div>
                            {/* Diagnosis */}
                            <div className="bg-white p-5 rounded-2xl">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Diagnosis Hasil</p>
                                <p className="text-sm font-bold text-[#1e3a8a] leading-relaxed">{selectedScan.message}</p>
                                {selectedScan.notes && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        <p className="text-[9px] font-black text-[#1e3a8a] uppercase tracking-widest mb-1">Catatan</p>
                                        <p className="text-xs text-gray-500 italic">&quot;{selectedScan.notes}&quot;</p>
                                    </div>
                                )}
                            </div>
                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                {[['thermostat','Suhu',`${selectedScan.temperature?.toFixed(1)}°C`,'text-orange-400'],
                                  ['water_drop','Lembap',`${selectedScan.humidity?.toFixed(0)}%`,'text-blue-400'],
                                  ['timer','Durasi',`${selectedScan.duration}s`,'text-green-400']
                                ].map(([icon,label,val,col]) => (
                                    <div key={label} className="bg-white border border-gray-100 p-4 rounded-2xl text-center shadow-sm">
                                        <span className={`material-symbols-outlined ${col} text-xl mb-1 block`}>{icon}</span>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase">{label}</p>
                                        <p className="text-sm font-black text-[#1e3a8a]">{val}</p>
                                    </div>
                                ))}
                            </div>
                            {/* Rekomendasi */}
                            <div className={`p-4 rounded-2xl text-xs font-bold leading-relaxed ${
                                selectedScan.riskLevel > 70 ? 'bg-red-50 text-red-700' : selectedScan.riskLevel > 40 ? 'bg-orange-50 text-orange-700' : 'bg-orange-50 text-green-700'}`}>
                                <p className="font-black uppercase tracking-widest text-[9px] mb-2">Rekomendasi</p>
                                {selectedScan.riskLevel > 70 ? (
                                    <ul className="space-y-2 list-disc list-inside">
                                        <li>Segera jalankan dehumidifier atau ventilator industri untuk menurunkan kelembapan di area ini, karena kondisi saat ini sudah sangat mendukung pertumbuhan jamur.</li>
                                        <li>Bersihkan semua permukaan dengan pembersih antifungal yang tepat, lalu lap hingga benar-benar kering untuk menghilangkan sisa kelembapan dan spora yang mungkin menempel.</li>
                                        <li>Perbaiki atau pasang ventilasi tambahan serta buka jendela secara berkala agar udara segar dapat masuk dan kelembapan tidak terperangkap.</li>
                                        <li>Singkirkan semua bahan organik, kain, dan kertas yang mudah menyimpan kelembapan dari sekitar area; benda-benda ini dapat menjadi tempat berkembangnya jamur.</li>
                                        <li>Periksa sumber kebocoran potensial seperti pipa, sambungan jendela, dan dinding; perbaiki segera jika ditemukan titik basah atau rembesan.</li>
                                    </ul>
                                ) : selectedScan.riskLevel > 40 ? (
                                    <ul className="space-y-2 list-disc list-inside">
                                        <li>Buka ventilasi dan aktifkan kipas untuk meningkatkan aliran udara, karena kelembapan sudah cukup tinggi untuk mulai mengganggu stabilitas lingkungan.</li>
                                        <li>Periksa area sekeliling untuk kemungkinan kebocoran air, noda gelap, atau permukaan dingin yang dapat menyebabkan kondensasi dan peningkatan kelembapan.</li>
                                        <li>Atur pencahayaan tambahan jika area terlihat redup, karena cahaya yang lebih baik membantu menjaga area tetap kering dan mengurangi risiko jamur.</li>
                                        <li>Ratakan barang-barang di area ini dan hindari penumpukan agar udara dapat bergerak dengan lebih bebas di antara benda-benda tersebut.</li>
                                        <li>Catat kondisi ini dan ulangi pengukuran dalam 1–2 hari untuk memastikan nilai suhu, kelembapan, dan cahaya tidak semakin memburuk.</li>
                                    </ul>
                                ) : (
                                    <p>✅ Kondisi ruangan sangat baik. Pertahankan kebersihan area ini dan terus pantau nilai sensor secara berkala untuk memastikan kondisi tetap stabil.</p>
                                )}
                            </div>
                        </div>
                        <div className="p-5 bg-gray-50 flex gap-3">
                            <button onClick={() => setSelectedScan(null)}
                                className="flex-1 py-3 bg-[#1e3a8a] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#3b82f6] transition-all">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {scanToDelete && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-[#1e3a8a]/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden text-center animate-bounce-in p-8 border-4 border-red-50">
                        <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <span className="material-symbols-outlined text-4xl">delete_forever</span>
                        </div>
                        <h2 className="text-xl font-black text-[#1e3a8a] mb-2">Hapus Riwayat?</h2>
                        <p className="text-xs font-bold text-gray-400 mb-8">
                            Tindakan ini tidak bisa dibatalkan. Riwayat pemindaian ini akan hilang dari database.
                        </p>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setScanToDelete(null)}
                                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={performDelete}
                                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all active:scale-95"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
