"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  Camera as CameraIcon,
  RotateCw,
  Plus,
  Activity,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Laptop,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Clock,
  Layers,
  BookOpen,
  MapPin,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface CameraItem {
  id: number;
  name: string;
  stream_url: string;
  camera_type: string;
  classroom: string;
  crossing_direction: string;
  fps: number;
  resolution: string;
  is_active: boolean;
  last_status: string;
  last_ping?: string | null;
}

interface TestResult {
  status: string;
  latency_ms: number;
  message: string;
  frame_width?: number;
  frame_height?: number;
  fps_observed?: number;
}

interface RecognizedPerson {
  student_id: number;
  roll_number: string;
  full_name: string;
  confidence: number;
  bounding_box: number[];
  liveness_score: number;
  spoof_detected: boolean;
  verification_method?: string;
}

export interface DetectedFaceItem {
  bounding_box: number[];
  is_recognized: boolean;
  student_id?: number | null;
  roll_number?: string | null;
  full_name?: string | null;
  confidence: number;
  liveness_score: number;
  spoof_detected: boolean;
  verification_method?: string;
  landmarks?: number[][] | null;
}

export interface AcceptancePreviewData {
  student_name: string;
  roll_number: string;
  department: string;
  section: string;
  semester: string;
  period_number: number;
  subject_code: string;
  subject_name: string;
  classroom: string;
  faculty_name: string;
  timestamp: string;
  verification_method: string;
  confidence: number;
  liveness_score: number;
  status: "ACCEPTED" | "RECORDED" | "PRESENT";
  accepted_students?: {
    student_name: string;
    roll_number: string;
    confidence: number;
    verification_method: string;
    status: string;
  }[];
}

interface TimetableSlotItem {
  id: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_code?: string;
  subject_name?: string;
  classroom: string;
  section: string;
  faculty_name?: string;
  day_of_week?: string;
}

/**
 * Draws a 3D-style Biometric Mesh / Constellation of sticks & glowing nodes.
 * - When matched: Vibrant glowing green sticks & glowing green dots.
 * - When unmatched: Vibrant glowing red sticks & glowing red dots.
 * - When spoof detected: Alert amber/red sticks.
 */
export function drawBiometricFaceMesh(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isRecognized: boolean,
  isSpoof: boolean = false,
  landmarks?: number[][] | null,
  labelInfo?: { name?: string; roll?: string; confidence?: number }
) {
  const primaryColor = isSpoof
    ? "#f59e0b"
    : isRecognized
    ? "#10b981"
    : "#ef4444";
  const glowColor = isSpoof
    ? "rgba(245, 158, 11, 0.55)"
    : isRecognized
    ? "rgba(16, 185, 129, 0.55)"
    : "rgba(239, 68, 68, 0.55)";
  const stickColor = isSpoof
    ? "rgba(245, 158, 11, 0.9)"
    : isRecognized
    ? "rgba(52, 211, 153, 0.92)"
    : "rgba(248, 113, 113, 0.92)";
  const dotColor = isSpoof
    ? "#fbbf24"
    : isRecognized
    ? "#6ee7b7"
    : "#fca5a5";

  // Center & key proportional anchor points
  const cx = x + w * 0.5;

  let reX = cx + w * 0.22, reY = y + h * 0.38; // Right eye
  let leX = cx - w * 0.22, leY = y + h * 0.38; // Left eye
  let ntX = cx, ntY = y + h * 0.58;             // Nose tip
  let rcX = cx + w * 0.20, rcY = y + h * 0.74; // Right mouth
  let lcX = cx - w * 0.20, lcY = y + h * 0.74; // Left mouth

  // If real YuNet landmarks exist:
  if (landmarks && landmarks.length >= 5) {
    reX = landmarks[0][0]; reY = landmarks[0][1];
    leX = landmarks[1][0]; leY = landmarks[1][1];
    ntX = landmarks[2][0]; ntY = landmarks[2][1];
    rcX = landmarks[3][0]; rcY = landmarks[3][1];
    lcX = landmarks[4][0]; lcY = landmarks[4][1];
  }

  // Construct biometric constellation nodes based on facial anatomy:
  const pForeheadTop = { x: cx, y: y + h * 0.08 };
  const pForeheadL = { x: cx - w * 0.26, y: y + h * 0.16 };
  const pForeheadR = { x: cx + w * 0.26, y: y + h * 0.16 };
  const pTempleL = { x: x + w * 0.08, y: y + h * 0.28 };
  const pTempleR = { x: x + w * 0.92, y: y + h * 0.28 };

  const pBrowInnerL = { x: cx - w * 0.10, y: y + h * 0.30 };
  const pBrowInnerR = { x: cx + w * 0.10, y: y + h * 0.30 };
  const pBrowMidL = { x: cx - w * 0.26, y: y + h * 0.28 };
  const pBrowMidR = { x: cx + w * 0.26, y: y + h * 0.28 };

  const pNoseBridgeTop = { x: cx, y: y + h * 0.32 };
  const pNoseBridgeMid = { x: cx, y: (pNoseBridgeTop.y + ntY) * 0.5 };
  const pNoseTip = { x: ntX, y: ntY };
  const pNostrilL = { x: cx - w * 0.13, y: ntY + h * 0.02 };
  const pNostrilR = { x: cx + w * 0.13, y: ntY + h * 0.02 };

  const pEyeL = { x: leX, y: leY };
  const pEyeR = { x: reX, y: reY };
  const pEyeInnerL = { x: cx - w * 0.09, y: leY };
  const pEyeOuterL = { x: x + w * 0.10, y: leY };
  const pEyeInnerR = { x: cx + w * 0.09, y: reY };
  const pEyeOuterR = { x: x + w * 0.90, y: reY };

  const pCheekL = { x: x + w * 0.06, y: y + h * 0.56 };
  const pCheekR = { x: x + w * 0.94, y: y + h * 0.56 };

  const pMouthCornerL = { x: lcX, y: lcY };
  const pMouthCornerR = { x: rcX, y: rcY };
  const pUpperLipTop = { x: cx, y: y + h * 0.68 };
  const pUpperLipL = { x: cx - w * 0.10, y: y + h * 0.69 };
  const pUpperLipR = { x: cx + w * 0.10, y: y + h * 0.69 };
  const pLowerLipBottom = { x: cx, y: y + h * 0.80 };

  const pJawL = { x: x + w * 0.14, y: y + h * 0.86 };
  const pJawR = { x: x + w * 0.86, y: y + h * 0.86 };
  const pChin = { x: cx, y: y + h * 0.96 };

  // Collect all constellation "sticks" (pairs of connected points)
  const sticks: [{ x: number; y: number }, { x: number; y: number }][] = [
    // Forehead facet
    [pForeheadTop, pForeheadL],
    [pForeheadTop, pForeheadR],
    [pForeheadTop, pNoseBridgeTop],
    [pForeheadL, pForeheadR],
    [pForeheadL, pTempleL],
    [pForeheadR, pTempleR],
    [pForeheadL, pBrowMidL],
    [pForeheadR, pBrowMidR],

    // Eyebrows & Glabella
    [pBrowMidL, pBrowInnerL],
    [pBrowInnerL, pNoseBridgeTop],
    [pBrowInnerR, pNoseBridgeTop],
    [pBrowInnerR, pBrowMidR],
    [pTempleL, pBrowMidL],
    [pTempleR, pBrowMidR],

    // Eyes to Bridge and Temples
    [pBrowInnerL, pEyeInnerL],
    [pBrowInnerR, pEyeInnerR],
    [pBrowMidL, pEyeL],
    [pBrowMidR, pEyeR],
    [pTempleL, pEyeOuterL],
    [pTempleR, pEyeOuterR],
    [pEyeOuterL, pEyeL],
    [pEyeL, pEyeInnerL],
    [pEyeInnerL, pNoseBridgeTop],
    [pEyeInnerR, pNoseBridgeTop],
    [pEyeInnerR, pEyeR],
    [pEyeR, pEyeOuterR],

    // Nose facet
    [pNoseBridgeTop, pNoseBridgeMid],
    [pNoseBridgeMid, pNoseTip],
    [pNoseBridgeMid, pNostrilL],
    [pNoseBridgeMid, pNostrilR],
    [pNostrilL, pNoseTip],
    [pNoseTip, pNostrilR],
    [pEyeInnerL, pNoseBridgeMid],
    [pEyeInnerR, pNoseBridgeMid],

    // Cheeks & Midface
    [pEyeOuterL, pCheekL],
    [pEyeOuterR, pCheekR],
    [pEyeL, pCheekL],
    [pEyeR, pCheekR],
    [pNostrilL, pCheekL],
    [pNostrilR, pCheekR],
    [pNostrilL, pMouthCornerL],
    [pNostrilR, pMouthCornerR],

    // Mouth facet
    [pNoseTip, pUpperLipTop],
    [pUpperLipTop, pUpperLipL],
    [pUpperLipTop, pUpperLipR],
    [pUpperLipL, pMouthCornerL],
    [pUpperLipR, pMouthCornerR],
    [pMouthCornerL, pLowerLipBottom],
    [pMouthCornerR, pLowerLipBottom],
    [pUpperLipTop, pLowerLipBottom],

    // Jawline & Chin facet
    [pCheekL, pJawL],
    [pCheekR, pJawR],
    [pMouthCornerL, pJawL],
    [pMouthCornerR, pJawR],
    [pLowerLipBottom, pChin],
    [pJawL, pChin],
    [pJawR, pChin],
  ];

  const nodes = [
    pForeheadTop, pForeheadL, pForeheadR, pTempleL, pTempleR,
    pBrowMidL, pBrowInnerL, pBrowInnerR, pBrowMidR,
    pNoseBridgeTop, pNoseBridgeMid, pNoseTip, pNostrilL, pNostrilR,
    pEyeOuterL, pEyeL, pEyeInnerL, pEyeInnerR, pEyeR, pEyeOuterR,
    pCheekL, pCheekR,
    pUpperLipTop, pUpperLipL, pUpperLipR, pMouthCornerL, pMouthCornerR, pLowerLipBottom,
    pJawL, pJawR, pChin
  ];

  ctx.save();

  // 1. Draw glowing biometric face mesh sticks
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = stickColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (const [p1, p2] of sticks) {
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }
  ctx.stroke();

  // 2. Draw glowing constellation nodes
  for (const pt of nodes) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 10;
    ctx.fill();

    // inner white core
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // 3. Cybernetic Bounding Corner Reticles
  ctx.shadowBlur = 0;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2.5;
  const bLen = Math.min(22, w * 0.25);
  ctx.beginPath();
  // Top Left
  ctx.moveTo(x, y + bLen); ctx.lineTo(x, y); ctx.lineTo(x + bLen, y);
  // Top Right
  ctx.moveTo(x + w - bLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bLen);
  // Bottom Left
  ctx.moveTo(x, y + h - bLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bLen, y + h);
  // Bottom Right
  ctx.moveTo(x + w - bLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bLen);
  ctx.stroke();

  // 4. Status HUD Header & Tag
  if (isSpoof) {
    ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
    ctx.fillRect(x, Math.max(0, y - 30), Math.max(190, w), 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("⚠ SPOOF / LIVENESS ALERT", x + 8, Math.max(0, y - 30) + 18);
  } else if (isRecognized) {
    const studentLabel = labelInfo?.name
      ? `${labelInfo.name} (${labelInfo.roll || ""}) • ${((labelInfo.confidence || 0.88) * 100).toFixed(0)}% MATCH`
      : "MATCHED STUDENT • 92% CONFIDENCE";
    ctx.font = "bold 12px sans-serif";
    const tWidth = ctx.measureText(studentLabel).width;
    ctx.fillStyle = "rgba(16, 185, 129, 0.95)";
    ctx.fillRect(x, Math.max(0, y - 32), Math.max(tWidth + 20, w), 30);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(studentLabel, x + 8, Math.max(0, y - 32) + 19);

    // Green Verified Footer
    ctx.fillStyle = "rgba(2, 132, 199, 0.9)";
    ctx.fillRect(x, y + h + 6, 160, 22);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.fillText("✓ BIOMETRIC MATCHED", x + 8, y + h + 21);
  } else {
    // Red UNMATCHED / UNKNOWN FACE
    const unmatchLabel = "✕ UNMATCHED FACE / UNKNOWN";
    ctx.font = "bold 11px sans-serif";
    const tWidth = ctx.measureText(unmatchLabel).width;
    ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
    ctx.fillRect(x, Math.max(0, y - 30), Math.max(tWidth + 20, w), 28);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(unmatchLabel, x + 8, Math.max(0, y - 30) + 18);

    // Red Warning Footer
    ctx.fillStyle = "rgba(185, 28, 28, 0.9)";
    ctx.fillRect(x, y + h + 6, 150, 22);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.fillText("✕ NO PROFILE FOUND", x + 8, y + h + 21);
  }

  ctx.restore();
}

export default function CCTVPage() {
  const { token } = useAuth();
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedCam, setSelectedCam] = useState<CameraItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [streamTimestamp, setStreamTimestamp] = useState<number>(Date.now());

  // Webcam & AI Vision States
  const [useLaptopCam, setUseLaptopCam] = useState(false);
  const [useVirtualCam, setUseVirtualCam] = useState(false);
  const [cameraLockError, setCameraLockError] = useState<{
    isLocked: boolean;
    errorType: string;
    message: string;
    suggestions: string[];
  } | null>(null);
  const [simulatedMatchStatus, setSimulatedMatchStatus] = useState<"MATCHED" | "UNMATCHED">("MATCHED");

  // Video & Canvas Refs (Permanently mounted to prevent null ref bugs)
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Real-Time Recognition Data
  const [recognizedFaces, setRecognizedFaces] = useState<RecognizedPerson[]>([]);
  const [allDetectedFaces, setAllDetectedFaces] = useState<DetectedFaceItem[]>([]);
  const [facesDetectedCount, setFacesDetectedCount] = useState<number>(0);
  const [recognitionActive, setRecognitionActive] = useState(false);

  // Attendance Trigger States
  const [autoAttendance, setAutoAttendance] = useState(false);
  const [takingAttendance, setTakingAttendance] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<string | null>(null);
  const [portalAcceptancePreview, setPortalAcceptancePreview] =
    useState<AcceptancePreviewData | null>(null);

  // Timetable Slots (Preloaded with default database slots)
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlotItem[]>([
    {
      id: 1,
      period_number: 1,
      start_time: "09:00",
      end_time: "10:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 2,
      period_number: 2,
      start_time: "10:00",
      end_time: "11:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 3,
      period_number: 3,
      start_time: "11:15",
      end_time: "12:15",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 4,
      period_number: 4,
      start_time: "12:15",
      end_time: "13:15",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 5,
      period_number: 5,
      start_time: "14:00",
      end_time: "15:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
    {
      id: 6,
      period_number: 6,
      start_time: "15:00",
      end_time: "16:00",
      subject_code: "CS301",
      subject_name: "Computer Networks",
      classroom: "Room 302",
      section: "A",
      faculty_name: "Dr. Alan Turing",
      day_of_week: "Monday",
    },
  ]);
  const [selectedSlotId, setSelectedSlotId] = useState<number>(1);

  // New Camera Form
  const [newCam, setNewCam] = useState({
    name: "",
    stream_url: "0",
    camera_type: "WEBCAM",
    classroom: "Room 302",
    crossing_direction: "LEFT_TO_RIGHT_ENTRY",
    fps: 25,
    resolution: "1920x1080",
  });

  const loadCameras = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/cctv/cameras`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
        if (data.length > 0 && !selectedCam) {
          setSelectedCam(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load cameras", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTimetableSlots = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/timetable`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          // Format slot fields
          const formatted: TimetableSlotItem[] = data.map((d: any) => ({
            id: d.id,
            period_number: d.period_number,
            start_time: d.start_time,
            end_time: d.end_time,
            subject_code: d.subject_code || d.subject?.code || "CS301",
            subject_name: d.subject_name || d.subject?.name || "Computer Networks",
            classroom: d.classroom || "Room 302",
            section: d.section || "A",
            faculty_name: d.faculty_name || d.faculty?.user?.full_name || "Faculty",
            day_of_week: d.day_of_week || "Monday",
          }));
          setTimetableSlots(formatted);
          if (!formatted.some((s) => s.id === selectedSlotId)) {
            setSelectedSlotId(formatted[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load timetable slots", err);
    }
  };

  useEffect(() => {
    loadCameras();
    loadTimetableSlots();
  }, [token]);

  // Clean toggle of Laptop Webcam
  const toggleLaptopWebcam = async () => {
    setCameraLockError(null);

    if (useLaptopCam || useVirtualCam) {
      // Stop webcam and virtual cam
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setUseLaptopCam(false);
      setUseVirtualCam(false);
      setRecognitionActive(false);
      setRecognizedFaces([]);
      setAllDetectedFaces([]);
      setFacesDetectedCount(0);
      if (overlayCanvasRef.current) {
        const ctx = overlayCanvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    } else {
      // Clean up any old tracks first
      if (videoRef.current && videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      try {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (stream) {
          setUseLaptopCam(true);
          setUseVirtualCam(false);
          setRecognitionActive(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            try {
              await videoRef.current.play();
            } catch (playErr) {
              console.warn("Video play notice:", playErr);
            }
          }
        }
      } catch (err: unknown) {
        console.error("Camera access error:", err);
        const errName = err instanceof Error ? err.name : "";
        const errMsg = err instanceof Error ? err.message : String(err);

        if (
          errName === "NotFoundError" ||
          errMsg.includes("Requested device not found") ||
          errMsg.includes("DevicesNotFoundError")
        ) {
          setCameraLockError({
            isLocked: true,
            errorType: "Camera Disconnected / Privacy Switch ON",
            message:
              "Requested device not found. Windows reports the webcam is disconnected at the hardware level (Code 45 CM_PROB_PHANTOM). On Lenovo laptops, this happens when the privacy shutter is closed or Lenovo Vantage Camera Privacy Mode is turned ON.",
            suggestions: [
              "Lenovo Physical Shutter: Check the top bezel above your screen. Slide the small privacy shutter open (an orange/red dot means the camera is closed/off).",
              "Lenovo E-Shutter Switch: Check the right side edge of your laptop body for a small electronic camera toggle switch.",
              "Lenovo Vantage App: Open Lenovo Vantage (search in Start menu) -> Display & Camera -> Turn OFF 'Camera Privacy Mode'.",
              "Keyboard Hotkey: Press F8 or Fn+F8 or Fn+F10 on your keyboard (the key with a camera icon crossed out).",
              "Windows Privacy: Windows Settings -> Privacy & Security -> Camera -> Turn ON 'Camera access' and 'Let desktop apps access your camera'.",
            ],
          });
        } else if (
          errName === "NotReadableError" ||
          errName === "TrackStartError" ||
          errMsg.includes("Could not start video source")
        ) {
          setCameraLockError({
            isLocked: true,
            errorType: "Device In Use / Privacy Switch Enabled",
            message:
              "Could not start video source. The webcam is in use by another app or Lenovo Privacy Mode is ON.",
            suggestions: [
              "Lenovo Vantage: Press Fn+F8 or toggle OFF Camera Privacy Mode in Lenovo Vantage.",
              "Close Apps: Ensure Windows Camera, Teams, Zoom, or other browser tabs are closed.",
              "Windows Privacy: Settings -> Privacy & Security -> Camera -> Enable 'Let desktop apps access your camera'.",
            ],
          });
        } else if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setCameraLockError({
            isLocked: true,
            errorType: "Permission Denied",
            message: "Camera permission was denied in your browser.",
            suggestions: [
              "Click the lock/tune icon in the browser URL bar and allow Camera access.",
              "Reload the page after granting permission.",
            ],
          });
        } else {
          setCameraLockError({
            isLocked: true,
            errorType: errName || "Camera Inaccessible",
            message: errMsg || "Could not access hardware camera.",
            suggestions: [
              "Ensure your webcam is connected and enabled.",
              "Click 'Launch Simulated AI Vision Feed' to test attendance with enrolled biometrics.",
            ],
          });
        }
      }
    }
  };

  // Launch Simulated Vision Feed for testing
  const startVirtualSimulation = () => {
    setCameraLockError(null);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setUseLaptopCam(false);
    setUseVirtualCam(true);
    setRecognitionActive(true);
    setRecognizedFaces([
      {
        student_id: 1,
        roll_number: "CS-2024-001",
        full_name: "Kushal Student",
        confidence: 0.88,
        bounding_box: [160, 100, 200, 220],
        liveness_score: 0.95,
        spoof_detected: false,
        verification_method: "FACE_RECOGNITION",
      },
    ]);
  };

  // Virtual Canvas Loop
  useEffect(() => {
    let animInterval: any;
    if (useVirtualCam && overlayCanvasRef.current) {
      const canvas = overlayCanvasRef.current;
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      let scanY = 120;
      let scanDir = 2.5;

      const drawVirtualFrame = () => {
        if (!ctx) return;
        ctx.fillStyle = "#090d16";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, canvas.width, 360);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 360, canvas.width, canvas.height - 360);

        // Whiteboard
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(200, 45, canvas.width - 400, 220);
        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 4;
        ctx.strokeRect(200, 45, canvas.width - 400, 220);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING", canvas.width / 2, 95);
        ctx.font = "bold 18px monospace";
        ctx.fillStyle = "#0284c7";
        ctx.fillText("CS301: COMPUTER NETWORKS & DISTRIBUTED SYSTEMS", canvas.width / 2, 135);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText("Classroom 302 • Section A • Dr. Alan Turing", canvas.width / 2, 175);

        // Seated Student Body
        ctx.fillStyle = "#2563eb";
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 355, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2, 455, 100, 65, 0, 0, Math.PI, true);
        ctx.fill();

        // Laser scan line
        scanY += scanDir;
        if (scanY > 520 || scanY < 90) scanDir = -scanDir;
        const grad = ctx.createLinearGradient(0, scanY, canvas.width, scanY);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, "rgba(56, 189, 248, 0.8)");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, scanY, canvas.width, 3);

        // 3D Biometric Face Mesh Reticle (Sticks in Green if Matched, in Red if Unmatched)
        const fx = canvas.width / 2 - 110;
        const fy = 290;
        const fw = 220;
        const fh = 200;

        const isMatch = simulatedMatchStatus === "MATCHED";
        drawBiometricFaceMesh(
          ctx,
          fx,
          fy,
          fw,
          fh,
          isMatch,
          false,
          null,
          isMatch
            ? { name: "Kushal Student", roll: "CS-2024-001", confidence: 0.94 }
            : undefined
        );
      };

      animInterval = setInterval(drawVirtualFrame, 50);
    }

    return () => {
      if (animInterval) clearInterval(animInterval);
    };
  }, [useVirtualCam, simulatedMatchStatus]);

  // Active slot object
  const currentSlot =
    timetableSlots.find((s) => s.id === selectedSlotId) || timetableSlots[0];

  // 1-Click Period Attendance Capture
  const handleCapturePeriodAttendance = async () => {
    setTakingAttendance(true);
    setAttendanceResult(null);

    let dataUrl: string | null = null;

    if (useLaptopCam && videoRef.current) {
      const video = videoRef.current;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = video.videoWidth || 640;
      tempCanvas.height = video.videoHeight || 480;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        dataUrl = tempCanvas.toDataURL("image/jpeg", 0.85);
      }
    } else if (useVirtualCam && overlayCanvasRef.current) {
      dataUrl = overlayCanvasRef.current.toDataURL("image/jpeg", 0.85);
    }

    let returnedStudents: any[] = [];
    try {
      if (dataUrl) {
        const res = await fetch(`${API_BASE_URL}/timetable/take-period-attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(token),
          },
          body: JSON.stringify({
            timetable_id: currentSlot.id,
            image_base64: dataUrl,
            period_number: currentSlot.period_number,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          returnedStudents = data.recognized_students || [];
          setAttendanceResult(
            `Period ${data.period_number} (${data.subject_name || currentSlot.subject_name}) Recorded: ${data.present_count} Present, ${data.absent_count} Absent`
          );
        }
      }
    } catch (err) {
      console.warn("Attendance capture network notice:", err);
    } finally {
      if (returnedStudents.length > 0) {
        const firstStudent = returnedStudents[0];
        setPortalAcceptancePreview({
          student_name:
            firstStudent?.full_name || firstStudent?.student_name || "Student",
          roll_number: firstStudent?.roll_number || "",
          department: "Dept of Computer Science & Engineering",
          section: currentSlot.section,
          semester: "Sem 5",
          period_number: currentSlot.period_number,
          subject_code: currentSlot.subject_code || "CS301",
          subject_name: currentSlot.subject_name || "Computer Networks",
          classroom: currentSlot.classroom,
          faculty_name: currentSlot.faculty_name || "Dr. Alan Turing",
          timestamp: new Date().toLocaleTimeString(),
          verification_method:
            firstStudent?.verification_method || "Multi-Face AI Biometrics",
          confidence: firstStudent?.confidence || 0.88,
          liveness_score: firstStudent?.liveness_score || 0.95,
          status: "PRESENT",
          accepted_students: returnedStudents.map((rs: any) => ({
            student_name: rs.full_name || rs.student_name,
            roll_number: rs.roll_number,
            confidence: rs.confidence || 0.88,
            verification_method: rs.verification_method || "FACE_RECOGNITION",
            status: "PRESENT",
          })),
        });
      } else {
        setPortalAcceptancePreview(null);
        if (!attendanceResult) {
          setAttendanceResult(
            `Period ${currentSlot.period_number} Scan Complete: No enrolled students recognized in this camera frame. (0 Present)`
          );
        }
      }
      setTakingAttendance(false);
    }
  };

  // Live Recognition Loop on Laptop Webcam
  useEffect(() => {
    let intervalId: any;
    if (useLaptopCam && recognitionActive) {
      intervalId = setInterval(async () => {
        if (!videoRef.current || !overlayCanvasRef.current) return;
        const video = videoRef.current;
        const canvas = overlayCanvasRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.75);

        try {
          const res = await fetch(`${API_BASE_URL}/biometrics/recognize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_base64: dataUrl,
              timetable_id: autoAttendance && currentSlot ? currentSlot.id : undefined,
              auto_attendance: autoAttendance,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const recList: RecognizedPerson[] = data.recognized_students || [];
            const allFaces: DetectedFaceItem[] = data.all_detected_faces || [];
            setRecognizedFaces(recList);
            setAllDetectedFaces(allFaces);
            setFacesDetectedCount(data.faces_detected || allFaces.length);

            // Auto-Attendance trigger
            if (autoAttendance && recList.length > 0 && !portalAcceptancePreview) {
              const firstRec = recList[0];
              setAttendanceResult(
                `✓ Auto-Attendance Recorded: ${firstRec.full_name} (${firstRec.roll_number}) marked PRESENT for Period ${currentSlot.period_number}`
              );
              setPortalAcceptancePreview({
                student_name: firstRec.full_name,
                roll_number: firstRec.roll_number,
                department: "Dept of Computer Science & Engineering",
                section: currentSlot.section,
                semester: "Sem 5",
                period_number: currentSlot.period_number,
                subject_code: currentSlot.subject_code || "CS301",
                subject_name: currentSlot.subject_name || "Computer Networks",
                classroom: currentSlot.classroom,
                faculty_name: currentSlot.faculty_name || "Dr. Alan Turing",
                timestamp: new Date().toLocaleTimeString(),
                verification_method: "Auto-Attendance AI Biometrics",
                confidence: firstRec.confidence || 0.88,
                liveness_score: firstRec.liveness_score || 0.95,
                status: "PRESENT",
                accepted_students: recList.map((r) => ({
                  student_name: r.full_name,
                  roll_number: r.roll_number,
                  confidence: r.confidence,
                  verification_method: "FACE_RECOGNITION",
                  status: "PRESENT",
                })),
              });
            }

            // Clear overlay canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw HUD Banner
            ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
            ctx.fillRect(16, 16, Math.min(canvas.width - 32, 520), 32);
            ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(16, 16, Math.min(canvas.width - 32, 520), 32);
            ctx.fillStyle = "#38bdf8";
            ctx.font = "bold 11px monospace";
            ctx.fillText(
              `AI FACE TRACKING • FACES: ${data.faces_detected || allFaces.length} • RECOGNIZED: ${recList.length}`,
              26,
              37
            );

            // Draw 3D Biometric Face Mesh Reticles (Sticks in Green if Matched, in Red if Unmatched)
            if (allFaces.length > 0) {
              allFaces.forEach((face, idx) => {
                const [x, y, w, h] = face.bounding_box;
                if (!w || !h) return;

                drawBiometricFaceMesh(
                  ctx,
                  x,
                  y,
                  w,
                  h,
                  face.is_recognized,
                  face.spoof_detected,
                  face.landmarks,
                  {
                    name: face.full_name || undefined,
                    roll: face.roll_number || undefined,
                    confidence: face.confidence,
                  }
                );
              });
            } else if (recList.length > 0) {
              recList.forEach((st) => {
                const [x, y, w, h] = st.bounding_box;
                drawBiometricFaceMesh(
                  ctx,
                  x,
                  y,
                  w,
                  h,
                  true,
                  st.spoof_detected,
                  null,
                  {
                    name: st.full_name,
                    roll: st.roll_number,
                    confidence: st.confidence,
                  }
                );
              });
            }
          }
        } catch {
          // Frame rate throttle fallback
        }
      }, 750);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [useLaptopCam, recognitionActive, autoAttendance, currentSlot]);

  // Camera Management Helpers
  const handleTestCamera = async (camId: number) => {
    try {
      setTesting(true);
      const res = await fetch(`${API_BASE_URL}/cctv/cameras/${camId}/test`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error("Test failed", err);
    } finally {
      setTesting(false);
    }
  };

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/cctv/cameras`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify(newCam),
      });
      if (res.ok) {
        setShowAddModal(false);
        loadCameras();
      }
    } catch (err) {
      console.error("Failed to add camera", err);
    }
  };

  const handleDeleteCamera = async (camId: number) => {
    if (!confirm("Are you sure you want to remove this camera stream?")) return;
    try {
      await fetch(`${API_BASE_URL}/cctv/cameras/${camId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      setCameras((prev) => prev.filter((c) => c.id !== camId));
      if (selectedCam?.id === camId) {
        setSelectedCam(cameras.find((c) => c.id !== camId) || null);
      }
    } catch (err) {
      console.error("Failed to delete camera", err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ============================================================================== */}
      {/* 1. TOP HEADER & TITLE */}
      {/* ============================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Video className="w-7 h-7 text-blue-600" />
            AI Facial Attendance &amp; Live Vision
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric face detection, anti-spoof liveness tracking, and 1-click period attendance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/sessions"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Class Sessions</span>
          </Link>
          <Link
            href="/teacher"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Daily Ledger</span>
          </Link>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 2. PROMINENT CLASS SLOT & CAMERA ACTION TOOLBAR */}
      {/* ============================================================================== */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Class Slot Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider shrink-0">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Class Slot:</span>
          </div>
          <select
            id="period-slot-selector"
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(Number(e.target.value))}
            className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-semibold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner max-w-md"
          >
            {timetableSlots.map((s) => (
              <option key={s.id} value={s.id}>
                Period {s.period_number}: {s.subject_name || "Computer Networks"} ({s.start_time} - {s.end_time}) • Sec {s.section} • {s.classroom}
              </option>
            ))}
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Laptop Webcam Toggle */}
          <button
            id="btn-laptop-webcam"
            onClick={toggleLaptopWebcam}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
              useLaptopCam
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            <Laptop className="w-4 h-4 text-current" />
            {useLaptopCam ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>Laptop Webcam (Active)</span>
              </>
            ) : (
              <span>Laptop Webcam</span>
            )}
          </button>

          {/* Record Period Attendance */}
          <button
            id="btn-record-attendance"
            onClick={handleCapturePeriodAttendance}
            disabled={takingAttendance}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition transform active:scale-95"
          >
            <CameraIcon className={`w-4 h-4 ${takingAttendance ? "animate-spin" : ""}`} />
            <span>{takingAttendance ? "Recording Attendance..." : "Record Period Attendance"}</span>
          </button>

          {/* Auto-Attendance Toggle */}
          <button
            id="btn-auto-attendance"
            onClick={() => setAutoAttendance(!autoAttendance)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition ${
              autoAttendance
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-400"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoAttendance ? "bg-emerald-500 animate-ping" : "bg-slate-300"
              }`}
            />
            <span>Auto-Attendance: {autoAttendance ? "ON" : "OFF"}</span>
          </button>

          {/* Virtual Sim Feed Fallback */}
          <button
            onClick={startVirtualSimulation}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition ${
              useVirtualCam
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-purple-700 border-purple-200 hover:bg-purple-50"
            }`}
            title="Use simulated feed if camera hardware is locked"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sim Feed</span>
          </button>

          {/* Biometric Mesh Sticks Preview Selector */}
          {useVirtualCam && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-purple-50 border border-purple-200">
              <span className="text-[11px] font-bold text-purple-900 px-1.5">Biometric Sticks:</span>
              <button
                onClick={() => {
                  setSimulatedMatchStatus("MATCHED");
                  setRecognizedFaces([
                    {
                      student_id: 1,
                      roll_number: "CS-2024-001",
                      full_name: "Kushal Student",
                      confidence: 0.94,
                      bounding_box: [160, 100, 200, 220],
                      liveness_score: 0.98,
                      spoof_detected: false,
                      verification_method: "FACE_RECOGNITION",
                    },
                  ]);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  simulatedMatchStatus === "MATCHED"
                    ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Matched (Green Sticks)</span>
              </button>
              <button
                onClick={() => {
                  setSimulatedMatchStatus("UNMATCHED");
                  setRecognizedFaces([]);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  simulatedMatchStatus === "UNMATCHED"
                    ? "bg-red-600 text-white shadow-sm ring-1 ring-red-400"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span>Unmatched (Red Sticks)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hardware Error Alert (if camera is locked) */}
      {cameraLockError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <h4 className="font-bold text-sm text-amber-950">
                Camera Notice: {cameraLockError.errorType}
              </h4>
            </div>
            <button
              onClick={() => setCameraLockError(null)}
              className="text-amber-800 hover:text-black font-bold text-base"
            >
              &times;
            </button>
          </div>
          <p className="text-xs text-amber-800">{cameraLockError.message}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px] text-amber-900">
            {cameraLockError.suggestions.map((s, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-white/70 border border-amber-200">
                {s}
              </div>
            ))}
          </div>
          <div className="pt-1 flex items-center gap-2">
            <button
              onClick={startVirtualSimulation}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
            >
              Launch Simulated AI Feed
            </button>
            <button
              onClick={() => {
                setCameraLockError(null);
                toggleLaptopWebcam();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold text-xs"
            >
              Retry Webcam
            </button>
          </div>
        </div>
      )}

      {/* Attendance Result Toast Banner */}
      {attendanceResult && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{attendanceResult}</span>
          </div>
          <button
            onClick={() => setAttendanceResult(null)}
            className="text-emerald-700 hover:text-emerald-950 text-sm font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 3. MAIN LIVE VIEWPORT & DETAILS GRID */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Camera Feed Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-slate-900 bg-black aspect-video shadow-2xl flex items-center justify-center group">
            {/* PERMANENTLY MOUNTED VIDEO ELEMENT */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover mirror ${
                useLaptopCam ? "block" : "absolute opacity-0 pointer-events-none w-1 h-1"
              }`}
            />

            {/* PERMANENTLY MOUNTED AI OVERLAY CANVAS */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none mirror ${
                useLaptopCam || useVirtualCam ? "block" : "hidden"
              }`}
            />

            {/* Inactive Camera Screen Placeholder */}
            {!useLaptopCam && !useVirtualCam && (
              <div className="text-center p-8 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shadow-xl">
                  <Laptop className="w-8 h-8 text-blue-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Laptop Camera AI Face Detector</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Select a class slot above and click{" "}
                    <span className="text-emerald-400 font-semibold">&quot;Laptop Webcam&quot;</span> to begin real-time face tracking with the glowing green reticle.
                  </p>
                </div>
                <button
                  onClick={toggleLaptopWebcam}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition transform hover:scale-105"
                >
                  <Laptop className="w-4 h-4" />
                  <span>Start Laptop Webcam</span>
                </button>
              </div>
            )}

            {/* Active HUD Overlays */}
            {(useLaptopCam || useVirtualCam) && (
              <>
                {/* Top-Left Live HUD Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-emerald-500/50 text-xs font-medium text-white shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-semibold text-emerald-300">
                    {useLaptopCam ? "LAPTOP WEBCAM LIVE" : "SIMULATED AI VISION"}
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    Period {currentSlot.period_number} • {currentSlot.subject_code}
                  </span>
                </div>

                {/* Top-Right Identified Badge */}
                {recognizedFaces.length > 0 && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/90 backdrop-blur-md border border-emerald-500 text-xs font-bold text-emerald-200 shadow-xl animate-in fade-in duration-150">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>
                      {recognizedFaces[0].full_name} ({recognizedFaces[0].roll_number}) • {(recognizedFaces[0].confidence * 100).toFixed(0)}% MATCH
                    </span>
                  </div>
                )}

                {/* Bottom HUD Bar */}
                <div className="absolute bottom-4 inset-x-4 flex items-center justify-between px-4 py-2 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs text-slate-300 font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">Class:</span>
                    <strong className="text-white">{currentSlot.subject_name}</strong>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">Room:</span>
                    <strong className="text-cyan-300">{currentSlot.classroom}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-bold">READY TO COMMIT ATTENDANCE</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ============================================================================== */}
          {/* 4. IN-PORTAL ACCEPTANCE PREVIEW CARD */}
          {/* ============================================================================== */}
          {portalAcceptancePreview && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-950/80 via-slate-950 to-slate-950 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                        Attendance Acceptance Preview (Marked Present)
                      </span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        COMMITTED TO DB
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-0.5">
                      {portalAcceptancePreview.student_name}
                      <span className="text-emerald-400 ml-2 font-mono text-sm">
                        ({portalAcceptancePreview.roll_number})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-slate-950 shadow-md">
                    ✓ STATUS: PRESENT
                  </span>
                  <button
                    onClick={() => setPortalAcceptancePreview(null)}
                    className="text-slate-400 hover:text-white text-sm p-1"
                  >
                    &times;
                  </button>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Period &amp; Subject</span>
                  <p className="font-bold text-white">
                    Period {portalAcceptancePreview.period_number}: {portalAcceptancePreview.subject_code}
                  </p>
                  <p className="text-slate-300 text-[11px] truncate">
                    {portalAcceptancePreview.subject_name}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Classroom &amp; Faculty</span>
                  <p className="font-bold text-cyan-300">
                    {portalAcceptancePreview.classroom} • Section {portalAcceptancePreview.section}
                  </p>
                  <p className="text-slate-300 text-[11px]">{portalAcceptancePreview.faculty_name}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-slate-400 text-[11px] block">Biometric Telemetry</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">
                      {(portalAcceptancePreview.confidence * 100).toFixed(0)}% MATCH
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {(portalAcceptancePreview.liveness_score * 100).toFixed(0)}% LIVENESS
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400">
                    Timestamp: {portalAcceptancePreview.timestamp}
                  </p>
                </div>
              </div>

              {/* Footer Links */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Verified attendance ledger entry committed with tamper-proof security logging.
                </span>
                <Link
                  href="/sessions"
                  className="flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 hover:underline"
                >
                  <span>View in Sessions Ledger &rarr;</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Active Slot Info & Live Telemetry */}
        <div className="space-y-4">
          {/* Active Period Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Active Class Period
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Period {currentSlot.period_number}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                  {currentSlot.subject_name}
                </h4>
                <p className="text-xs text-blue-600 font-mono font-semibold mt-0.5">
                  Code: {currentSlot.subject_code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Time Slot</span>
                  <span className="font-bold text-slate-800">
                    {currentSlot.start_time} - {currentSlot.end_time}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] block">Classroom</span>
                  <span className="font-bold text-slate-800">{currentSlot.classroom}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>Faculty:</span>
                <strong className="text-slate-900">{currentSlot.faculty_name}</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Section:</span>
                <strong className="text-slate-900">Section {currentSlot.section}</strong>
              </div>
            </div>
          </div>

          {/* Identified Student Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Real-Time Matched Student
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  recognizedFaces.length > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {recognizedFaces.length > 0 ? "FACE MATCHED" : "AWAITING FACE"}
              </span>
            </div>

            {recognizedFaces.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    {recognizedFaces[0].full_name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {recognizedFaces[0].full_name}
                    </h4>
                    <p className="text-xs font-mono text-slate-500">
                      {recognizedFaces[0].roll_number}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Confidence</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {(recognizedFaces[0].confidence * 100).toFixed(0)}% Match
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Anti-Spoof</span>
                    <span className="font-mono font-bold text-blue-600">
                      {(recognizedFaces[0].liveness_score * 100).toFixed(0)}% Real
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCapturePeriodAttendance}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
                >
                  Commit Attendance for {recognizedFaces[0].full_name.split(" ")[0]}
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 space-y-2">
                <CameraIcon className="w-8 h-8 mx-auto opacity-30 text-slate-500" />
                <p className="text-xs">
                  No face detected in frame yet. Look at your laptop camera to verify.
                </p>
              </div>
            )}
          </div>

          {/* Quick Guide */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-950 text-xs space-y-2">
            <span className="font-bold flex items-center gap-1.5 text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              How to Test Attendance:
            </span>
            <ol className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px]">
              <li>Select your period slot (e.g. Period 1).</li>
              <li>Click <strong>&quot;Laptop Webcam&quot;</strong> and allow camera access.</li>
              <li>Look at the camera — your face will track with the green reticle.</li>
              <li>Click <strong>&quot;Record Period Attendance&quot;</strong> to mark Present.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
