"use client";

import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  UserPlus,
  Search,
  Mail,
  Phone,
  Building,
  RefreshCw,
  CheckCircle2,
  Trash2,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  BookOpen
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface FacultyData {
  id: number;
  employee_id: string;
  department: string;
  designation: string;
  office_location?: string;
  user?: {
    id: number;
    email: string;
    full_name: string;
    phone_number?: string;
    role?: string;
  };
}

export default function FacultyPage() {
  const { token, user: currentUser } = useAuth();
  const [facultyList, setFacultyList] = useState<FacultyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    employee_id: "",
    full_name: "",
    email: "",
    password: "faculty123",
    department: "Computer Science",
    designation: "Assistant Professor",
    office_location: "Block B, Room 302",
    phone_number: "",
  });

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`${API_BASE_URL}/academic/faculty`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setFacultyList(data);
      } else {
        setErrorMsg("Failed to load faculty records.");
      }
    } catch {
      setErrorMsg("Network error connecting to backend service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, [token]);

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/academic/faculty`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: formData.employee_id.trim().toUpperCase(),
          full_name: formData.full_name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password || "faculty123",
          department: formData.department,
          designation: formData.designation,
          office_location: formData.office_location,
          phone_number: formData.phone_number || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to create teacher account.");
      }

      setSuccessMsg(`Teacher account created successfully! Login Email: ${formData.email.toLowerCase()}`);
      setShowModal(false);
      setFormData({
        employee_id: "",
        full_name: "",
        email: "",
        password: "faculty123",
        department: "Computer Science",
        designation: "Assistant Professor",
        office_location: "Block B, Room 302",
        phone_number: "",
      });
      fetchFaculty();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFaculty = async (facultyId: number) => {
    try {
      setDeleteId(facultyId);
      const res = await fetch(`${API_BASE_URL}/academic/faculty/${facultyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setSuccessMsg("Teacher account and login deleted successfully.");
        fetchFaculty();
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || "Failed to delete teacher account.");
      }
    } catch {
      setErrorMsg("Network error trying to delete teacher.");
    } finally {
      setDeleteId(null);
    }
  };

  const filteredFaculty = facultyList.filter((fac) => {
    const q = searchQuery.toLowerCase();
    const name = fac.user?.full_name?.toLowerCase() || "";
    const email = fac.user?.email?.toLowerCase() || "";
    const empId = fac.employee_id?.toLowerCase() || "";
    const dept = fac.department?.toLowerCase() || "";
    return name.includes(q) || email.includes(q) || empId.includes(q) || dept.includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800/80 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Admin Portal
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> RBAC Enabled
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-cyan-400" />
            <span>Teacher Management & Login Creation</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create and manage verified Teacher login accounts, assign faculties to departments, and control attendance permissions.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg(null);
            setSuccessMsg(null);
            setShowModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 transition-all shrink-0 hover:scale-[1.02]"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create New Teacher (Login)</span>
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

      {/* Search and Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teachers by name, email, employee ID, or department..."
            className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition"
          />
        </div>
        <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2 text-xs">
          <span className="text-slate-400 font-medium">Registered Teachers:</span>
          <span className="font-mono font-bold text-cyan-400 text-sm">{facultyList.length}</span>
        </div>
      </div>

      {/* Teachers Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
            <span>Loading verified teacher roster...</span>
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8">
            <GraduationCap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300 text-sm">No teacher accounts found.</p>
            <p className="text-slate-500 mt-1">
              Click &quot;Create New Teacher (Login)&quot; above to add instructors with full login access to the portal.
            </p>
          </div>
        ) : (
          filteredFaculty.map((fac) => (
            <div
              key={fac.id}
              className="bg-slate-900/70 hover:bg-slate-900/90 rounded-3xl p-5 border border-slate-800/80 hover:border-cyan-500/30 transition-all duration-200 space-y-4 shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Employee ID & Role */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/20">
                    {fac.employee_id}
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                    {fac.designation}
                  </span>
                </div>

                {/* Name & Department */}
                <div>
                  <h3 className="text-base font-bold text-slate-100">{fac.user?.full_name || "Faculty Member"}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{fac.department}</p>
                </div>

                {/* Credentials & Details */}
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate font-mono">{fac.user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-400">Login Role: <strong className="text-slate-200">FACULTY</strong></span>
                  </div>
                  {fac.office_location && (
                    <div className="flex items-center gap-2">
                      <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{fac.office_location}</span>
                    </div>
                  )}
                  {fac.user?.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{fac.user.phone_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active Account
                </span>
                <button
                  onClick={() => handleDeleteFaculty(fac.id)}
                  disabled={deleteId === fac.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold border border-rose-500/20 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteId === fac.id ? "Deleting..." : "Delete Teacher"}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal for Creating Teacher Account */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <span>Create New Teacher (Login Account)</span>
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-100 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-400">
              The teacher will use the email and password provided below to log in to the Teacher Portal and take period attendance.
            </p>

            <form onSubmit={handleCreateFaculty} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Employee ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    placeholder="e.g. FAC-001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 uppercase font-mono focus:border-cyan-500/50 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Dr. Alan Turing"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500/50 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Login Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="teacher@university.edu"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500/50 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-medium flex items-center justify-between">
                  <span>Login Password *</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Set teacher login password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 font-mono focus:border-cyan-500/50 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500/50 outline-none"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Artificial Intelligence">Artificial Intelligence</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Designation</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500/50 outline-none"
                  >
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Professor">Professor</option>
                    <option value="Head of Department">Head of Department</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Office Location</label>
                  <input
                    type="text"
                    value={formData.office_location}
                    onChange={(e) => setFormData({ ...formData, office_location: e.target.value })}
                    placeholder="e.g. Block B, Room 302"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500/50 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Phone Number (Optional)</label>
                  <input
                    type="text"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:border-cyan-500/50 outline-none"
                  />
                </div>
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{submitting ? "Creating Account..." : "Create Teacher Account"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
