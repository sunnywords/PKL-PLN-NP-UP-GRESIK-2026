import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getMoldInsights, normalizeRecommendations, buildCombinedAnalysis } from '../utils/moldInsights';

export default function Analytics() {
    const { token, activeDeviceId } = useAppContext();
    const [scanHistory, setScanHistory] = useState([]);
    const [selectedScan, setSelectedScan] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    // Explicit local backend host to avoid routing to ESP32 AP captive pages
    const API_URL = `http://localhost:3000`;

    const resolveImageSource = (scan) => {
        if (!scan) return '';
        if (scan.imageData) return scan.imageData;
        if (scan.imagePath) return `${API_URL}${scan.imagePath}`;
        return '';
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = async () => {
        if (!activeDeviceId) return;
        setIsLoading(true);
        try {
            const resScans = await fetch(`${API_URL}/api/scans/${activeDeviceId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const dataScans = await resScans.json();
            if (dataScans.ok) setScanHistory(dataScans.scans);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteScan = async (id) => {
        if (!window.confirm('Yakin ingin menghapus riwayat ini?')) return;
        try {
            const res = await fetch(`${API_URL}/api/scans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) {
                setScanHistory(prev => prev.filter(s => s.id !== id));
                setSelectedScan(null);
            }
        } catch (e) {
            console.error('Gagal hapus:', e);
        }
    };

    const exportToCSV = () => {
        if (scanHistory.length === 0) return;
        const headers = ['ID', 'Timestamp', 'Location', 'RiskLevel', 'SensorQuality', 'SensorQualityStatus', 'Temp', 'Humidity', 'Light', 'Duration', 'Message', 'CombinedSummary', 'Recommendations', 'ImageName', 'Notes'];
        const csvRows = [
            headers.join(','),
            ...scanHistory.map(s => [
                s.id,
                new Date(s.timestamp).toLocaleString(),
                `"${s.location}"`,
                s.riskLevel,
                s.sensorQuality ?? '',
                `"${(s.sensorQualityStatus || '').replace(/"/g, '""')}"`,
                s.temperature,
                s.humidity,
                s.ldr ?? '',
                s.duration,
                `"${(s.message || '').replace(/"/g, '""')}"`,
                `"${(s.combinedSummary || '').replace(/"/g, '""')}"`,
                `"${(s.recommendations || '').replace(/"/g, '""')}"`,
                `"${(s.imageName || '').replace(/"/g, '""')}"`,
                `"${s.notes || ''}`
            ].join(','))
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `FungiGuard_Report_${new Date().toISOString().split('T')[0]}.csv`);
        a.click();
    };

    useEffect(() => {
        fetchData();
    }, [activeDeviceId, token]);

    // Auto-refresh saat scan selesai dari DashboardMetrics
    useEffect(() => {
        const handler = () => {
            console.log('[ANALYTICS] Scan selesai terdeteksi, refresh history...');
            setTimeout(fetchData, 500); // Delay kecil agar data sudah tersimpan di DB
        };
        window.addEventListener('scan-completed', handler);
        return () => window.removeEventListener('scan-completed', handler);
    }, [activeDeviceId, token]);

    const selectedScanFallbackInsights = selectedScan ? getMoldInsights({
        riskLevel: selectedScan.riskLevel > 70 ? 2 : selectedScan.riskLevel > 40 ? 1 : 0,
        temperature: selectedScan.temperature,
        humidity: selectedScan.humidity,
        ldr: Number.isFinite(Number(selectedScan.ldr)) ? Number(selectedScan.ldr) : 0,
        location: selectedScan.location,
    }) : null;

    const parseRecommendations = (recs = []) => {
        const groups = { immediate: [], shortTerm: [], longTerm: [], checklist: [], tips: [] };
        const list = Array.isArray(recs) ? recs : [];
        list.forEach(r => {
            if (!r) return;
            const s = String(r).trim();
            const m = s.match(/^(IMMEDIATE|SHORT-TERM|LONG-TERM|CHECKLIST):\s*(.*)$/i);
            if (m) {
                const tag = m[1].toUpperCase();
                const parts = (m[2] || '').split(/\s*\|\s*/).map(p => p.trim()).filter(Boolean);
                if (tag === 'IMMEDIATE') groups.immediate.push(...parts);
                else if (tag === 'SHORT-TERM') groups.shortTerm.push(...parts);
                else if (tag === 'LONG-TERM') groups.longTerm.push(...parts);
                else if (tag === 'CHECKLIST') groups.checklist.push(...parts);
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
            return 'Kondisi ruangan saat ini menunjukkan parameter lingkungan yang stabil: suhu dan kelembapan berada pada rentang aman, serta intensitas cahaya memadai. Pertahankan rutinitas pembersihan, pastikan ventilasi berfungsi, dan lakukan pemeriksaan berkala setiap beberapa hari untuk memastikan tidak ada perubahan yang meningkatkan risiko pertumbuhan jamur.';
        }
        if (/tidak tersedia|belum dihitung/i.test(s)) {
            return s;
        }
        // Default: jika kalimat singkat, panjanginya sedikit
        if (s.length < 60) {
            return s + ' Untuk hasil yang lebih akurat, perhatikan checklist yang disarankan dan lakukan tindak lanjut jika nilai kelembapan atau suhu berubah.';
        }
        return s;
    };
    const [recCollapse, setRecCollapse] = useState({ immediate: false, shortTerm: false, longTerm: false, checklist: false, tips: false });
    const toggleRec = (key) => setRecCollapse(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12 relative">
            
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#1e3a8a] rounded-3xl flex items-center justify-center text-white shadow-xl">
                        <span className="material-symbols-outlined text-3xl">history</span>
                    </div>
                    <div>
                        <h2 className="font-black text-[#1e3a8a] text-2xl tracking-tight uppercase">Scanning History</h2>
                        <p className="text-xs text-gray-400 font-bold tracking-widest flex items-center gap-2">
                             DATABASE HASIL ANALISIS AI • {currentTime}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={exportToCSV}
                        className="px-6 py-3 bg-white text-[#1e3a8a] rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#1e3a8a] hover:text-white transition-all shadow-sm active:scale-95"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Export CSV
                    </button>
                    <button 
                        onClick={fetchData}
                        disabled={isLoading}
                        className="px-4 py-3 bg-gray-50 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-gray-100 transition-all active:scale-95"
                    >
                        <span className={`material-symbols-outlined text-lg ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                </div>
            </div>

            {/* SCAN HISTORY LIST */}
            <section className="space-y-4">
                {scanHistory.map((scan) => {
                    const fallbackInsights = getMoldInsights({
                        riskLevel: scan.riskLevel > 70 ? 2 : scan.riskLevel > 40 ? 1 : 0,
                        temperature: scan.temperature,
                        humidity: scan.humidity,
                        ldr: Number.isFinite(Number(scan.ldr)) ? Number(scan.ldr) : 0,
                        location: scan.location,
                    });
                    const qualityValue = Number.isFinite(Number(scan.sensorQuality)) ? Number(scan.sensorQuality) : null;
                    const imageSource = resolveImageSource(scan);
                    const date = new Date(scan.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                    const summaryText = scan.combinedSummary || scan.message || fallbackInsights.desc;
                    return (
                        <div 
                            key={scan.id} 
                            onClick={() => setSelectedScan(scan)}
                            className="bg-white rounded-[2.5rem] p-6 border border-gray-100 group hover:shadow-xl hover:border-orange-100 transition-all duration-300 animate-fade-in cursor-pointer"
                        >
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-20 h-20 rounded-[2.2rem] flex flex-col items-center justify-center shadow-inner shrink-0 ${scan.riskLevel > 70 ? 'bg-red-50 text-red-600' : scan.riskLevel > 40 ? 'bg-orange-50 text-orange-600' : 'bg-orange-50 text-green-600'}`}>
                                            <span className="text-3xl font-black leading-none">{scan.riskLevel}%</span>
                                            <span className="text-[8px] font-black uppercase tracking-widest mt-1">RISK</span>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">{scan.location}</p>
                                            <p className="text-sm font-black text-[#1e3a8a] leading-tight">{summaryText}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">timer</span>{scan.duration}s</span>
                                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">calendar_month</span>{date}</span>
                                    </div>
                                </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="rounded-[2rem] bg-white p-4 border border-gray-100 text-center">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]">Suhu</p>
                                        <p className="text-xl font-black text-[#1e3a8a] mt-2">{scan.temperature.toFixed(1)}°C</p>
                                    </div>
                                    <div className="rounded-[2rem] bg-white p-4 border border-gray-100 text-center">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]">Lembap</p>
                                        <p className="text-xl font-black text-[#1e3a8a] mt-2">{scan.humidity.toFixed(0)}%</p>
                                    </div>
                                    <div className="rounded-[2rem] bg-white p-4 border border-gray-100 text-center">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]">Cahaya</p>
                                        <p className="text-xl font-black text-[#1e3a8a] mt-2">{Number.isFinite(Number(scan.ldr)) ? scan.ldr : '—'}</p>
                                    </div>
                                    <div className="rounded-[2rem] bg-white p-4 border border-gray-100 text-center">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]">Kualitas Sensor</p>
                                        <p className="text-xl font-black text-[#1e3a8a] mt-2">{qualityValue !== null ? `${qualityValue}%` : '—'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded-[2rem] bg-white p-4 border border-gray-100 shadow-sm">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] mb-2">Ringkasan Analisis</p>
                                        <p className="text-xs text-[#1e3a8a] leading-relaxed">{summaryText}</p>
                                    </div>
                                    {imageSource && (
                                        <div className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm">
                                            <img
                                                src={imageSource}
                                                alt={scan.imageName || 'Foto pendukung scan'}
                                                className="h-32 w-full object-cover"
                                            />
                                            <div className="p-3 bg-white">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a]">Foto Pendukung</p>
                                                <p className="text-[10px] font-bold text-gray-500 truncate">{scan.imageName || 'Gambar terunggah'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </section>

            {/* DETAIL MODAL OVERLAY */}
            {selectedScan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden relative animate-bounce-in max-h-[90vh] flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="bg-[#1e3a8a] p-8 text-white relative">
                            <button 
                                onClick={() => setSelectedScan(null)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-3 py-1 bg-white/20 rounded-lg text-[9px] font-black uppercase tracking-widest">Detail Analisis AI</span>
                            </div>
                            <h2 className="text-3xl font-black tracking-tight">{selectedScan.location}</h2>
                            <p className="text-xs text-green-300/60 font-bold mt-1 tracking-widest uppercase">
                                {new Date(selectedScan.timestamp).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 space-y-8 overflow-y-auto">
                            <div className="flex flex-col items-center">
                                <div className="relative w-48 h-24 overflow-hidden mb-4">
                                    <div className="w-48 h-48 rounded-full border-[20px] border-gray-100"></div>
                                    <div 
                                        className={`absolute top-0 left-0 w-48 h-48 rounded-full border-[20px] transition-all duration-1000`}
                                            style={{ 
                                            borderColor: selectedScan.riskLevel > 70 ? '#dc2626' : selectedScan.riskLevel > 40 ? '#f97316' : '#10b981',
                                            clipPath: `polygon(0 0, 100% 0, 100% 50%, 0 50%)`,
                                            transform: `rotate(${(selectedScan.riskLevel / 100) * 180 - 180}deg)`
                                        }}
                                    ></div>
                                </div>
                                <div className="text-center">
                                    <p className="text-5xl font-black text-[#1e3a8a] mb-1">{selectedScan.riskLevel}%</p>
                                    <p className={`text-[10px] font-black uppercase tracking-widest py-1.5 px-6 rounded-full inline-block ${selectedScan.riskLevel > 70 ? 'bg-red-50 text-red-600' : selectedScan.riskLevel > 40 ? 'bg-orange-50 text-orange-600' : 'bg-orange-50 text-green-600'}`}>
                                        {selectedScan.riskLevel > 70 ? 'HIGH RISK' : selectedScan.riskLevel > 40 ? 'MEDIUM RISK' : 'LOW RISK'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2rem] border border-gray-50">
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Hasil Analisis Riwayat</h4>
                                        <p className="text-sm font-black text-[#1e3a8a] mb-3">{selectedScan.combinedSummary || selectedScan.message}</p>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="inline-flex items-center justify-center bg-yellow-50 text-yellow-600 rounded-full w-8 h-8">
                                                <span className="material-symbols-outlined">light_mode</span>
                                            </span>
                                            <div>
                                                <p className="text-sm font-black text-[#1e3a8a]">{Number.isFinite(Number(selectedScan.ldr)) ? `${selectedScan.ldr} lx` : 'Tidak tersedia'}</p>
                                                <p className="text-[10px] text-gray-500">Intensitas cahaya (lux) yang tercatat saat pemindaian.</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-[#1e3a8a]/80 leading-relaxed">{selectedScan.message}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="rounded-3xl bg-white p-4 border border-gray-100 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] mb-2">Kualitas Sensor</p>
                                            <p className="text-sm font-black text-[#1e3a8a]">{Number.isFinite(Number(selectedScan.sensorQuality)) ? `${selectedScan.sensorQuality}%` : 'Belum dihitung'}</p>
                                            <p className="text-[10px] text-gray-500 mt-2">{selectedScan.sensorQualityStatus || 'Status sensor belum tersedia.'}</p>
                                        </div>
                                        <div className="rounded-3xl bg-white p-4 border border-gray-100 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Cahaya</p>
                                            <p className="text-sm font-black text-[#1e3a8a]">{Number.isFinite(Number(selectedScan.ldr)) ? `${selectedScan.ldr} lx` : 'Tidak tersedia'}</p>
                                            <p className="text-[10px] text-gray-500 mt-2">Intensitas cahaya mempengaruhi prediksi pertumbuhan jamur.</p>
                                        </div>
                                        <div className="rounded-3xl bg-white p-4 border border-gray-100 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">Durasi Scan</p>
                                            <p className="text-sm font-black text-[#1e3a8a]">{selectedScan.duration}s</p>
                                            <p className="text-[10px] text-gray-500 mt-2">Lama pemindaian yang menghasilkan hasil ini.</p>
                                        </div>
                                    </div>
                                </div>
                                {resolveImageSource(selectedScan) && (
                                    <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white shadow-sm">
                                        <img
                                        {/* Expanded combined analysis + long-form recommendations */}
                                        {(() => {
                                            const raw = normalizeRecommendations(selectedScan.recommendations, selectedScanFallbackInsights?.recommendations || []);
                                            const combined = buildCombinedAnalysis({ insight: selectedScan, imageName: selectedScan.imageName, hasImage: Boolean(resolveImageSource(selectedScan)) });
                                            const groups = parseRecommendations(raw);
                                            const detailedParagraph = [];
                                            detailedParagraph.push(combined.combinedSummary || selectedScan.combinedSummary || selectedScan.message || selectedScanFallbackInsights?.desc);
                                            if (selectedScan.notes) detailedParagraph.push(`Catatan: ${selectedScan.notes}.`);
                                            detailedParagraph.push(combined.sensorQualityStatus || selectedScan.sensorQualityStatus || 'Kualitas sensor belum dihitung.');
                                            // Build long recommendations text per group
                                            if (groups.immediate.length) detailedParagraph.push(`Tindakan segera: ${groups.immediate.join('. ')}.`);
                                            if (groups.shortTerm.length) detailedParagraph.push(`Tindakan jangka pendek yang disarankan: ${groups.shortTerm.join('. ')}.`);
                                            if (groups.longTerm.length) detailedParagraph.push(`Tindakan jangka panjang yang direkomendasikan: ${groups.longTerm.join('. ')}.`);
                                            if (groups.checklist.length) detailedParagraph.push(`Checklist teknis: ${groups.checklist.join('. ')}.`);

                                            return (
                                                <div className="mt-4">
                                                    <div className="rounded-[1.5rem] bg-white p-4 border border-gray-100 shadow-sm mb-3">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#1e3a8a] mb-2">Analisis gabungan sensor + gambar</p>
                                                        <p className="text-xs text-[#1e3a8a] leading-relaxed">{detailedParagraph.join(' ')}</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                                <div className="mt-4">
                                    <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="inline-flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full w-6 h-6">
                                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                            </span>
                                            <p className="text-sm font-black text-emerald-700">Rekomendasi</p>
                                        </div>
                                        {(() => {
                                            const raw = normalizeRecommendations(selectedScan.recommendations, selectedScanFallbackInsights?.recommendations || []);
                                            const groups = parseRecommendations(raw);
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
                                                                    <ul className="list-inside list-disc mt-2 space-y-1 text-[#b91c1c]">
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
                                                                    <ul className="list-inside list-disc mt-2 space-y-1 text-[#f97316]">
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
                                                                    <ul className="list-inside list-disc mt-2 space-y-1 text-[#d97706]">
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
                                                                <p className="text-[10px] font-black uppercase text-[#1e3a8a] flex items-center gap-2"><span className="material-symbols-outlined text-base">checklist</span>CHECKLIST</p>
                                                                <button onClick={() => toggleRec('checklist')} className="text-xs text-gray-500 hover:text-gray-700">
                                                                    <span className="material-symbols-outlined">{recCollapse.checklist ? 'expand_more' : 'expand_less'}</span>
                                                                </button>
                                                            </div>
                                                            
                                                                <div style={{ maxHeight: recCollapse.checklist ? '0px' : '500px', overflow: 'hidden', transition: 'max-height 280ms ease' }}>
                                                                    <ul className="list-inside list-disc mt-2 space-y-1 text-[#059669]">
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
                                                                    <ul className="list-inside list-disc mt-2 space-y-1 text-gray-600">
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
                                {selectedScan.notes && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <h5 className="text-[9px] font-black text-[#1e3a8a] uppercase tracking-widest mb-2">User Notes</h5>
                                        <p className="text-xs text-gray-500 italic font-medium leading-relaxed">" {selectedScan.notes} "</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm text-center">
                                    <span className="material-symbols-outlined text-orange-400 text-xl mb-1">thermostat</span>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Suhu</p>
                                    <p className="text-sm font-black text-[#1e3a8a]">{selectedScan.temperature.toFixed(1)}°C</p>
                                </div>
                                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm text-center">
                                    <span className="material-symbols-outlined text-blue-400 text-xl mb-1">water_drop</span>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Lembap</p>
                                    <p className="text-sm font-black text-[#1e3a8a]">{selectedScan.humidity.toFixed(0)}%</p>
                                </div>
                                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm text-center">
                                    <span className="material-symbols-outlined text-yellow-400 text-xl mb-1">light_mode</span>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Cahaya</p>
                                    <p className="text-sm font-black text-[#1e3a8a]">{Number.isFinite(Number(selectedScan.ldr)) ? `${selectedScan.ldr} lx` : 'Tidak tersedia'}</p>
                                </div>
                                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm text-center">
                                    <span className="material-symbols-outlined text-green-400 text-xl mb-1">timer</span>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Durasi</p>
                                    <p className="text-sm font-black text-[#1e3a8a]">{selectedScan.duration}s</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 flex gap-3">