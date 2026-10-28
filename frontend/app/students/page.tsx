"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  ScanFace,
  Trash2,
  RefreshCw,
  X,
  AlertCircle,
  GraduationCap,
  ShieldCheck,
  Building,
  ArrowRight,
  Clock,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface StudentData {
  id: number;
  student_id: string;
  department: string;
  batch_year: string;
  semester: number;
  section: string;
  biometric_enrolled: boolean;
  biometric_face_count: number;
  user: {
    id: number;
    email: string;
    full_name: string;
    phone_number?: string;
    is_active: boolean;
  };
}

export default function StudentsPage() {
  const { token } = useAuth();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusTab, setStatusTab] = useState<"ALL" | "ENROLLED" | "PENDING">("ALL");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    student_id: "",
    full_name: "",
    email: "",
    department: "Computer Science",
    batch_year: "2023-2027",
    semester: 6,
    section: "A",
    phone_number: "",
    password: "student123",
  });

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (deptFilter !== "ALL") params.append("department", deptFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`${API_BASE_URL}/academic/students?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [deptFilter, search]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token && token !== "null" && token !== "undefined") {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}/academic/students`, {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create student.");
      }

      setShowModal(false);
      setFormData({
        student_id: "",
        full_name: "",
        email: "",
        department: "Computer Science",
        batch_year: "2023-2027",
        semester: 6,
        section: "A",
        phone_number: "",
        password: "student123",
      });
      fetchStudents();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error creating student.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this student record?")) return;
    try {
      const headers: Record<string, string> = {};
      if (token && token !== "null" && token !== "undefined") {
        headers["Authorization"] = `Bearer ${token}`;
      }
      await fetch(`${API_BASE_URL}/academic/students/${id}`, {
        method: "DELETE",
        headers,
      });
      fetchStudents();
    } catch {
      // ignore
    }
  };

  // Metrics
  const enrolledCount = students.filter((s) => s.biometric_enrolled).length;
  const pendingCount = students.length - enrolledCount;
  const distinctDepts = Array.from(new Set(students.map((s) => s.department))).length;

  const filteredStudents = students.filter((s) => {
    if (statusTab === "ENROLLED") return s.biometric_enrolled;
    if (statusTab === "PENDING") return !s.biometric_enrolled;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* =========================================================================
          HERO BANNER: CLEAN LIGHT MODERN ENTERPRISE SAAS
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/40 border border-blue-200/80 shadow-xs p-6 md:p-8">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                Student Registry
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Biometric Identity Verified
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Student Management &amp; Directory
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Register students, manage academic cohorts, monitor biometric face enrollment status, and control student accounts.
            </p>
          </div>

          <button
            id="btn-register-student"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all shrink-0 hover:scale-[1.02] cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Student</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          KEY PERFORMANCE METRICS (KPIs)
      ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Registered */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/70 flex items-center justify-center text-blue-600 shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Registered</div>
            <div className="text-xl font-extrabold text-slate-900">{students.length}</div>
          </div>
        </div>

        {/* Card 2: Biometric Verified */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Biometrics Enrolled</div>
            <div className="text-xl font-extrabold text-emerald-600">
              {enrolledCount}{" "}
              <span className="text-xs font-normal text-slate-400">
                ({students.length > 0 ? Math.round((enrolledCount / students.length) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Pending Training */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending Face Scan</div>
            <div className="text-xl font-extrabold text-amber-600">{pendingCount}</div>
          </div>
        </div>

        {/* Card 4: Academic Departments */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/70 flex items-center justify-center text-indigo-600 shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Departments</div>
            <div className="text-xl font-extrabold text-indigo-600">{distinctDepts || 1}</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CONTROLS: FILTER TABS, SEARCH, AND DROPDOWN (CLEAN WHITE SAAS)
      ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setStatusTab("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              statusTab === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Students ({students.length})
          </button>
          <button
            onClick={() => setStatusTab("ENROLLED")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              statusTab === "ENROLLED"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Enrolled ({enrolledCount})
          </button>
          <button
            onClick={() => setStatusTab("PENDING")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              statusTab === "PENDING"
                ? "bg-white text-amber-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pending ({pendingCount})
          </button>
        </div>

        {/* Search and Department Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roll no, name, email..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="relative shrink-0">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">All Departments</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Artificial Intelligence">Artificial Intelligence</option>
              <option value="Electronics & Communication">Electronics &amp; Comm.</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          STUDENTS TABLE: MODERN CRISP LIGHT THEME
      ========================================================================= */}
      <div className="rounded-3xl overflow-hidden border border-slate-200/90 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-4">Student</th>
                <th className="px-5 py-4">Roll Number</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Batch / Sem</th>
                <th className="px-5 py-4">Biometric Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                    <span className="font-medium text-xs">Loading student directory...</span>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 bg-slate-50/40 font-medium">
                    No student records found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu) => {
                  const initials = stu.user?.full_name
                    ? stu.user.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "ST";

                  return (
                    <tr key={stu.id} className="hover:bg-slate-50/80 transition">
                      {/* Student Name & Avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{stu.user?.full_name || "Unknown"}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{stu.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono font-bold text-xs border border-blue-100">
                          {stu.student_id}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="px-5 py-3.5 text-slate-700 font-medium">{stu.department}</td>

                      {/* Batch & Sem */}
                      <td className="px-5 py-3.5 text-slate-600 font-mono text-[11px]">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                          {stu.batch_year} &bull; Sem {stu.semester}-{stu.section}
                        </span>
                      </td>

                      {/* Biometric Status */}
                      <td className="px-5 py-3.5">
                        {stu.biometric_enrolled ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Enrolled ({stu.biometric_face_count} frames)</span>
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <ScanFace className="w-3.5 h-3.5 text-amber-600" />
                              <span>Pending Enrollment</span>
                            </span>
                            <Link
                              href="/enrollment"
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5"
                            >
                              <span>Enroll Face</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(stu.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          CREATE STUDENT MODAL: CLEAN LIGHT ENTERPRISE FORM
      ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider">
                  New Admission
                </span>
                <h2 className="text-lg font-bold mt-1 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-white" />
                  <span>Register New Student</span>
                </h2>
                <p className="text-xs text-blue-100 mt-0.5">
                  Create student profile and assign credentials for biometric logging.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Roll Number / Student ID *</label>
                    <input
                      type="text"
                      required
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value.toUpperCase() })}
                      placeholder="e.g. CS-2024-007"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 uppercase font-mono focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                      placeholder="student@university.edu"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Department *</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition cursor-pointer font-medium"
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                      <option value="Electronics & Communication">Electronics &amp; Communication</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Batch Year</label>
                    <input
                      type="text"
                      value={formData.batch_year}
                      onChange={(e) => setFormData({ ...formData, batch_year: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Semester</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-700 font-bold">Section</label>
                    <input
                      type="text"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center gap-2 shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Save Student Record</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
