'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Briefcase, Lock, Mail, Users, ArrowLeft, ShieldCheck, Wrench, AlertCircle } from 'lucide-react';

function FsmLoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, directEmail?: string, directPass?: string, targetRole?: string) => {
    if (e) e.preventDefault();
    const loginEmail = directEmail || email;
    const loginPass = directPass || password;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      const role = targetRole || data.user?.role;
      const destination = redirectParam || (role === 'technician' ? '/technician' : '/');
      router.push(destination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-4 text-indigo-400 font-semibold text-xs hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to Dispatch Console
        </Link>
        <div className="flex justify-center items-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-3 text-center text-2xl font-black text-white tracking-tight">
          Field Service Management Console
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Sign in for Dispatch Scheduling and Field Technician Operations
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-6 shadow-2xl border border-slate-800 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="dispatcher1@fsm.local"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-sm shadow transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to FSM'}
            </button>
          </form>

          {/* Fast Demo Logins */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <span className="block text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
              Fast Demo Logins (1-Click Switch)
            </span>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleLogin(undefined, 'dispatcher1@fsm.local', 'DispatcherPass123!', 'dispatcher')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span><strong>Dispatcher:</strong> Chief Dispatcher</span>
                </span>
                <span className="text-[10px] text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">
                  Dashboard
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleLogin(undefined, 'arnel.mendoza@fsm.local', 'TechPassword123!', 'technician')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  <span><strong>Technician:</strong> Arnel (TECH-001)</span>
                </span>
                <span className="text-[10px] text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                  Mobile View
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleLogin(undefined, 'admin@fsm.local', 'FsmAdminPass123!', 'admin')}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span><strong>Operations Admin:</strong> Lead Admin</span>
                </span>
                <span className="text-[10px] text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                  Full Access
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FsmLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading FSM sign in...</div>}>
      <FsmLoginFormContent />
    </Suspense>
  );
}
