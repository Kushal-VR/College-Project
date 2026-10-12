"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  UserCheck,
  UserX,
  QrCode,
  ShieldAlert,
  Send,
  Sparkles,
  ArrowRightLeft,
  RotateCw,
  X,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface TimetableSlot {
  id: number;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  classroom: string;
  start_time: string;
  end_time: string;
  day_of_week: string;
}

interface SessionData {
  id: number;
  timetable_id: number;
  date: string;
  status: string;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  faculty_email?: string;
  classroom?: string;
  total_enrolled: number;
  present_count: number;
  absent_count: number;
  left_early_count: number;
  email_report_sent: boolean;
}

interface RosterItem {
  id: number;
  student_id: number;
  roll_number: string;
  student_name: string;
  in_time?: string | null;
  out_time?: string | null;
  total_minutes_present: number;
  presence_ratio: number;
  status: string;
  verification_method: string;
  photo_proof_url?: string | null;
  email_notified: boolean;
}

function SessionsContent() {
  const searchParams = useSearchParams();
  const urlTimetableId = searchParams.get("timetable_id");
  const { token } = useAuth();

  const [timetables, setTimetables] = useState<TimetableSlot[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<number | null>(
    urlTimetableId ? parseInt(urlTimetableId) : null
  );
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Load available timetable periods
  useEffect(() => {
    const loadTimetables = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/timetable`, {
          headers: getAuthHeaders(token),
        });
        if (res.ok) {
          const data = await res.json();
          setTimetables(data);
          if (!selectedTimetableId && data.length > 0) {
            setSelectedTimetableId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load timetable", err);
      } finally {
        setLoading(false);
      }
    };
    loadTimetables();
  }, [token]);

  // Start / Load session for selected timetable
  const loadSession = async () => {
    if (!selectedTimetableId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/start?timetable_id=${selectedTimetableId}`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        // Load ledger roster
        loadRoster(data.id);
      }
    } catch (err) {
      console.error("Failed to start/load session", err);
    }
  };

  const loadRoster = async (sessionId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${sessionId}/ledger`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setRoster(data);
      }
    } catch (err) {
      console.error("Failed to load roster", err);
    }
  };

  useEffect(() => {
    if (selectedTimetableId) {
      loadSession();
    }
  }, [selectedTimetableId]);

  // Finalize Session & Auto-email Teacher
  const handleFinalizeSession = async () => {
    if (!activeSession) return;
    setFinalizing(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${activeSession.id}/finalize`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          msg: `Session finalized! Presence evaluated against >= 75% rule. Official report dispatched to ${data.teacher_email || "assigned teacher"}.`,
        });
        loadSession();
      } else {
        throw new Error(data.detail || "Failed to finalize session.");
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Finalization error." });
    } finally {
      setFinalizing(false);
    }
  };

  // Re-send Email
  const handleSendEmail = async () => {
    if (!activeSession) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/timetable/sessions/${activeSession.id}/send-email`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          msg: `Attendance report dispatched via SMTP to ${data.teacher_email}!`,
        });
      }
    } catch (err) {
      setFeedback({ type: "error", msg: "Failed to dispatch email." });
    } finally {
      setSendingEmail(false);
    }
  };

  // Barcode Scan Fallback
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;
    try {
      const res = await fetch(`${API_BASE_URL}/biometrics/scan-id-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode_data: barcodeInput }),
      });
      const data = await res.json();
      if (data.success && activeSession) {
        setFeedback({
          type: "success",
          msg: `ID Card Verified: ${data.student_name} (${data.roll_number}) marked Present via Barcode Fallback!`,
        });
        setShowBarcodeModal(false);
        setBarcodeInput("");
        loadRoster(activeSession.id);
      } else {
        setFeedback({ type: "error", msg: data.message });
      }
    } catch (err) {
      setFeedback({ type: "error", msg: "Failed to scan barcode." });
    }
  };

  const presentCount = roster.filter((r) => r.status === "PRESENT").length;
  const leftEarlyCount = roster.filter((r) => r.status === "LEFT_EARLY").length;
  const absentCount = roster.filter((r) => r.status === "ABSENT").length;
  const occludedCount = roster.filter((r) => r.status === "FLAGGED_OCCLUDED_EXIT").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
            Live Classroom Attendance Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Continuous presence monitoring, directional in/out crossing, covered-face occlusion flags, and automated teacher SMTP email.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBarcodeModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            Scan Student ID Card
          </button>
          <button
            onClick={handleFinalizeSession}
            disabled={finalizing || !activeSession}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {finalizing ? "Finalizing Ledger..." : "Finalize & Email Teacher"}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 text-xs">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Class Period Selector & Metadata Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Active Class Period:</label>
          <select
            value={selectedTimetableId || ""}
            onChange={(e) => setSelectedTimetableId(parseInt(e.target.value))}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
          >
            {timetables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.day_of_week} ({t.start_time} - {t.end_time}) : {t.subject_code} - {t.subject_name} ({t.classroom})
              </option>
            ))}
          </select>
        </div>

        {activeSession && (
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">
              Instructor: <strong className="text-slate-800">{activeSession.faculty_name}</strong>
            </span>
            <span className="text-slate-500">
              Room: <strong className="text-slate-800">{activeSession.classroom}</strong>
            </span>
            <span className="text-slate-500">
              Date: <strong className="font-mono text-blue-600">{activeSession.date}</strong>
            </span>
            {activeSession.email_report_sent && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                EMAIL DISPATCHED
              </span>
            )}
          </div>
        )}
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Enrolled Students</div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{roster.length}</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Present (In-Class)</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono">{presentCount}</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Left Early / Partial</div>
          <div className="text-2xl font-bold text-amber-700 font-mono">{leftEarlyCount}</div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider mb-1">Absent</div>
          <div className="text-2xl font-bold text-rose-700 font-mono">{absentCount}</div>
        </div>
      </div>

      {/* Live Attendance Ledger Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Student Continuous Attendance Ledger</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium">
              &ge; 75% Duration Required
            </span>
          </h2>
          <button
            onClick={() => activeSession && loadRoster(activeSession.id)}
            className="text-slate-400 hover:text-slate-700 p-1"
            title="Refresh Ledger"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Roll Number</th>
                <th className="px-5 py-3">Student Name</th>
                <th className="px-5 py-3">In-Time</th>
                <th className="px-5 py-3">Out-Time</th>
                <th className="px-5 py-3">Presence Time</th>
                <th className="px-5 py-3">Attendance %</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((st, idx) => {
                const isPresent = st.status === "PRESENT";
                const isLeftEarly = st.status === "LEFT_EARLY";
                const isFlagged = st.status === "FLAGGED_OCCLUDED_EXIT";

                return (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-3.5 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-900">{st.roll_number}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{st.student_name}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {st.in_time ? new Date(st.in_time).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {st.out_time ? new Date(st.out_time).toLocaleTimeString() : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-blue-600 font-semibold">
                      {st.total_minutes_present.toFixed(1)} mins
                    </td>
                    <td className="px-5 py-3.5 font-mono">
                      <span className={isPresent ? "text-emerald-600 font-semibold" : isLeftEarly ? "text-amber-600 font-semibold" : "text-rose-600 font-semibold"}>
                        {(st.presence_ratio * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[10px]">
                      {st.verification_method}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold font-mono uppercase border ${
                          isFlagged
                            ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                            : isPresent
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : isLeftEarly
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {isFlagged ? (
                          <>
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            COVERED EXIT
                          </>
                        ) : isPresent ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            PRESENT
                          </>
                        ) : isLeftEarly ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            LEFT EARLY
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            ABSENT
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {roster.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    No enrolled students in this subject yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode Fallback Modal */}
      {showBarcodeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                Student ID Card Scanner
              </h3>
              <button onClick={() => setShowBarcodeModal(false)} className="text-slate-400 hover:text-slate-700 text-xs">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              If a student's face is occluded or not detected, enter or scan the barcode/roll number from their Student ID Card:
            </p>

            <form onSubmit={handleBarcodeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Student Roll Number (Barcode)</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="e.g. 1EW23CS065"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition"
                >
                  Record Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500 font-mono text-xs">Loading live attendance sessions...</div>}>
      <SessionsContent />
    </Suspense>
  );
}
