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
  const { token } = useAuth();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>("ALL");

  // Form State for creating a single class period
  const [formData, setFormData] = useState({
    subject_id: 0,
    faculty_id: 0,
    camera_id: 0,
    day_of_week: "Monday",
    start_time: "13:00",
    end_time: "14:00",
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

      const [resSlots, resSubj, resFac, resCam] = await Promise.all([
        fetch(`${API_BASE_URL}/timetable`, { headers }),
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
  }, [token]);

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

  const filteredSlots = slots.filter((s) =>
    selectedDayFilter === "ALL" ? true : s.day_of_week === selectedDayFilter
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            Timetable &amp; Class Period Scheduler
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create discrete single-class periods (e.g. 1-2 PM, 2-3 PM) with assigned Subject, Teacher, Classroom, and Camera.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Schedule Single Class
          </button>
        </div>
      </div>

      {/* Day Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedDayFilter("ALL")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
            selectedDayFilter === "ALL"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                selectedDayFilter === day
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {day} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* Scheduled Slots Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSlots.map((slot) => (
          <div
            key={slot.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between group shadow-sm relative overflow-hidden"
          >
            {/* Top Accent Stripe */}
            <div className="absolute top-0 inset-x-0 h-1 bg-blue-600" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold">
                  {slot.start_time} - {slot.end_time}
                </span>
                <span className="text-[11px] font-medium text-slate-400">{slot.day_of_week}</span>
              </div>

              <h3 className="text-base font-bold text-white mb-1 group-hover:text-blue-400 transition">
                {slot.subject_name || "Academic Subject"}
              </h3>
              <p className="text-xs font-mono text-slate-400 mb-3">{slot.subject_code}</p>

              <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Instructor: <strong>{slot.faculty_name || "Assigned Teacher"}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Classroom: <strong>{slot.classroom}</strong> (Sec {slot.section})</span>
                </div>
                {slot.camera_name && (
                  <div className="flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>CCTV: <strong className="text-slate-300">{slot.camera_name}</strong></span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <Link
                href={`/sessions?timetable_id=${slot.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition"
              >
                <Play className="w-3 h-3 fill-current" />
                Live Attendance Session
              </Link>
              <button
                onClick={() => handleDeleteSlot(slot.id)}
                className="text-slate-500 hover:text-rose-400 p-1.5 transition"
                title="Delete slot"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {filteredSlots.length === 0 && (
          <div className="col-span-full text-center py-12 rounded-2xl border border-dashed border-slate-800 text-slate-500">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No class periods scheduled for {selectedDayFilter}.</p>
            <p className="text-xs text-slate-500 mt-1">Click "Schedule Single Class" to create an hourly session.</p>
          </div>
        )}
      </div>

      {/* Add Slot Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Schedule Class Period
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 text-xs">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Subject</label>
                  <select
                    value={formData.subject_id}
                    onChange={(e) => setFormData({ ...formData, subject_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code}: {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Teacher</label>
                  <select
                    value={formData.faculty_id}
                    onChange={(e) => setFormData({ ...formData, faculty_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
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
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Day of Week</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Start Time (e.g. 13:00)</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">End Time (e.g. 14:00)</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Classroom & Camera */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Classroom</label>
                  <input
                    type="text"
                    required
                    value={formData.classroom}
                    onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                    placeholder="e.g. Room 302"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned CCTV Camera</label>
                  <select
                    value={formData.camera_id}
                    onChange={(e) => setFormData({ ...formData, camera_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>None / Default</option>
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.name} ({cam.classroom})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
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
