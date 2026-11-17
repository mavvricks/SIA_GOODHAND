"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  FlaskConical,
  LogOut,
  Menu,
  RadioTower,
  Truck,
  UserRound,
  Users,
  Wrench,
  X,
} from "lucide-react";
import type { UserSession } from "@/lib/auth";

export function FsmHeader({ title }: { title?: string }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => setMenuOpen(false), [pathname]);

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
  }, [refresh, pathname]);

  const logout = async () => {
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Try again.");
      setUser(null);
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  };

  if (pathname === "/login") return null;

  const staff = user && ["dispatcher", "admin"].includes(user.role);
  const links = [
    { href: "/", label: "Jobs queue", icon: ClipboardList },
    { href: "/technician", label: "Technician view", icon: Wrench },
    ...(staff
      ? [
          { href: "/technicians", label: "Technicians", icon: Users },
          { href: "/deliveries", label: "Deliveries", icon: Truck },
          { href: "/operations", label: "Operations", icon: RadioTower },
        ]
      : []),
    ...(process.env.NODE_ENV === "production"
      ? []
      : [{ href: "/demo", label: "Demo", icon: FlaskConical }]),
  ];

  return (
    <>
      <div className="flex h-16 items-center justify-between border-t-[3px] border-[#d71920] bg-[#0b1c2d] px-4 text-white md:hidden">
        <Link href="/" className="flex items-center gap-2 font-bold" aria-label="GoodHand Field Service home">
          <img src="/brand/goodhand-logo.png" alt="GoodHand" width={92} height={30} className="h-8 w-auto object-contain" />
          <span className="border-l border-white/20 pl-2 text-sm">Field Service</span>
        </Link>
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="fsm-sidebar" className="rounded-lg border border-white/20 p-2">
          <Menu size={20} />
        </button>
      </div>
      {menuOpen && <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/60 md:hidden" />}
      <aside id="fsm-sidebar" className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-white/10 border-t-[3px] border-t-[#d71920] bg-[#0b1c2d] text-white shadow-xl transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 md:shadow-none ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-6">
          <Link href="/" className="min-w-0" aria-label="GoodHand Field Service home" onClick={() => setMenuOpen(false)}>
            <img src="/brand/goodhand-logo.png" alt="GoodHand Security Products" width={128} height={40} className="h-10 w-auto object-contain" />
            <strong className="mt-4 block text-base font-bold">{title || "Field Service"}</strong>
            <span className="block text-[11px] text-slate-300">Dispatch & technician operations</span>
          </Link>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="rounded-lg p-1 hover:bg-white/10 md:hidden"><X size={20} /></button>
        </div>
        <nav aria-label="Field service navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5 text-sm">
          <span className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</span>
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-3 font-semibold transition ${active ? "border-[#ffc400] bg-white/10 text-white" : "border-transparent text-slate-300 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={18} className={active ? "text-[#ffc400]" : undefined} />{label}
            </Link>;
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          {loading ? <span className="text-xs text-slate-300" role="status">Checking session…</span> : user ? <>
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-200" aria-label="Signed-in account"><UserRound size={17} className="shrink-0 text-[#ffc400]" /><span className="min-w-0"><strong className="block truncate">{user.fullName}</strong><span className="text-slate-400">{user.role}</span></span></div>
            <button type="button" disabled={signingOut} onClick={() => void logout()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-50"><LogOut size={15} />{signingOut ? "Signing out…" : "Sign out"}</button>
          </> : <Link href="/login" className="block rounded-lg bg-[#ffc400] px-4 py-2 text-center text-sm font-bold text-[#0b1c2d]">Sign in</Link>}
          {error && <p role="alert" className="mt-2 text-xs text-red-200">{error}</p>}
        </div>
      </aside>
    </>
  );
}
