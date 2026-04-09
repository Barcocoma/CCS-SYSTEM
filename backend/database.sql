-- ITEW6 Project Database Schema
-- MySQL Database Schema for CCS Student Profiling System
-- Complete setup script - run this to create the entire database

-- Create Database (if not exists)
CREATE DATABASE IF NOT EXISTS itew6_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create User (optional - uncomment if needed)
-- CREATE USER IF NOT EXISTS 'itew6_user'@'localhost' IDENTIFIED BY 'itew6_password';
-- GRANT ALL PRIVILEGES ON itew6_db.* TO 'itew6_user'@'localhost';
-- FLUSH PRIVILEGES;

USE itew6_db;

-- Users Table (Authentication with Multitenant Support)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL COMMENT 'DEAN, CHAIR, FACULTY, SECRETARY',
    tenant_id VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    email VARCHAR(120) NULL,
    contact_number VARCHAR(20) NULL,
    course VARCHAR(100) NULL,
    year_level VARCHAR(50) NULL,
    enrollment_status VARCHAR(50) DEFAULT 'Enrolled',
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_course (course)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Skills
CREATE TABLE IF NOT EXISTS student_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    skill_name VARCHAR(120) NOT NULL,
    level VARCHAR(50) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_skill_name (skill_name),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student Academic History
CREATE TABLE IF NOT EXISTS student_academic_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    academic_year VARCHAR(50) NULL,
    course VARCHAR(100) NULL,
    details TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_academic_year (academic_year),
    INDEX idx_course (course),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Non-Academic Activities
CREATE TABLE IF NOT EXISTS student_non_academic_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    activity_type VARCHAR(100) NULL,
    activity_name VARCHAR(150) NOT NULL,
    details TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_activity_name (activity_name),
    INDEX idx_activity_type (activity_type),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Violations
CREATE TABLE IF NOT EXISTS student_violations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    violation_name VARCHAR(150) NOT NULL,
    severity VARCHAR(50) NULL,
    date DATE NULL,
    details TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_violation_name (violation_name),
    INDEX idx_severity (severity),
    INDEX idx_date (date),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Affiliations
CREATE TABLE IF NOT EXISTS student_affiliations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NULL,
    role VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_id (student_id),
    INDEX idx_affiliation_name (name),
    INDEX idx_affiliation_category (category),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Faculty Table
CREATE TABLE IF NOT EXISTS faculty (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    email VARCHAR(120) NULL,
    contact_number VARCHAR(20) NULL,
    department VARCHAR(100) NULL,
    position VARCHAR(100) NULL,
    employment_start_date DATE NULL,
    employment_status VARCHAR(50) DEFAULT 'Full-time',
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee_number (employee_number),
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    instructor VARCHAR(200) NOT NULL,
    room VARCHAR(100) NOT NULL,
    day VARCHAR(20) NOT NULL COMMENT 'Monday, Tuesday, Wednesday, etc.',
    start_time VARCHAR(50) NOT NULL COMMENT 'e.g., 9:00 AM',
    end_time VARCHAR(50) NOT NULL COMMENT 'e.g., 11:00 AM',
    students INT DEFAULT 0,
    year_level VARCHAR(50) NULL,
    section VARCHAR(10) NULL,
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_course (course),
    INDEX idx_day (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Research Table
CREATE TABLE IF NOT EXISTS research (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    authors TEXT NULL COMMENT 'JSON array or comma-separated list',
    category VARCHAR(100) NULL,
    status VARCHAR(50) DEFAULT 'ongoing',
    keywords TEXT NULL COMMENT 'JSON array or comma-separated list',
    citations INT DEFAULT 0,
    views INT DEFAULT 0,
    downloads INT DEFAULT 0,
    journal VARCHAR(200) NULL,
    doi VARCHAR(100) NULL,
    publication_date DATE NULL,
    year VARCHAR(10) NULL,
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_category (category),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    members INT DEFAULT 0,
    events_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Active',
    color VARCHAR(50) NULL,
    description TEXT NULL,
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_status (status),
    UNIQUE KEY unique_name_tenant (name, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reports Table (Organization and Events Reports)
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    report_type VARCHAR(50) NULL COMMENT 'organization, event',
    description TEXT NULL,
    organization VARCHAR(100) NULL,
    date DATE NOT NULL,
    time VARCHAR(50) NULL,
    venue VARCHAR(200) NULL,
    status VARCHAR(50) DEFAULT 'Upcoming',
    participants INT DEFAULT 0,
    registered INT DEFAULT 0,
    category VARCHAR(50) NULL,
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_report_type (report_type),
    INDEX idx_date (date),
    INDEX idx_organization (organization)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Admin User
-- Password: admin123 (hashed)
INSERT INTO users (username, email, password_hash, role, is_active) 
VALUES ('admin', 'admin@example.com', 'pbkdf2:sha256:600000$...', 'DEAN', TRUE)
ON DUPLICATE KEY UPDATE username=username;

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(80) NOT NULL,
    action VARCHAR(100) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, VIEW, LOGIN, LOGOUT',
    entity_type VARCHAR(50) NOT NULL COMMENT 'STUDENT, FACULTY, SCHEDULE, etc.',
    entity_id INT NULL,
    entity_name VARCHAR(200) NULL,
    details TEXT NULL COMMENT 'Additional details in JSON format',
    ip_address VARCHAR(50) NULL,
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity_type (entity_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Syllabus Table (Instructions Module)
CREATE TABLE IF NOT EXISTS syllabus (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    instructor VARCHAR(200) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    units INT NOT NULL,
    hours INT NOT NULL,
    description TEXT NULL,
    objectives TEXT NULL COMMENT 'JSON array',
    topics TEXT NULL COMMENT 'JSON array of {week, topic, hours}',
    requirements TEXT NULL COMMENT 'JSON array of {type, weight}',
    status VARCHAR(50) DEFAULT 'Active',
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_course (course),
    INDEX idx_code (code),
    INDEX idx_semester (semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Curriculum Table (Instructions Module)
CREATE TABLE IF NOT EXISTS curriculum (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course VARCHAR(100) NOT NULL,
    program VARCHAR(200) NOT NULL,
    year VARCHAR(10) NOT NULL,
    total_units INT NOT NULL,
    semesters TEXT NOT NULL COMMENT 'JSON array of {semester, subjects: [{code, name, units}]}',
    status VARCHAR(50) DEFAULT 'Active',
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_course (course),
    INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lessons Table (Instructions Module)
CREATE TABLE IF NOT EXISTS lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    syllabus_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    week INT NOT NULL,
    duration VARCHAR(50) NULL,
    type VARCHAR(50) DEFAULT 'Lecture',
    materials TEXT NULL COMMENT 'JSON array of {name, type, size}',
    activities TEXT NULL COMMENT 'JSON array of {name, dueDate, status}',
    objectives TEXT NULL COMMENT 'JSON array',
    status VARCHAR(50) DEFAULT 'Published',
    tenant_id VARCHAR(100) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_syllabus_id (syllabus_id),
    INDEX idx_week (week),
    INDEX idx_status (status),
    FOREIGN KEY (syllabus_id) REFERENCES syllabus(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: The password_hash above is a placeholder. 
-- In production, use the init_db.py script which properly hashes passwords.

