import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background selection:bg-accent selection:text-black">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-card border border-border text-accent mb-4 shadow-sm">
            <Server className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">PalAutoBC Dashboard</h1>
          <p className="text-xs text-mutedText mt-1">Palworld Dedicated Server Management</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-xl relative backdrop-blur-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="admin"
                  className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-mutedText focus:outline-none focus:border-accent/80 transition-colors"
                />
                <User className="w-4 h-4 text-mutedText absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-mutedText focus:outline-none focus:border-accent/80 transition-colors"
                />
                <Lock className="w-4 h-4 text-mutedText absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-accent hover:bg-accent-hover text-black font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border/60 text-center">
            <span className="text-[11px] text-mutedText font-mono">Port 3000 • Production Node.js Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}

