import { useState, useEffect } from 'react';
import TopNavBar from './components/TopNavBar';
import SensorErrorBanner from './components/SensorErrorBanner';
import DashboardMetrics from './components/DashboardMetrics';
// import Analytics from './components/Analytics'; // Dihapus karena sudah digabung ke Dashboard
import Login from './components/Login';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
import { AppProvider, useAppContext } from './context/AppContext';

function MainApp() {
  const { token, logout, activeDeviceId, isConnected, devices, isDeviceOnline } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!token) {
    return <Login />;
  }

  const formatDeviceName = (id) => {
    if (!id) return 'Tidak ada alat terhubung';
    if (devices[id]?.name) return devices[id].name;
    return id.includes('inkubator') ? `Scanner (${id.slice(-4)})` : `Area: ${id}`;
  };

  return (
    <>
      <TopNavBar onLogout={logout} onProfileClick={() => setActiveTab('profile')} />
      
      {/* Top Navigation Tabs - Updated v2 */}
      <div className="pt-20 px-margin max-w-7xl mx-auto mb-6">
        <div className="flex justify-between items-center bg-white p-1.5 rounded-full border border-blue-50 shadow-sm max-w-sm mx-auto">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'dashboard' ? 'bg-white text-[#1e3a8a] shadow-sm' : 'text-gray-400 hover:bg-white/50'}`}
          >
            <span className="material-symbols-outlined text-[18px]">biotech</span>
            Scanner
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'settings' ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-gray-400 hover:bg-white/50'}`}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Settings
          </button>
        </div>
      </div>

      <main className="px-margin max-w-7xl mx-auto space-y-lg pb-12">
        <SensorErrorBanner />
        
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            {/* DEVICE INDICATOR */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-white to-transparent p-6 rounded-3xl border border-blue-50">
               <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[#3b82f6]">radar</span>
                    <span className="text-[10px] font-black text-[#1e40af] tracking-widest uppercase">Scanner Active</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-black text-[#1e3a8a] tracking-tight">
                     {formatDeviceName(activeDeviceId)}
                  </h1>
               </div>
               <div className="flex items-center gap-3">
                  {/* ALAT */}
                  <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="relative flex items-center justify-center w-2.5 h-2.5">
                      {isDeviceOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#52b788] opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full w-2 h-2 ${isDeviceOnline ? 'bg-[#52b788]' : 'bg-red-500'}`}></span>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDeviceOnline ? 'text-[#52b788]' : 'text-red-500'}`}>
                      Alat: {isDeviceOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  {/* SISTEM / AI */}
                  <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="relative flex items-center justify-center w-2.5 h-2.5">
                      <span className={`relative inline-flex rounded-full w-2 h-2 ${isConnected ? 'bg-blue-500' : 'bg-red-500'}`}></span>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isConnected ? 'text-blue-500' : 'text-red-500'}`}>
                      Sistem: {isConnected ? 'Ready' : 'Lost'}
                    </span>
                  </div>
               </div>
            </div>
            
            <DashboardMetrics />
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsPage />
        )}
        {/* Riwayat Tab Dihapus - Digabung ke Dashboard */}
        {activeTab === 'profile' && (
          <ProfilePage />
        )}

      </main>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
