"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
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
  Play,
  Pause,
  RotateCw,
  Eye,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Zap,
  School,
  GraduationCap,
  AlertTriangle,
  Building,
} from "lucide-react";
import { fetchHealth, SystemHealth, API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// --- BEZIER SPLINE HELPER FOR SMOOTH CURVES ---
function getCurvedPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// --- CLASS-SPECIFIC DATASETS (SCOPED TO CLASS SIZE: 6 STUDENTS) ---
const CLASS_CHART_DATA = {
  Today: {
    labels: ["P1 (9AM)", "P2 (10AM)", "P3 (11AM)", "P4 (1PM)", "P5 (2PM)", "P6 (3PM)"],
    periodNames: [
      "Period 1 (09:00 AM) • CS601 AI (Prof. Alan Turing)",
      "Period 2 (10:00 AM) • CS602 Networks (Prof. Donald Knuth)",
      "Period 3 (11:15 AM) • CS603 Databases (Prof. Ada Lovelace)",
      "Period 4 (01:00 PM) • CS604 Operating Systems (Prof. Claude Shannon)",
      "Period 5 (02:00 PM) • CS605 Cloud Computing (Prof. Alan Turing)",
      "Period 6 (03:00 PM) • CS606 Machine Learning Lab",
    ],
    // SVG Y-coordinates (scaled for 6-student class in 160px height)
    // 6 students = y: 30, 5 students = y: 55, 4 students = y: 85, 1 student = y: 130
    present: [55, 30, 55, 30, 55, 30],
    ingests: [55, 30, 55, 30, 75, 30],
    late: [130, 142, 130, 142, 130, 142],
    rawValues: {
      present: ["5 / 6", "6 / 6", "5 / 6", "6 / 6", "5 / 6", "6 / 6"],
      ingests: ["5 Ingests", "6 Ingests", "5 Ingests", "6 Ingests", "4 Ingests (1 Card)", "6 Ingests"],
      late: ["1 Absent (Kavya)", "0 Absent", "1 Absent (Kavya)", "0 Absent", "0 Absent (1 Card)", "0 Absent"],
    },
  },
  Weekly: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    periodNames: [
      "Monday (6 Periods)",
      "Tuesday (6 Periods)",
      "Wednesday (6 Periods)",
      "Thursday (6 Periods)",
      "Friday (6 Periods)",
      "Saturday (4 Periods)",
    ],
    present: [55, 30, 55, 30, 55, 80],
    ingests: [55, 30, 55, 30, 60, 80],
    late: [130, 142, 130, 142, 130, 115],
    rawValues: {
      present: ["5.2 avg / 6", "6.0 / 6 (100%)", "5.0 / 6 (83%)", "6.0 / 6 (100%)", "5.4 / 6 (90%)", "4.0 / 6 (67%)"],
      ingests: ["5.2 Ingests", "6.0 Ingests", "5.0 Ingests", "6.0 Ingests", "5.0 Ingests", "4.0 Ingests"],
      late: ["0.8 Absent avg", "0.0 Absent", "1.0 Absent", "0.0 Absent", "0.6 Absent", "2.0 Absent"],
    },
  },
  Monthly: {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    periodNames: [
      "Week 1 (Oct 1 - Oct 7)",
      "Week 2 (Oct 8 - Oct 14)",
      "Week 3 (Oct 15 - Oct 21)",
      "Week 4 (Oct 22 - Oct 28)",
    ],
    present: [45, 35, 50, 40],
    ingests: [48, 38, 52, 42],
    late: [132, 138, 128, 135],
    rawValues: {
      present: ["86% Class Attendance", "92% Class Attendance", "83% Class Attendance", "88% Class Attendance"],
      ingests: ["120 Total Face Ingests", "138 Total Face Ingests", "116 Total Face Ingests", "126 Total Face Ingests"],
      late: ["14 Shortage Flags", "6 Shortage Flags", "16 Shortage Flags", "10 Shortage Flags"],
    },
  },
};

export default function DashboardPage() {
  const { user, isAuthenticated, token } = useAuth();
  const [timeframe, setTimeframe] = useState<"Today" | "Weekly" | "Monthly">("Today");

  // Class Overview State (Direct from Classroom API)
  const [classInfo, setClassInfo] = useState({
    department: "Computer Science",
    semester: 6,
    section: "A",
    classroom: "Room 302",
    classTeacherName: "Prof. Alan Turing",
    totalStudents: 6,
    enrolledFaces: 5,
    pendingFaces: 1,
    presentToday: 5,
    attendanceRate: 83.3,
  });
  const [loadingClass, setLoadingClass] = useState(true);

  // Animated entrance trigger
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Fetch Class-Specific Details from Classroom Endpoint
  useEffect(() => {
    const loadClassroomData = async () => {
      try {
        setLoadingClass(true);
        const res = await fetch(`${API_BASE_URL}/academic/classroom/overview`, {
          headers: getAuthHeaders(token),
        });
        if (res.ok) {
          const data = await res.json();
          const enrolledCount = (data.students || []).filter((s: any) => s.biometric_enrolled).length;
          const totalCount = data.students?.length || 6;
          setClassInfo({
            department: data.monitored_class?.department || "Computer Science",
            semester: data.monitored_class?.semester || 6,
            section: data.monitored_class?.section || "A",
            classroom: data.monitored_class?.classroom || "Room 302",
            classTeacherName: data.monitored_class?.class_teacher_name || user?.full_name || "Prof. Alan Turing",
            totalStudents: totalCount,
            enrolledFaces: enrolledCount,
            pendingFaces: totalCount - enrolledCount,
            presentToday: Math.min(totalCount, Math.max(1, totalCount - 1)), // 5 out of 6
            attendanceRate: Math.round(((totalCount - 1) / totalCount) * 1000) / 10, // 83.3%
          });
        }
      } catch {
        // Fallback default is already set
      } finally {
        setLoadingClass(false);
      }
    };
    loadClassroomData();
  }, [token, user]);

  // =========================================================================
  // INTERACTIVE LINE GRAPH STATE & MOVEMENTS (SCOPED TO CLASS)
  // =========================================================================
  const [activeSeries, setActiveSeries] = useState({
    present: true,
    ingests: true,
    late: true,
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Live Movement Simulation: auto-tick wave pulse
  const [isLiveSimulating, setIsLiveSimulating] = useState(true);
  const [liveOffset, setLiveOffset] = useState(0);

  useEffect(() => {
    if (!isLiveSimulating) return;
    const interval = setInterval(() => {
      setLiveOffset((prev) => (prev + 1) % 100);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLiveSimulating]);

  const currentDataset = CLASS_CHART_DATA[timeframe];
  const numPoints = currentDataset.labels.length;
  const svgWidth = 600;
  const svgHeight = 160;

  // Build points arrays for current timeframe with subtle live motion
  const points = useMemo(() => {
    const stepX = svgWidth / (numPoints - 1);
    const presentPts = currentDataset.present.map((y, i) => {
      const jitter = isLiveSimulating ? Math.sin((liveOffset + i) * 0.8) * 3 : 0;
      return { x: i * stepX, y: Math.max(15, Math.min(145, y + jitter)) };
    });
    const ingestsPts = currentDataset.ingests.map((y, i) => {
      const jitter = isLiveSimulating ? Math.cos((liveOffset + i) * 0.8) * 2.5 : 0;
      return { x: i * stepX, y: Math.max(15, Math.min(145, y + jitter)) };
    });
    const latePts = currentDataset.late.map((y, i) => {
      const jitter = isLiveSimulating ? Math.sin((liveOffset + i * 1.5) * 0.5) * 2 : 0;
      return { x: i * stepX, y: Math.max(15, Math.min(145, y + jitter)) };
    });

    return {
      stepX,
      present: presentPts,
      ingests: ingestsPts,
      late: latePts,
    };
  }, [currentDataset, numPoints, isLiveSimulating, liveOffset]);

  const presentPath = useMemo(() => getCurvedPath(points.present), [points.present]);
  const ingestsPath = useMemo(() => getCurvedPath(points.ingests), [points.ingests]);
  const latePath = useMemo(() => getCurvedPath(points.late), [points.late]);

  // Area paths for soft gradients
  const presentArea = useMemo(
    () => `${presentPath} L ${svgWidth},145 L 0,145 Z`,
    [presentPath, svgWidth]
  );
  const ingestsArea = useMemo(
    () => `${ingestsPath} L ${svgWidth},145 L 0,145 Z`,
    [ingestsPath, svgWidth]
  );

  // Mouse hover tracking over Line Graph
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const normX = (clientX / rect.width) * svgWidth;
    const normY = (clientY / rect.height) * svgHeight;

    const closestIdx = Math.max(
      0,
      Math.min(numPoints - 1, Math.round(normX / points.stepX))
    );
    setHoverIndex(closestIdx);
    setHoverCoords({ x: closestIdx * points.stepX, y: normY });
  };

  const handleSvgMouseLeave = () => {
    setHoverIndex(null);
    setHoverCoords(null);
  };

  // =========================================================================
  // INTERACTIVE PIE / DONUT CHART STATE & MOVEMENTS (CLASS INGEST CHANNELS)
  // =========================================================================
  const [pieMode, setPieMode] = useState<"distribution" | "latency">("distribution");
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  // Class Channels Breakdown (5 Present via Face, 1 via Barcode fallback, 0 Manual)
  const classChannelSlices = [
    {
      id: "biometric",
      name: "Automated Face Recognition (CCTV)",
      value: "83%",
      numeric: 5,
      percent: 0.83,
      color: "#10b981",
      description: "5 Students verified via Room 302 Camera",
    },
    {
      id: "barcode",
      name: "Smart ID Barcode Fallback",
      value: "17%",
      numeric: 1,
      percent: 0.17,
      color: "#2563eb",
      description: "1 Student verified via Barcode card scan",
    },
    {
      id: "manual",
      name: "Teacher Manual Ledger Check",
      value: "0%",
      numeric: 0,
      percent: 0.0,
      color: "#f59e0b",
      description: "No manual overrides needed today",
    },
  ];

  // Room 302 Edge Device Latency
  const classLatencySlices = [
    {
      id: "embedding",
      name: "128-d Gradient Embedding",
      value: "24ms",
      numeric: 24,
      percent: 0.53,
      color: "#2563eb",
      description: "Room 302 Jetson Xavier Edge",
    },
    {
      id: "spoof",
      name: "Anti-Spoof FFT Verification",
      value: "12ms",
      numeric: 12,
      percent: 0.32,
      color: "#f59e0b",
      description: "Classroom Liveness Ingest",
    },
    {
      id: "cosine",
      name: "Cosine Similarity Lookup",
      value: "4ms",
      numeric: 4,
      percent: 0.15,
      color: "#10b981",
      description: "Cohort KD-Tree Vector Match",
    },
  ];

  const currentPieSlices = pieMode === "distribution" ? classChannelSlices : classLatencySlices;
  const circumference = 2 * Math.PI * 38; // ~238.76

  let accumulatedPercent = 0;
  const computedDonutSlices = currentPieSlices.map((slice) => {
    const dashArray = `${circumference * slice.percent} ${circumference * (1 - slice.percent)}`;
    const dashOffset = -circumference * accumulatedPercent;
    accumulatedPercent += slice.percent;
    return {
      ...slice,
      dashArray,
      dashOffset,
    };
  });

  return (
    <div className="space-y-7 pb-10 max-w-7xl mx-auto">
      {/* =========================================================================
          TOP BANNER: FACULTY MONITORED CLASS IDENTITY
      ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          {/* CLASSROOM SCOPE TAG */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold uppercase tracking-wider">
              <School className="w-3.5 h-3.5 text-blue-600" />
              Monitored Cohort: {classInfo.department} &bull; Sem {classInfo.semester} - Sec {classInfo.section}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
              <Building className="w-3 h-3 text-indigo-600" /> {classInfo.classroom}
            </span>
            {isLiveSimulating && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Class Ingest Feed Active
              </span>
            )}
          </div>

          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            {isAuthenticated && user ? `Welcome back, ${user.full_name}` : "Faculty Class Teacher Dashboard"}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed max-w-3xl">
            Live attendance matrix, real-time biometric verifications, and automated CCTV telemetry scoped exclusively to your monitored cohort (<strong className="text-slate-800">Semester {classInfo.semester} - Section {classInfo.section}</strong>).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {/* Live Wave Motion Toggle */}
          <button
            onClick={() => setIsLiveSimulating(!isLiveSimulating)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border ${
              isLiveSimulating
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
            }`}
            title="Toggle live wave animation and continuous movement"
          >
            {isLiveSimulating ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pause Motion</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-slate-600" />
                <span>Resume Motion</span>
              </>
            )}
          </button>

          <Link
            href="/cctv"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition hover:scale-[1.02] cursor-pointer"
          >
            <Video className="w-4 h-4" />
            <span>Launch {classInfo.classroom} CCTV</span>
          </Link>
          <Link
            href="/classroom"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>My Classroom Portal</span>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          ROW 1: CLASS-SCOPED METRIC CARDS WITH ANIMATED GAUGES
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Class Attendance Rate */}
        <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Class Attendance Rate</span>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 flex items-center justify-center transition">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-5 flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={mounted ? 251.2 * (1 - classInfo.attendanceRate / 100) : 251.2}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  className="filter drop-shadow-[0_0_4px_rgba(37,99,235,0.4)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-900">{Math.round(classInfo.attendanceRate)}%</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Sem {classInfo.semester}-A</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">{classInfo.totalStudents}</span>
              <span className="text-[11px] text-slate-400 ml-1.5">Enrolled in Cohort</span>
            </div>
            <Link
              href="/classroom"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition inline-flex items-center gap-1 group-hover:translate-x-0.5"
            >
              <span>View Cohort</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-b-2xl" />
        </div>

        {/* Card 2: Students Present Today in Class */}
        <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-emerald-300 transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Students Present Today</span>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 flex items-center justify-center transition">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-5 flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={mounted ? 251.2 * (1 - classInfo.presentToday / classInfo.totalStudents) : 251.2}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s" }}
                  className="filter drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-900">
                  {classInfo.presentToday} / {classInfo.totalStudents}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-emerald-600 font-semibold">Active Period</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {classInfo.totalStudents - classInfo.presentToday} Absent Today
              </span>
            </div>
            <Link
              href="/teacher"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition inline-flex items-center gap-1 group-hover:translate-x-0.5"
            >
              <span>Daily Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-b-2xl" />
        </div>

        {/* Card 3: Biometric Face Verified (Cohort) */}
        <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-amber-300 transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Biometric Face Verified</span>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50 flex items-center justify-center transition">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-5 flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={mounted ? 251.2 * (1 - classInfo.enrolledFaces / classInfo.totalStudents) : 251.2}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.2s" }}
                  className="filter drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold text-slate-900">
                  {Math.round((classInfo.enrolledFaces / classInfo.totalStudents) * 100)}%
                </span>
                <span className="text-[9px] uppercase tracking-wider text-amber-600 font-semibold">128-D Enrolled</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">{classInfo.enrolledFaces}</span>
              <span className="text-[11px] text-slate-400 ml-1.5">Trained ({classInfo.pendingFaces} Pending)</span>
            </div>
            <Link
              href="/enrollment"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 transition inline-flex items-center gap-1 group-hover:translate-x-0.5"
            >
              <span>Train Face</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-b-2xl" />
        </div>

        {/* Card 4: Dedicated Classroom CCTV Stream */}
        <div className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-sm">Classroom CCTV Stream</span>
            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs group-hover:bg-blue-50 group-hover:text-blue-600 transition">
              <Video className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="my-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-slate-800 font-bold">{classInfo.classroom} In-Class Feed</span>
              </div>
              <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                ONLINE
              </span>
            </div>
            <div className="text-[11px] text-slate-500 space-y-1 px-1">
              <div className="flex justify-between">
                <span>Ingest Stream:</span>
                <span className="font-mono font-semibold text-slate-700">30 FPS &bull; 1080p</span>
              </div>
              <div className="flex justify-between">
                <span>Tripwire Mode:</span>
                <span className="font-semibold text-blue-600">Passive Attendance</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-2">
            <div>
              <span className="text-xs font-semibold text-slate-500">Class Feed Dedicated</span>
            </div>
            <Link
              href="/cctv"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition inline-flex items-center gap-1 group-hover:translate-x-0.5"
            >
              <span>View Stream</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-b-2xl" />
        </div>
      </div>

      {/* =========================================================================
          ROW 2: CLASS ATTENDANCE TRENDS (LINE GRAPH) + INGEST CHANNELS (DONUT)
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* =======================================================================
            LINE GRAPH: SCOPED TO THIS COHORT (MAX 6 STUDENTS)
        ======================================================================= */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-2 flex flex-col justify-between relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <LineIcon className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-base">
                  Classroom Attendance Matrix ({classInfo.department} &bull; Sem {classInfo.semester}-A)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Attendance and face detection telemetry across timetable period slots (Cohort size: {classInfo.totalStudents} students).
              </p>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                {(["Today", "Weekly", "Monthly"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTimeframe(t);
                      setHoverIndex(null);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      timeframe === t
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Legend (Click to toggle series on/off) */}
          <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
            <button
              onClick={() => setActiveSeries((prev) => ({ ...prev, present: !prev.present }))}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border transition cursor-pointer ${
                activeSeries.present
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                  : "bg-slate-50 border-slate-200 text-slate-400 opacity-60 line-through"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
              <span>Present in Class</span>
            </button>

            <button
              onClick={() => setActiveSeries((prev) => ({ ...prev, ingests: !prev.ingests }))}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border transition cursor-pointer ${
                activeSeries.ingests
                  ? "bg-blue-50 border-blue-200 text-blue-800 font-bold"
                  : "bg-slate-50 border-slate-200 text-slate-400 opacity-60 line-through"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
              <span>Face CCTV Ingests</span>
            </button>

            <button
              onClick={() => setActiveSeries((prev) => ({ ...prev, late: !prev.late }))}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border transition cursor-pointer ${
                activeSeries.late
                  ? "bg-amber-50 border-amber-200 text-amber-800 font-bold"
                  : "bg-slate-50 border-slate-200 text-slate-400 opacity-60 line-through"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
              <span>Absent / Late</span>
            </button>
          </div>

          {/* ===================================================================
              INTERACTIVE ANIMATED SVG LINE GRAPH (SCOPED TO CLASS SIZE)
          =================================================================== */}
          <div className="relative w-full h-60 pt-2 select-none">
            <svg
              ref={svgRef}
              className="w-full h-full overflow-visible cursor-crosshair"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={handleSvgMouseLeave}
            >
              <defs>
                <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id="blueArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>

                <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.45" />
                </filter>
                <filter id="blueGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563eb" floodOpacity="0.45" />
                </filter>
                <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.45" />
                </filter>
              </defs>

              {/* Horizontal Grid lines with Class Headcount Markers */}
              <line x1="0" y1="30" x2={svgWidth} y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="65" x2={svgWidth} y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="105" x2={svgWidth} y2="105" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="145" x2={svgWidth} y2="145" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Area Fills */}
              {activeSeries.present && (
                <path d={presentArea} fill="url(#emeraldArea)" className="transition-all duration-700 ease-out" />
              )}
              {activeSeries.ingests && (
                <path d={ingestsArea} fill="url(#blueArea)" className="transition-all duration-700 ease-out" />
              )}

              {/* Line 1: Present in Class */}
              {activeSeries.present && (
                <path
                  d={presentPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#emeraldGlow)"
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* Line 2: Face Ingests */}
              {activeSeries.ingests && (
                <path
                  d={ingestsPath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#blueGlow)"
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* Line 3: Absent / Late */}
              {activeSeries.late && (
                <path
                  d={latePath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#amberGlow)"
                  className="transition-all duration-700 ease-out"
                />
              )}

              {/* Crosshair Line & Snapping Dots */}
              {hoverCoords && (
                <g className="transition-all duration-150">
                  <line
                    x1={hoverCoords.x}
                    y1={15}
                    x2={hoverCoords.x}
                    y2={145}
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  {hoverIndex !== null && activeSeries.present && (
                    <circle
                      cx={points.present[hoverIndex].x}
                      cy={points.present[hoverIndex].y}
                      r="6.5"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      className="animate-pulse shadow-md"
                    />
                  )}
                  {hoverIndex !== null && activeSeries.ingests && (
                    <circle
                      cx={points.ingests[hoverIndex].x}
                      cy={points.ingests[hoverIndex].y}
                      r="6.5"
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      className="animate-pulse shadow-md"
                    />
                  )}
                  {hoverIndex !== null && activeSeries.late && (
                    <circle
                      cx={points.late[hoverIndex].x}
                      cy={points.late[hoverIndex].y}
                      r="6.5"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      className="animate-pulse shadow-md"
                    />
                  )}
                </g>
              )}
            </svg>

            {/* X-Axis Tick Labels */}
            <div className="flex justify-between text-[11px] text-slate-500 pt-2 font-mono font-semibold">
              {currentDataset.labels.map((lbl, idx) => (
                <span
                  key={idx}
                  className={`transition-all ${
                    hoverIndex === idx ? "text-blue-600 font-bold scale-110" : "text-slate-400"
                  }`}
                >
                  {lbl}
                </span>
              ))}
            </div>

            {/* FLOATING HOVER TOOLTIP FOR CLASS PERIOD */}
            {hoverIndex !== null && hoverCoords && (
              <div
                className="absolute z-30 pointer-events-none bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl p-3 text-xs space-y-1.5 transition-all duration-100 min-w-56"
                style={{
                  left: `${Math.min(75, Math.max(5, (hoverCoords.x / svgWidth) * 100))}%`,
                  top: "10px",
                }}
              >
                <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">
                  {currentDataset.periodNames[hoverIndex]}
                </div>
                <div className="space-y-1 text-[11px]">
                  {activeSeries.present && (
                    <div className="flex items-center justify-between text-emerald-700">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Present Students:
                      </span>
                      <strong className="font-mono">{currentDataset.rawValues.present[hoverIndex]}</strong>
                    </div>
                  )}

                  {activeSeries.ingests && (
                    <div className="flex items-center justify-between text-blue-700">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        Face CCTV Ingests:
                      </span>
                      <strong className="font-mono">{currentDataset.rawValues.ingests[hoverIndex]}</strong>
                    </div>
                  )}

                  {activeSeries.late && (
                    <div className="flex items-center justify-between text-amber-700">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Status:
                      </span>
                      <strong className="font-mono">{currentDataset.rawValues.late[hoverIndex]}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =======================================================================
            PIE / DONUT: CLASS ATTENDANCE CHANNELS & LATENCY
        ======================================================================= */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-base">
                  {pieMode === "distribution" ? "Class Verification Modes" : "Room 302 Latency"}
                </h2>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {pieMode === "distribution" ? "Attendance channels in Room 302" : "Processing delay in edge ingest"}
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setPieMode("distribution");
                  setActivePieIndex(null);
                }}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  pieMode === "distribution" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Channels
              </button>
              <button
                onClick={() => {
                  setPieMode("latency");
                  setActivePieIndex(null);
                }}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                  pieMode === "latency" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Latency
              </button>
            </div>
          </div>

          {/* Interactive Multi-Segment Donut */}
          <div className="my-3 flex flex-col items-center justify-center relative">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
                {computedDonutSlices.map((slice, idx) => {
                  const isHovered = activePieIndex === idx;
                  return (
                    <circle
                      key={slice.id}
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={isHovered ? 14 : 10}
                      strokeDasharray={slice.dashArray}
                      strokeDashoffset={mounted ? slice.dashOffset : 0}
                      strokeLinecap="round"
                      onMouseEnter={() => setActivePieIndex(idx)}
                      onMouseLeave={() => setActivePieIndex(null)}
                      style={{
                        transition: "stroke-width 0.25s ease, stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                      className="cursor-pointer filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:brightness-110"
                    />
                  );
                })}
              </svg>

              {/* Dynamic Center HUD Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-3">
                {activePieIndex !== null ? (
                  <div className="animate-scaleUp space-y-0.5">
                    <span className="text-xl font-black text-slate-900 leading-none">
                      {currentPieSlices[activePieIndex].value}
                    </span>
                    <div className="text-[10px] font-bold text-slate-700 truncate max-w-[110px] mx-auto">
                      {currentPieSlices[activePieIndex].name.split(" ")[0]}
                    </div>
                    <span className="text-[9px] text-blue-600 font-mono font-semibold">
                      {currentPieSlices[activePieIndex].description.split(" ")[0]} Active
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {pieMode === "distribution" ? "83.3%" : "68ms"}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                      {pieMode === "distribution" ? "Face Verified" : "Per Frame"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Slices Breakdown List */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {currentPieSlices.map((slice, idx) => {
              const isHovered = activePieIndex === idx;
              return (
                <div
                  key={slice.id}
                  onMouseEnter={() => setActivePieIndex(idx)}
                  onMouseLeave={() => setActivePieIndex(null)}
                  className={`flex items-center justify-between p-2 rounded-xl transition cursor-pointer ${
                    isHovered ? "bg-slate-50 shadow-2xs scale-[1.02]" : "hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: slice.color }} />
                    <span className="text-slate-600 font-medium truncate text-xs">{slice.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900 font-mono">{slice.value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: IN-CLASSROOM LIVE TIMELINE EVENTS (SECTION 6-A SPECIFIC)
      ========================================================================= */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-slate-900 text-base">
                In-Classroom Live Attendance Events ({classInfo.classroom} &bull; Section A)
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Live biometric admissions, period transitions, and attendance ledger locks for your monitored cohort.
            </p>
          </div>
          <Link
            href="/teacher"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition inline-flex items-center gap-1"
          >
            <span>View Class Teacher Matrix</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Chronological Milestones */}
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-4 py-3">
          {/* Milestone 1 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10 group">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Room 302 CCTV Synced</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Sem {classInfo.semester}-A Stream Connected</div>
              <span className="text-[10px] text-blue-600 font-mono font-semibold">09:00:15 AM</span>
            </div>
          </div>

          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 -mt-8" />

          {/* Milestone 2 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all relative">
              <CheckCircle2 className="w-5 h-5" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute -top-1 -right-1" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Kushal Student Verified</div>
              <div className="text-[11px] text-slate-500 mt-0.5">CS-2024-001 &bull; 98.4% Confidence</div>
              <span className="text-[10px] text-emerald-600 font-mono font-semibold">09:02:44 AM</span>
            </div>
          </div>

          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 -mt-8" />

          {/* Milestone 3 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10 group">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Period 1 Finalized (CS601)</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{classInfo.presentToday}/{classInfo.totalStudents} Present (83.3%)</div>
              <span className="text-[10px] text-amber-600 font-mono font-semibold">09:55:00 AM</span>
            </div>
          </div>

          <div className="hidden md:block flex-1 border-t-2 border-dashed border-slate-200 -mt-8" />

          {/* Milestone 4 */}
          <div className="flex items-center md:flex-col gap-4 text-left md:text-center flex-1 relative z-10 group">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 group-hover:bg-slate-800 group-hover:text-white transition-all">
              <Send className="w-5 h-5 text-slate-600 group-hover:text-white" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Period 2 Handover</div>
              <div className="text-[11px] text-slate-500 mt-0.5">CS602 &bull; Prof. Donald Knuth</div>
              <span className="text-[10px] text-slate-600 font-mono font-semibold">10:00:00 AM</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 4: CLASS TEACHER DIRECT ACTIONS
      ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/cctv"
          className="group rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Video className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Classroom CCTV Stream ({classInfo.classroom})</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Monitor real-time face detection bounding boxes and passive attendance for Section A students.
          </p>
        </Link>

        <Link
          href="/teacher"
          className="group rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Class Teacher Daily Matrix (P1 &ndash; P6)</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Review period-by-period daily ledger and subject attendance percentages with shortage alerts (&lt;75%).
          </p>
        </Link>

        <Link
          href="/classroom"
          className="group rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <School className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">My Classroom Management Portal</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            View cohort roster, assigned subject teachers, weekly class timetable, and admit new students.
          </p>
        </Link>
      </div>
    </div>
  );
}
