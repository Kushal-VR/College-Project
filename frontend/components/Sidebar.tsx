"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Video,
  ScanFace,
  ChevronDown,
  LogOut,
  Shield,
  School,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  count?: number | string;
  badgeType?: "number" | "tag" | "highlight";
}

const mainNavItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", count: 1, icon: LayoutDashboard },
  { name: "Live CCTV Feeds", href: "/cctv", count: 3, icon: Video, badgeType: "highlight" },
  { name: "Timetable & Classes", href: "/timetable", count: "NEW", icon: CalendarDays, badgeType: "tag" },
  { name: "Attendance Ledger", href: "/sessions", count: 1, icon: CalendarCheck },
  { name: "Teacher Daily Matrix", href: "/teacher", count: 6, icon: GraduationCap },
  { name: "Face Biometrics & ID", href: "/enrollment", count: 2, icon: ScanFace },
  { name: "Student Directory", href: "/students", count: 3, icon: Users },
  { name: "My Classroom", href: "/classroom", count: "CLASS", icon: School, badgeType: "highlight" },
  { name: "Subject Catalog", href: "/subjects", count: 1, icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="w-64 shrink-0 border-r border-slate-100 bg-white hidden md:flex flex-col justify-between p-4 shadow-[1px_0_4px_0_rgba(0,0,0,0.01)] sticky top-[61px] h-[calc(100vh-61px)]">
      {/* Top navigation area */}
      <div className="space-y-6 overflow-y-auto pr-1">
        <div>
          <div className="px-3 mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                    isActive
                      ? "bg-blue-50/80 text-blue-600 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.count !== undefined && (
                      <span
                        className={`text-[10px] font-semibold flex items-center justify-center ${
                          isActive || item.badgeType === "highlight"
                            ? "w-5 h-5 rounded-full bg-blue-600 text-white"
                            : item.badgeType === "tag"
                            ? "px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-mono text-[9px]"
                            : "w-5 h-5 rounded-full bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Section: User Info & Bottom-Left Logout Button */}
      {isAuthenticated && (
        <div className="pt-3 border-t border-slate-100 mt-2">
          {/* User Card + Working Logout Button */}
          <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                  {user?.full_name || "Administrator"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">
                    <Shield className="w-2.5 h-2.5" />
                    {user?.role || "ADMIN"}
                  </span>
                </div>
              </div>
            </div>

            <button
              id="sidebar-logout-button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign out of your account"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 active:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-lg shadow-xs transition-all group cursor-pointer disabled:opacity-50"
            >
              <LogOut className={`w-3.5 h-3.5 text-rose-500 transition-transform group-hover:-translate-x-0.5 ${isLoggingOut ? "animate-spin" : ""}`} />
              <span>{isLoggingOut ? "Logging out..." : "Log Out"}</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
