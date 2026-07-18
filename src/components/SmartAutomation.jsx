import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function SmartAutomation() {
    const [isScheduleActive, setIsScheduleActive] = useState(true);
    const [startTime, setStartTime] = useState('19:00');
    const [endTime, setEndTime] = useState('06:00');
    
    const [isClimateActive, setIsClimateActive] = useState(false);
    const [tempThreshold, setTempThreshold] = useState(30.0);
    
    const [timerHours, setTimerHours] = useState(8);
    const [timerMinutes, setTimerMinutes] = useState(0);

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            
            {/* 1. PENJADWALAN RUTIN */}
            <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#eff6ff] rounded-2xl flex items-center justify-center shadow-inner">
                            <span className="material-symbols-outlined text-[#1d4ed8] text-3xl">shield_moon</span>
                        </div>
                        <div>
                            <h2 className="font-black text-[#1e3a8a] text-2xl tracking-tight">Mold Prevention</h2>
                            <p className="text-xs text-gray-500 font-medium">Otomasi pencegahan jamur & kontrol sirkulasi</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isScheduleActive} 
                            onChange={(e) => setIsScheduleActive(e.target.checked)} 
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563eb]"></div>
                    </label>
                </div>

                <div className={`grid grid-cols-2 gap-4 transition-opacity duration-300 ${isScheduleActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="bg-[#eff6ff] border border-gray-100 rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Jam Nyala</span>
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 font-bold text-[#1e3a8a]" />
                    </div>
                    <div className="bg-[#eff6ff] border border-gray-100 rounded-2xl p-4">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Jam Mati</span>
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 font-bold text-[#1e3a8a]" />
                    </div>
                </div>
            </section>

            {/* 2. TIMER SEKALI PAKAI */}
            <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#2563eb]">
                        <span className="material-symbols-outlined">hourglass_top</span>
                    </div>
                    <div>
                        <h2 className="font-bold text-[#1e3a8a] text-xl">Timer Sekali Pakai</h2>
                        <p className="text-xs text-gray-500">Nyalakan sistem untuk durasi tertentu</p>
                    </div>
                </div>
                <div className="flex justify-center items-end gap-2 mb-6">
                    <span className="text-4xl font-black text-[#1e3a8a]">{timerHours}h</span>
                    <span className="text-4xl font-black text-[#1e3a8a]">{timerMinutes}m</span>
                </div>
                <div className="space-y-4">
                    <input type="range" min="0" max="12" value={timerHours} onChange={(e) => setTimerHours(e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2563eb]" />
                    <input type="range" min="0" max="59" value={timerMinutes} onChange={(e) => setTimerMinutes(e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2563eb]" />
                </div>
            </section>

            {/* 3. AUTO AIR CIRCULATION */}
            <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center text-[#2563eb]">
                            <span className="material-symbols-outlined">cyclone</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-[#1e3a8a] text-xl">Auto Air Circulation</h2>
                            <p className="text-xs text-gray-500">Kontrol otomatis berdasarkan kelembapan</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={isClimateActive}
                            onChange={(e) => setIsClimateActive(e.target.checked)}
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563eb]"></div>
                    </label>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${isClimateActive ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div>
                        <div className="flex justify-between mb-4">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kelembapan Aman</span>
                            <span className="text-sm font-black text-[#1e3a8a]">{tempThreshold}% RH</span>
                        </div>
                        <input 
                            type="range" 
                            min="40" 
                            max="90" 
                            value={tempThreshold}
                            onChange={(e) => setTempThreshold(e.target.value)}
                            className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                        />
                        <div className="flex justify-between mt-2 text-[8px] font-bold text-gray-400 uppercase">
                            <span>Kering</span>
                            <span>Sangat Lembap</span>
                        </div>
                    </div>

                    <div className="bg-[#f8fafc] p-4 rounded-2xl border border-gray-50">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">Indikator Lampu AI</p>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-[#2563eb]"></div>
                                <p className="text-xs font-bold text-[#1e3a8a]">Aman: Kondisi Normal</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-orange-400 animate-pulse"></div>
                                <p className="text-xs font-bold text-[#1e3a8a]">Oranye: Sirkulasi Aktif (Lembap)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
}
