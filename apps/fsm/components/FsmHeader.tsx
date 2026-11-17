"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { UserSession } from "@/lib/auth";

export function FsmHeader({ title }: { title?: string }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (response.ok) {
        const result = await response.json();
        setUser(result.authenticated ? result.user : null);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
    const onFocus = () => void refresh().catch(() => {});
    window.addEventListener("focus", onFocus);
    const timer = setInterval(onFocus, 15000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [refresh]);
  const logout = async () => {
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Try again.");
      setUser(null);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  };
  if (pathname === "/login") return null;
  return (
    <header className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">
            {title ||
              (user?.role === "technician" || pathname.startsWith("/technician")
                ? "Technician Field App"
                : "FSM Dispatch Console")}
          </h1>
          <p className="text-xs text-slate-300">
            {user
              ? `${user.fullName} · ${user.role}`
              : "System B · Field Service Operations"}
          </p>
        </div>
        <nav
          aria-label="Field service navigation"
          className="flex flex-wrap items-center gap-4 text-sm"
        >
          <Link href="/">Jobs Queue</Link>
          <Link href="/technician">Technician View</Link>
          {user && ["dispatcher", "admin"].includes(user.role) && (
            <>
              <Link href="/technicians">Technicians</Link>
              <Link href="/deliveries">Order deliveries</Link>
              <Link href="/operations">Operations</Link>
            </>
          )}
          <Link href="/demo">Demo Panel</Link>
          {loading ? (
            <span className="text-slate-400 text-xs" role="status">
              Checking session…
            </span>
          ) : user ? (
            <>
              <span
                className="text-slate-300 text-xs"
                aria-label="Signed-in account"
              >
                {user.fullName}
              </span>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void logout()}
                className="rounded border border-slate-600 px-3 py-1.5 font-semibold disabled:opacity-50"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </nav>
        {error && (
          <p role="alert" className="text-red-300 text-sm">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}
