import { useAppContext } from '../context/AppContext';

export default function PowerControl() {
    const { state, sendCommand, espLastSeen, isDeviceOnline } = useAppContext();

    const ESP_TIMEOUT = 15000;
    const now = Date.now();
    const espIsAlive = isDeviceOnline || (espLastSeen > 0 && (now - espLastSeen < ESP_TIMEOUT));

    const handleToggle = () => {
        if (!espIsAlive) return; // Disable if offline
        sendCommand({ system: !state.system });
    };

    return (
        <section className="glass-card rounded-xl p-8 flex flex-col h-full justify-between relative overflow-hidden">
            {/* Background glowing effect */}
            {state.system && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#4ade80]/20 blur-3xl rounded-full pointer-events-none"></div>
            )}

            <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                    <h2 className="text-2xl font-bold text-on-surface mb-1">Master Power</h2>
                    <p className="text-sm text-on-surface-variant">Kendali Utama Sistem FungiGuard</p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${state.system ? 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/30' : 'bg-surface-variant text-on-surface-variant border-transparent'}`}>
                    {state.system ? 'SISTEM AKTIF' : 'SISTEM MATI'}
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-6">
                <button
                    onClick={handleToggle}
                    disabled={!espIsAlive}
                    className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${!espIsAlive
                            ? 'bg-surface-variant cursor-not-allowed opacity-50'
                            : state.system
                                ? 'bg-gradient-to-br from-[#4ade80] to-[#22c55e] hover:shadow-[0_0_40px_rgba(74,222,128,0.5)] hover:scale-105'
                                : 'bg-gradient-to-br from-surface-variant to-gray-300 hover:scale-105'
                        }`}
                >
                    <span className={`material-symbols-outlined text-7xl transition-colors duration-300 ${state.system ? 'text-white' : 'text-gray-500'}`}>
                        power_settings_new
                    </span>

                    {/* Ripple effect rings when active */}
                    {state.system && (
                        <>
                            <div className="absolute inset-0 rounded-full border-2 border-[#4ade80] opacity-0 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                            <div className="absolute inset-[-12px] rounded-full border-2 border-[#4ade80] opacity-0 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] delay-300"></div>
                        </>
                    )}
                </button>

                <p className="mt-8 text-base text-center text-on-surface-variant max-w-[250px] leading-relaxed">
                    {espIsAlive
                        ? state.system
                            ? "Sistem sedang berjalan dan melindungi ruangan."
                            : "Klik tombol di atas untuk menyalakan sistem."
                        : "Sistem tidak dapat dinyalakan karena perangkat terputus."
                    }
                </p>
            </div>

        </section>
    );
}
