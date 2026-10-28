"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarDays,
  Clock,
  Plus,
  BookOpen,
  User,
  MapPin,
  Camera,
  Trash2,
  Play,
  RotateCw,
  CheckCircle2,
  Calendar,
  X,
  Filter,
  Search,
  School,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface TimetableSlot {
  id: number;
  subject_id: number;
  faculty_id: number;
  camera_id?: number | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  classroom: string;
  section: string;
  batch_year: string;
  is_recurring: boolean;
  single_date?: string | null;
  is_active: boolean;
  subject_name?: string | null;
  subject_code?: string | null;
  faculty_name?: string | null;
  camera_name?: string | null;
}

interface SubjectItem {
  id: number;
  code: string;
  name: string;
  semester?: number;
  department?: string;
}

interface FacultyItem {
  id: number;
  employee_id: string;
  user: {
    full_name: string;
    email: string;
  };
}

interface CameraItem {
  id: number;
  name: string;
  classroom: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TimetablePage() {
  const { user, token } = useAuth();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Filters
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("ALL");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("A");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<number>(6);
  const [viewScope, setViewScope] = useState<"cohort" | "taught_by_me" | "all">("cohort");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Form State for creating a single class period
  const [formData, setFormData] = useState({
    subject_id: 0,
    faculty_id: 0,
    camera_id: 0,
    day_of_week: "Monday",
    start_time: "09:00",
    end_time: "10:00",
    classroom: "Room 302",
    section: "A",
    batch_year: "2023-2027",
    is_recurring: true,
    single_date: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders(token);

      // Build query string for timetable
      const params = new URLSearchParams();
      if (selectedSectionFilter !== "ALL") params.append("section", selectedSectionFilter);
      if (selectedSemesterFilter > 0) params.append("semester", selectedSemesterFilter.toString());
      if (viewScope !== "all") params.append("view_mode", viewScope);

      const [resSlots, resSubj, resFac, resCam] = await Promise.all([
        fetch(`${API_BASE_URL}/timetable?${params.toString()}`, { headers }),
        fetch(`${API_BASE_URL}/academic/subjects`, { headers }),
        fetch(`${API_BASE_URL}/academic/faculty`, { headers }),
        fetch(`${API_BASE_URL}/cctv/cameras`, { headers }),
      ]);

      if (resSlots.ok) setSlots(await resSlots.json());
      if (resSubj.ok) {
        const subData = await resSubj.json();
        setSubjects(subData);
        if (subData.length > 0 && formData.subject_id === 0) {
          setFormData((prev) => ({ ...prev, subject_id: subData[0].id }));
        }
      }
      if (resFac.ok) {
        const facData = await resFac.json();
        setFacultyList(facData);
        if (facData.length > 0 && formData.faculty_id === 0) {
          setFormData((prev) => ({ ...prev, faculty_id: facData[0].id }));
        }
      }
      if (resCam.ok) {
        const camData = await resCam.json();
        setCameras(camData);
        if (camData.length > 0 && formData.camera_id === 0) {
          setFormData((prev) => ({ ...prev, camera_id: camData[0].id }));
        }
      }
    } catch (err) {
      console.error("Failed to load timetable data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, selectedSectionFilter, selectedSemesterFilter, viewScope]);

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/timetable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          ...formData,
          camera_id: formData.camera_id ? formData.camera_id : null,
          single_date: formData.is_recurring ? null : formData.single_date || null,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        loadData();
      }
    } catch (err) {
      console.error("Failed to create class slot", err);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm("Are you sure you want to delete this class slot?")) return;
    try {
      await fetch(`${API_BASE_URL}/timetable/${slotId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      console.error("Failed to delete slot", err);
    }
  };

  // Client-side filtering by Day & Search query
  const filteredSlots = slots.filter((s) => {
    if (selectedDayFilter !== "ALL" && s.day_of_week !== selectedDayFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubName = s.subject_name?.toLowerCase().includes(q);
      const matchSubCode = s.subject_code?.toLowerCase().includes(q);
      const matchFacName = s.faculty_name?.toLowerCase().includes(q);
      const matchRoom = s.classroom?.toLowerCase().includes(q);
      return matchSubName || matchSubCode || matchFacName || matchRoom;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* =========================================================================
          HERO BANNER: CLEAN LIGHT MODERN SAAS
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/50 border border-blue-200/80 shadow-xs p-6 md:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                Timetable &amp; Schedule
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <School className="w-3 h-3 text-emerald-600" />
                {selectedSectionFilter === "ALL" ? "All Sections" : `Section ${selectedSectionFilter}`} &bull; Sem {selectedSemesterFilter || 6}
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Timetable &amp; Class Period Scheduler
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Explore scheduled period slots, teaching faculty assignments, classroom locations, and CCTV camera mapping for your monitored class and semester.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={loadData}
              className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 shadow-xs transition cursor-pointer"
              title="Refresh Timetable"
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Single Class</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CONTROLS BAR: CLASS/SECTION/SEMESTER FILTERS + SEARCH
      ========================================================================= */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* View Scope Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl shrink-0">
            <button
              onClick={() => setViewScope("cohort")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                viewScope === "cohort"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Classes for This Cohort
            </button>
            <button
              onClick={() => setViewScope("taught_by_me")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                viewScope === "taught_by_me"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Taught by Me Only
            </button>
            <button
              onClick={() => setViewScope("all")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                viewScope === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Campus Classes
            </button>
          </div>

          {/* Section & Semester Dropdowns + Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Section Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sec:</span>
              <select
                value={selectedSectionFilter}
                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="A">Section A (Monitored)</option>
                <option value="B">Section B</option>
                <option value="ALL">All Sections</option>
              </select>
            </div>

            {/* Semester Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sem:</span>
              <select
                value={selectedSemesterFilter}
                onChange={(e) => setSelectedSemesterFilter(parseInt(e.target.value) || 0)}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={6}>Semester 6</option>
                <option value={7}>Semester 7</option>
                <option value={0}>All Semesters</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, teacher, room..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Day Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
          <button
            onClick={() => setSelectedDayFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              selectedDayFilter === "ALL"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            All Days ({slots.length})
          </button>
          {DAYS.map((day) => {
            const count = slots.filter((s) => s.day_of_week === day).length;
            return (
              <button
                key={day}
                onClick={() => setSelectedDayFilter(day)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  selectedDayFilter === day
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-50 border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {day} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          SCHEDULED SLOTS CARDS GRID: CLEAN LIGHT PROFESSIONAL SAAS
      ========================================================================= */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
          <span className="text-xs font-semibold">Loading class schedule...</span>
        </div>
      ) : filteredSlots.length === 0 ? (
        <div className="col-span-full text-center py-16 rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-slate-400">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-blue-600" />
          <p className="text-sm font-bold text-slate-700">No class periods scheduled matching the filters.</p>
          <p className="text-xs text-slate-500 mt-1">
            Try switching day tab or select &quot;All Sections&quot; to inspect campus-wide slots.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSlots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-3xl border border-slate-200/90 bg-white p-5 hover:border-blue-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between group shadow-xs relative overflow-hidden"
            >
              {/* Top Accent Stripe */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />

              <div>
                {/* Time Range Pill & Day Tag */}
                <div className="flex items-center justify-between mb-3 pt-1">
                  <span className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 font-mono text-xs font-bold">
                    {slot.start_time} &ndash; {slot.end_time}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {slot.day_of_week}
                  </span>
                </div>

                {/* Subject Name & Code (High Contrast Slate-900) */}
                <div className="mb-3">
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                    {slot.subject_name || "Academic Course"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-blue-700 font-mono font-bold text-xs border border-slate-200">
                      {slot.subject_code || "CS300"}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Cohort: Sem 6 &bull; Sec {slot.section}
                    </span>
                  </div>
                </div>

                {/* Class Details */}
                <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>
                      Instructor: <strong className="text-slate-900 font-semibold">{slot.faculty_name || "Assigned Teacher"}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Classroom: <strong className="text-slate-900 font-semibold">{slot.classroom}</strong> (Sec {slot.section})
                    </span>
                  </div>
                  {slot.camera_name && (
                    <div className="flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">
                        CCTV: <strong className="text-slate-700">{slot.camera_name}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/sessions?timetable_id=${slot.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Live Attendance Session</span>
                </Link>
                <button
                  onClick={() => handleDeleteSlot(slot.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Delete Class Period"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          SCHEDULE CLASS PERIOD MODAL: CLEAN LIGHT SAAS
      ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider">
                  Timetable Manager
                </span>
                <h3 className="text-lg font-bold mt-1 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-white" />
                  <span>Schedule Class Period</span>
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  Allocate discrete class slot with teacher, room, and CCTV sensor.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Subject *</label>
                  <select
                    value={formData.subject_id}
                    onChange={(e) => setFormData({ ...formData, subject_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code}: {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Assigned Teacher *</label>
                  <select
                    value={formData.faculty_id}
                    onChange={(e) => setFormData({ ...formData, faculty_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    {facultyList.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.user.full_name} ({fac.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Day of Week</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Start Time</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">End Time</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Classroom, Section & Camera */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Classroom</label>
                  <input
                    type="text"
                    required
                    value={formData.classroom}
                    onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                    placeholder="e.g. Room 302"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">Section</label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-700 font-bold">CCTV Camera</label>
                  <select
                    value={formData.camera_id}
                    onChange={(e) => setFormData({ ...formData, camera_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>None / Default</option>
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition cursor-pointer shadow-md shadow-blue-500/20"
                >
                  Schedule Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
