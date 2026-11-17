"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check login on client load
  useEffect(() => {
    async function loadUser() {
      try {
        const stored = localStorage.getItem(USER_STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }

        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
          } else {
            setUser(null);
            localStorage.removeItem(USER_STORAGE_KEY);
          }
        }
      } catch {
        // Fallback to local storage if API call fails
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error?.message || "Login failed" };
      }

      setUser(data.user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      return { success: true };
    } catch (err: any) {
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
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
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
