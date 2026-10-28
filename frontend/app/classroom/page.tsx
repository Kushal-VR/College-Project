"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  School,
  GraduationCap,
  Users,
  Calendar,
  Clock,
  BookOpen,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Mail,
  Phone,
  Building,
  Shield,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Filter,
  ScanFace,
  UserPlus,
  ExternalLink,
  Award,
  Layers,
  MapPin,
  CalendarDays,
  UserCheck,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// --- TYPES & INTERFACES ---
interface ClassroomTeacherInfo {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  phone_number?: string | null;
  department: string;
  designation: string;
  office_location?: string | null;
  is_class_teacher: boolean;
  subjects_taught: string[];
  weekly_periods: number;
}

interface ClassroomSubjectInfo {
  id: number;
  code: string;
  name: string;
  department: string;
  semester: number;
  credits: number;
  faculty_id?: number | null;
  faculty_name?: string | null;
}

interface ClassroomTimeSlot {
  period: number;
  start_time: string;
  end_time: string;
  label: string;
}

interface ClassroomTimetableSlot {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code?: string | null;
  subject_name?: string | null;
  classroom: string;
  teacher_name?: string | null;
  teacher_email?: string | null;
  day_of_week: string;
  is_recurring: boolean;
}

interface ClassroomStudentItem {
  id: number;
  student_id: string;
  full_name: string;
  email: string;
  phone_number?: string | null;
  department: string;
  semester: number;
  section: string;
  batch_year: string;
  biometric_enrolled: boolean;
  biometric_face_count: number;
  photo_url?: string | null;
  enrolled_subjects_count: number;
  enrolled_subject_names: string[];
}

interface ClassroomOverviewResponse {
  monitored_class: {
    is_class_teacher: boolean;
    class_teacher_name: string;
    class_teacher_email: string;
    class_teacher_employee_id: string;
    department: string;
    semester: number;
    section: string;
    batch_year: string;
    classroom: string;
  };
  available_sections: string[];
  available_semesters: number[];
  stats: {
    total_students: number;
    total_subjects: number;
    total_teachers: number;
    total_weekly_periods: number;
  };
  teachers: ClassroomTeacherInfo[];
  subjects: ClassroomSubjectInfo[];
  time_slots: ClassroomTimeSlot[];
  timetable_grid: Record<string, ClassroomTimetableSlot[]>;
  students: ClassroomStudentItem[];
}

export default function ClassroomPage() {
  const { token, user: currentUser } = useAuth();
  const [data, setData] = useState<ClassroomOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string>("A");
  const [activeTab, setActiveTab] = useState<"overview" | "classes_teachers" | "timetable" | "students" | "timeslots">("overview");

  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState<"ALL" | "ENROLLED" | "PENDING">("ALL");
  const [selectedDay, setSelectedDay] = useState<string>("All");

  // Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [deleteStudentConfirm, setDeleteStudentConfirm] = useState<ClassroomStudentItem | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Admin Faculty Management Modal
  const [showFacultyAdminModal, setShowFacultyAdminModal] = useState(false);
  const [facultyAdminSubmitting, setFacultyAdminSubmitting] = useState(false);
  const [facultyFormData, setFacultyFormData] = useState({
    employee_id: "",
    full_name: "",
    email: "",
    password: "faculty123",
    department: "Computer Science",
    designation: "Assistant Professor",
    office_location: "Block B, Room 302",
    phone_number: "",
  });

  // New Student Form
  const [studentFormData, setStudentFormData] = useState({
    student_id: "",
    full_name: "",
    email: "",
    phone_number: "",
    password: "student123",
    department: "Computer Science",
    semester: 6,
    section: "A",
    batch_year: "2023-2027",
    auto_enroll_subjects: true,
  });

  const fetchClassroomOverview = async (sectionOverride?: string) => {
    try {
      setRefreshing(true);
      setErrorMsg(null);
      const targetSec = sectionOverride || selectedSection;
      const res = await fetch(
        `${API_BASE_URL}/academic/classroom/overview?section=${encodeURIComponent(targetSec)}`,
        {
          headers: getAuthHeaders(token),
        }
      );
      if (res.ok) {
        const result: ClassroomOverviewResponse = await res.json();
        setData(result);
        if (result.monitored_class?.section && !sectionOverride) {
          setSelectedSection(result.monitored_class.section);
        }
        // Update new student form defaults
        setStudentFormData((prev) => ({
          ...prev,
          section: result.monitored_class.section || "A",
          semester: result.monitored_class.semester || 6,
          department: result.monitored_class.department || "Computer Science",
          batch_year: result.monitored_class.batch_year || "2023-2027",
        }));
      } else {
        const err = await res.json().catch(() => null);
        setErrorMsg(err?.detail || "Failed to load classroom overview data.");
      }
    } catch {
      setErrorMsg("Network error connecting to backend service.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClassroomOverview();
  }, [token]);

  const handleSectionChange = (sec: string) => {
    setSelectedSection(sec);
    fetchClassroomOverview(sec);
  };

  // Add Student Submission
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingStudent(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/academic/classroom/students`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          student_id: studentFormData.student_id.trim().toUpperCase(),
          full_name: studentFormData.full_name.trim(),
          email: studentFormData.email.trim().toLowerCase(),
          phone_number: studentFormData.phone_number.trim() || undefined,
          password: studentFormData.password || "student123",
          department: studentFormData.department,
          semester: Number(studentFormData.semester),
          section: studentFormData.section,
          batch_year: studentFormData.batch_year,
          auto_enroll_subjects: studentFormData.auto_enroll_subjects,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Failed to add student to classroom.");
      }

      setSuccessMsg(
        `Student ${resData.full_name} (${resData.student_id}) enrolled into Section ${resData.section} with ${resData.enrolled_subjects_count} subjects!`
      );
      setShowAddStudentModal(false);
      // Reset form ID
      setStudentFormData((prev) => ({
        ...prev,
        student_id: "",
        full_name: "",
        email: "",
        phone_number: "",
      }));
      // Refresh
      fetchClassroomOverview(selectedSection);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register student.");
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  // Delete Student
  const handleDeleteStudent = async () => {
    if (!deleteStudentConfirm) return;
    try {
      setIsDeletingStudent(true);
      setErrorMsg(null);
      const res = await fetch(`${API_BASE_URL}/academic/students/${deleteStudentConfirm.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (res.ok) {
        setSuccessMsg(`Student ${deleteStudentConfirm.full_name} removed from classroom.`);
        setDeleteStudentConfirm(null);
        fetchClassroomOverview(selectedSection);
      } else {
        const err = await res.json().catch(() => null);
        setErrorMsg(err?.detail || "Failed to remove student.");
      }
    } catch {
      setErrorMsg("Network error trying to remove student.");
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // Create Faculty (Admin preservation)
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setFacultyAdminSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/academic/faculty`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          employee_id: facultyFormData.employee_id.trim().toUpperCase(),
          full_name: facultyFormData.full_name.trim(),
          email: facultyFormData.email.trim().toLowerCase(),
          password: facultyFormData.password || "faculty123",
          department: facultyFormData.department,
          designation: facultyFormData.designation,
          office_location: facultyFormData.office_location,
          phone_number: facultyFormData.phone_number || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Failed to create teacher account.");
      }

      setSuccessMsg(`Teacher account created for ${facultyFormData.full_name} (${facultyFormData.email})`);
      setShowFacultyAdminModal(false);
      fetchClassroomOverview(selectedSection);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred creating teacher.");
    } finally {
      setFacultyAdminSubmitting(false);
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    return data.students.filter((st) => {
      const q = studentSearch.toLowerCase();
      const matchesSearch =
        st.full_name.toLowerCase().includes(q) ||
        st.student_id.toLowerCase().includes(q) ||
        st.email.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (studentFilter === "ENROLLED") return st.biometric_enrolled;
      if (studentFilter === "PENDING") return !st.biometric_enrolled;
      return true;
    });
  }, [data?.students, studentSearch, studentFilter]);

  // Timetable days
  const daysList = ["All", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Loading Monitored Classroom &amp; Timetable Schedule...
        </p>
      </div>
    );
  }

  const monitored = data?.monitored_class;
  const teachers = data?.teachers || [];
  const subjects = data?.subjects || [];
  const timeSlots = data?.time_slots || [];
  const timetableGrid = data?.timetable_grid || {};
  const stats = data?.stats;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* =========================================================================
          HERO BANNER: MONITORED CLASSROOM & CLASS TEACHER PROFILE
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/50 border border-blue-200/80 shadow-xs p-6 md:p-8">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                <School className="w-3.5 h-3.5 text-blue-600" />
                My Classroom
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                Class Teacher Cohort
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Automated CCTV Tracking
              </span>
            </div>

            {/* Title & Description */}
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
                <span>
                  {monitored?.department} • Sem {monitored?.semester} (Sec {selectedSection})
                </span>
                <span className="px-3 py-0.5 rounded-xl bg-blue-100 border border-blue-200 text-xs font-mono font-bold text-blue-700">
                  {monitored?.classroom || "Room 302"}
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-600 max-w-2xl mt-1 leading-relaxed">
                Centralized dashboard for the monitored classroom cohort. View classes received, assigned teachers, period time slots, weekly timetable schedules, and manage student enrollments.
              </p>
            </div>

            {/* Class Teacher Meta Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-2xs">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <span>
                  <strong className="text-slate-900">Class Teacher:</strong>{" "}
                  {monitored?.class_teacher_name || "Prof. Alan Turing"}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-2xs">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-slate-700">{monitored?.class_teacher_email || "faculty@attendance.edu"}</span>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-2xs">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>Batch: {monitored?.batch_year || "2023-2027"}</span>
              </div>
            </div>
          </div>

          {/* Right Controls: Section Switcher & Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            {/* Section Switcher Pills */}
            <div className="bg-white border border-slate-200 p-1.5 rounded-2xl flex items-center justify-between gap-1 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3">
                Section:
              </span>
              <div className="flex items-center gap-1">
                {(data?.available_sections || ["A", "B"]).map((sec) => (
                  <button
                    key={sec}
                    onClick={() => handleSectionChange(sec)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedSection === sec
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    Sec {sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                id="btn-add-new-student"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setShowAddStudentModal(true);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Enroll New Student</span>
              </button>

              <button
                onClick={() => fetchClassroomOverview(selectedSection)}
                disabled={refreshing}
                title="Refresh Classroom Data"
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
              </button>

              {currentUser?.role === "ADMIN" && (
                <button
                  onClick={() => setShowFacultyAdminModal(true)}
                  title="Admin: Create/Manage Teacher Accounts"
                  className="px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Teacher Accounts</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          NOTIFICATIONS: ERRORS & SUCCESS
      ========================================================================= */}
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

      {/* =========================================================================
          STATISTICS CARDS: COHORT OVERVIEW
      ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Students */}
        <div
          onClick={() => setActiveTab("students")}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Enrolled Students
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.total_students ?? 0}</div>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              {data?.students.filter((s) => s.biometric_enrolled).length ?? 0} Face ID Enrolled
            </span>
          </div>
        </div>

        {/* Card 2: Subjects */}
        <div
          onClick={() => setActiveTab("classes_teachers")}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Classes / Courses
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.total_subjects ?? 0}</div>
          <p className="mt-2 text-[11px] text-slate-500">Subjects taught to this section</p>
        </div>

        {/* Card 3: Teachers */}
        <div
          onClick={() => setActiveTab("classes_teachers")}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-cyan-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Assigned Faculty
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.total_teachers ?? 0}</div>
          <p className="mt-2 text-[11px] text-slate-500">Professors &amp; Instructors</p>
        </div>

        {/* Card 4: Weekly Periods */}
        <div
          onClick={() => setActiveTab("timetable")}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Weekly Timetable Load
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats?.total_weekly_periods ?? 0}</div>
          <p className="mt-2 text-[11px] text-slate-500">Periods (Mon - Sat Schedule)</p>
        </div>
      </div>

      {/* =========================================================================
          NAVIGATION TABS: SECTIONS
      ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Full Cohort Hub</span>
        </button>

        <button
          onClick={() => setActiveTab("classes_teachers")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "classes_teachers"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Classes &amp; Assigned Teachers ({teachers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("timetable")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "timetable"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Weekly Timetable Schedule</span>
        </button>

        <button
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "students"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Students &amp; Admissions ({data?.students.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("timeslots")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === "timeslots"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Period Time Slots</span>
        </button>
      </div>

      {/* =========================================================================
          TAB CONTENT 1: CLASSES & ASSIGNED TEACHERS
      ========================================================================= */}
      {(activeTab === "overview" || activeTab === "classes_teachers") && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Classes &amp; Assigned Teachers</span>
              </h2>
              <p className="text-xs text-slate-500">
                Courses taught to this monitored cohort, who the faculty teachers are, their contact information, and weekly period counts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                Total Classes: <strong className="text-blue-600">{subjects.length}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className={`rounded-2xl border transition-all p-5 shadow-xs relative flex flex-col justify-between ${
                  teacher.is_class_teacher
                    ? "bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 border-blue-200/90 shadow-blue-500/5 ring-1 ring-blue-400/30"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                      {teacher.employee_id}
                    </span>

                    {teacher.is_class_teacher ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <Award className="w-3 h-3 text-amber-600" /> Class Teacher
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {teacher.designation}
                      </span>
                    )}
                  </div>

                  {/* Teacher Info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                      {teacher.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">{teacher.name}</h3>
                      <p className="text-xs text-slate-500">{teacher.department}</p>
                      {teacher.office_location && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{teacher.office_location}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subjects Handled for This Class */}
                  <div className="space-y-1.5 mb-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Subjects Taught To This Class:
                    </div>
                    {teacher.subjects_taught.length > 0 ? (
                      teacher.subjects_taught.map((sub, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-800 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{sub}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                            Core
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-slate-50 text-xs text-slate-400 italic">
                        General Class Teacher &amp; Mentor
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Footer Info */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{teacher.email}</span>
                    </span>
                    <span className="font-bold text-blue-600 shrink-0 font-mono">
                      {teacher.weekly_periods} hrs/wk
                    </span>
                  </div>

                  {teacher.phone_number && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{teacher.phone_number}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT 2: WEEKLY TIMETABLE SCHEDULE
      ========================================================================= */}
      {(activeTab === "overview" || activeTab === "timetable") && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span>Weekly Timetable &amp; Schedule Matrix</span>
              </h2>
              <p className="text-xs text-slate-500">
                Complete period-by-period class timetable for Section {selectedSection} across all 6 days.
              </p>
            </div>

            {/* Day Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto max-w-full">
              {daysList.map((day) => {
                const isSelected = selectedDay === day;
                const isToday = day === currentDayName;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {day}
                    {isToday && day !== "All" && (
                      <span className="ml-1.5 px-1 py-0.2 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700">
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timetable Schedule Cards / Grid */}
          <div className="space-y-6">
            {Object.entries(timetableGrid)
              .filter(([day]) => selectedDay === "All" || selectedDay === day)
              .map(([day, slots]) => {
                const isToday = day === currentDayName;
                return (
                  <div
                    key={day}
                    className={`rounded-2xl border p-5 transition ${
                      isToday
                        ? "bg-indigo-50/40 border-indigo-200/90 shadow-sm"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <h3 className="font-bold text-slate-900 text-base">{day}</h3>
                        {isToday && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {slots.length} Lectures Scheduled
                      </span>
                    </div>

                    {/* Periods Grid */}
                    {slots.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {slots.map((slot) => (
                          <div
                            key={slot.id}
                            className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:border-indigo-300 hover:bg-white hover:shadow-xs transition group flex flex-col justify-between"
                          >
                            <div>
                              {/* Slot Period & Time */}
                              <div className="flex items-center justify-between mb-2">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 font-mono">
                                  P{slot.period_number}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500 font-mono">
                                  {slot.start_time} - {slot.end_time}
                                </span>
                              </div>

                              {/* Subject Code & Name */}
                              <div className="font-bold text-xs text-slate-900 line-clamp-1 group-hover:text-blue-600 transition">
                                {slot.subject_code || "CS301"}
                              </div>
                              <div className="text-[11px] text-slate-600 font-medium line-clamp-2 mt-0.5 leading-snug">
                                {slot.subject_name || "Course Subject"}
                              </div>
                            </div>

                            {/* Faculty & Classroom */}
                            <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                              <span className="truncate max-w-[90px]" title={slot.teacher_name || "Faculty"}>
                                {slot.teacher_name || "Faculty"}
                              </span>
                              <span className="font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {slot.classroom}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-xs text-slate-400 italic">
                        No active classes scheduled for {day} in Section {selectedSection}.
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT 3: STUDENTS & NEW ADMISSIONS
      ========================================================================= */}
      {(activeTab === "overview" || activeTab === "students") && (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Classroom Student Roster ({filteredStudents.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Active students registered in Section {selectedSection}. Monitor facial biometric enrollment and enroll new students.
              </p>
            </div>

            <button
              onClick={() => {
                setErrorMsg(null);
                setSuccessMsg(null);
                setShowAddStudentModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Student to Monitored Class</span>
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students by name, roll number, or email..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setStudentFilter("ALL")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  studentFilter === "ALL" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-600"
                }`}
              >
                All ({data?.students.length ?? 0})
              </button>
              <button
                onClick={() => setStudentFilter("ENROLLED")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  studentFilter === "ENROLLED" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-600"
                }`}
              >
                Face ID ({data?.students.filter((s) => s.biometric_enrolled).length ?? 0})
              </button>
              <button
                onClick={() => setStudentFilter("PENDING")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  studentFilter === "PENDING" ? "bg-white text-amber-700 shadow-2xs" : "text-slate-600"
                }`}
              >
                Pending ({data?.students.filter((s) => !s.biometric_enrolled).length ?? 0})
              </button>
            </div>
          </div>

          {/* Students Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      {st.student_id}
                    </span>

                    {st.biometric_enrolled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <ScanFace className="w-3 h-3 text-emerald-600" />
                        Face Enrolled ({st.biometric_face_count})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        <ScanFace className="w-3 h-3 text-amber-600" />
                        Face Pending
                      </span>
                    )}
                  </div>

                  {/* Student Details */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                      {st.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-slate-900 truncate leading-tight">
                        {st.full_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">{st.email}</p>
                    </div>
                  </div>

                  {/* Enrolled Courses Preview */}
                  <div className="space-y-1 mb-3">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Enrolled Courses ({st.enrolled_subjects_count}):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {st.enrolled_subject_names.slice(0, 3).map((subName, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-50 text-slate-700 border border-slate-200/60 truncate max-w-[140px]"
                        >
                          {subName}
                        </span>
                      ))}
                      {st.enrolled_subject_names.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-bold">
                          +{st.enrolled_subject_names.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  {!st.biometric_enrolled ? (
                    <Link
                      href={`/enrollment`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <ScanFace className="w-3.5 h-3.5" />
                      <span>Enroll Face ID</span>
                    </Link>
                  ) : (
                    <span className="text-[11px] text-slate-400">Ready for CCTV</span>
                  )}

                  <button
                    onClick={() => setDeleteStudentConfirm(st)}
                    title="Remove Student from Classroom"
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredStudents.length === 0 && (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">No students found matching your criteria</p>
              <p className="text-[11px] text-slate-400">
                Try clearing search or click "+ Add Student to Monitored Class" to enroll new students.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB CONTENT 4: PERIOD TIME SLOTS
      ========================================================================= */}
      {(activeTab === "overview" || activeTab === "timeslots") && (
        <div className="space-y-4 pt-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <span>Standard Period Time Slots &amp; Breaks</span>
            </h2>
            <p className="text-xs text-slate-500">
              Daily period intervals configured for automated CCTV entry/exit tracking and attendance ledger recording.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {timeSlots.map((slot) => (
              <div
                key={slot.period}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-emerald-300 transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center">
                    P{slot.period}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    60 Mins
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {slot.start_time} - {slot.end_time}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Lecture Period {slot.period}</div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>CCTV Biometrics Active</span>
                </div>
              </div>
            ))}
          </div>

          {/* Recess & Break Times Info Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Morning Tea Recess: <strong>11:00 AM - 11:15 AM</strong> (15 mins)</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Lunch Break: <strong>12:15 PM - 01:00 PM</strong> (45 mins)</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Attendance sessions auto-sync with Room 302 High-Angle CCTV
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: ADD NEW STUDENT TO CLASSROOM
      ========================================================================= */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider">
                    Sec {selectedSection} Admissions
                  </span>
                </div>
                <h3 className="text-lg font-bold">Enroll New Student</h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  Register a new student directly into monitored Section {selectedSection} and enroll them into all class subjects.
                </p>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student ID / Roll No. *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS-2024-008"
                    value={studentFormData.student_id}
                    onChange={(e) =>
                      setStudentFormData({ ...studentFormData, student_id: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grace Hopper"
                    value={studentFormData.full_name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="grace@attendance.edu"
                    value={studentFormData.email}
                    onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value.toLowerCase() })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+1-800-555-0155"
                    value={studentFormData.phone_number}
                    onChange={(e) => setStudentFormData({ ...studentFormData, phone_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Section</label>
                  <input
                    type="text"
                    readOnly
                    value={studentFormData.section}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Semester</label>
                  <input
                    type="number"
                    readOnly
                    value={studentFormData.semester}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Batch</label>
                  <input
                    type="text"
                    readOnly
                    value={studentFormData.batch_year}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Auto Enroll Subjects Checkbox */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="auto_enroll_subjects"
                  checked={studentFormData.auto_enroll_subjects}
                  onChange={(e) =>
                    setStudentFormData({ ...studentFormData, auto_enroll_subjects: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="auto_enroll_subjects" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-bold text-blue-900 block">
                    Auto-Enroll in All Class Subjects
                  </span>
                  Automatically register student into all {subjects.length} courses for Section {selectedSection} (Computer Networks, OS, DBMS, Automata).
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStudent}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingStudent ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Enrolling Student...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Complete Enrollment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: DELETE STUDENT CONFIRMATION
      ========================================================================= */}
      {deleteStudentConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Remove Student From Class?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove{" "}
                <strong className="text-slate-800">{deleteStudentConfirm.full_name}</strong> (
                {deleteStudentConfirm.student_id}) from Section {selectedSection}? This will remove their course enrollments.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteStudentConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                disabled={isDeletingStudent}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {isDeletingStudent ? "Removing..." : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: ADMIN FACULTY LOGIN CREATION (PRESERVING ADMIN FEATURES)
      ========================================================================= */}
      {showFacultyAdminModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleUp">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white uppercase tracking-wider">
                  Admin Control Panel
                </span>
                <h3 className="text-lg font-bold mt-1">Create Teacher Account</h3>
                <p className="text-xs text-blue-100">
                  Add verified faculty member credentials and assign department permissions.
                </p>
              </div>
              <button
                onClick={() => setShowFacultyAdminModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFaculty} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FAC-005"
                    value={facultyFormData.employee_id}
                    onChange={(e) =>
                      setFacultyFormData({ ...facultyFormData, employee_id: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prof. Dennis Ritchie"
                    value={facultyFormData.full_name}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Login Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="ritchie@attendance.edu"
                    value={facultyFormData.email}
                    onChange={(e) =>
                      setFacultyFormData({ ...facultyFormData, email: e.target.value.toLowerCase() })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Temporary Password</label>
                  <input
                    type="text"
                    value={facultyFormData.password}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={facultyFormData.department}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Electronics & Communication">Electronics &amp; Communication</option>
                    <option value="Information Science">Information Science</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={facultyFormData.designation}
                    onChange={(e) => setFacultyFormData({ ...facultyFormData, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFacultyAdminModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facultyAdminSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {facultyAdminSubmitting ? "Creating..." : "Create Teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
