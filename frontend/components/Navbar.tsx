"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserCircle,
  LogOut,
  Search,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const { user, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/95 backdrop-blur-md px-6 py-3 flex items-center justify-between shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
      {/* Brand & Search Bar */}
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* Circular Badge */}
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm tracking-wider shadow-sm shadow-blue-500/20">
            CCTV
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-slate-800 tracking-tight text-sm">
              Attendance Ledger
            </span>
            <p className="text-[11px] text-slate-400 font-medium">Automated Biometrics</p>
          </div>
        </Link>

        {/* Pill Search Input */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search students, classes, cameras..."
            className="w-72 lg:w-96 pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-full text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Right Controls: Clock & User profile */}
      <div className="flex items-center gap-3">
        {/* Live Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/60 text-xs font-mono font-medium text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime || "00:00:00"}</span>
        </div>

        {/* User profile / Sign in */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-full p-1 pl-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-800 leading-tight">{user.full_name}</div>
              <div className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">{user.role}</div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-full bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition"
          >
            <UserCircle className="w-4 h-4" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
