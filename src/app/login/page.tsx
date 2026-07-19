'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Loader2, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';
import { ZConnectLogo } from '../../components/ZConnectLogo';
import { useTheme } from '../ThemeProvider';

function LoginContent() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear token on mounting login
  useEffect(() => {
    localStorage.removeItem('zorvik_chat_token');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Save the verified session token locally in localStorage
        localStorage.setItem('zorvik_chat_token', data.token);
        
        // Redirect to target dashboard
        router.push(`${data.redirectTo}?token=${data.token}`);
      } else {
        setError(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      console.error(err);
      setError('A connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen relative flex flex-col items-center justify-center p-4 transition-colors duration-300">
      {/* Dynamic ambient decoration */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gold-accent/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <ZConnectLogo size={56} />
          <div>
            <h1 className="font-bold text-2xl tracking-tight text-foreground font-sans">ZConnect Portal</h1>
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase mt-1">Client Authorization Node</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 dark:text-red-400 text-xs leading-relaxed font-semibold">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Clean, spacious minimalist card */}
        <div className="premium-card bg-card border-border shadow-xl p-8 transition-all">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-foreground text-xs font-bold uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="operator@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary-accent/50 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-foreground text-xs font-bold uppercase tracking-wider">Passphrase</label>
                <span className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer font-semibold">Forgot passcode?</span>
              </div>
              <div className="relative">
                <Lock className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary-accent/50 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-primary-accent-foreground bg-primary-accent hover:bg-primary-accent-hover mt-8 shadow-sm cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Initialize Support Session"
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center text-xs text-muted-foreground">
          Protected by enterprise-grade cryptographic validation.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-accent" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
