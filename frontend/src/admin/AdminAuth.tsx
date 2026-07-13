import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AdminAuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('kaboom_admin_token'));

  const login = (newToken: string) => {
    setToken(newToken);
    sessionStorage.setItem('kaboom_admin_token', newToken);
  };

  const logout = () => {
    setToken(null);
    sessionStorage.removeItem('kaboom_admin_token');
  };

  return (
    <AdminAuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

// Simple Login Screen Component
export function AdminLogin() {
  const { login } = useAdminAuth();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError('');

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_URL}/api/analytics/mission-control`, {
        headers: { 'Authorization': `Bearer ${input}` }
      });
      
      if (res.ok) {
        login(input);
      } else {
        setError(res.status === 403 ? 'Incorrect admin token.' : `Server error: ${res.status}`);
      }
    } catch (e: any) {
      setError('Network error — backend may be offline.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59, 130, 246, 0.08) 0%, transparent 70%)' }}>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-blue-900/10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-500/30">
            💥
          </div>
          <div>
            <div className="text-white text-lg font-bold tracking-tight">Kaboom TV</div>
            <div className="text-slate-400 text-sm">Analytics V2</div>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-white mb-2">Sign in</h1>
        <p className="text-sm text-slate-400 mb-6">Enter your admin token to access the operations dashboard.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin Token</label>
            <input 
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="Bearer token..."
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg px-4 py-3 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
          >
            {loading ? 'Verifying...' : 'Access Dashboard'}
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-6 text-center">This page is for internal use only.</p>
      </div>
    </div>
  );
}
