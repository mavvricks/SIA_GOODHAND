"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export interface User {
  userId: string;
  email: string;
  fullName: string;
  role: "customer" | "store_admin";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "gh_store_user_v1";
const AUTH_CHANGE_KEY = "gh_store_auth_changed_v1";

function clearCachedUser() {
  try { localStorage.removeItem(USER_STORAGE_KEY); } catch {}
}

function signalAuthChange() {
  try { localStorage.setItem(AUTH_CHANGE_KEY, crypto.randomUUID()); } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authVersion = useRef(0);

  // Revalidate when another tab changes the session or this tab resumes.
  // Neither localStorage nor a previously rendered user is proof of login.
  useEffect(() => {
    async function loadUser() {
      const version = ++authVersion.current;
      setIsLoading(true);
      setUser(null);
      try {
        // The browser cache is never proof of an authenticated session.
        clearCachedUser();
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (version !== authVersion.current) return;
        if (res.ok) {
          const data = await res.json();
          if (version !== authVersion.current) return;
          if (data.authenticated && data.user?.userId) {
            setUser(data.user);
          } else {
            setUser(null);
          }
        } else setUser(null);
      } catch {
        if (version === authVersion.current) setUser(null);
      } finally {
        if (version === authVersion.current) setIsLoading(false);
      }
    }

    void loadUser();
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_CHANGE_KEY) void loadUser();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadUser();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      authVersion.current += 1;
    };
  }, []);

  const login = async (email: string, password: string) => {
    authVersion.current += 1;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setIsLoading(false);
        return { success: false, error: data.error?.message || "Login failed" };
      }

      authVersion.current += 1;
      setUser(data.user);
      clearCachedUser();
      signalAuthChange();
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || "Login request error" };
    }
  };

  const logout = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) return;
    } catch {
      return;
    }
    authVersion.current += 1;
    setUser(null);
    clearCachedUser();
    signalAuthChange();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
