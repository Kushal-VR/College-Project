"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Plus, Search, RefreshCw, CheckCircle2, User, Trash2, AlertCircle, X, Sparkles } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface SubjectData {
  id: number;
  code: string;
  name: string;
  department: string;
  semester: number;
  credits: number;
  faculty_id?: number | null;
  faculty?: {
    id: number;
    employee_id: string;
    user?: {
      full_name: string;
    };
  };
}

interface FacultyOption {
  id: number;
  employee_id: string;
  user?: {
    full_name: string;
  };
}

export default function SubjectsPage() {
  const { token } = useAuth();
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    department: "Computer Science",
    semester: 6,
    credits: 4,
    faculty_id: "",
  });

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`${API_BASE_URL}/academic/subjects`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch {
      setErrorMsg("Failed to load subjects catalog.");
    } finally {
      setLoading(false);
    }
  };

  const fetchFaculty = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/academic/faculty`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setFacultyList(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSubjects();
    fetchFaculty();
  }, [token]);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/academic/subjects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          department: formData.department,
          semester: Number(formData.semester),
          credits: Number(formData.credits),
          faculty_id: formData.faculty_id ? Number(formData.faculty_id) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create subject.");
      }

      setSuccessMsg(`Subject ${formData.code.toUpperCase()} created successfully!`);
      setShowModal(false);
      setFormData({
        code: "",
        name: "",
        department: "Computer Science",
        semester: 6,
        credits: 4,
        faculty_id: "",
      });
      fetchSubjects();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create subject.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (subjectId: number) => {
    try {
      setDeletingId(subjectId);
      const res = await fetch(`${API_BASE_URL}/academic/subjects/${subjectId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setSuccessMsg("Subject removed successfully.");
        fetchSubjects();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "Failed to delete subject.");
      }
    } catch {
      setErrorMsg("Network error deleting subject.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredSubjects = subjects.filter((s) => {
    const q = searchQuery.toLowerCase();
    return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* =========================================================================
          HERO BANNER: CLEAN LIGHT MODERN SAAS
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 border border-emerald-200/80 shadow-xs p-6 md:p-8">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                Course Catalog
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                <Sparkles className="w-3 h-3 text-teal-500" /> Curriculum Sync
              </span>
            </div>

            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              Academic Courses &amp; Subjects Catalog
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Configure department courses, map codes, assign verified teaching faculty, and manage period timetable slots dynamically.
            </p>
          </div>

          <button
            id="btn-add-subject"
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setShowModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all shrink-0 hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Subject</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects by code, title, or department..."
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
          />
        </div>
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-2.5 text-xs shadow-2xs">
          <span className="text-slate-500 font-semibold">Configured Subjects:</span>
          <span className="font-mono font-bold text-emerald-600 text-sm">{subjects.length}</span>
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
            <span>Loading subject catalog...</span>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-500 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-800 text-sm">No subjects found</p>
            <p className="text-slate-500 mt-1">
              Click &quot;Add New Subject&quot; above to configure curriculum courses.
            </p>
          </div>
        ) : (
          filteredSubjects.map((sub) => (
            <div
              key={sub.id}
              className="bg-white hover:border-emerald-300 rounded-3xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 space-y-4 flex flex-col justify-between group"
            >
              <div className="space-y-3">
                {/* Header Pills */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-700 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200">
                    {sub.code}
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    {sub.credits} Credits • Sem {sub.semester}
                  </span>
                </div>

                {/* Course Title & Dept */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition leading-snug">
                    {sub.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{sub.department}</p>
                </div>

                {/* Assigned Faculty */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-slate-400">Assigned Teacher:</span>
                  <strong className="text-slate-800 truncate">
                    {sub.faculty?.user?.full_name || "Unassigned"}
                  </strong>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active Course
                </span>
                <button
                  onClick={() => handleDeleteSubject(sub.id)}
                  disabled={deletingId === sub.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-xs font-semibold border border-rose-200 transition disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>{deletingId === sub.id ? "Deleting..." : "Delete"}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* =========================================================================
          MODAL TO ADD SUBJECT: CLEAN LIGHT MODERN
      ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 text-white flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider">
                  Curriculum Setup
                </span>
                <h2 className="text-lg font-bold mt-1 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-white" />
                  <span>Add Academic Subject</span>
                </h2>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Register course code, credit weight, and link assigned teaching faculty.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubject} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Subject Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. CS701"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 uppercase font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition cursor-pointer font-medium"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Electronics & Communication">Electronics &amp; Communication</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Subject Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 3 })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-700 font-bold">Assigned Teacher (Optional)</label>
                <select
                  value={formData.faculty_id}
                  onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition cursor-pointer font-medium"
                >
                  <option value="">-- Assign Later --</option>
                  {facultyList.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.user?.full_name || "Teacher"} ({fac.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Form Action Buttons */}
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{submitting ? "Saving Subject..." : "Save Subject"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
