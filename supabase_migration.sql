-- ==============================================================================
-- SMART AI CCTV ATTENDANCE LEDGER - DATABASE RESET & INITIALIZATION
-- Project Ref: wxzvojhljxbelkiwqcze
-- Compatible with PostgreSQL / Supabase & FastAPI SQLAlchemy Models
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: DROP OLD TABLES & TYPES CLEANLY
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS attendance_audit_logs CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS class_sessions CASCADE;
DROP TABLE IF EXISTS timetables CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS student_face_embeddings CASCADE;
DROP TABLE IF EXISTS security_audit_logs CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS faculties CASCADE;
DROP TABLE IF EXISTS cameras CASCADE;
DROP TABLE IF EXISTS cctv_zones CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop old types if present
DROP TYPE IF EXISTS userrole CASCADE;
DROP TYPE IF EXISTS sessionstatus CASCADE;
DROP TYPE IF EXISTS attendancestatus CASCADE;
DROP TYPE IF EXISTS verificationmethod CASCADE;

-- ------------------------------------------------------------------------------
-- STEP 2: CREATE ENUM TYPES
-- ------------------------------------------------------------------------------
CREATE TYPE userrole AS ENUM ('ADMIN', 'FACULTY', 'STUDENT');

-- ------------------------------------------------------------------------------
-- STEP 3: CREATE CORE USERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role userrole NOT NULL DEFAULT 'STUDENT',
    phone_number VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ------------------------------------------------------------------------------
-- STEP 4: CREATE FACULTY & STUDENTS TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE faculty (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Computer Science',
    designation VARCHAR(100) NOT NULL DEFAULT 'Assistant Professor',
    office_location VARCHAR(100) DEFAULT 'Block B, Room 302',
    is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
    class_teacher_section VARCHAR(20),
    class_teacher_semester INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_faculty_employee_id ON faculty(employee_id);
CREATE INDEX idx_faculty_department ON faculty(department);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Computer Science',
    batch_year VARCHAR(20) NOT NULL DEFAULT '2023-2027',
    semester INTEGER NOT NULL DEFAULT 6,
    section VARCHAR(10) NOT NULL DEFAULT 'A',
    biometric_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
    biometric_face_count INTEGER NOT NULL DEFAULT 0,
    photo_url VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_department ON students(department);

-- ------------------------------------------------------------------------------
-- STEP 5: CREATE CAMERAS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    stream_url VARCHAR(500) NOT NULL,
    camera_type VARCHAR(20) NOT NULL DEFAULT 'RTSP',
    classroom VARCHAR(100) NOT NULL DEFAULT 'Room 302',
    crossing_direction VARCHAR(50) NOT NULL DEFAULT 'LEFT_TO_RIGHT_ENTRY',
    fps INTEGER NOT NULL DEFAULT 25,
    resolution VARCHAR(20) NOT NULL DEFAULT '1920x1080',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE',
    last_ping TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cameras_classroom ON cameras(classroom);

-- ------------------------------------------------------------------------------
-- STEP 6: CREATE SUBJECTS & ENROLLMENTS TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'Computer Science',
    semester INTEGER NOT NULL DEFAULT 6,
    credits INTEGER NOT NULL DEFAULT 3,
    faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subjects_code ON subjects(code);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2026-2027',
    status VARCHAR(20) NOT NULL DEFAULT 'ENROLLED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, subject_id)
);

-- ------------------------------------------------------------------------------
-- STEP 7: CREATE TIMETABLES & SESSIONS TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE timetables (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    day_of_week VARCHAR(20) NOT NULL,
    period_number INTEGER NOT NULL DEFAULT 1,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    classroom VARCHAR(100) NOT NULL DEFAULT 'Room 302',
    section VARCHAR(10) NOT NULL DEFAULT 'A',
    batch_year VARCHAR(20) NOT NULL DEFAULT '2023-2027',
    is_recurring BOOLEAN NOT NULL DEFAULT TRUE,
    single_date VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE class_sessions (
    id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    date VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    email_report_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- STEP 8: CREATE ATTENDANCE RECORDS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date VARCHAR(20) NOT NULL,
    period_number INTEGER NOT NULL DEFAULT 1,
    in_time TIMESTAMPTZ,
    out_time TIMESTAMPTZ,
    total_minutes_present FLOAT NOT NULL DEFAULT 0.0,
    presence_ratio FLOAT NOT NULL DEFAULT 0.0,
    status VARCHAR(30) NOT NULL DEFAULT 'ABSENT',
    verification_method VARCHAR(30) NOT NULL DEFAULT 'FACE_RECOGNITION',
    photo_proof_url VARCHAR(500),
    confidence_score FLOAT NOT NULL DEFAULT 0.0,
    email_notified BOOLEAN NOT NULL DEFAULT FALSE,
    remarks VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, student_id)
);

-- ------------------------------------------------------------------------------
-- STEP 9: BIOMETRICS & SECURITY AUDIT TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE student_face_embeddings (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    photo_path VARCHAR(500),
    embedding TEXT NOT NULL,
    quality_score FLOAT NOT NULL DEFAULT 1.0,
    liveness_score FLOAT NOT NULL DEFAULT 1.0,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE security_audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    photo_proof_path VARCHAR(500),
    details TEXT,
    email_alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description VARCHAR(255),
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- STEP 10: SEED BASELINE DEMO DATA (Admin, Faculty, Student, Camera, Subject)
-- Password for all seed accounts is 'admin123' / 'faculty123' / 'student123'
-- ------------------------------------------------------------------------------

-- 1. Chief Administrator Kushal
INSERT INTO users (email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'kushalvr12@gmail.com',
    '$2b$12$0hrnyTlqksZrZ5i7WYDzU.B6ZkD3P154rtVjNQaC5NX9i162yBMMa',
    'Chief Administrator Kushal',
    'ADMIN',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- 2. System Administrator
INSERT INTO users (email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'admin@attendance.edu',
    '$2b$12$0hrnyTlqksZrZ5i7WYDzU.B6ZkD3P154rtVjNQaC5NX9i162yBMMa',
    'System Administrator',
    'ADMIN',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- 3. Default Faculty User & Profile
INSERT INTO users (email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'faculty@attendance.edu',
    '$2b$12$0hrnyTlqksZrZ5i7WYDzU.B6ZkD3P154rtVjNQaC5NX9i162yBMMa',
    'Prof. Alan Turing',
    'FACULTY',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO faculty (user_id, employee_id, department, designation, office_location, is_class_teacher, class_teacher_section, class_teacher_semester)
SELECT id, 'FAC-001', 'Computer Science', 'Associate Professor', 'Block B, Room 302', TRUE, 'A', 6
FROM users WHERE email = 'faculty@attendance.edu'
ON CONFLICT (user_id) DO NOTHING;

-- 4. Default Student User & Profile
INSERT INTO users (email, hashed_password, full_name, role, is_active, is_verified)
VALUES (
    'student.kushal@university.edu',
    '$2b$12$0hrnyTlqksZrZ5i7WYDzU.B6ZkD3P154rtVjNQaC5NX9i162yBMMa',
    'Kushal Student',
    'STUDENT',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO students (user_id, student_id, department, batch_year, semester, section, biometric_enrolled, biometric_face_count)
SELECT id, 'CS-2024-001', 'Computer Science', '2023-2027', 6, 'A', TRUE, 1
FROM users WHERE email = 'student.kushal@university.edu'
ON CONFLICT (user_id) DO NOTHING;

-- 5. Default Camera
INSERT INTO cameras (name, stream_url, camera_type, classroom, crossing_direction, fps, resolution, is_active, last_status)
VALUES (
    'Classroom 302 High-Angle CCTV',
    'demo',
    'RTSP',
    'Room 302',
    'LEFT_TO_RIGHT_ENTRY',
    25,
    '1920x1080',
    TRUE,
    'ONLINE'
)
ON CONFLICT DO NOTHING;

-- 6. Default Subject & Enrollment
INSERT INTO subjects (code, name, department, semester, credits, faculty_id)
SELECT 'CS301', 'Computer Networks', 'Computer Science', 6, 4, f.id
FROM faculty f WHERE f.employee_id = 'FAC-001'
ON CONFLICT (code) DO NOTHING;

INSERT INTO enrollments (student_id, subject_id, academic_year, status)
SELECT s.id, sub.id, '2026-2027', 'ENROLLED'
FROM students s, subjects sub
WHERE s.student_id = 'CS-2024-001' AND sub.code = 'CS301'
ON CONFLICT (student_id, subject_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- STEP 11: GRANT PERMISSIONS TO SUPABASE ROLES
-- ------------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;
