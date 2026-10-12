"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";

export type Role = "ADMIN" | "FACULTY" | "STUDENT";

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  phone_number?: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResult {
  requires_otp: boolean;
  email: string;
  message: string;
  user?: UserProfile;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, otp?: string) => Promise<LoginResult>;
  resendOtp: (email: string, purpose?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem("cctv_attendance_token");
    const savedUser = localStorage.getItem("cctv_attendance_user");

    if (savedToken && savedToken !== "null" && savedToken !== "undefined" && savedUser) {
      try {
        // Check JWT expiration if valid 3-part token
        const parts = savedToken.split(".");
        let isExpired = false;
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              isExpired = true;
            }
          } catch {
            isExpired = true;
          }
        }
        if (isExpired) {
          localStorage.removeItem("cctv_attendance_token");
          localStorage.removeItem("cctv_attendance_user");
          setToken(null);
          setUser(null);
        } else {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch {
        localStorage.removeItem("cctv_attendance_token");
        localStorage.removeItem("cctv_attendance_user");
      }
    } else {
      localStorage.removeItem("cctv_attendance_token");
      localStorage.removeItem("cctv_attendance_user");
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string, otp?: string): Promise<LoginResult> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, otp }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Authentication failed. Please check credentials.");
    }

    const data = await response.json();

    if (data.requires_otp) {
      return {
        requires_otp: true,
        email: data.email,
        message: data.message,
      };
    }

    if (data.access_token && data.user) {
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem("cctv_attendance_token", data.access_token);
      localStorage.setItem("cctv_attendance_user", JSON.stringify(data.user));
    }

    return {
      requires_otp: false,
      email: data.email,
      message: data.message,
      user: data.user,
    };
  };

  const resendOtp = async (email: string, purpose: string = "Login 2FA Verification"): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore logout error
      }
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("cctv_attendance_token");
    localStorage.removeItem("cctv_attendance_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        resendOtp,
        logout,
        isAuthenticated: !!user,
      }}
    >
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
