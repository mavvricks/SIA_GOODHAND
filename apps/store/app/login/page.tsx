"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";
  const { user, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [fullName, setFullName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (registering) {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName }),
        });
        if (!response.ok) {
          const value = await response.json();
          setError(value.error?.message || "Registration failed");
          setLoading(false);
          return;
        }
      } catch {
        setError("Registration failed");
        setLoading(false);
        return;
      }
    }
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      router.push(redirectUrl);
    } else {
      setError(result.error || "Invalid email or password");
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setError(null);
    setLoading(true);

    const result = await login(quickEmail, quickPass);
    setLoading(false);

    if (result.success) {
      router.push(redirectUrl);
    } else {
      setError(result.error || "Quick login failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 mb-4 text-[#0e2378] font-bold text-sm hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Store Catalog
        </Link>
        <div className="flex justify-center items-center gap-2">
          <div className="w-12 h-12 bg-[#0e2378] rounded-xl flex items-center justify-center shadow-md">
            <ShieldCheck className="w-7 h-7 text-[#ffc107]" />
          </div>
        </div>
        <h2 className="mt-3 text-center text-2xl font-black text-slate-900 tracking-tight">
          GoodHand Security Store
        </h2>
        <p className="mt-1 text-center text-xs text-slate-600">
          Sign in to manage installation orders, cart, and equipment warranties
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {user && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                Currently logged in as <strong>{user.fullName}</strong> (
                {user.role}).
                <Link
                  href={redirectUrl}
                  className="block font-bold text-emerald-900 underline mt-1"
                >
                  Continue to {redirectUrl === "/" ? "Store" : "Checkout"} →
                </Link>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {registering && (
              <label className="block text-xs font-semibold text-slate-700">
                Full Name
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="block w-full mt-1 p-2 border rounded-lg"
                />
              </label>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer1@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e2378] focus:border-[#0e2378]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  minLength={registering ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0e2378] focus:border-[#0e2378]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-[#0e2378] hover:bg-[#193893] text-white font-bold rounded-lg text-sm shadow transition-colors disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : registering
                  ? "Create Account"
                  : "Sign In"}
            </button>
          </form>
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-[#0e2378]"
            onClick={() => {
              setRegistering(!registering);
              setError(null);
            }}
          >
            {registering
              ? "Already have an account? Sign in"
              : "New customer? Create an account"}
          </button>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <span className="block text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Fast Demo Logins (1-Click)
            </span>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  handleQuickLogin(
                    "customer1@example.com",
                    "CustomerPassword123!",
                  )
                }
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-blue-50 text-[#0e2378] hover:bg-blue-100 border border-blue-200 transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <strong>Customer:</strong> Juan Dela Cruz
                </span>
                <span className="text-[10px] text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  customer1@example.com
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleQuickLogin("admin@goodhand88.com", "AdminPassword123!")
                }
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  <strong>Store Admin:</strong> GoodHand Manager
                </span>
                <span className="text-[10px] text-amber-700 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                  admin@goodhand88.com
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500">
          Loading sign in...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
