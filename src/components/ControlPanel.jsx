import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export default function ControlPanel() {
    const { state, sendCommand } = useAppContext();
    const [localBrightness, setLocalBrightness] = useState(0);

    // Sync local brightness with server when it updates externally
    useEffect(() => {
        if (state.lampBrightness !== undefined) {
            setLocalBrightness(state.lampBrightness);
        }
    }, [state.lampBrightness]);

    const handleSystemToggle = (e) => {
        sendCommand({ system: e.target.checked });
    };

    const handleColorChange = (color) => {
        sendCommand({ command: 'sleepwell_lamp', color: color, brightness: localBrightness });
    };

    const handleBrightnessEnd = (e) => {
        const val = parseInt(e.target.value);
        sendCommand({ command: 'sleepwell_lamp', color: state.lampColor || 'putih', brightness: val });
    };
    return (
        <section className="glass-card rounded-xl p-8 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-on-surface">Control Panel</h2>
            </div>
            <div className="space-y-8">
                {/* Lighting Slider */}
                <div className="space-y-sm">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-base font-medium text-on-surface-variant flex items-center gap-2">
                            <span className="material-symbols-outlined text-xl">light_mode</span>
                            Kecerahan Lampu
                        </span>
                        <span className="text-base font-medium text-on-surface">{Math.round((localBrightness/255)*100)}%</span>
                    </div>
                    <input 
                        className="w-full h-3 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary-container" 
                        type="range" 
                        min="0" max="255"
                        value={localBrightness}
                        onChange={(e) => setLocalBrightness(e.target.value)}
                        onMouseUp={handleBrightnessEnd}
                        onTouchEnd={handleBrightnessEnd}
                    />
                </div>
                {/* Lamp Color */}
                <div className="space-y-sm">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-base font-medium text-on-surface-variant flex items-center gap-2">
                            <span className="material-symbols-outlined text-xl">palette</span>
                            Warna Lampu
                        </span>
                    </div>
                    <p className="text-sm text-on-surface-variant bg-surface-container-low p-3 rounded-lg italic leading-relaxed">
                        <span className="material-symbols-outlined text-base inline-block align-text-bottom mr-1 text-primary">info</span>
                        Warna-warna ini dikalibrasi secara khusus untuk memancarkan panjang gelombang yang secara alami dihindari nyamuk, menjaga estetika ruangan Anda dan bebas dari gigitan.
                    </p>
                    <div className="grid grid-cols-5 gap-4 pt-3">
                        <button onClick={() => handleColorChange('putih')} className={`h-14 rounded-xl bg-white border-2 shadow-sm transition-all ${state.lampColor === 'putih' ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent hover:border-primary/50 hover:scale-105'}`} title="Putih"></button>
                        <button onClick={() => handleColorChange('hijau')} className={`h-14 rounded-xl bg-[#4ade80] border-2 shadow-sm transition-all ${state.lampColor === 'hijau' ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent hover:border-primary/50 hover:scale-105'}`} title="Hijau"></button>
                        <button onClick={() => handleColorChange('biru')} className={`h-14 rounded-xl bg-[#60a5fa] border-2 shadow-sm transition-all ${state.lampColor === 'biru' ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent hover:border-primary/50 hover:scale-105'}`} title="Biru"></button>
                        <button onClick={() => handleColorChange('kuning')} className={`h-14 rounded-xl bg-[#facc15] border-2 shadow-sm transition-all ${state.lampColor === 'kuning' ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent hover:border-primary/50 hover:scale-105'}`} title="Kuning"></button>
                        <button className="h-14 rounded-xl bg-gradient-to-r from-white via-[#4ade80] to-[#60a5fa] border-2 border-transparent hover:border-primary/50 hover:scale-105 transition-all flex items-center justify-center group" title="Shuffle">
                            <span className="material-symbols-outlined text-white text-xl group-hover:rotate-180 transition-transform duration-300" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>shuffle</span>
                        </button>
                    </div>
                </div>

            </div>
        </section>
    );
}
