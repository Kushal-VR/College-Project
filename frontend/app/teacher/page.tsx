"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Calendar,
  BarChart3,
  ShieldAlert,
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  RotateCw,
  Search,
  BookOpen,
  Filter,
  Check,
  X,
  Layers,
  Sparkles,
  Camera,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// --- TYPES ---
interface PeriodHeader {
  period: number;
  time: string;
  subject: string;
  subject_code: string;
  teacher: string;
  timetable_id: number;
}

interface DailyLedgerStudent {
  student_id: number;
  roll_number: string;
  student_name: string;
  periods: Record<string, string>; // "1": "PRESENT" | "ABSENT" | "NOT_RECORDED"
  total_attended_today: number;
}

interface DailyLedgerResponse {
  date: string;
  section: string;
  semester: number;
  department: string;
  classroom: string;
  period_headers: PeriodHeader[];
  students: DailyLedgerStudent[];
}

interface SubjectAttendanceStat {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  classes_held: number;
  classes_attended: number;
  percentage: number;
}

interface StudentSubjectMatrixRow {
  student_id: number;
  roll_number: string;
  student_name: string;
  department: string;
  section: string;
  semester: number;
  subjects: SubjectAttendanceStat[];
  overall_held: number;
  overall_attended: number;
  overall_percentage: number;
  has_shortage: boolean;
}

interface TimetableSlot {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code: string;
  subject_name: string;
  classroom: string;
  section: string;
  faculty_name: string;
}

interface WeeklyGridResponse {
  days: string[];
  grid: Record<string, TimetableSlot[]>;
}

interface DayByDayRecord {
  session_id: number;
  date: string;
  time_slot: string;
  classroom: string;
  present_count: number;
  absent_count: number;
  left_early_count: number;
  attendance_rate: number;
  email_sent: boolean;
}

interface SecurityIncident {
  id: number;
  event_type: string;
  camera_name: string;
  classroom: string;
  student_name: string;
  roll_number: string;
  details: string;
  photo_proof_path?: string | null;
  timestamp: string;
}

export default function TeacherPortalPage() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "class_teacher_ledger" | "subject_matrix" | "weekly_timetable" | "faculty_sessions" | "incidents"
  >("class_teacher_ledger");

  // Filter states
  const [selectedSection, setSelectedSection] = useState<string>("B");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Data states
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [activeSections, setActiveSections] = useState<string[]>(["B"]);

  // Daily Ledger
  const [dailyLedger, setDailyLedger] = useState<DailyLedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Subject Wise Matrix
  const [subjectMatrix, setSubjectMatrix] = useState<StudentSubjectMatrixRow[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Weekly Timetable
  const [weeklyGrid, setWeeklyGrid] = useState<WeeklyGridResponse | null>(null);
  const [timetableLoading, setTimetableLoading] = useState(false);

  // Faculty course sessions & incidents
  const [recentSessions, setRecentSessions] = useState<DayByDayRecord[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);

  // 1. Initial Profile & Session loading
  const loadProfileAndSessions = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders(token);

      const [resStats, resIncidents] = await Promise.all([
        fetch(`${API_BASE_URL}/timetable/teacher-stats`, { headers }),
        fetch(`${API_BASE_URL}/timetable/incidents`, { headers }),
      ]);

      if (resStats.ok) {
        const data = await resStats.json();
        setTeacherName(data.teacher_name || user?.full_name || "Faculty");
        setTeacherEmail(data.teacher_email || user?.email || "");
        if (data.active_sections && data.active_sections.length > 0) {
          setActiveSections(data.active_sections);
        }
        setRecentSessions(data.recent_sessions || []);
      }

      if (resIncidents.ok) {
        setIncidents(await resIncidents.json());
      }
    } catch (err) {
      console.error("Failed to load teacher stats", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Class Teacher Daily Ledger
  const fetchDailyLedger = async (section: string, date: string) => {
    try {
      setLedgerLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/timetable/class-teacher/daily-ledger?section=${encodeURIComponent(section)}&date=${encodeURIComponent(date)}`,
        { headers: getAuthHeaders(token) }
      );
      if (res.ok) {
        const data = await res.json();
        setDailyLedger(data);
      }
    } catch (err) {
      console.error("Failed to load daily ledger", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  // 3. Fetch Subject-Wise Matrix
  const fetchSubjectMatrix = async (section: string) => {
    try {
      setMatrixLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/timetable/class-teacher/subject-wise-matrix?section=${encodeURIComponent(section)}`,
        { headers: getAuthHeaders(token) }
      );
      if (res.ok) {
        const data = await res.json();
        setSubjectMatrix(data);
      }
    } catch (err) {
      console.error("Failed to load subject matrix", err);
    } finally {
      setMatrixLoading(false);
    }
  };

  // 4. Fetch Weekly Timetable Grid
  const fetchWeeklyGrid = async (section: string) => {
    try {
      setTimetableLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/timetable/weekly-grid?section=${encodeURIComponent(section)}`,
        { headers: getAuthHeaders(token) }
      );
      if (res.ok) {
        const data = await res.json();
        setWeeklyGrid(data);
      }
    } catch (err) {
      console.error("Failed to load weekly grid", err);
    } finally {
      setTimetableLoading(false);
    }
  };

  useEffect(() => {
    loadProfileAndSessions();
  }, [token]);

  useEffect(() => {
    if (activeTab === "class_teacher_ledger") {
      fetchDailyLedger(selectedSection, selectedDate);
    } else if (activeTab === "subject_matrix") {
      fetchSubjectMatrix(selectedSection);
    } else if (activeTab === "weekly_timetable") {
      fetchWeeklyGrid(selectedSection);
    }
  }, [activeTab, selectedSection, selectedDate, token]);

  const handleSendEmailReport = async (sessionId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${sessionId}/send-email`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback(`Official attendance ledger dispatched via SMTP to ${data.teacher_email}`);
        loadProfileAndSessions();
      }
    } catch (err) {
      console.error("Failed to send email", err);
    }
  };

  // Filtered lists for search
  const filteredDailyStudents = (dailyLedger?.students || []).filter(
    (s) =>
      s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMatrix = subjectMatrix.filter(
    (s) =>
      s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Distinct subjects in matrix for header
  const matrixSubjects =
    subjectMatrix.length > 0 && subjectMatrix[0].subjects
      ? subjectMatrix[0].subjects.map((sub) => ({
          code: sub.subject_code,
          name: sub.subject_name,
        }))
      : [];

  return (
    <div className="space-y-6">
      {/* Top Profile Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-blue-600 font-bold">
                  Class Teacher &amp; Faculty Portal
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                  Assigned: Section {selectedSection}
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">{teacherName || user?.full_name || "Dr. Alan Turing"}</h1>
              <p className="text-xs text-slate-500 font-mono">{teacherEmail || user?.email || "faculty@smartattend.edu"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Assigned Cohort</div>
              <div className="text-sm font-bold text-slate-900">Sem 7 - Sec {selectedSection}</div>
            </div>
            <Link
              href="/cctv"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm"
            >
              <Camera className="w-4 h-4" />
              Open In-Classroom CCTV
            </Link>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 text-xs">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("class_teacher_ledger")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "class_teacher_ledger"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Class Teacher Daily Ledger (P1 - P6)
        </button>

        <button
          onClick={() => setActiveTab("subject_matrix")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "subject_matrix"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overall Subject-Wise Matrix (% & Shortage)
        </button>

        <button
          onClick={() => setActiveTab("weekly_timetable")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "weekly_timetable"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          Weekly Class Timetable
        </button>

        <button
          onClick={() => setActiveTab("faculty_sessions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "faculty_sessions"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Subject Faculty Sessions & Email
        </button>

        <button
          onClick={() => setActiveTab("incidents")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === "incidents"
              ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Occluded Face Exits ({incidents.length})
        </button>
      </div>

      {/* Global Filter Bar for Ledger & Matrix */}
      {(activeTab === "class_teacher_ledger" || activeTab === "subject_matrix" || activeTab === "weekly_timetable") && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Section:</span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 font-semibold"
              >
                <option value="B">Section B (Assigned Class)</option>
                <option value="A">Section A</option>
                <option value="C">Section C</option>
              </select>
            </div>

            {activeTab === "class_teacher_ledger" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
          </div>

          {(activeTab === "class_teacher_ledger" || activeTab === "subject_matrix") && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search roll or student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 1: Class Teacher All-Periods Ledger */}
      {activeTab === "class_teacher_ledger" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl space-y-4">
          <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  Section {selectedSection} Complete Daily Period Ledger
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {selectedDate}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Full period-by-period matrix (Period 1 to 6) recorded automatically via In-Classroom AI Camera & Barcode Scanner.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Classroom:</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white">
                {dailyLedger?.classroom || "Room 302"}
              </span>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-blue-500" />
              Loading Section {selectedSection} Ledger...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Roll No</th>
                    <th className="px-5 py-3">Student Name</th>
                    {dailyLedger?.period_headers.map((hdr) => (
                      <th key={hdr.period} className="px-4 py-3 text-center border-l border-slate-800/80">
                        <div className="font-bold text-white">P{hdr.period}</div>
                        <div className="text-[9px] text-blue-400 lowercase">{hdr.time}</div>
                        <div className="text-[9px] text-slate-400 font-mono">{hdr.subject_code}</div>
                      </th>
                    ))}
                    <th className="px-5 py-3 text-center border-l border-slate-800/80">Day Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredDailyStudents.map((st, idx) => (
                    <tr key={st.student_id} className="hover:bg-slate-900/40 transition">
                      <td className="px-5 py-3.5 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-white">{st.roll_number}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-200">{st.student_name}</td>

                      {dailyLedger?.period_headers.map((hdr) => {
                        const status = st.periods[String(hdr.period)] || "NOT_RECORDED";
                        const isPresent = status === "PRESENT";
                        const isAbsent = status === "ABSENT";

                        return (
                          <td
                            key={hdr.period}
                            className="px-4 py-3.5 text-center border-l border-slate-800/50"
                          >
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                <Check className="w-3 h-3" />
                                PRES
                              </span>
                            ) : isAbsent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                <X className="w-3 h-3" />
                                ABS
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600 font-mono">—</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-5 py-3.5 text-center border-l border-slate-800/80 font-mono font-bold">
                        <span className="text-emerald-400">{st.total_attended_today}</span>
                        <span className="text-slate-500"> / {dailyLedger?.period_headers.length || 6}</span>
                      </td>
                    </tr>
                  ))}

                  {filteredDailyStudents.length === 0 && (
                    <tr>
                      <td
                        colSpan={(dailyLedger?.period_headers.length || 0) + 4}
                        className="px-5 py-10 text-center text-slate-500"
                      >
                        No attendance records for Section {selectedSection} on {selectedDate}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Overall Subject-Wise Matrix */}
      {activeTab === "subject_matrix" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl space-y-4">
          <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  Section {selectedSection} Master Subject-Wise Attendance Matrix
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Sem 7
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Full cumulative attendance percentage breakdown per student across all assigned courses with low-attendance warnings.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-400">≥ 75% Eligible</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-400">&lt; 75% Shortage</span>
              </div>
            </div>
          </div>

          {matrixLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-blue-500" />
              Loading Subject Matrix...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Roll No</th>
                    <th className="px-5 py-3">Student Name</th>
                    {matrixSubjects.map((sub) => (
                      <th key={sub.code} className="px-4 py-3 text-center border-l border-slate-800/80">
                        <div className="font-bold text-white">{sub.code}</div>
                        <div className="text-[9px] text-slate-400 max-w-[100px] truncate">{sub.name}</div>
                      </th>
                    ))}
                    <th className="px-5 py-3 text-center border-l border-slate-800/80">Overall Classes</th>
                    <th className="px-5 py-3 text-center border-l border-slate-800/80">Overall %</th>
                    <th className="px-5 py-3 text-center border-l border-slate-800/80">Eligibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredMatrix.map((row, idx) => {
                    const isSafe = !row.has_shortage;

                    return (
                      <tr key={row.student_id} className="hover:bg-slate-900/40 transition">
                        <td className="px-5 py-3.5 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-white">{row.roll_number}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-200">{row.student_name}</td>

                        {row.subjects.map((sub) => {
                          const subSafe = sub.percentage >= 75.0;
                          return (
                            <td
                              key={sub.subject_code}
                              className="px-4 py-3.5 text-center border-l border-slate-800/50"
                            >
                              <div className="font-mono font-bold text-white text-xs">
                                {sub.classes_attended}/{sub.classes_held}
                              </div>
                              <div
                                className={`text-[10px] font-mono font-bold ${
                                  subSafe ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {sub.percentage}%
                              </div>
                            </td>
                          );
                        })}

                        <td className="px-5 py-3.5 text-center border-l border-slate-800/80 font-mono font-bold">
                          <span className="text-emerald-400">{row.overall_attended}</span>
                          <span className="text-slate-500"> / {row.overall_held}</span>
                        </td>

                        <td className="px-5 py-3.5 text-center border-l border-slate-800/80 font-mono">
                          <div className="flex items-center justify-center gap-2">
                            <span
                              className={`font-bold text-xs ${
                                isSafe ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {row.overall_percentage}%
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-center border-l border-slate-800/80">
                          {row.has_shortage ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              SHORTAGE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ELIGIBLE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredMatrix.length === 0 && (
                    <tr>
                      <td colSpan={matrixSubjects.length + 6} className="px-5 py-10 text-center text-slate-500">
                        No student matrix data found for Section {selectedSection}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Weekly Timetable Grid */}
      {activeTab === "weekly_timetable" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Section {selectedSection} Official Weekly Class Timetable
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Period Schedule (Periods 1 to 6) configured for automatic AI Camera scanning and faculty attendance ledger.
              </p>
            </div>
            <div className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono">
              6 Slots / Day (Mon - Sat)
            </div>
          </div>

          {timetableLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-blue-500" />
              Loading Timetable Grid...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weeklyGrid?.days.map((day) => {
                const slots = weeklyGrid.grid[day] || [];

                return (
                  <div
                    key={day}
                    className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="font-bold text-white text-sm">{day}</span>
                      <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                        {slots.length} Periods
                      </span>
                    </div>

                    <div className="space-y-2">
                      {slots.map((s) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 hover:border-blue-500/40 transition flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-400 text-[11px]">
                                P{s.period_number}
                              </span>
                              <span className="font-semibold text-white">{s.subject_name}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {s.subject_code} • {s.faculty_name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-slate-300 text-[11px]">
                              {s.start_time} - {s.end_time}
                            </div>
                            <div className="text-[10px] text-slate-500">{s.classroom}</div>
                          </div>
                        </div>
                      ))}

                      {slots.length === 0 && (
                        <div className="text-center py-6 text-slate-500 text-xs">No periods scheduled.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Subject Faculty Course Sessions & Email */}
      {activeTab === "faculty_sessions" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white">Day-by-Day Course Sessions & Dispatch</h2>
            <p className="text-xs text-slate-400 mt-1">
              Browse every class session by date with instant option to email official attendance report via SMTP.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Time Slot</th>
                  <th className="px-5 py-3">Classroom</th>
                  <th className="px-5 py-3">Present</th>
                  <th className="px-5 py-3">Absent</th>
                  <th className="px-5 py-3">Left Early</th>
                  <th className="px-5 py-3">Rate</th>
                  <th className="px-5 py-3">SMTP Email</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {recentSessions.map((sess) => (
                  <tr key={sess.session_id} className="hover:bg-slate-900/40 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-white">{sess.date}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-300">{sess.time_slot}</td>
                    <td className="px-5 py-3.5 text-slate-400">{sess.classroom}</td>
                    <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">{sess.present_count}</td>
                    <td className="px-5 py-3.5 font-mono text-rose-400 font-bold">{sess.absent_count}</td>
                    <td className="px-5 py-3.5 font-mono text-amber-400">{sess.left_early_count}</td>
                    <td className="px-5 py-3.5 font-mono text-blue-400 font-bold">{sess.attendance_rate}%</td>
                    <td className="px-5 py-3.5">
                      {sess.email_sent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          SENT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                          NOT SENT
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleSendEmailReport(sess.session_id)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-medium transition text-[11px]"
                      >
                        <Mail className="w-3 h-3" />
                        Send Report via Email
                      </button>
                    </td>
                  </tr>
                ))}

                {recentSessions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-slate-500">
                      No completed class sessions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Security & Covered Face Incidents */}
      {activeTab === "incidents" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Covered Face &amp; Occluded Departure Incidents
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Photographic proofs captured when students exited the classroom with concealed faces (hands, hoods, or masks).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="rounded-xl border border-rose-500/30 bg-rose-950/10 p-4 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-rose-400 font-bold uppercase">{inc.event_type}</span>
                  <span className="text-slate-400 text-[11px] font-mono">
                    {new Date(inc.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs text-slate-300">
                  <div>
                    Location: <strong>{inc.classroom}</strong> ({inc.camera_name})
                  </div>
                  <div>
                    Suspected Student: <strong className="text-rose-300">{inc.student_name}</strong> ({inc.roll_number})
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{inc.details}</p>
                </div>

                {inc.photo_proof_path && (
                  <div className="rounded-lg overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                    <img src={inc.photo_proof_path} alt="Proof" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            ))}

            {incidents.length === 0 && (
              <div className="col-span-full text-center py-10 text-slate-500">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/40" />
                <p className="text-xs">Zero security incidents or covered-face exits recorded.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
