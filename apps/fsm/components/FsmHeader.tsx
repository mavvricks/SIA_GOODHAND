"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  FlaskConical,
  LogOut,
  RadioTower,
  Truck,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
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
    <header className="border-t-[3px] border-[#d71920] bg-[#0b1c2d] text-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-[74px] flex-wrap items-center justify-between gap-3 py-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3"
            aria-label="GoodHand Field Service home"
          >
            <img
              src="/brand/goodhand-logo.png"
              alt="GoodHand Security Products"
              width={118}
              height={40}
              className="h-10 w-auto object-contain"
            />
            <span
              className="hidden h-8 w-px bg-white/20 sm:block"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <strong className="block truncate text-sm font-bold leading-tight sm:text-base">
                {title || "Field Service"}
              </strong>
              <span className="block text-[11px] text-slate-300">
                Dispatch & technician operations
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-slate-300" role="status">
                Checking session…
              </span>
            ) : user ? (
              <>
                <span
                  className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-200 sm:flex"
                  aria-label="Signed-in account"
                >
                  <UserRound size={14} className="text-[#ffc400]" />
                  <span className="max-w-36 truncate">{user.fullName}</span>
                  <span className="text-slate-400">· {user.role}</span>
                </span>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold transition hover:bg-white/10 disabled:opacity-50"
                >
                  <LogOut size={15} />{" "}
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-[#ffc400] px-4 py-2 text-sm font-bold text-[#0b1c2d] hover:bg-[#eeb500]"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
        <nav
          aria-label="Field service navigation"
          className="-mx-4 flex items-center gap-1 overflow-x-auto border-t border-white/10 px-4 py-2 text-sm sm:mx-0 sm:px-0"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-semibold transition ${active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon
                  size={15}
                  className={active ? "text-[#ffc400]" : undefined}
                />
                {label}
              </Link>
            );
          })}
        </nav>
        {error && (
          <p role="alert" className="pb-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}
