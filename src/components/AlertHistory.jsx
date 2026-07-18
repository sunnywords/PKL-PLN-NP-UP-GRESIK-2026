import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export default function AlertHistory({ isDropdown = false }) {
    const { token, activeDeviceId } = useAppContext();
    const [alerts, setAlerts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const host = window.location.hostname || 'localhost';
    const API_URL = `http://${host}:3000`;

    useEffect(() => {
        const fetchAlerts = async () => {
            if (!activeDeviceId) return;
            try {
                const res = await fetch(`${API_URL}/api/alerts/${activeDeviceId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.ok) setAlerts(data.alerts);
            } catch (err) {
                console.error('Fetch alerts error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlerts();
        // Polling tiap 30 detik
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, [activeDeviceId, token]);

    const getIcon = (type) => {
        switch(type) {
            case 'warning': return { icon: 'warning', color: 'text-orange-500', bg: 'bg-orange-50' };
            case 'system': return { icon: 'settings_suggest', color: 'text-blue-500', bg: 'bg-blue-50' };
            case 'danger': return { icon: 'error', color: 'text-red-500', bg: 'bg-red-50' };
            default: return { icon: 'notifications', color: 'text-gray-500', bg: 'bg-gray-50' };
        }
    };

    if (isLoading) return <div className="p-4 text-center text-xs text-gray-400">Memuat riwayat...</div>;

    return (
        <section className={isDropdown ? "p-4" : "bg-white rounded-3xl p-8 border border-gray-100 shadow-sm overflow-hidden"}>
            <div className={`flex items-center justify-between ${isDropdown ? 'mb-4' : 'mb-8'}`}>
                <h2 className="font-bold text-[#1e3a8a] text-xl">Riwayat Aktivitas</h2>
                {!isDropdown && <span className="bg-white text-[#1e3a8a] px-3 py-1 rounded-full text-[10px] font-bold border border-[#e6f0ff]">LIVE</span>}
            </div>

            <div className="space-y-1">
                {alerts.length === 0 ? (
                    <div className="py-10 text-center">
                        <span className="material-symbols-outlined text-gray-200 text-5xl mb-2">notifications_off</span>
                        <p className="text-gray-400 text-xs italic">Belum ada aktivitas tercatat</p>
                    </div>
                ) : alerts.map((alert) => {
                    const style = getIcon(alert.type);
                    const time = new Date(alert.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const date = new Date(alert.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

                    return (
                        <div key={alert.id} className="py-4 flex items-start gap-4 group transition-all">
                            <div className={`w-10 h-10 rounded-2xl ${style.bg} flex-shrink-0 flex items-center justify-center border border-white shadow-sm`}>
                                <span className={`material-symbols-outlined ${style.color} text-xl`}>{style.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className="font-bold text-[#1e3a8a] text-sm truncate uppercase tracking-tight">
                                        {alert.type === 'warning' ? 'Peringatan' : 'Sistem'}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{date}, {time}</p>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                                    {alert.message}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {!isDropdown && alerts.length > 0 && (
                <button className="w-full mt-6 py-3 border border-gray-100 rounded-2xl text-[10px] font-black text-[#1e3a8a] uppercase tracking-widest hover:bg-gray-50 transition-colors">
                    Lihat Riwayat Lengkap
                </button>
            )}
        </section>
    );
}
