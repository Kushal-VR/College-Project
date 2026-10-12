"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Video,
  Users,
  ShieldCheck,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  FileSpreadsheet,
} from "lucide-react";
import { fetchHealth, SystemHealth, API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [timeframe, setTimeframe] = useState<"Monthly" | "Weekly" | "Today">("Monthly");
  const { user, isAuthenticated, token } = useAuth();
  const [stats, setStats] = useState({
    attendanceRate: 84.6,
    totalRecords: 12200,
    presentCount: 16200,
    presentPercent: 88,
    biometricAccuracy: 98.4,
    verifiedCount: 9100,
    cctvOnlineCount: 3,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const h = await fetchHealth();
        setHealth(h);
      } catch {
        // graceful
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-7 pb-10">
      {/* Top Banner with Clean Instructed UX */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Operational Smart CCTV Ledger • Production Mode</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {isAuthenticated && user
              ? `Welcome back, ${user.full_name}`
              : "CCTV Attendance & Biometrics Dashboard"}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Automated facial recognition, multi-factor anti-spoofing, and real-time attendance ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/cctv"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Video className="w-4 h-4" />
            <span>Launch Live CCTV</span>
          </Link>
          <Link
            href="/teacher"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <CalendarCheck className="w-4 h-4 text-slate-500" />
            <span>Teacher Daily Ledger</span>
          </Link>
        </div>
      </div>

      {/* Row 1: Top Metric Cards with Circular Progress Rings (Directly modeled after reference image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Attendance Rate */}
        <div className="saas-card relative overflow-hidden p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Attendance Rate</span>
            <button className="text-slate-400 hover:text-slate-600 transition" aria-label="More options">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="my-5 flex flex-col items-center justify-center">
            {/* Circular Gauge Ring */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - 0.78)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-800">78%</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">12,200</span>
            <Link
              href="/sessions"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              View More
            </Link>
          </div>
          {/* Blue bottom bar accent from reference image */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-b-2xl" />
        </div>

        {/* Card 2: Students Present */}
        <div className="saas-card relative overflow-hidden p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Students Present</span>
            <button className="text-slate-400 hover:text-slate-600 transition" aria-label="More options">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="my-5 flex flex-col items-center justify-center">
            {/* Circular Gauge Ring in Emerald */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - 0.80)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-800">80%</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">16,200</span>
            <Link
              href="/students"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition"
            >
              View More
            </Link>
          </div>
          {/* Emerald bottom bar accent */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-b-2xl" />
        </div>

        {/* Card 3: Biometric Verified */}
        <div className="saas-card relative overflow-hidden p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Biometric Verified</span>
            <button className="text-slate-400 hover:text-slate-600 transition" aria-label="More options">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="my-5 flex flex-col items-center justify-center">
            {/* Circular Gauge Ring in Amber */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - 0.61)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-800">61%</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">9,100</span>
            <Link
              href="/enrollment"
              className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition"
            >
              View More
            </Link>
          </div>
          {/* Amber bottom bar accent */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-b-2xl" />
        </div>

        {/* Card 4: CCTV Feeds & Camera Activity */}
        <div className="saas-card relative overflow-hidden p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">CCTV Feeds Active</span>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Room 302 High-Angle</span>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Laptop Webcam Ingest</span>
              <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">READY</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">RTSP Tripwire Gate</span>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">ONLINE</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">3 Streams</span>
            <Link
              href="/cctv"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
            >
              Manage Feeds
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-400 rounded-b-2xl" />
        </div>
      </div>

      {/* Row 2: Statistics Chart + Site Speed Donut (Directly modeled after reference image) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Statistics Chart Card (2 Cols) */}
        <div className="saas-card p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-800 text-base">Statistics</h2>
              <p className="text-xs text-slate-400">Classroom attendance trends across period slots</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Today">Today</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1" aria-label="More statistics">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chart Legends */}
          <div className="flex items-center gap-6 mb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 font-medium">Present Students</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span className="text-slate-600 font-medium">Verified Face Ingests</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600 font-medium">Late / Left Early</span>
            </div>
          </div>

          {/* Clean Curved Multi-Line SVG Chart matching screenshot exactly */}
          <div className="relative w-full h-56 pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
              {/* Horizontal Grid lines */}
              <line x1="0" y1="20" x2="600" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="60" x2="600" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="100" x2="600" y2="100" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="140" x2="600" y2="140" stroke="#f1f5f9" strokeWidth="1" />

              {/* Line 1: Emerald (Present) */}
              <path
                d="M 0,90 Q 60,30 120,70 T 240,40 T 360,95 T 480,30 T 600,80"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Line 2: Blue (Verified Ingests) */}
              <path
                d="M 0,110 Q 60,85 120,105 T 240,115 T 360,50 T 480,110 T 600,70"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Line 3: Amber (Left Early) */}
              <path
                d="M 0,100 Q 60,135 120,120 T 240,130 T 360,110 T 480,135 T 600,125"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* X-Axis Tick Labels like in screenshot (10, 20, 30, ...) */}
            <div className="flex justify-between text-[11px] text-slate-400 pt-2 font-mono">
              <span>10</span>
              <span>20</span>
              <span>30</span>
              <span>40</span>
              <span>50</span>
              <span>60</span>
              <span>70</span>
              <span>80</span>
              <span>90</span>
            </div>
          </div>
        </div>

        {/* Donut Gauge Card (Like Site Speed in screenshot) */}
        <div className="saas-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-base">Inference Latency</h2>
            <button className="text-slate-400 hover:text-slate-600 p-1" aria-label="Latency options">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          <div className="my-3 flex flex-col items-center justify-center">
            {/* Multi-segmented Circular Donut Gauge */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="9"
                />
                {/* Arc 1: Blue */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="9"
                  strokeDasharray="238.7"
                  strokeDashoffset="80"
                  strokeLinecap="round"
                />
                {/* Arc 2: Amber */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="9"
                  strokeDasharray="238.7"
                  strokeDashoffset="170"
                  strokeLinecap="round"
                />
                {/* Arc 3: Emerald */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="9"
                  strokeDasharray="238.7"
                  strokeDashoffset="210"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900 leading-none">68ms</span>
                <span className="text-[10px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">Per Frame</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Anti-Spoof FFT Verification</span>
              <span className="font-semibold text-slate-700">12ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">128-d Gradient Embedding</span>
              <span className="font-semibold text-slate-700">24ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Cosine Similarity Lookup</span>
              <span className="font-semibold text-slate-700">4ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Latest Events Timeline (Directly modeled after reference image) */}
      <div className="saas-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Latest Events</h2>
            <p className="text-xs text-slate-400">Chronological live stream biometric validations and ledger commits</p>
          </div>
          <Link href="/sessions" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition">
            View All Ledger Logs
          </Link>
        </div>

        {/* Stepper with connecting dotted line matching screenshot */}
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-4 py-2">
          {/* Milestone 1 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10">
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">CCTV Stream Synchronized</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Room 302 • 30 FPS</div>
              <span className="text-[10px] text-blue-600 font-mono">09:00:15 AM</span>
            </div>
          </div>

          {/* Dotted line segment 1 */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 -mt-8" />

          {/* Milestone 2 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Auto Face Verified</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Kushal VR (1EW23CS065)</div>
              <span className="text-[10px] text-emerald-600 font-mono">09:02:44 AM</span>
            </div>
          </div>

          {/* Dotted line segment 2 */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 -mt-8" />

          {/* Milestone 3 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-sm">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Period Attendance Finalized</div>
              <div className="text-[11px] text-slate-400 mt-0.5">CS701 AI • 88% Present</div>
              <span className="text-[10px] text-amber-600 font-mono">10:00:00 AM</span>
            </div>
          </div>

          {/* Dotted line segment 3 */}
          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 -mt-8" />

          {/* Milestone 4 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10">
            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-sm">
              <Send className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Official Report Emailed</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Dispatched to Faculty via SMTP</div>
              <span className="text-[10px] text-slate-600 font-mono">10:01:12 AM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Clean Instructed UX Quick-Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/cctv"
          className="saas-card p-5 group hover:border-blue-200 transition"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Step 1: Live CCTV Ingest</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Open camera monitor. Auto-Attendance automatically detects enrolled faces without scanning cards.
          </p>
        </Link>

        <Link
          href="/teacher"
          className="saas-card p-5 group hover:border-emerald-200 transition"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Step 2: Class Teacher Matrix</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Review period-by-period daily ledger and subject attendance percentages with shortage alerts (&lt;75%).
          </p>
        </Link>

        <Link
          href="/enrollment"
          className="saas-card p-5 group hover:border-amber-200 transition"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Step 3: Biometric Enrollment</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Enroll new student face photos, compute 128-d spatial descriptors, and sync to Supabase.
          </p>
        </Link>
      </div>
    </div>
  );
}
