import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function Login() {
  const { login } = useAppContext();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetStatus, setResetStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous error
    const result = await login(username, password);
    if (!result.ok) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0f8ff 0%, #eff6ff 100%)' }}>
      
      {/* Decorative element bottom right */}
      <div className="absolute bottom-10 right-10 w-24 h-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center opacity-80">
        <span className="material-symbols-outlined text-[#2563eb] text-3xl">radar</span>
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-2xl w-full max-w-[400px] p-8 rounded-3xl text-center relative z-10">
        <div className="w-16 h-16 bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="material-symbols-outlined text-white text-3xl">biotech</span>
        </div>
        
        <h2 className="text-2xl font-black text-[#1e3a8a] mb-1 tracking-tight">FungiGuard <span className="text-[#3b82f6]">AI</span></h2>
        <p className="text-xs text-gray-500 mb-8">Sistem cerdas pencegah dan pemantau risiko jamur.</p>
        
        {isForgotPassword ? (
          <div className="space-y-4 text-left animate-fade-in">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-[#1e3a8a] mb-2">Lupa Password?</h3>
              <p className="text-xs text-gray-500">Masukkan username Anda untuk mereset password.</p>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400 text-lg">person</span>
                </div>
                <input 
                  type="text" 
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  placeholder="Masukkan username Anda"
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
                />
              </div>
            </div>

            {resetStatus && <p className="text-[#2563eb] text-xs text-center font-medium mt-2">{resetStatus}</p>}

            <div className="pt-2 space-y-3">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  if(!resetUsername) return;
                  setResetStatus('Permintaan reset password telah dikirim ke Admin!');
                }}
                className="w-full bg-[#3b82f6] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#1e3a8a] transition-colors flex justify-center items-center gap-2 shadow-md"
              >
                Kirim Permintaan
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
              
              <button 
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetStatus('');
                  setResetUsername('');
                }}
                className="w-full bg-white border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors flex justify-center items-center gap-2"
              >
                Kembali ke Login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left animate-fade-in">
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400 text-lg">person</span>
                </div>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username Anda"
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 ml-1">
                <label className="block text-xs font-semibold text-gray-700">Password</label>
                <button 
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-[10px] text-[#2563eb] hover:underline font-medium"
                >
                  Lupa Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-gray-400 text-lg">lock</span>
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password Anda"
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
                />
                <div 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-gray-400 text-lg hover:text-[#2563eb] transition-colors">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-xs text-center font-medium mt-2">{error}</p>}

            <div className="pt-2">
              <button type="submit" className="w-full bg-[#1d4ed8] text-white py-3 rounded-xl text-sm font-semibold hover:bg-[#1e3a8a] transition-colors flex justify-center items-center gap-2 shadow-md">
                Masuk Ke Sistem
                <span className="material-symbols-outlined text-sm">login</span>
              </button>
            </div>
            
          </form>
        )}

        <div className="mt-8 text-center pt-4 border-t border-gray-100/50">
          <div className="inline-flex items-center gap-1 bg-[#eff6ff] text-[#1d4ed8] px-3 py-1 rounded-full text-[10px] font-medium mb-2 border border-blue-100">
            <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full"></span>
            Sistem Terenkripsi & Aman
          </div>
          <p className="text-[9px] text-gray-400">© 2024 FungiGuard AI. Semua Hak Dilindungi.</p>
        </div>

      </div>
    </div>
  );
}
