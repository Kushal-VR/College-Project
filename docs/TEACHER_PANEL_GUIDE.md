# Smart AI-Based CCTV Attendance Ledger — Complete Teacher Portal Reference Manual

This comprehensive guide details **every section, tab, button, matrix table, chart, filter, and backend data link** within the **Teacher & Class Teacher Portal** (`/teacher`).

---

## Table of Contents
1. [Teacher Portal Architecture](#1-teacher-portal-architecture)
2. [Top Header Banner & Quick Controls](#2-top-header-banner--quick-controls)
3. [Global Filter Bar](#3-global-filter-bar)
4. [Tab 1: Class Teacher Daily Ledger (Periods 1 to 6)](#tab-1-class-teacher-daily-ledger-periods-1-to-6)
5. [Tab 2: Master Subject-Wise Matrix (% & Shortage Alerts)](#tab-2-master-subject-wise-matrix--shortage-alerts)
6. [Tab 3: Official Weekly Timetable Grid](#tab-3-official-weekly-timetable-grid)
7. [Tab 4: Day-by-Day Course Sessions & SMTP Email Dispatch](#tab-4-day-by-day-course-sessions--smtp-email-dispatch)
8. [Tab 5: Covered Face Exits & Security Incidents](#tab-5-covered-face-exits--security-incidents)
9. [Backend APIs & Database Schema Reference](#9-backend-apis--database-schema-reference)

---

## 1. Teacher Portal Architecture

The Teacher Portal (`/teacher`) is designed for both **Course Faculty Instructors** and **Designated Class Teachers**. It provides a single consolidated view to track daily 6-period attendance, evaluate 75% exam eligibility shortages, inspect weekly timetable schedules, dispatch official email reports, and review security audit logs.

| Feature / Tab | Route / Tab ID | Purpose | Backend API Endpoint |
| :--- | :--- | :--- | :--- |
| **Profile Banner** | Permanent Header | Displays teacher identity, assigned class section, and quick link to camera | `GET /api/timetable/teacher-stats` |
| **Class Teacher Daily Ledger** | `class_teacher_ledger` | 6-Period P/A matrix for the entire class cohort for selected date | `GET /api/timetable/class-teacher/daily-ledger` |
| **Subject-Wise Matrix** | `subject_matrix` | Cumulative subject attendance percentages with `< 75%` shortage flags | `GET /api/timetable/class-teacher/subject-wise-matrix` |
| **Weekly Timetable Grid** | `weekly_timetable` | Monday–Saturday 6-slot schedule grid with room and teacher mappings | `GET /api/timetable/weekly-grid` |
| **Faculty Course Sessions** | `faculty_sessions` | History of conducted lectures with 1-click SMTP email dispatch | `GET /api/timetable/teacher-stats`, `POST /timetable/sessions/{id}/send-email` |
| **Covered Face Incidents** | `incidents` | Photographic proof of students exiting classroom with occluded/covered faces | `GET /api/timetable/incidents` |

---

## 2. Top Header Banner & Quick Controls

Located at the top of `/teacher`, this banner displays teacher credentials and direct action shortcuts:

### Components & Badges
* **Teacher Avatar & Icon (Blue)**: Visual badge with `GraduationCap` icon indicating instructor credentials.
* **Role Pill**: Displays `Class Teacher & Faculty Portal`.
* **Assigned Cohort Tag (Emerald)**: Highlights the specific section assigned to this class teacher (e.g., `Assigned: Section B`).
* **Instructor Name & Email**:
  * Extracted from JWT token claims and database: e.g., `Dr. Alan Turing` (`faculty@smartattend.edu`).
  * Fallbacks automatically if offline or running in mock development mode.
* **Assigned Cohort Stat Card (Slate)**:
  * Shows semester and section code (e.g., `Sem 7 - Sec B`).
* **`Open In-Classroom CCTV` Button (Blue)**:
  * Clickable shortcut leading directly to `/cctv`.
  * Pre-configures the camera view for the teacher's classroom so they can initiate automatic attendance capture immediately.

### Toast Notification Banner (Feedback)
* When an attendance report is dispatched or settings updated, a green alert banner pops up:
  * Shows: `✓ Official attendance ledger dispatched via SMTP to [email]`.
  * Includes a dismiss button (`&times;`) to clear the notice.

---

## 3. Global Filter Bar

Positioned directly above the tabs, this sticky toolbar enables instant filtering of all student records across sections, dates, and names:

### Controls & Actions
1. **Section Selector Dropdown**:
   * Options: `Section B (Assigned Class)`, `Section A`, `Section C`.
   * **Action**: Dynamically switches the query parameter `?section=X`.
   * Re-fetches the ledger and matrix for the chosen cohort without page reload.
2. **Date Picker Input (`type="date"`)**:
   * Available when viewing Tab 1 (Class Teacher Daily Ledger).
   * Defaults to today's date (`YYYY-MM-DD`).
   * **Action**: Allows class teachers to review past dates (e.g., yesterday or last week) to audit historical period records.
3. **Search Input Bar (`Search roll or student...`)**:
   * Real-time client-side text filter.
   * **Action**: Filters the table rows instantly by **Student Full Name** or **Roll Number / Student ID** (e.g., typing `1EW23` or `Kushal`).

---

## Tab 1: Class Teacher Daily Ledger (Periods 1 to 6)

The centerpiece of the portal for class teachers. Instead of opening 6 different subject registers, this tab displays a unified **horizontal period matrix** for all students in the assigned class section.

### Period Headers (Table Head)
* **`#` Column**: Sequential row number.
* **`Roll No` Column**: Unique institutional roll number / USN (e.g., `CS-2024-001`).
* **`Student Name` Column**: Full name of the enrolled student.
* **Period Columns (`P1` to `P6`)**:
  * Each period header shows:
    * **Period Label**: `P1`, `P2`, `P3`, `P4`, `P5`, `P6`.
    * **Time Slot**: e.g., `09:00 - 10:00`, `10:00 - 11:00`.
    * **Subject Code**: e.g., `CS701`, `CS702`, `CS703`.
* **`Day Total` Column**: Shows total periods attended out of total periods conducted today (e.g., `5 / 6`).

### Status Badges Inside Cells
For each student and each period, the cell dynamically renders one of three states:

| Badge | Visual Appearance | Meaning |
| :--- | :--- | :--- |
| **`PRES`** | Green pill (`bg-emerald-500/20 text-emerald-400`) with checkmark `✓` | Student was recognized by in-classroom CCTV facial recognition or scanned via barcode fallback. |
| **`ABS`** | Red pill (`bg-rose-500/20 text-rose-400`) with `✕` | Class session occurred, but student was not detected in the classroom. |
| **`—`** | Gray dash (`text-slate-600 font-mono`) | Period has not taken place yet or lecture was cancelled. |

### How It Is Linked
* **API**: `GET /api/timetable/class-teacher/daily-ledger?section={section}&date={date}`.
* **Database Tables**:
  * `Timetable`: Determines the 6 scheduled subjects and times for that day of week.
  * `ClassSession`: Identifies the session IDs for that specific calendar date.
  * `AttendanceRecord`: Queries status (`PRESENT` or `ABSENT`) for each student.

---

## Tab 2: Master Subject-Wise Matrix (% & Shortage Alerts)

Provides cumulative academic analytics across the entire semester to track attendance compliance with university regulations (typically a mandatory 75% minimum threshold).

### Header & Legend
* **Eligibility Legend**:
  * **Emerald Dot (`≥ 75% Eligible`)**: Student satisfies minimum attendance criteria for university exam admission.
  * **Rose Dot (`< 75% Shortage`)**: Student is critically below threshold and flagged for shortage intervention.

### Matrix Table Columns
1. **Student Credentials**: Sequential number, Roll Number, Full Name.
2. **Subject Columns**: One column per enrolled subject (e.g., `CS701 AI`, `CS702 Cloud`, `CS703 Security`):
   * **Top Counter**: `classes_attended / classes_held` (e.g., `18/20`).
   * **Percentage**: Formatted percentage (e.g., `90.0%`).
   * Color-coded: **Emerald Green** if $\ge 75\%$, **Rose Red** if $< 75\%$.
3. **`Overall Classes` Column**: Sum of attended lectures vs total lectures conducted across all subjects (e.g., `72 / 80`).
4. **`Overall %` Column**: Cumulative percentage across all courses.
5. **`Eligibility` Status Badge**:
   * **`ELIGIBLE` (Green)**: Accompanied by a `CheckCircle2` icon when overall attendance is $\ge 75\%$.
   * **`SHORTAGE` (Red)**: Accompanied by an `AlertTriangle` icon when attendance drops $< 75\%$. Triggers automatic parent SMS/email notification recommendations.

### How It Is Linked
* **API**: `GET /api/timetable/class-teacher/subject-wise-matrix?section={section}`.
* **Database Aggregation**:
  * Iterates over all historical `ClassSession` rows for the section.
  * Computes total sessions held per subject.
  * Sums `AttendanceRecord` entries where `status == 'PRESENT'`.
  * Evaluates boolean flag `has_shortage = overall_percentage < 75.0`.

---

## Tab 3: Official Weekly Timetable Grid

Displays the full weekly lecture schedule for the section in an intuitive card-based calendar layout.

### Layout & Card Contents
* **Days Covered**: Monday through Saturday.
* **Day Column Card**:
  * Shows day name and total period count badge (e.g., `6 Periods`).
* **Period Cards**:
  * **Period Number**: `P1`, `P2`, `P3`, etc.
  * **Subject Name**: Full title (e.g., `Computer Networks & Distributed Systems`).
  * **Subject Code & Teacher**: e.g., `CS301 • Dr. Alan Turing`.
  * **Time Window**: e.g., `09:00 - 10:00`.
  * **Classroom**: Location identifier (e.g., `Room 302`).

### How It Is Linked
* **API**: `GET /api/timetable/weekly-grid?section={section}`.
* **Database Model**: Reads all rows from `Timetable` matching `section == selectedSection` ordered by `day_of_week` and `period_number`.

---

## Tab 4: Day-by-Day Course Sessions & SMTP Email Dispatch

Allows individual subject teachers to audit each lecture they conducted and immediately dispatch official attendance reports via email.

### Sessions Table Columns
1. **Date**: Calendar date of the session (`YYYY-MM-DD`).
2. **Time Slot**: Duration window (e.g., `10:00 - 11:00`).
3. **Classroom**: Room number where CCTV verified students.
4. **Present Count**: Total students marked present (Emerald font).
5. **Absent Count**: Total students marked absent (Rose font).
6. **Left Early**: Students who left before the lecture threshold.
7. **Rate %**: Percentage attendance calculated for this single lecture.
8. **SMTP Email Status**:
   * `SENT` (Green badge): Official HTML email receipt was dispatched to teacher's inbox.
   * `NOT SENT` (Gray badge): Email report has not been triggered yet.
9. **Action Column (`Send Report via Email` Button)**:
   * Clicking the button sends a `POST` request to `/api/timetable/sessions/{id}/send-email`.
   * The backend generates an HTML email with the full student attendance roster and delivers it via SMTP.
   * Updates status badge to `SENT` and displays confirmation toast.

---

## Tab 5: Covered Face Exits & Security Incidents

An AI-driven security auditing tab designed to prevent attendance fraud and monitor proxy attempts.

### Incident Cards
When a student exits the classroom with their face concealed (wearing a hoodie, mask, or covering their face with a book or hand to avoid camera recognition), the AI vision engine logs an incident:

* **Event Type Badge (Rose Red)**: e.g., `COVERED_FACE_EXIT` or `UNAUTHORIZED_DEPARTURE`.
* **Timestamp**: Exact date, hour, minute, and second of occurrence.
* **Location & Camera**: Classroom number and CCTV camera ID.
* **Suspected Student**: Roll number and name inferred from timetable roster presence and seat tracking.
* **Audit Details**: Algorithmic description (e.g., *Student attempted exit with face occluded by hand at tripwire boundary*).
* **Photographic Proof Thumbnail**:
  * Displays the exact video frame captured by the CCTV camera at the moment of the infraction.
  * Serves as undeniable proof for academic disciplinary inquiries.

### How It Is Linked
* **API**: `GET /api/timetable/incidents`.
* **Database Model**: Reads from `SecurityAuditLog` table where `event_type.in_(['COVERED_FACE_EXIT', 'LIVENESS_FAILED', 'SPOOF_ATTEMPT'])`.

---

## 9. Backend APIs & Database Schema Reference

### Complete API Endpoint Mapping

| HTTP Method | API URL | Handler Function | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/timetable/teacher-stats` | `get_teacher_portal_stats()` | Loads teacher name, assigned sections, and session summaries |
| `GET` | `/api/timetable/class-teacher/daily-ledger` | `get_daily_ledger_matrix()` | Computes period 1-6 attendance matrix for section on selected date |
| `GET` | `/api/timetable/class-teacher/subject-wise-matrix` | `get_subject_wise_matrix()` | Calculates cumulative semester percentage & shortage per subject |
| `GET` | `/api/timetable/weekly-grid` | `get_weekly_timetable_grid()` | Returns Monday–Saturday 6-period visual schedule |
| `POST` | `/api/timetable/sessions/{id}/send-email` | `send_session_report_email()` | Generates HTML email and delivers via SMTP to instructor |
| `GET` | `/api/timetable/incidents` | `get_security_incidents()` | Fetches photographic proof logs of covered-face departures |

### Database Relationship Diagram

```
[ User (Role=TEACHER) ]
         │ (1-to-1)
         ▼
    [ Faculty ] ◄────────────────────────────────────────┐
         │ (1-to-Many)                                   │
         ▼                                               │
    [ Timetable ] ──── (Linked Camera) ──► [ Camera ]    │
         │ (1-to-Many)                                   │
         ▼                                               │
   [ ClassSession ] ─── (SMTP Report) ───────────────────┘
         │ (1-to-Many)
         ▼
 [ AttendanceRecord ] ◄── (1-to-Many) ── [ Student ]
         │ (Links to)
         ▼
[ SecurityAuditLog ] (Stores CCTV photographic proof)
```
