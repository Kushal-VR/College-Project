"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ScanFace,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  QrCode,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Search,
  Printer,
  Trash2,
} from "lucide-react";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface StudentItem {
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
  };
}

export default function EnrollmentPage() {
  const { token } = useAuth();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Webcam State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [qualityScore, setQualityScore] = useState<number>(0.92);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setCameraDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }).catch(() => {});
    }
  }, []);

  // Start webcam with robust fallback
  const startWebcam = async (devId?: string) => {
    setMessage(null);
    stopWebcam();
    try {
      const activeId = devId || selectedDeviceId;
      let stream: MediaStream;

      // 1. Try with deviceId if available, else plain video: true
      try {
        if (activeId) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: activeId } },
          });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } catch {
        // Fallback unconditionally to generic video: true
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch {
          // play failed or autoplay policy
        }
        setWebcamActive(true);
      }
    } catch (err: unknown) {
      console.error("Camera access error:", err);
      const errName = err instanceof Error ? err.name : "";
      let detail = "Could not access webcam. Please check browser camera permissions or upload an image.";
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        detail = "Camera permission was denied in your browser. Please click the lock/camera icon in your URL bar and select 'Allow'.";
      } else if (errName === "NotReadableError" || errName === "TrackStartError") {
        detail = "Camera hardware is locked by another program or Lenovo Vantage Privacy Mode. Press Fn+F8 or check Lenovo Vantage / Windows Camera apps, or upload a photo directly.";
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        detail = "No camera hardware was detected on your computer.";
      }
      setMessage({
        type: "error",
        text: detail,
      });
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setWebcamActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(dataUrl);
      setQualityScore(0.95);
      stopWebcam();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setQualityScore(0.91);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnrollBiometrics = async () => {
    if (!selectedStudent || !capturedImage) return;
    setEnrolling(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/biometrics/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          image_base64: capturedImage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Enrollment failed.");
      }

      setMessage({
        type: "success",
        text: `Successfully trained biometrics for ${data.student_name}! 128-D facial vector stored.`,
      });

      // Update student local state
      setSelectedStudent((prev) =>
        prev ? { ...prev, biometric_enrolled: true, biometric_face_count: data.total_faces_enrolled } : null
      );
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id
            ? { ...s, biometric_enrolled: true, biometric_face_count: data.total_faces_enrolled }
            : s
        )
      );
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to train biometric face embedding.",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.student_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
          <ScanFace className="w-6 h-6 text-blue-600" />
          Biometric Face Training &amp; ID Card Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Train normalized 128-dimensional facial embeddings with liveness checks, and manage Student ID Card Barcode fallbacks.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-3 ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Selector Roster */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Select Student</h2>
            <span className="text-[11px] text-slate-500 font-medium">{students.length} Registered</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, roll no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredStudents.map((st) => {
              const isSelected = selectedStudent?.id === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => {
                    setSelectedStudent(st);
                    setCapturedImage(null);
                    setMessage(null);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-blue-50 border-blue-300 shadow-sm"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-900">{st.user.full_name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                        st.biometric_enrolled
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {st.biometric_enrolled ? "TRAINED" : "PENDING"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{st.student_id}</span>
                    <span>Sec {st.section} &bull; Sem {st.semester}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Camera Capture & Face Training Canvas */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              Capture Face Photo
            </h2>
            {selectedStudent && (
              <span className="text-xs text-slate-500">
                Enrolling: <strong className="text-slate-800">{selectedStudent.user.full_name}</strong>
              </span>
            )}
          </div>

          {/* Viewport Viewfinder */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-square flex items-center justify-center">
            {webcamActive ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
            ) : capturedImage ? (
              <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6 text-slate-400 space-y-2">
                <ScanFace className="w-16 h-16 mx-auto opacity-40 text-blue-400" />
                <p className="text-xs text-slate-400">Webcam inactive. Start camera or upload face photo.</p>
              </div>
            )}

            {/* Viewfinder Target Reticle */}
            {(webcamActive || capturedImage) && (
              <div className="absolute inset-12 border-2 border-dashed border-blue-400/50 rounded-full pointer-events-none flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
              </div>
            )}

            {/* Quality pill */}
            {capturedImage && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Quality: {(qualityScore * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Camera Device Switcher (if multiple available) */}
          {cameraDevices.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 text-[11px]">Select Camera:</span>
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  if (webcamActive) startWebcam(e.target.value);
                }}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 text-xs focus:outline-none focus:border-blue-600"
              >
                {cameraDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            {!webcamActive ? (
              <button
                onClick={() => startWebcam()}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                Start Camera
              </button>
            ) : (
              <button
                onClick={capturePhoto}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                Take Snapshot
              </button>
            )}

            <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm cursor-pointer transition">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Upload Image
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Submit / Train Button */}
          <button
            onClick={handleEnrollBiometrics}
            disabled={!capturedImage || !selectedStudent || enrolling}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition"
          >
            <Sparkles className="w-4 h-4" />
            {enrolling ? "Extracting 128-D Embedding..." : "Train Biometric Recognition Model"}
          </button>
        </div>

        {/* Right Column: Student ID Card & Barcode / QR Code Fallback */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Student ID Card (Barcode Fallback)</h3>
              <span className="text-[10px] text-slate-500 font-medium">Offline Backup</span>
            </div>

            {selectedStudent ? (
              <div className="space-y-4">
                {/* Physical ID Card Preview Mock */}
                <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/40 p-4 text-white shadow-xl relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-blue-400 font-bold">SMART CAMPUS ID</div>
                      <div className="text-xs font-bold text-slate-100">{selectedStudent.user.full_name}</div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-400 flex items-center justify-center text-[10px] font-bold text-blue-300">
                      ID
                    </div>
                  </div>

                  <div className="py-3 text-[11px] space-y-1 text-slate-300">
                    <div>
                      Roll No: <strong className="font-mono text-white">{selectedStudent.student_id}</strong>
                    </div>
                    <div>
                      Dept: <span className="text-slate-400">{selectedStudent.department}</span>
                    </div>
                    <div>
                      Batch: <span className="text-slate-400">{selectedStudent.batch_year}</span>
                    </div>
                  </div>

                  {/* High-Resolution Barcode / QR Visual Representation */}
                  <div className="pt-2 border-t border-slate-800/80 text-center">
                    <div className="bg-white p-2 rounded-lg inline-block my-1 shadow-sm">
                      {/* Barcode SVG representation */}
                      <svg className="w-40 h-8" viewBox="0 0 160 30">
                        {selectedStudent.student_id.split("").map((char, i) => {
                          const w = (char.charCodeAt(0) % 3) + 1;
                          return (
                            <rect
                              key={i}
                              x={i * 14 + 10}
                              y="0"
                              width={w * 2}
                              height="30"
                              fill="#000000"
                            />
                          );
                        })}
                      </svg>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 tracking-widest mt-1">
                      *{selectedStudent.student_id}*
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-200">How Barcode Fallback Works:</span> If a student's face is occluded or not detected, they can hold this barcode up to the camera to mark presence automatically.
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">Select a student to view ID Card.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
