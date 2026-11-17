"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ArrowLeft, AlertCircle } from "lucide-react";

function FsmLoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Login failed");
      }

      const role = data.user?.role;
      const destination =
        redirectParam || (role === "technician" ? "/technician" : "/");
      router.push(destination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#0b1c2d] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 mb-6 text-[#0e2378] font-semibold text-xs hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dispatch Console
        </Link>
        <div className="flex justify-center items-center rounded-2xl bg-[#0b1c2d] border-t-4 border-[#d71920] py-5 shadow-sm">
          <img
            src="/brand/goodhand-logo.png"
            width={190}
            height={65}
            alt="GoodHand Security Products"
            className="h-16 w-auto object-contain"
          />
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-[#0b1c2d] tracking-tight">
          Welcome to GoodHand Field Service
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in for Dispatch Scheduling and Field Technician Operations
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="dispatcher1@fsm.local"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#ffc400] hover:bg-[#eeb500] text-[#0b1c2d] font-bold rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In to FSM"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function FsmLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400">
          Loading FSM sign in...
        </div>
      }
    >
      <FsmLoginFormContent />
    </Suspense>
  );
}
