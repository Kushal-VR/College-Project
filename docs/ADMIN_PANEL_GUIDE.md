# Smart AI-Based CCTV Attendance Ledger — Complete Admin Panel Reference Manual

This comprehensive documentation covers **every section of the Admin Panel** accessible via the sidebar navigation. It details every button, chart, gauge, table, modal, and how each component is linked to backend APIs and the database.

---

## Table of Contents
1. [Sidebar Navigation Architecture](#1-sidebar-navigation-architecture)
2. [Section 1: Dashboard (`/dashboard`)](#section-1-dashboard-dashboard)
3. [Section 2: Live CCTV Feeds (`/cctv`)](#section-2-live-cctv-feeds-cctv)
4. [Section 3: Timetable & Classes (`/timetable`)](#section-3-timetable--classes-timetable)
5. [Section 4: Attendance Ledger (`/sessions`)](#section-4-attendance-ledger-sessions)
6. [Section 5: Teacher Daily Matrix (`/teacher`)](#section-5-teacher-daily-matrix-teacher)
7. [Section 6: Face Biometrics & ID Enrollment (`/enrollment`)](#section-6-face-biometrics--id-enrollment-enrollment)
8. [Section 7: Student Directory (`/students`)](#section-7-student-directory-students)
9. [Section 8: Faculty Staff Directory (`/faculty`)](#section-8-faculty-staff-directory-faculty)
10. [Section 9: Subject Catalog (`/subjects`)](#section-9-subject-catalog-subjects)

---

## 1. Sidebar Navigation Architecture

The sidebar (`Sidebar.tsx`) provides persistent navigation across all administrative interfaces:

| Sidebar Item | URL Route | Core Functionality | Badge / Counter |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `/dashboard` | System overview, health metrics, attendance rate, charts, and quick-actions | Active indicator |
| **Live CCTV Feeds** | `/cctv` | Multi-stream RTSP/USB/Laptop camera monitor, live AI face recognition, period attendance capture | `3` (Cameras) |
| **Timetable & Classes** | `/timetable` | Academic period slots, classroom mappings, teacher assignments, schedule planner | `NEW` |
| **Attendance Ledger** | `/sessions` | Period attendance rosters, entry/exit minutes, email reports, manual barcode overrides | Active session count |
| **Teacher Daily Matrix** | `/teacher` | Class teacher daily 6-period ledger, shortage alerts (<75%), weekly grid, security alerts | `6` (Periods) |
| **Face Biometrics & ID** | `/enrollment` | Face photo capture/upload, 128-d SFace embedding extraction, liveness audit | Enrolled count |
| **Student Directory** | `/students` | Enrolled student registry, batch & section assignments, biometric status | Student count |
| **Faculty Staff** | `/faculty` | Teacher accounts, department designations, employee credentials | Faculty count |
| **Subject Catalog** | `/subjects` | Course registry, credits, semester allocation, assigned professors | Course count |

---

## Section 1: Dashboard (`/dashboard`)

The central command dashboard provides executives and administrators with real-time operational metrics, AI inference latency, attendance trends, and quick-action navigation.

### Top Banner & Quick Actions
* **Status Pill (`Operational Smart CCTV Ledger • Production Mode`)**: Displays system health status by polling `GET /api/health`. Shows whether PostgreSQL/SQLite, OpenCV YuNet, and SFace models are operational.
* **Welcome Heading**: Greets the logged-in user dynamically using JWT claims (`user.full_name`).
* **`Launch Live CCTV` Button (Blue)**: Direct router shortcut to `/cctv` for initiating real-time surveillance or attendance capture.
* **`Teacher Daily Ledger` Button (Slate)**: Direct router shortcut to `/teacher` for viewing the daily class teacher matrix.

### Top Metric Gauge Cards (Row 1)
Each card features a circular SVG radial ring gauge and bottom status accent bar:

1. **Attendance Rate Card**:
   * **Gauge**: 78% circular progress ring in Royal Blue (`#2563eb`).
   * **Number**: `12,200` cumulative attendances recorded.
   * **`View More` Link**: Navigates to `/sessions` (Attendance Ledger).
   * **Backend Link**: Aggregated from `AttendanceRecord` table in database (`status == PRESENT`).

2. **Students Present Card**:
   * **Gauge**: 80% circular progress ring in Emerald Green (`#10b981`).
   * **Number**: `16,200` total present validations.
   * **`View More` Link**: Navigates to `/students` (Student Directory).
   * **Backend Link**: Count of students marked present in today's active sessions.

3. **Biometric Verified Card**:
   * **Gauge**: 61% circular progress ring in Amber (`#f59e0b`).
   * **Number**: `9,100` facial recognition matches.
   * **`View More` Link**: Navigates to `/enrollment` (Biometrics).
   * **Backend Link**: Count of records where `verification_method == 'FACE_RECOGNITION'`.

4. **CCTV Feeds Active Card**:
   * **Live Stream Indicators**: Shows real-time connection status for:
     * *Room 302 High-Angle* (`ONLINE`)
     * *Laptop Webcam Ingest* (`READY`)
     * *RTSP Tripwire Gate* (`ONLINE`)
   * **Number**: `3 Streams` active.
   * **`Manage Feeds` Link**: Navigates to `/cctv` camera management.

### Charts & Deep Analytics (Row 2)

#### 1. Statistics Attendance Trends (Multi-Line Smooth SVG Chart)
* **Timeframe Dropdown**: Allows filtering between `Monthly`, `Weekly`, and `Today`.
* **Chart Lines**:
  * **Green Curve (`#10b981`)**: Present Students across periods.
  * **Blue Curve (`#2563eb`)**: Verified Face Ingests from CCTV cameras.
  * **Amber Curve (`#f59e0b`)**: Late Arrivals or Early Departures.
* **Backend Source**: Aggregated from `ClassSession` and `AttendanceRecord` timestamps.

#### 2. AI Inference Latency Donut Gauge
* **Center Metric**: `68ms Per Frame` (Real-time edge processing speed).
* **Segmented Rings**:
  * **Blue Segment**: Cosine Similarity database lookup (`4ms`).
  * **Amber Segment**: 128-dimensional Deep Neural SFace Embedding extraction (`24ms`).
  * **Emerald Segment**: Anti-Spoofing & Liveness Fast Fourier Transform check (`12ms`).
* **Backend Link**: Benchmarked by `backend/app/services/biometric_service.py`.

### Timeline & Workflow Cards (Rows 3 & 4)
* **Latest Events Stepper**: A 4-milestone chronological tracker showing:
  1. *CCTV Stream Synchronized* (Camera live at 30 FPS).
  2. *Auto Face Verified* (Biometric match logged for student).
  3. *Period Attendance Finalized* (Period closed and attendance calculated).
  4. *Official Report Emailed* (Automated SMTP email dispatch to teacher).
* **3-Step Guided Workflow Cards**:
  * **Step 1 (Live CCTV Ingest)**: Links to `/cctv`.
  * **Step 2 (Class Teacher Matrix)**: Links to `/teacher`.
  * **Step 3 (Biometric Enrollment)**: Links to `/enrollment`.

---

## Section 2: Live CCTV Feeds (`/cctv`)

The core computer-vision surveillance hub for automated student attendance, multi-camera switching, anti-spoofing verification, and RTSP stream ingest.

### Stream & Feed Controls
* **Camera Selector Dropdown**: Switch between configured CCTV streams (e.g., Room 302, Corridor Gate, Lab Camera). Linked to `GET /api/cctv/cameras`.
* **`+ Add Camera` Button**: Opens a modal to register RTSP, ONVIF, or USB cameras:
  * Fields: Camera Name, Stream URL (`rtsp://`), Classroom mapping, IP, Port, Username, Password.
  * Backend Link: `POST /api/cctv/cameras`.
* **`Class Slot` Dropdown**: Selects the active lecture period from the timetable (e.g., Period 1: Computer Networks 09:00 - 10:00).
* **`Laptop Webcam` Button**:
  * Requests hardware webcam stream via WebRTC `navigator.mediaDevices.getUserMedia`.
  * Automatically switches into Live CCTV mode for instant testing on portable devices.
  * Has built-in Lenovo hardware privacy shutter & `Fn+F8` diagnostics.
* **`Record Period Attendance` Button**:
  * Takes an instantaneous snapshot of the current video frame.
  * Sends Base64 payload to `POST /api/timetable/take-period-attendance`.
  * Recognizes all students present in the classroom and logs attendance to the database.
* **`Auto-Attendance: ON/OFF` Toggle**:
  * When enabled, continuously inspects the video feed every 750ms.
  * If an enrolled student's face is detected with $>88\%$ confidence and liveness score $>0.9$, automatically logs them as **PRESENT** without requiring any manual clicks.
* **`Sim Feed` (Virtual Simulation) Button**:
  * Fallback mode when physical cameras are locked or unavailable.
  * Simulates high-definition classroom camera frames with AI scanning laser lines.
* **Biometric Mesh Sticks Buttons (`Matched (Green)` vs `Unmatched (Red)`)**:
  * **Matched (Green Sticks)**: Draws the 3D geometric wireframe mesh in luminous neon emerald green (`#10b981`) with glowing nodes.
  * **Unmatched (Red Sticks)**: Draws the 3D geometric wireframe mesh in luminous crimson red (`#ef4444`) representing an unregistered visitor or stranger.

### Real-Time Video HUD & Overlay Canvas
* **3D Biometric Constellation Mesh**: Renders dynamic connecting sticks across 30+ facial landmark points (forehead apex, eyebrows, glabella, eyelids, nose bridge, nostrils, cheeks, lips, chin).
* **Face Match Banner**: Displays student's name, roll number, and confidence percentage.
* **Anti-Spoofing Reticle**: Flags photos, phone screens, or paper cutouts with an amber alert.

### Recognized Students Live Table
* Displays real-time detections with columns:
  * **Roll Number**: e.g., `CS-2024-001`.
  * **Student Name**: Full name from database.
  * **Match Confidence**: Percentage calculated from SFace cosine similarity.
  * **Liveness Score**: Anti-spoof texture frequency score.
  * **Verification Method**: `FACE_RECOGNITION` or `BARCODE_FALLBACK`.

### Security Audit Incidents Log
* Below the camera feed, lists security exceptions (unauthorized access, liveness failure, stranger detection).
* **`View Proof` Button**: Opens photographic evidence snapshot captured during the incident.
* **Backend Link**: `GET /api/cctv/audit-logs`.

---

## Section 3: Timetable & Classes (`/timetable`)

Manages the institution's master class schedule, assigning subjects, faculty members, classrooms, and specific CCTV cameras to each time period.

### Header & Filters
* **Day-of-Week Filters**: Buttons for `ALL`, `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`.
* **`+ Add Class Slot` Button**: Opens the schedule creator modal:
  * **Subject**: Dropdown populated from `GET /api/academic/subjects`.
  * **Faculty**: Dropdown populated from `GET /api/academic/faculty`.
  * **Linked CCTV Camera**: Dropdown populated from `GET /api/cctv/cameras`.
  * **Day of Week**: Monday through Saturday.
  * **Start Time & End Time**: e.g., `09:00` to `10:00`.
  * **Classroom & Section**: e.g., `Room 302`, `Section A`.
  * **Recurring Weekly Toggle**: Defines recurring vs one-time extra classes.
  * **Backend Link**: `POST /api/timetable`.

### Timetable Slot Cards
Each card represents a scheduled lecture and includes:
* **Subject Code & Title**: e.g., `CS301: Computer Networks`.
* **Period Number**: Period 1, 2, 3, etc.
* **Time Badge**: Start to end time window.
* **Faculty Name**: Assigned professor.
* **Classroom & Section**: Room location and section group.
* **Camera Link Badge**: Indicates which CCTV camera covers this classroom.
* **`Take Attendance via CCTV` Button (Blue)**:
  * Immediately launches `/cctv` with this specific class slot pre-selected.
* **`Delete Slot` Button (Red Trash Icon)**:
  * Prompts confirmation and deletes the period via `DELETE /api/timetable/{id}`.

---

## Section 4: Attendance Ledger (`/sessions`)

The official attendance ledger where period sessions are reviewed, finalized, audited, and officially emailed to faculty.

### Session Selection & Summary
* **Lecture Period Dropdown**: Lists all scheduled class sessions for today.
* **Session Status Header**:
  * Shows Subject, Section, Classroom, and Teacher.
  * **Status Pills**: `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
  * **Stat Counters**: Total Enrolled, Present Count, Absent Count, Left Early Count, Attendance Rate Percentage.

### Action Buttons
1. **`Finalize & Close Session` Button (Emerald)**:
   * Calculates total present minutes and attendance ratio for every student.
   * Marks session as finalized and freezes records to prevent tampering.
   * Backend Link: `POST /api/timetable/sessions/{id}/finalize`.
2. **`Email Official Report to Faculty` Button (Blue)**:
   * Generates a structured HTML attendance report table.
   * Sends it directly to the faculty member's registered email via SMTP.
   * Backend Link: `POST /api/timetable/sessions/{id}/send-report`.
3. **`Scan Barcode / ID Card` Button (Purple)**:
   * Opens manual ID card scanner modal for barcode/QR fallback verification if a student has facial injury or camera occlusion.
   * Backend Link: `POST /api/biometrics/id-card/scan`.

### Student Ledger Roster Table
Lists all students enrolled in the class with columns:
* **Roll Number & Name**: Student credentials.
* **In-Time**: Exact timestamp when face was first recognized by CCTV.
* **Out-Time**: Last timestamp observed before class ended.
* **Presence Minutes**: Total time spent inside classroom.
* **Attendance Ratio**: Percentage of lecture attended.
* **Status Badge**:
  * `PRESENT` (Green)
  * `ABSENT` (Red)
  * `LEFT_EARLY` (Amber)
* **Verification Method**: `FACE_RECOGNITION` or `BARCODE_FALLBACK`.
* **Proof Snapshot**: Image thumbnail captured during facial match.

---

## Section 5: Teacher Daily Matrix (`/teacher`)

The class teacher's executive cockpit, providing day-by-day matrices across all periods, shortage warnings, and daily consolidated reports.

### Tab Navigation
1. **Class Teacher Daily Ledger (Default)**:
   * Displays the 6-period daily attendance matrix for the entire class section.
   * Columns: Student Name, Roll Number, Period 1, Period 2, Period 3, Period 4, Period 5, Period 6, Total Attended.
   * Status indicators: Green `P` (Present), Red `A` (Absent), Gray `-` (Not recorded).
   * **`Email Daily Report to Principal / HOD` Button**: Dispatches consolidated section report to academic administrators.
   * Backend Link: `GET /api/teacher/daily-ledger?section=A&date=YYYY-MM-DD`.

2. **Subject-Wise Matrix**:
   * Evaluates student attendance across individual subjects.
   * Shows: Total Classes Held, Attended, Attendance Percentage.
   * **Shortage Alert Flag (`< 75%`)**: Highlights students in red who are ineligible for semester examinations due to low attendance.
   * Backend Link: `GET /api/teacher/subject-matrix?section=A`.

3. **Weekly Timetable Grid**:
   * Full Monday through Saturday visual grid showing class distribution and teacher allocation.

4. **Faculty Sessions History**:
   * History of all lectures conducted by the teacher with attendance percentages and email dispatch receipts.

5. **Biometric Security Incidents**:
   * Chronological log of camera tampering, proxy attempts, and anti-spoofing flags.

---

## Section 6: Face Biometrics & ID Enrollment (`/enrollment`)

Registers new student biometric identities, computing facial embeddings for deep face recognition.

### Enrollment Controls
* **Student Selector Dropdown**: Selects an un-enrolled or existing student.
* **Dual Ingest Mode**:
  1. **Live Camera Capture**: Streams local webcam, displays alignment frame, and captures instant snapshot.
  2. **High-Res Photo File Upload**: Uploads JPG/PNG identity photograph.
* **Image Quality & Liveness Meter**:
  * Analyzes facial sharpness, lighting balance, and eye visibility.
  * Quality Score gauge ($0.0 - 1.0$).
* **`Enroll Face Embedding` Button (Blue)**:
  * Crops facial region using YuNet.
  * Generates 128-dimensional mathematical vector using SFace.
  * Stores embedding in database table `StudentFaceEmbedding`.
  * Backend Link: `POST /api/biometrics/enroll`.
* **Multi-Angle Counter**: Shows how many reference angles (frontal, left profile, right profile) are registered for the student.

---

## Section 7: Student Directory (`/students`)

The master directory of all enrolled students in the institution.

### Top Summary Cards
* **Total Students**: Total registered in database.
* **Biometrically Enrolled**: Students with active face embeddings.
* **Pending Enrollment**: Students needing photo registration.

### Controls & Actions
* **Search Input**: Instant search by Student Name, Roll Number, or Email.
* **Department Filter**: Filter by Computer Science, Electronics, Mechanical, etc.
* **`+ Enroll New Student` Button**: Opens student registration modal:
  * Fields: Student Roll Number, Full Name, Email, Department, Batch Year, Semester, Section, Phone Number, Initial Password.
  * Backend Link: `POST /api/academic/students`.
* **Table Action Buttons**:
  * **`Enroll Face` (ScanFace Icon)**: Direct link to `/enrollment` with student pre-selected.
  * **`Delete` (Trash Icon)**: Deletes student record and associated biometric embeddings via `DELETE /api/academic/students/{id}`.

---

## Section 8: Faculty Staff Directory (`/faculty`)

Manages professors, lecturers, and academic instructors.

### Top Summary Cards
* **Total Faculty**: Count of registered teachers.
* **Assigned Classes**: Total active lectures taught.
* **Department Heads**: Department coordinators.

### Controls & Actions
* **Search Input**: Filters faculty by name, employee ID, or department.
* **`+ Add Faculty Member` Button**: Opens faculty creation modal:
  * Fields: Employee ID, Full Name, Email, Password, Department, Designation (Professor, Assistant Professor, Lecturer), Office Room Number, Phone Number.
  * Automatically creates user credentials with `Role = TEACHER`.
  * Backend Link: `POST /api/academic/faculty`.
* **Table Action Buttons**:
  * **`Delete Faculty` (Trash Icon)**: Removes faculty record via `DELETE /api/academic/faculty/{id}`.

---

## Section 9: Subject Catalog (`/subjects`)

Maintains the course curriculum, subject codes, credits, and professor assignments.

### Top Summary Cards
* **Total Courses**: Count of active subjects.
* **Total Credits**: Cumulative academic credits.
* **Assigned Instructors**: Courses with active teachers.

### Controls & Actions
* **Search Bar**: Quick lookup by Subject Code (e.g., `CS301`) or Title.
* **`+ Add New Subject` Button**: Opens subject creation modal:
  * Fields: Subject Code (e.g., `CS701`), Subject Name (e.g., `Artificial Intelligence & Robotics`), Department, Semester (1 - 8), Credits (1 - 5), Assigned Faculty Instructor dropdown.
  * Backend Link: `POST /api/academic/subjects`.
* **Table Action Buttons**:
  * **Faculty Badge**: Shows assigned professor or "Unassigned".
  * **`Delete Subject` (Trash Icon)**: Removes subject via `DELETE /api/academic/subjects/{id}`.

---

## Summary Diagram: System Flow & Data Linking

```
                                [ Student Enrollment (/enrollment) ]
                                                │
                                    (128-d Vector via SFace)
                                                ▼
  [ Timetable (/timetable) ] ─────► [ Supabase / SQLite DB ] ◄───── [ Academic Setup (/students, /faculty, /subjects) ]
              │                                 ▲
              ▼                                 │
     [ Live CCTV (/cctv) ]                      │ (Records Present/Absent)
  (YuNet Detect + SFace Match) ─────────────────┘
              │
              ▼
   [ Ledger Sessions (/sessions) ] ─────► [ SMTP Email Dispatch to Faculty ]
              │
              ▼
  [ Teacher Matrix (/teacher) ] ──────► [ Daily Consolidated Section Reports ]
              │
              ▼
    [ Dashboard (/dashboard) ] (Real-time Executive Metrics & Charts)
```
