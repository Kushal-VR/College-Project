"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Plus, Search, RefreshCw, CheckCircle2, User, Trash2, AlertCircle } from "lucide-react";
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <span>Academic Courses &amp; Subjects Catalog</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure subjects, map course codes, assign teachers, and manage period timetable slots dynamically.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg(null);
            setSuccessMsg(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition-all shrink-0 hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Subject</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects by code, title, or department..."
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition"
          />
        </div>
        <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-xs">
          <span className="text-slate-400 font-medium">Configured Subjects:</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">{subjects.length}</span>
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
            <span>Loading subject catalog...</span>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300 text-sm">No subjects added yet.</p>
            <p className="text-slate-500 mt-1">
              Click &quot;Add New Subject&quot; above to configure your real academic subjects and courses.
            </p>
          </div>
        ) : (
          filteredSubjects.map((sub) => (
            <div
              key={sub.id}
              className="bg-slate-900/70 hover:bg-slate-900/90 rounded-3xl p-5 border border-slate-800/80 hover:border-emerald-500/30 transition-all duration-200 space-y-4 shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
                    {sub.code}
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                    {sub.credits} Credits • Sem {sub.semester}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-100">{sub.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{sub.department}</p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-300 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-400">Assigned Teacher:</span>
                  <strong className="text-slate-200 truncate">
                    {sub.faculty?.user?.full_name || "Unassigned"}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active Course
                </span>
                <button
                  onClick={() => handleDeleteSubject(sub.id)}
                  disabled={deletingId === sub.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold border border-rose-500/20 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingId === sub.id ? "Deleting..." : "Delete"}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal to Add Subject */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <span>Add Academic Subject</span>
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-100 text-lg font-bold">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Subject Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. CS701"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 uppercase font-mono focus:border-emerald-500/50 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-emerald-500/50 outline-none"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Subject Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-emerald-500/50 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-emerald-500/50 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 3 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-emerald-500/50 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Assigned Teacher (Optional)</label>
                <select
                  value={formData.faculty_id}
                  onChange={(e) => setFormData({ ...formData, faculty_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-emerald-500/50 outline-none"
                >
                  <option value="">-- Assign Later --</option>
                  {facultyList.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.user?.full_name || "Teacher"} ({fac.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
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
