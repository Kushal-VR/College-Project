"use client";

import React from "react";
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
  Info,
  Layers,
} from "lucide-react";

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
  { name: "Faculty Staff", href: "/faculty", count: 1, icon: Users },
  { name: "Subject Catalog", href: "/subjects", count: 1, icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-slate-100 bg-white hidden md:flex flex-col justify-between p-4 shadow-[1px_0_4px_0_rgba(0,0,0,0.01)]">
      <div className="space-y-6">
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

      {/* Guided Instruction Card */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          <span>Instructed Workflow</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
          1. Select class in Timetable
          <br />
          2. Toggle Live CCTV Auto-Attendance
          <br />
          3. Face matches log directly to Supabase
        </p>
      </div>
    </aside>
  );
}
