import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Download,
  Edit3,
  FileImage,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { StudentForm } from './StudentForm';
import { StudentListRow } from './StudentListRow';
import { StudentSearchBar } from './StudentSearchBar';
import { ModalShell } from '../ui/ModalShell';
import { useUI } from '../ui/UIProvider';
import { useSession } from '../../context/SessionProvider';
import { apiRequest } from '../../lib/api';
import {
  ACTIVITY_TYPES,
  AFFILIATION_CATEGORIES,
  AFFILIATION_ROLES,
  CORE_COURSES,
  VIOLATION_SEVERITIES,
  YEAR_LEVELS,
} from '../../lib/formOptions';
import { cn } from '../../constants';
import { getInitials, matchesFacultyAssignment, parseOptionalJson } from '../../lib/display';

const defaultStudentForm = {
  student_id: '',
  first_name: '',
  last_name: '',
  middle_name: '',
  birthday: '',
  email: '',
  contact_number: '',
  course: 'BSIT',
  year_level: '1st Year',
  section: '',
  enrollment_status: 'Enrolled',
};

const defaultDetailForms = {
  skill: {
    skill_name: '',
    level: 'Intermediate',
  },
  academic: {
    academic_year: '',
    course: 'BSIT',
    school_name: '',
    start_period: '',
    end_period: '',
    award: '',
    notes: '',
  },
  activity: {
    activity_type: ACTIVITY_TYPES[0],
    activity_name: '',
    details: '',
  },
  violation: {
    violation_name: '',
    severity: VIOLATION_SEVERITIES[0],
    date: '',
    details: '',
  },
  affiliation: {
    category: AFFILIATION_CATEGORIES[0],
    name: '',
    role: AFFILIATION_ROLES[0],
  },
};

const STUDENT_EXPORT_COLUMNS = [
  { key: 'student_id', label: 'Student ID', required: true },
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'middle_name', label: 'Middle Name', required: false },
  { key: 'birthday', label: 'Birthday', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'contact_number', label: 'Contact Number', required: false },
  { key: 'course', label: 'Course', required: true },
  { key: 'year_level', label: 'Year Level', required: true },
  { key: 'section', label: 'Section', required: false },
  { key: 'enrollment_status', label: 'Enrollment Status', required: false },
];

const STUDENT_REQUIRED_KEYS = STUDENT_EXPORT_COLUMNS.filter((column) => column.required).map((column) => column.key);
const STUDENT_COLUMN_WIDTHS = [100, 105, 105, 95, 110, 180, 120, 90, 95, 70, 130];
const STUDENT_FIELD_LIMITS = {
  student_id: 50,
  first_name: 100,
  last_name: 100,
  middle_name: 100,
  birthday: 10,
  email: 120,
  contact_number: 20,
  course: 100,
  year_level: 50,
  section: 20,
  enrollment_status: 50,
};

const FILE_TYPE_OPTIONS = [
  { key: 'excel', label: 'Excel', icon: FileSpreadsheet, accept: '.xlsx,.xls,.csv' },
  { key: 'pdf', label: 'PDF', icon: FileText, accept: '.pdf' },
  { key: 'image', label: 'Image', icon: FileImage, accept: '.png,.jpg,.jpeg,.webp' },
];

const STUDENT_COLUMN_ALIASES = {
  student_id: ['student id', 'studentid', 'id number', 'id'],
  first_name: ['first name', 'firstname', 'given name'],
  last_name: ['last name', 'lastname', 'surname', 'family name'],
  middle_name: ['middle name', 'middlename', 'middle initial'],
  birthday: ['birthday', 'birth date', 'date of birth', 'dob'],
  email: ['email', 'email address'],
  contact_number: ['contact number', 'contact', 'phone', 'mobile', 'contact no'],
  course: ['course', 'program'],
  year_level: ['year level', 'yearlevel', 'year', 'level'],
  section: ['section', 'sec', 'section name'],
  enrollment_status: ['enrollment status', 'status', 'enrollment'],
};

const YEAR_LEVEL_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const ENROLLMENT_STATUS_OPTIONS = ['Enrolled', 'Irregular', 'On Leave', 'Graduated', 'Dropped'];

const skillLevels = ['Beginner', 'Intermediate', 'Advanced', 'Competitive'];
const violationSuggestions = [
  'Attendance',
  'Dress Code',
  'Late Submission',
  'Misconduct',
  'Property Damage',
];

function sanitizeValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function sameCourse(left, right) {
  return sanitizeValue(left).toUpperCase() === sanitizeValue(right).toUpperCase();
}

function normalizeHeaderName(value) {
  return sanitizeValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeHeaderToken(value) {
  return sanitizeValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function headerMatchesAlias(header, alias) {
  const headerName = normalizeHeaderName(header);
  const aliasName = normalizeHeaderName(alias);
  if (headerName === aliasName) return true;

  const headerToken = normalizeHeaderToken(header);
  const aliasToken = normalizeHeaderToken(alias);
  if (!headerToken || !aliasToken) return false;
  if (headerToken === aliasToken) return true;
  if (aliasToken.length >= 5 && headerToken.includes(aliasToken)) return true;
  if (headerToken.length >= 5 && aliasToken.includes(headerToken)) return true;
  return false;
}

function scoreHeaderRow(headers) {
  const matchedFields = new Set();
  Object.entries(STUDENT_COLUMN_ALIASES).forEach(([fieldKey, aliases]) => {
    const matched = aliases.some((alias) => headers.some((header) => headerMatchesAlias(header, alias)));
    if (matched) matchedFields.add(fieldKey);
  });
  return matchedFields.size;
}

function convertMatrixToObjects(matrix) {
  const meaningfulRows = matrix
    .map((row) => (Array.isArray(row) ? row : []))
    .filter((row) => row.some((cell) => sanitizeValue(cell)));

  if (meaningfulRows.length === 0) {
    return { objects: [], headerScore: 0 };
  }

  let bestHeaderIndex = -1;
  let bestScore = -1;
  const maxScan = Math.min(10, meaningfulRows.length);
  for (let index = 0; index < maxScan; index += 1) {
    const headers = meaningfulRows[index].map((cell) => sanitizeValue(cell));
    const score = scoreHeaderRow(headers);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderIndex = index;
    }
  }

  if (bestHeaderIndex < 0) {
    return { objects: [], headerScore: 0 };
  }

  const headers = meaningfulRows[bestHeaderIndex].map((cell) => sanitizeValue(cell));
  const dataRows = meaningfulRows.slice(bestHeaderIndex + 1);
  const objects = dataRows
    .map((cells) => {
      const rowObject = {};
      headers.forEach((header, index) => {
        if (!header) return;
        rowObject[header] = sanitizeValue(cells[index]);
      });
      return rowObject;
    })
    .filter((rowObject) => Object.values(rowObject).some((value) => sanitizeValue(value)));

  return { objects, headerScore: bestScore };
}

function resolveValueFromAliases(row, aliases) {
  if (!row || typeof row !== 'object') return '';
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([key]) => headerMatchesAlias(key, alias));
    if (found) return sanitizeValue(found[1]);
  }
  return '';
}

function clampField(value, maxLength) {
  return sanitizeValue(value).slice(0, maxLength);
}

function normalizeStudentId(value) {
  const token = sanitizeValue(value).replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  return token;
}

function normalizeName(value) {
  return sanitizeValue(value).replace(/[^A-Za-z .'-]/g, '');
}

function normalizeEmail(value) {
  return sanitizeValue(value).toLowerCase();
}

function normalizePhone(value) {
  return sanitizeValue(value).replace(/\D/g, '').slice(0, 11);
}

function normalizeCourse(value) {
  const raw = sanitizeValue(value).toUpperCase();
  const matched = CORE_COURSES.find((course) => course.toUpperCase() === raw);
  return matched || raw;
}

function normalizeYearLevel(value) {
  const text = sanitizeValue(value);
  const direct = YEAR_LEVEL_OPTIONS.find((year) => year.toLowerCase() === text.toLowerCase());
  if (direct) return direct;

  const match = text.match(/\b(1ST|2ND|3RD|4TH)\b/i);
  if (!match) return '';
  const key = match[1].toLowerCase();
  if (key === '1st') return '1st Year';
  if (key === '2nd') return '2nd Year';
  if (key === '3rd') return '3rd Year';
  if (key === '4th') return '4th Year';
  return '';
}

function normalizeEnrollmentStatus(value) {
  const text = sanitizeValue(value);
  const direct = ENROLLMENT_STATUS_OPTIONS.find((status) => status.toLowerCase() === text.toLowerCase());
  return direct || (text || 'Enrolled');
}

function normalizeBirthday(value) {
  const text = sanitizeValue(value);
  if (!text) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const mmddyyyy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mmddyyyy) {
    const month = mmddyyyy[1].padStart(2, '0');
    const day = mmddyyyy[2].padStart(2, '0');
    const year = mmddyyyy[3];
    return `${year}-${month}-${day}`;
  }

  return text;
}

function toStudentPayload(rawRow) {
  const studentId = normalizeStudentId(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.student_id));
  const firstName = normalizeName(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.first_name));
  const lastName = normalizeName(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.last_name));
  const middleName = normalizeName(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.middle_name));
  const birthday = normalizeBirthday(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.birthday));
  const email = normalizeEmail(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.email));
  const contactNumber = normalizePhone(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.contact_number));
  const course = normalizeCourse(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.course));
  const yearLevel = normalizeYearLevel(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.year_level));
  const section = sanitizeValue(resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.section))
    .replace(/[^A-Za-z0-9-]/g, '')
    .toUpperCase();
  const enrollmentStatus = normalizeEnrollmentStatus(
    resolveValueFromAliases(rawRow, STUDENT_COLUMN_ALIASES.enrollment_status),
  );

  return {
    student_id: clampField(studentId, STUDENT_FIELD_LIMITS.student_id),
    first_name: clampField(firstName, STUDENT_FIELD_LIMITS.first_name),
    last_name: clampField(lastName, STUDENT_FIELD_LIMITS.last_name),
    middle_name: clampField(middleName, STUDENT_FIELD_LIMITS.middle_name),
    birthday: clampField(birthday, STUDENT_FIELD_LIMITS.birthday),
    email: clampField(email, STUDENT_FIELD_LIMITS.email),
    contact_number: clampField(contactNumber, STUDENT_FIELD_LIMITS.contact_number),
    course: clampField(course, STUDENT_FIELD_LIMITS.course),
    year_level: clampField(yearLevel, STUDENT_FIELD_LIMITS.year_level),
    section: clampField(section, STUDENT_FIELD_LIMITS.section),
    enrollment_status: clampField(enrollmentStatus, STUDENT_FIELD_LIMITS.enrollment_status),
  };
}

function extractRowsFromText(text) {
  const lines = sanitizeValue(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headerCandidates = lines.slice(0, Math.min(lines.length, 8));
  const splitPatterns = [/\|/, /\t+/, /,\s*/, /\s{2,}/];
  let headerTokens = null;
  let headerPattern = null;
  let headerLineIndex = -1;
  let headerScore = -1;

  headerCandidates.forEach((line, index) => {
    splitPatterns.forEach((pattern) => {
      const tokens = line.split(pattern).map((token) => sanitizeValue(token)).filter(Boolean);
      if (tokens.length < 3) return;
      const score = scoreHeaderRow(tokens);
      if (score > headerScore) {
        headerScore = score;
        headerTokens = tokens;
        headerPattern = pattern;
        headerLineIndex = index;
      }
    });
  });

  if (headerTokens && headerPattern && headerScore >= 2) {
    return lines
      .slice(headerLineIndex + 1)
      .map((line) => line.split(headerPattern).map((token) => sanitizeValue(token)))
      .filter((tokens) => tokens.some(Boolean))
      .map((tokens) => {
        const row = {};
        headerTokens.forEach((header, index) => {
          row[header] = tokens[index] || '';
        });
        return row;
      });
  }

  const heuristicRows = [];
  lines.forEach((line) => {
    const collapsed = line.replace(/\s+/g, ' ').trim();
    const tokens = collapsed.split(' ');
    if (tokens.length < 5) return;

    const studentIdMatch = collapsed.match(/\b\d{4}-\d{3,6}\b/);
    const studentId = studentIdMatch ? studentIdMatch[0] : tokens[0];
    const yearMatch = collapsed.match(/\b(1st|2nd|3rd|4th)\s*Year\b/i);
    const courseMatch = CORE_COURSES.find((course) => collapsed.toUpperCase().includes(course.toUpperCase()));
    if (!studentId || !courseMatch || !yearMatch) return;

    const idIndex = tokens.findIndex((token) => token === studentId);
    const firstName = tokens[idIndex + 1] || '';
    const lastName = tokens[idIndex + 2] || '';
    const middleName = tokens[idIndex + 3] && !CORE_COURSES.includes(tokens[idIndex + 3].toUpperCase()) ? tokens[idIndex + 3] : '';
    const emailMatch = collapsed.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    const phoneMatch = collapsed.match(/\b09\d{9}\b/);

    heuristicRows.push({
      'Student ID': studentId,
      'First Name': firstName,
      'Last Name': lastName,
      'Middle Name': middleName,
      Birthday: '',
      Email: emailMatch ? emailMatch[0] : '',
      'Contact Number': phoneMatch ? phoneMatch[0] : '',
      Course: courseMatch,
      'Year Level': yearMatch[0],
      Section: '',
      'Enrollment Status': 'Enrolled',
    });
  });

  return heuristicRows;
}

function truncateToWidth(ctx, value, width) {
  const suffix = '...';
  const text = sanitizeValue(value);
  if (!text) return '';
  if (ctx.measureText(text).width <= width) return text;

  let output = text;
  while (output.length > 0 && ctx.measureText(`${output}${suffix}`).width > width) {
    output = output.slice(0, -1);
  }
  return output ? `${output}${suffix}` : '';
}

function buildStudentCanvasTable(rows) {
  const paddingX = 12;
  const rowHeight = 34;
  const headerHeight = 40;
  const tableWidth = STUDENT_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
  const titleHeight = 52;
  const footerHeight = 24;
  const canvas = document.createElement('canvas');
  canvas.width = tableWidth + 2;
  canvas.height = titleHeight + headerHeight + (rows.length * rowHeight) + footerHeight + 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Student Export', paddingX, 30);
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Arial';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, paddingX, 46);

  const tableTop = titleHeight;
  ctx.fillStyle = '#f97316';
  ctx.fillRect(1, tableTop + 1, tableWidth, headerHeight - 1);

  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#ffffff';
  let cursorX = 1;
  STUDENT_EXPORT_COLUMNS.forEach((column, index) => {
    const width = STUDENT_COLUMN_WIDTHS[index];
    const text = truncateToWidth(ctx, column.label, width - (paddingX * 2));
    ctx.fillText(text, cursorX + paddingX, tableTop + 24);
    cursorX += width;
  });

  rows.forEach((row, rowIndex) => {
    const top = tableTop + headerHeight + (rowIndex * rowHeight);
    ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
    ctx.fillRect(1, top, tableWidth, rowHeight);
  });

  ctx.font = '12px Arial';
  ctx.fillStyle = '#111827';
  rows.forEach((row, rowIndex) => {
    let cellX = 1;
    const top = tableTop + headerHeight + (rowIndex * rowHeight);
    STUDENT_EXPORT_COLUMNS.forEach((column, columnIndex) => {
      const width = STUDENT_COLUMN_WIDTHS[columnIndex];
      const rawValue = row[column.label] ?? '';
      const text = truncateToWidth(ctx, rawValue, width - (paddingX * 2));
      ctx.fillText(text, cellX + paddingX, top + 22);
      cellX += width;
    });
  });

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, tableTop + 0.5, tableWidth + 1, headerHeight + (rows.length * rowHeight) + 1);

  let gridX = 1;
  STUDENT_COLUMN_WIDTHS.forEach((width) => {
    ctx.beginPath();
    ctx.moveTo(gridX + 0.5, tableTop + 0.5);
    ctx.lineTo(gridX + 0.5, tableTop + headerHeight + (rows.length * rowHeight) + 1);
    ctx.stroke();
    gridX += width;
  });

  for (let index = 0; index <= rows.length; index += 1) {
    const y = tableTop + headerHeight + (index * rowHeight) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0.5, y);
    ctx.lineTo(tableWidth + 1.5, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Arial';
  ctx.fillText(`Total rows exported: ${rows.length}`, paddingX, canvas.height - 8);
  return canvas;
}

function getTopItems(items, limit = 4) {
  const counts = new Map();

  items
    .filter(Boolean)
    .forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function parseAcademicDetails(record) {
  const details = parseOptionalJson(record?.details, null);
  if (!details || Array.isArray(details)) {
    return null;
  }
  return details;
}

function buildAcademicPayload(form) {
  return {
    academic_year: form.academic_year.trim(),
    course: form.course,
    details: JSON.stringify({
      school_name: form.school_name.trim(),
      start_period: form.start_period.trim(),
      end_period: form.end_period.trim(),
      award: form.award.trim(),
      notes: form.notes.trim(),
    }),
  };
}

function studentMatchesSchedule(student, schedule) {
  if (!student || !schedule) {
    return false;
  }

  if (schedule.course !== student.course) {
    return false;
  }

  if (schedule.year_level && student.year_level) {
    if (schedule.year_level !== student.year_level) {
      return false;
    }
  }

  if (schedule.section && student.section) {
    return schedule.section === student.section;
  }

  return true;
}

function studentMatchesFacultySchedule(student, schedule) {
  if (!student || !schedule) {
    return false;
  }

  if (schedule.course && student.course !== schedule.course) {
    return false;
  }

  if (schedule.year_level && student.year_level && schedule.year_level !== student.year_level) {
    return false;
  }

  if (schedule.section) {
    const studentSection = (student.section || '').trim().toUpperCase();
    const scheduleSection = (schedule.section || '').trim().toUpperCase();
    return studentSection === scheduleSection;
  }

  return true;
}

function buildStudentPayload(formData) {
  return {
    student_id: (formData.student_id || '').trim(),
    first_name: (formData.first_name || '').trim(),
    last_name: (formData.last_name || '').trim(),
    middle_name: (formData.middle_name || '').trim(),
    birthday: (formData.birthday || '').trim(),
    email: (formData.email || '').trim(),
    contact_number: (formData.contact_number || '').trim(),
    course: formData.course,
    year_level: formData.year_level,
    section: (formData.section || '').trim().toUpperCase(),
    enrollment_status: formData.enrollment_status,
  };
}

function DetailSectionCard({ title, subtitle, actionLabel, onAction, children }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-700"
          >
            <Plus size={14} />
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ItemActionButtons({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-2xl border border-slate-200 p-2 text-slate-400 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
        title="Edit item"
      >
        <Edit3 size={14} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-2xl border border-slate-200 p-2 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        title="Delete item"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function StudentRecords({ navigationIntent, clearNavigationIntent, onNavigate }) {
  const navigate = useNavigate();
  const { id: routeStudentId } = useParams();
  const { user, accessRole } = useSession();
  const { showError, showSuccess, showInfo, confirm } = useUI();
  const [students, setStudents] = useState([]);
  const [facultyProfiles, setFacultyProfiles] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supportLoading, setSupportLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterYearLevel, setFilterYearLevel] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [activityQuery, setActivityQuery] = useState('');
  const [affiliationQuery, setAffiliationQuery] = useState('');
  const [formData, setFormData] = useState(defaultStudentForm);
  const [detailForms, setDetailForms] = useState(defaultDetailForms);
  const [organizations, setOrganizations] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [events, setEvents] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [exportingFormat, setExportingFormat] = useState('');
  const [importingFormat, setImportingFormat] = useState('');
  const [openActionMenu, setOpenActionMenu] = useState('');
  const [pendingImportType, setPendingImportType] = useState('excel');
  const actionMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingImportTypeRef = useRef('excel');
  const isProcessingFile = Boolean(exportingFormat || importingFormat);

  const fetchStudents = useCallback(
    async ({
      search = '',
      course = '',
      year_level = '',
      skill = '',
      activity = '',
      affiliation = '',
    } = {}) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (course) params.append('course', course);
        if (year_level) params.append('year_level', year_level);
        if (skill) params.append('skill', skill);
        if (activity) params.append('activity', activity);
        if (affiliation) params.append('affiliation', affiliation);

        const query = params.toString();
        const response = await apiRequest(`/api/students${query ? `?${query}` : ''}`);
        setStudents(response.data || []);
      } catch (error) {
        showError('Unable to load student records', error.message);
      } finally {
        setLoading(false);
      }
    },
    [showError],
  );

  const fetchSupportData = useCallback(async () => {
    try {
      setSupportLoading(true);
      const results = await Promise.allSettled([
        apiRequest('/api/organizations'),
        apiRequest('/api/schedules'),
        apiRequest('/api/reports?report_type=event'),
        apiRequest('/api/syllabus'),
        apiRequest('/api/curriculum'),
        apiRequest('/api/lessons'),
        apiRequest('/api/faculty'),
      ]);

      const [orgs, scheduleData, eventData, syllabusData, curriculumData, lessonData, facultyData] = results.map(
        (result) => (result.status === 'fulfilled' ? result.value.data || [] : []),
      );

      setOrganizations(orgs);
      setSchedules(scheduleData);
      setEvents(eventData);
      setSyllabi(syllabusData);
      setCurricula(curriculumData);
      setLessons(lessonData);
      setFacultyProfiles(facultyData);

      if (results.some((result) => result.status === 'rejected')) {
        showInfo('Some linked data is unavailable', 'Student profiles still work, but a few connected summaries may be incomplete.');
      }
    } finally {
      setSupportLoading(false);
    }
  }, [showInfo]);

  const facultyLoginTokens = useMemo(
    () => [user?.email, user?.username].map((value) => sanitizeValue(value).toLowerCase()).filter(Boolean),
    [user?.email, user?.username],
  );

  const matchedFacultyProfile = useMemo(
    () =>
      facultyProfiles.find((item) => {
        const email = sanitizeValue(item.email).toLowerCase();
        const employeeNumber = sanitizeValue(item.employee_number).toLowerCase();
        return facultyLoginTokens.some((token) => token === email || token === employeeNumber);
      }) || null,
    [facultyLoginTokens, facultyProfiles],
  );

  const normalizedFacultyPosition = sanitizeValue(matchedFacultyProfile?.position).toLowerCase();
  const hasChairPosition = ['department chair', 'dept chair', 'chair', 'chairperson'].includes(normalizedFacultyPosition);
  const isChairUser = accessRole === 'CHAIR' || (accessRole === 'FACULTY' && hasChairPosition);
  const isFacultyUser = accessRole === 'FACULTY' && !hasChairPosition;
  const facultyProfile = isFacultyUser ? matchedFacultyProfile : null;
  const chairProfile = isChairUser ? matchedFacultyProfile : null;
  const chairDepartment = sanitizeValue(chairProfile?.department);

  const facultyAssignedSchedules = useMemo(() => {
    if (!isFacultyUser || !facultyProfile) {
      return [];
    }
    return schedules.filter((schedule) => matchesFacultyAssignment(schedule, facultyProfile));
  }, [facultyProfile, isFacultyUser, schedules]);

  const canRoleAccessStudent = useCallback(
    (studentRecord) => {
      if (isFacultyUser) {
        if (!facultyProfile || facultyAssignedSchedules.length === 0) {
          return false;
        }
        return facultyAssignedSchedules.some((schedule) => studentMatchesFacultySchedule(studentRecord, schedule));
      }

      if (isChairUser) {
        if (!chairDepartment) {
          return false;
        }
        return sameCourse(studentRecord?.course, chairDepartment);
      }

      return true;
    },
    [chairDepartment, facultyAssignedSchedules, facultyProfile, isChairUser, isFacultyUser],
  );

  const scopedStudents = useMemo(() => {
    if (isFacultyUser && (!facultyProfile || facultyAssignedSchedules.length === 0)) {
      return [];
    }

    if (isChairUser && !chairDepartment) {
      return [];
    }

    return students.filter((student) => canRoleAccessStudent(student));
  }, [
    canRoleAccessStudent,
    chairDepartment,
    facultyAssignedSchedules.length,
    facultyProfile,
    isChairUser,
    isFacultyUser,
    students,
  ]);

  const fetchStudentDetails = useCallback(
    async (studentId) => {
      try {
        const response = await apiRequest(`/api/students/${studentId}`);
        if (!canRoleAccessStudent(response.data)) {
          showError(
            'Access restricted',
            isChairUser
              ? `You can only view student profiles under ${chairDepartment || 'your assigned'} department.`
              : 'You can only view student profiles from sections assigned to you.',
          );
          setSelectedStudent(null);
          navigate('/users');
          return null;
        }
        setSelectedStudent(response.data);
        return response.data;
      } catch (error) {
        showError('Unable to open student profile', error.message);
        return null;
      }
    },
    [canRoleAccessStudent, chairDepartment, isChairUser, navigate, showError],
  );

  useEffect(() => {
    fetchSupportData();
  }, [fetchSupportData]);

  useEffect(() => {
    if (!isChairUser) {
      return;
    }
    setFilterCourse(chairDepartment || '');
  }, [chairDepartment, isChairUser]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchStudents({
        search: searchTerm,
        course: filterCourse,
        year_level: filterYearLevel,
        skill: skillQuery,
        activity: activityQuery,
        affiliation: affiliationQuery,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchTerm, filterCourse, filterYearLevel, skillQuery, activityQuery, affiliationQuery, fetchStudents]);

  useEffect(() => {
    if (navigationIntent?.tab !== 'students') {
      return;
    }

    const context = navigationIntent.context || {};
    if (Object.prototype.hasOwnProperty.call(context, 'search')) setSearchTerm(context.search || '');
    if (Object.prototype.hasOwnProperty.call(context, 'course')) setFilterCourse(context.course || '');
    if (Object.prototype.hasOwnProperty.call(context, 'year_level')) setFilterYearLevel(context.year_level || '');
    if (Object.prototype.hasOwnProperty.call(context, 'skill')) setSkillQuery(context.skill || '');
    if (Object.prototype.hasOwnProperty.call(context, 'activity')) setActivityQuery(context.activity || '');
    if (Object.prototype.hasOwnProperty.call(context, 'affiliation')) setAffiliationQuery(context.affiliation || '');

    if (context.studentId) {
      navigate('/users/' + context.studentId);
    }

    clearNavigationIntent?.();
  }, [navigationIntent, clearNavigationIntent, navigate]);

  useEffect(() => {
    if (!routeStudentId) {
      setSelectedStudent(null);
      return;
    }

    if (String(selectedStudent?.id) === String(routeStudentId)) {
      return;
    }

    fetchStudentDetails(routeStudentId);
  }, [fetchStudentDetails, routeStudentId, selectedStudent?.id]);

  useEffect(() => {
    if (!selectedStudent) {
      return;
    }
    if (canRoleAccessStudent(selectedStudent)) {
      return;
    }
    setSelectedStudent(null);
    if (routeStudentId) {
      navigate('/users');
    }
  }, [canRoleAccessStudent, navigate, routeStudentId, selectedStudent]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setOpenActionMenu('');
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const refreshCurrentView = useCallback(async () => {
    await fetchStudents({
      search: searchTerm,
      course: filterCourse,
      year_level: filterYearLevel,
      skill: skillQuery,
      activity: activityQuery,
      affiliation: affiliationQuery,
    });

    if (selectedStudent?.id) {
      await fetchStudentDetails(selectedStudent.id);
    }
  }, [
    activityQuery,
    affiliationQuery,
    fetchStudentDetails,
    fetchStudents,
    filterCourse,
    filterYearLevel,
    searchTerm,
    selectedStudent?.id,
    skillQuery,
  ]);

  const quickSkillQueries = useMemo(
    () => getTopItems(scopedStudents.flatMap((student) => (student.skills || []).map((skill) => skill.skill_name))),
    [scopedStudents],
  );

  const quickActivityQueries = useMemo(
    () =>
      getTopItems(
        scopedStudents.flatMap((student) => (student.activities || []).map((activity) => activity.activity_name || activity.activity_type)),
        3,
      ),
    [scopedStudents],
  );

  const quickAffiliationQueries = useMemo(
    () => getTopItems(scopedStudents.flatMap((student) => (student.affiliations || []).map((item) => item.name)), 3),
    [scopedStudents],
  );

  const skillSuggestions = useMemo(
    () => getTopItems(scopedStudents.flatMap((student) => (student.skills || []).map((skill) => skill.skill_name)), 10).map((item) => item.label),
    [scopedStudents],
  );

  const activitySuggestions = useMemo(
    () =>
      getTopItems(
        scopedStudents.flatMap((student) => (student.activities || []).map((activity) => activity.activity_name || activity.activity_type)),
        10,
      ).map((item) => item.label),
    [scopedStudents],
  );

  const affiliationSuggestions = useMemo(() => {
    const organizationNames = organizations.map((org) => org.name);
    const existingAffiliations = scopedStudents.flatMap((student) => (student.affiliations || []).map((item) => item.name));
    return [...new Set([...organizationNames, ...existingAffiliations].filter(Boolean))].sort();
  }, [organizations, scopedStudents]);

  const selectedStudentSchedules = useMemo(
    () => schedules.filter((schedule) => studentMatchesSchedule(selectedStudent, schedule)),
    [schedules, selectedStudent],
  );

  const selectedStudentSyllabi = useMemo(() => {
    if (!selectedStudent) {
      return [];
    }

    const relatedSubjects = new Set(selectedStudentSchedules.map((schedule) => schedule.subject?.toLowerCase()).filter(Boolean));
    return syllabi.filter((syllabus) => {
      if (syllabus.course !== selectedStudent.course) {
        return false;
      }

      if (relatedSubjects.size === 0) {
        return true;
      }

      const subject = (syllabus.subject || '').toLowerCase();
      const code = (syllabus.code || '').toLowerCase();
      return [...relatedSubjects].some((value) => subject.includes(value) || value.includes(subject) || code.includes(value));
    });
  }, [selectedStudent, selectedStudentSchedules, syllabi]);

  const selectedStudentLessons = useMemo(() => {
    const syllabusIds = new Set(selectedStudentSyllabi.map((item) => item.id));
    return lessons.filter((lesson) => syllabusIds.has(lesson.syllabus_id));
  }, [lessons, selectedStudentSyllabi]);

  const selectedStudentCurriculum = useMemo(
    () => curricula.find((curriculum) => curriculum.course === selectedStudent?.course) || null,
    [curricula, selectedStudent],
  );

  const selectedStudentEvents = useMemo(() => {
    if (!selectedStudent) {
      return [];
    }

    const affiliations = new Set((selectedStudent.affiliations || []).map((item) => item.name?.toLowerCase()).filter(Boolean));
    return events.filter((event) => affiliations.has((event.organization || '').toLowerCase()));
  }, [events, selectedStudent]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterCourse(isChairUser ? chairDepartment : '');
    setFilterYearLevel('');
    setSkillQuery('');
    setActivityQuery('');
    setAffiliationQuery('');
  };

  const getValidatedStudentExportRows = () => {
    const rows = [];
    let skippedCount = 0;

    scopedStudents.forEach((student) => {
      const isValid = STUDENT_REQUIRED_KEYS.every((requiredKey) => sanitizeValue(student[requiredKey]));
      if (!isValid) {
        skippedCount += 1;
        return;
      }

      const row = {};
      STUDENT_EXPORT_COLUMNS.forEach((column) => {
        row[column.label] = sanitizeValue(student[column.key]);
      });
      rows.push(row);
    });

    return { rows, skippedCount };
  };

  const canExportRows = (count) => {
    if (count > 0) {
      return true;
    }
    showError(
      'No rows exported',
      'Every row is missing at least one required field (Student ID, First Name, Last Name, Birthday, Course, Year Level).',
    );
    return false;
  };

  const showExportSummary = (rowsCount, skippedCount, formatLabel) => {
    if (skippedCount > 0) {
      showSuccess(
        `${formatLabel} exported`,
        `${rowsCount} row(s) exported. ${skippedCount} row(s) skipped due to missing required fields.`,
      );
      return;
    }
    showSuccess(`${formatLabel} exported`, `${rowsCount} row(s) exported successfully.`);
  };

  const exportStudentsAsExcel = async () => {
    const { rows, skippedCount } = getValidatedStudentExportRows();
    if (!canExportRows(rows.length)) return;

    setExportingFormat('excel');
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(rows, {
        header: STUDENT_EXPORT_COLUMNS.map((column) => column.label),
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
      XLSX.writeFile(workbook, `students-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showExportSummary(rows.length, skippedCount, 'Excel');
    } catch (error) {
      showError('Excel export failed', error.message || 'Unable to export Excel file.');
    } finally {
      setExportingFormat('');
    }
  };

  const exportStudentsAsImage = async () => {
    const { rows, skippedCount } = getValidatedStudentExportRows();
    if (!canExportRows(rows.length)) return;

    setExportingFormat('image');
    try {
      const canvas = buildStudentCanvasTable(rows);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `students-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showExportSummary(rows.length, skippedCount, 'Image');
    } catch (error) {
      showError('Image export failed', error.message || 'Unable to export image file.');
    } finally {
      setExportingFormat('');
    }
  };

  const exportStudentsAsPdf = async () => {
    const { rows, skippedCount } = getValidatedStudentExportRows();
    if (!canExportRows(rows.length)) return;

    setExportingFormat('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const canvas = buildStudentCanvasTable(rows);
      const imageData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const renderWidth = pageWidth - (margin * 2);
      const renderHeight = (canvas.height * renderWidth) / canvas.width;
      const printableHeight = pageHeight - (margin * 2);

      let heightLeft = renderHeight;
      let positionY = margin;
      pdf.addImage(imageData, 'PNG', margin, positionY, renderWidth, renderHeight);
      heightLeft -= printableHeight;

      while (heightLeft > 0) {
        positionY = margin - (renderHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imageData, 'PNG', margin, positionY, renderWidth, renderHeight);
        heightLeft -= printableHeight;
      }

      pdf.save(`students-${new Date().toISOString().slice(0, 10)}.pdf`);
      showExportSummary(rows.length, skippedCount, 'PDF');
    } catch (error) {
      showError('PDF export failed', error.message || 'Unable to export PDF file.');
    } finally {
      setExportingFormat('');
    }
  };

  const handleChooseExportType = async (typeKey) => {
    if (isProcessingFile) return;
    setOpenActionMenu('');

    if (typeKey === 'excel') {
      await exportStudentsAsExcel();
      return;
    }
    if (typeKey === 'pdf') {
      await exportStudentsAsPdf();
      return;
    }
    await exportStudentsAsImage();
  };

  const parseExcelImportFile = async (file) => {
    const XLSX = await import('xlsx');
    const rawBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(rawBuffer, { type: 'array', raw: false });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    if (!firstSheet) return [];

    const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });
    const { objects, headerScore } = convertMatrixToObjects(matrix);
    if (objects.length === 0) return [];

    const payloads = objects.map(toStudentPayload);
    const hasRequiredData = payloads.some((payload) =>
      STUDENT_REQUIRED_KEYS.every((requiredKey) => sanitizeValue(payload[requiredKey])),
    );
    if (!hasRequiredData && headerScore < 2) {
      throw new Error(
        'Could not detect student columns. Check headers like Student ID, First Name, Last Name, Birthday, Course, Year Level.',
      );
    }
    return payloads;
  };

  const parsePdfImportFile = async (file) => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const rawBuffer = await file.arrayBuffer();
    const task = pdfjs.getDocument({ data: new Uint8Array(rawBuffer), disableWorker: true });
    const pdf = await task.promise;

    let aggregatedText = '';
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => sanitizeValue(item.str)).join(' ');
      aggregatedText += `${pageText}\n`;
    }

    return extractRowsFromText(aggregatedText).map(toStudentPayload);
  };

  const parseImageImportFile = async (file) => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(file);
      return extractRowsFromText(text).map(toStudentPayload);
    } finally {
      await worker.terminate();
    }
  };

  const handleChooseImportType = (typeKey) => {
    if (isFacultyUser) {
      showError('Action not allowed', 'Faculty accounts cannot import student profiles.');
      return;
    }
    if (isChairUser && !chairDepartment) {
      showError('Access restricted', 'Your chair account is not linked to any department yet.');
      return;
    }
    if (isProcessingFile) return;
    pendingImportTypeRef.current = typeKey;
    setPendingImportType(typeKey);
    setOpenActionMenu('');

    if (fileInputRef.current) {
      const selected = FILE_TYPE_OPTIONS.find((option) => option.key === typeKey);
      if (selected) fileInputRef.current.setAttribute('accept', selected.accept);
      fileInputRef.current.value = '';
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  };

  const handleImportFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (isChairUser && !chairDepartment) {
      event.target.value = '';
      showError('Access restricted', 'Your chair account is not linked to any department yet.');
      return;
    }

    const importType = pendingImportTypeRef.current;
    setImportingFormat(importType);
    try {
      let payloads = [];
      if (importType === 'excel') {
        payloads = await parseExcelImportFile(selectedFile);
      } else if (importType === 'pdf') {
        payloads = await parsePdfImportFile(selectedFile);
      } else {
        payloads = await parseImageImportFile(selectedFile);
      }

      if (payloads.length === 0) {
        showError('Import failed', 'No student rows were detected in the selected file.');
        return;
      }

      const validPayloads = [];
      let skippedRequired = 0;
      let skippedDepartment = 0;
      payloads.forEach((payload) => {
        const hasRequired = STUDENT_REQUIRED_KEYS.every((requiredKey) => sanitizeValue(payload[requiredKey]));
        if (!hasRequired) {
          skippedRequired += 1;
          return;
        }
        if (isChairUser && chairDepartment && !sameCourse(payload.course, chairDepartment)) {
          skippedDepartment += 1;
          return;
        }
        validPayloads.push(payload);
      });

      if (validPayloads.length === 0) {
        showError(
          'Import failed',
          'All detected rows are missing required fields (Student ID, First Name, Last Name, Birthday, Course, Year Level).',
        );
        return;
      }

      let createdCount = 0;
      let failedCount = 0;
      let firstFailure = '';

      for (const payload of validPayloads) {
        try {
          await apiRequest('/api/students', { method: 'POST', body: payload });
          createdCount += 1;
        } catch (error) {
          failedCount += 1;
          if (!firstFailure) firstFailure = error.message || 'Unknown import error';
        }
      }

      await refreshCurrentView();

      if (createdCount > 0) {
        const parts = [`${createdCount} row(s) imported`];
        if (skippedRequired > 0) parts.push(`${skippedRequired} row(s) skipped for missing required fields`);
        if (skippedDepartment > 0) parts.push(`${skippedDepartment} row(s) skipped outside ${chairDepartment}`);
        if (failedCount > 0) parts.push(`${failedCount} row(s) failed to save`);
        showSuccess('Import completed', `${parts.join(', ')}.`);
      } else {
        showError('Import failed', firstFailure || 'No rows were imported.');
      }
    } catch (error) {
      showError('Import failed', error.message || 'Unable to import file.');
    } finally {
      setImportingFormat('');
      event.target.value = '';
    }
  };

  const handleSelectStudent = async (studentId) => {
    await fetchStudentDetails(studentId);
    navigate('/users/' + studentId);
  };

  const openAddStudentModal = () => {
    if (isFacultyUser) {
      showError('Action not allowed', 'Faculty accounts cannot add student profiles.');
      return;
    }
    if (isChairUser && !chairDepartment) {
      showError('Access restricted', 'Your chair account is not linked to any department yet.');
      return;
    }
    setFormData({
      ...defaultStudentForm,
      course: isChairUser && chairDepartment ? chairDepartment : defaultStudentForm.course,
    });
    setShowAddModal(true);
  };

  const openEditStudentModal = (student) => {
    setFormData({
      student_id: student.student_id || '',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      middle_name: student.middle_name || '',
      birthday: student.birthday ? String(student.birthday).split('T')[0] : '',
      email: student.email || '',
      contact_number: student.contact_number || '',
      course: isChairUser && chairDepartment ? chairDepartment : (student.course || 'BSIT'),
      year_level: student.year_level || '1st Year',
      section: student.section || '',
      enrollment_status: student.enrollment_status || 'Enrolled',
    });
    setShowEditModal(true);
  };

  const handleAddStudent = async (event) => {
    event.preventDefault();
    if (isFacultyUser) {
      showError('Action not allowed', 'Faculty accounts cannot add student profiles.');
      return;
    }
    if (isChairUser && !chairDepartment) {
      showError('Access restricted', 'Your chair account is not linked to any department yet.');
      return;
    }
    try {
      const payload = buildStudentPayload(formData);
      if (isChairUser && chairDepartment) {
        payload.course = chairDepartment;
      }
      const response = await apiRequest('/api/students', {
        method: 'POST',
        body: payload,
      });
      setShowAddModal(false);
      setFormData(defaultStudentForm);
      await refreshCurrentView();
      await fetchStudentDetails(response.data.id);
      navigate('/users/' + response.data.id);
      const credentialsHint = response.account
        ? `Account ID: ${response.account.email} | Default password: ${response.account.password}`
        : 'The new student is now part of the searchable list.';
      showSuccess('Student profile added', credentialsHint);
      showSuccess('Student profile added', 'The new student is now part of the searchable list.');
    } catch (error) {
      showError('Unable to add student', error.message);
    }
  };

  const handleEditStudent = async (event) => {
    event.preventDefault();
    if (!selectedStudent?.id) {
      return;
    }
    if (isChairUser && !chairDepartment) {
      showError('Access restricted', 'Your chair account is not linked to any department yet.');
      return;
    }

    try {
      const payload = buildStudentPayload(formData);
      if (isChairUser && chairDepartment) {
        payload.course = chairDepartment;
      }
      await apiRequest(`/api/students/${selectedStudent.id}`, {
        method: 'PUT',
        body: payload,
      });
      setShowEditModal(false);
      await refreshCurrentView();
      showSuccess('Student profile updated', 'The profile details were saved successfully.');
    } catch (error) {
      showError('Unable to update student', error.message);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent?.id) {
      return;
    }

    const approved = await confirm({
      title: 'Delete student profile?',
      description: `This will remove ${selectedStudent.first_name} ${selectedStudent.last_name} and all connected student detail records.`,
      confirmText: 'Delete student',
      tone: 'danger',
    });

    if (!approved) {
      return;
    }

    try {
      await apiRequest(`/api/students/${selectedStudent.id}`, { method: 'DELETE' });
      setSelectedStudent(null);
      await refreshCurrentView();
      showSuccess('Student deleted', 'The student profile was removed.');
    } catch (error) {
      showError('Unable to delete student', error.message);
    }
  };

  const openDetailModal = (type, item = null) => {
    if (type === 'skill') {
      setDetailForms((current) => ({
        ...current,
        skill: {
          skill_name: item?.skill_name || '',
          level: item?.level || 'Intermediate',
        },
      }));
    }

    if (type === 'academic') {
      const details = parseAcademicDetails(item) || {};
      setDetailForms((current) => ({
        ...current,
        academic: {
          academic_year: item?.academic_year || '',
          course: item?.course || selectedStudent?.course || 'BSIT',
          school_name: details.school_name || '',
          start_period: details.start_period || '',
          end_period: details.end_period || '',
          award: details.award || '',
          notes: details.notes || (item?.details && !details.school_name ? item.details : ''),
        },
      }));
    }

    if (type === 'activity') {
      setDetailForms((current) => ({
        ...current,
        activity: {
          activity_type: item?.activity_type || ACTIVITY_TYPES[0],
          activity_name: item?.activity_name || '',
          details: item?.details || '',
        },
      }));
    }

    if (type === 'violation') {
      setDetailForms((current) => ({
        ...current,
        violation: {
          violation_name: item?.violation_name || '',
          severity: item?.severity || VIOLATION_SEVERITIES[0],
          date: item?.date ? item.date.split('T')[0] : '',
          details: item?.details || '',
        },
      }));
    }

    if (type === 'affiliation') {
      setDetailForms((current) => ({
        ...current,
        affiliation: {
          category: item?.category || AFFILIATION_CATEGORIES[0],
          name: item?.name || '',
          role: item?.role || AFFILIATION_ROLES[0],
        },
      }));
    }

    setDetailModal({ type, mode: item ? 'edit' : 'add', item });
  };

  const closeDetailModal = () => {
    setDetailModal(null);
    setDetailForms(defaultDetailForms);
  };

  const handleDetailSubmit = async (event) => {
    event.preventDefault();
    if (!selectedStudent?.id || !detailModal?.type) {
      return;
    }

    const endpointMap = {
      skill: 'skills',
      academic: 'academic-history',
      activity: 'activities',
      violation: 'violations',
      affiliation: 'affiliations',
    };

    const payloadMap = {
      skill: detailForms.skill,
      academic: buildAcademicPayload(detailForms.academic),
      activity: {
        activity_type: detailForms.activity.activity_type,
        activity_name: detailForms.activity.activity_name.trim(),
        details: detailForms.activity.details.trim(),
      },
      violation: {
        violation_name: detailForms.violation.violation_name.trim(),
        severity: detailForms.violation.severity,
        date: detailForms.violation.date,
        details: detailForms.violation.details.trim(),
      },
      affiliation: {
        category: detailForms.affiliation.category,
        name: detailForms.affiliation.name.trim(),
        role: detailForms.affiliation.role,
      },
    };

    const basePath = `/api/students/${selectedStudent.id}/${endpointMap[detailModal.type]}`;
    const url = detailModal.mode === 'edit' ? `${basePath}/${detailModal.item.id}` : basePath;

    try {
      await apiRequest(url, {
        method: detailModal.mode === 'edit' ? 'PUT' : 'POST',
        body: payloadMap[detailModal.type],
      });
      closeDetailModal();
      await refreshCurrentView();
      showSuccess(
        `${detailModal.mode === 'edit' ? 'Updated' : 'Added'} successfully`,
        `The ${detailModal.type.replace('-', ' ')} record is now part of the student profile.`,
      );
    } catch (error) {
      showError('Unable to save record', error.message);
    }
  };

  const handleDeleteDetail = async (type, item) => {
    if (!selectedStudent?.id || !item?.id) {
      return;
    }

    const endpointMap = {
      skill: 'skills',
      academic: 'academic-history',
      activity: 'activities',
      violation: 'violations',
      affiliation: 'affiliations',
    };

    const labelMap = {
      skill: item.skill_name,
      academic: item.course || item.academic_year || 'Academic History',
      activity: item.activity_name,
      violation: item.violation_name,
      affiliation: item.name,
    };

    const approved = await confirm({
      title: `Delete ${type} record?`,
      description: `This removes "${labelMap[type] || 'selected record'}" from ${selectedStudent.first_name}'s profile.`,
      confirmText: 'Delete record',
      tone: 'danger',
    });

    if (!approved) {
      return;
    }

    try {
      await apiRequest(`/api/students/${selectedStudent.id}/${endpointMap[type]}/${item.id}`, {
        method: 'DELETE',
      });
      await refreshCurrentView();
      showSuccess('Record deleted', 'The student detail entry was removed.');
    } catch (error) {
      showError('Unable to delete record', error.message);
    }
  };

  const renderDetailModalContent = () => {
    if (!detailModal) {
      return null;
    }

    if (detailModal.type === 'skill') {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Skill name *</span>
              <input
                list="skill-options"
                type="text"
                required
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
                value={detailForms.skill.skill_name}
                onChange={(event) =>
                  setDetailForms((current) => ({
                    ...current,
                    skill: { ...current.skill, skill_name: event.target.value },
                  }))
                }
                placeholder="e.g., Programming"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Proficiency</span>
              <select
                className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
                value={detailForms.skill.level}
                onChange={(event) =>
                  setDetailForms((current) => ({
                    ...current,
                    skill: { ...current.skill, level: event.target.value },
                  }))
                }
              >
                {skillLevels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
          </div>
          <datalist id="skill-options">
            {skillSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </>
      );
    }

    if (detailModal.type === 'academic') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Academic year *</span>
            <input
              type="text"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.academic.academic_year}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  academic: { ...current.academic, academic_year: event.target.value },
                }))
              }
              placeholder="e.g., 2024-2025"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Course</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.academic.course}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  academic: { ...current.academic, course: event.target.value },
                }))
              }
            >
              {CORE_COURSES.map((course) => (
                <option key={course}>{course}</option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">School / Institution</span>
            <input
              type="text"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.academic.school_name}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  academic: { ...current.academic, school_name: event.target.value },
                }))
              }
              placeholder="e.g., University of Cabuyao"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Start period</span>
            <input
              type="text"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.academic.start_period}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  academic: { ...current.academic, start_period: event.target.value },
                }))
              }
              placeholder="e.g., August 2024"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">End period</span>
            <input
              type="text"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.academic.end_period}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  academic: { ...current.academic, end_period: event.target.value },
                }))
              }
              placeholder="e.g., May 2025"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Awards / distinctions</span>
            <input
              type="text"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.academic.award}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  academic: { ...current.academic, award: event.target.value },
                }))
              }
              placeholder="e.g., Dean's Lister"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Notes</span>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.academic.notes}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  academic: { ...current.academic, notes: event.target.value },
                }))
              }
              placeholder="Add optional notes for this record"
            />
          </label>
        </div>
      );
    }

    if (detailModal.type === 'activity') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Activity type *</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.activity.activity_type}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  activity: { ...current.activity, activity_type: event.target.value },
                }))
              }
            >
              {ACTIVITY_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Activity name *</span>
            <input
              list="activity-options"
              type="text"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.activity.activity_name}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  activity: { ...current.activity, activity_name: event.target.value },
                }))
              }
              placeholder="e.g., Hackathon Kickoff"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Details</span>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.activity.details}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  activity: { ...current.activity, details: event.target.value },
                }))
              }
              placeholder="Role, outcome, or participation notes"
            />
          </label>
          <datalist id="activity-options">
            {activitySuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
      );
    }

    if (detailModal.type === 'violation') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Violation name *</span>
            <input
              list="violation-options"
              type="text"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.violation.violation_name}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  violation: { ...current.violation, violation_name: event.target.value },
                }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Severity</span>
            <select
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.violation.severity}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  violation: { ...current.violation, severity: event.target.value },
                }))
              }
            >
              {VIOLATION_SEVERITIES.map((severity) => (
                <option key={severity}>{severity}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.violation.date}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  violation: { ...current.violation, date: event.target.value },
                }))
              }
            />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">Resolution notes</span>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.violation.details}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  violation: { ...current.violation, details: event.target.value },
                }))
              }
            />
          </label>
          <datalist id="violation-options">
            {violationSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Category *</span>
          <select
            className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
            value={detailForms.affiliation.category}
            onChange={(event) =>
              setDetailForms((current) => ({
                ...current,
                affiliation: {
                  ...current.affiliation,
                  category: event.target.value,
                  name:
                    event.target.value === 'Organization' && organizations[0]
                      ? organizations[0].name
                      : current.affiliation.name,
                },
              }))
            }
          >
            {AFFILIATION_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
          <select
            className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
            value={detailForms.affiliation.role}
            onChange={(event) =>
              setDetailForms((current) => ({
                ...current,
                affiliation: { ...current.affiliation, role: event.target.value },
              }))
            }
          >
            {AFFILIATION_ROLES.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Affiliation name *</span>
          {detailForms.affiliation.category === 'Organization' ? (
            <select
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.affiliation.name}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  affiliation: { ...current.affiliation, name: event.target.value },
                }))
              }
            >
              <option value="">Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.name}>
                  {organization.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              list="affiliation-options"
              type="text"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-200"
              value={detailForms.affiliation.name}
              onChange={(event) =>
                setDetailForms((current) => ({
                  ...current,
                  affiliation: { ...current.affiliation, name: event.target.value },
                }))
              }
              placeholder="e.g., Basketball Team"
            />
          )}
          <datalist id="affiliation-options">
            {affiliationSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </label>
      </div>
    );
  };

  const importAccept =
    FILE_TYPE_OPTIONS.find((option) => option.key === pendingImportType)?.accept || '.xlsx,.xls,.csv';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Student Profiles</h3>
              <p className="mt-1 text-sm text-slate-500">
                {isFacultyUser
                  ? 'Search and filter students from sections assigned to your schedules.'
                  : isChairUser
                    ? `Search and manage student records under ${chairDepartment || 'your assigned'} department only.`
                    : 'Search, filter, and manage the complete student record in one place.'}
              </p>
              {isFacultyUser && !facultyProfile ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  Your faculty account is not linked to a faculty profile. No student records are shown.
                </p>
              ) : null}
              {isChairUser && !chairDepartment ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  Your chair account is not linked to a faculty profile with a department yet. No student records are shown.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Results</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{scopedStudents.length}</p>
              </div>
              <div className="rounded-2xl bg-orange-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-400">Query Ready</p>
                <p className="mt-1 text-lg font-bold text-orange-700">Skills, activities, affiliations</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Linked Data</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {supportLoading ? 'Loading...' : 'Schedules, events, instructions'}
                </p>
              </div>
            </div>
          </div>

          <div ref={actionMenuRef} className="flex flex-wrap items-center gap-2">
            {!isFacultyUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenActionMenu(openActionMenu === 'import' ? '' : 'import')}
                  disabled={isProcessingFile}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload size={16} />
                  {importingFormat ? `Importing ${importingFormat}...` : 'Import'}
                </button>
                {openActionMenu === 'import' ? (
                  <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                    {FILE_TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={`import-${option.key}`}
                          type="button"
                          onClick={() => handleChooseImportType(option.key)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Icon size={15} />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenActionMenu(openActionMenu === 'export' ? '' : 'export')}
                disabled={isProcessingFile}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={16} />
                {exportingFormat ? `Exporting ${exportingFormat}...` : 'Export'}
              </button>
              {openActionMenu === 'export' ? (
                <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                  {FILE_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={`export-${option.key}`}
                        type="button"
                        onClick={() => handleChooseExportType(option.key)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Icon size={15} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {!isFacultyUser ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={importAccept}
                  onChange={handleImportFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={openAddStudentModal}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700"
                >
                  <Plus size={18} />
                  Add Student
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StudentSearchBar value={searchTerm} onChange={setSearchTerm} />

          <select
            className={cn(
              'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200',
              isChairUser ? 'cursor-not-allowed bg-slate-100 text-slate-500' : '',
            )}
            value={isChairUser ? chairDepartment : filterCourse}
            onChange={(event) => {
              if (!isChairUser) {
                setFilterCourse(event.target.value);
              }
            }}
            disabled={isChairUser}
          >
            {isChairUser ? (
              <option value={chairDepartment || ''}>
                {chairDepartment || 'No department linked'}
              </option>
            ) : (
              <>
                <option value="">All Courses</option>
                {CORE_COURSES.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </>
            )}
          </select>

          <select
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
            value={filterYearLevel}
            onChange={(event) => setFilterYearLevel(event.target.value)}
          >
            <option value="">All Year Levels</option>
            {YEAR_LEVELS.map((yearLevel) => (
              <option key={yearLevel} value={yearLevel}>
                {yearLevel}
              </option>
            ))}
          </select>

          <input
            list="skill-options"
            type="text"
            placeholder="Filter by skill"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
            value={skillQuery}
            onChange={(event) => setSkillQuery(event.target.value)}
          />

          <input
            list="activity-options"
            type="text"
            placeholder="Filter by activity"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
            value={activityQuery}
            onChange={(event) => setActivityQuery(event.target.value)}
          />

          <input
            list="affiliation-options"
            type="text"
            placeholder="Filter by affiliation"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
            value={affiliationQuery}
            onChange={(event) => setAffiliationQuery(event.target.value)}
          />
        </div>

        <div className="mt-5 space-y-3">
          {quickSkillQueries.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                <Sparkles size={12} />
                Popular skill queries
              </span>
              {quickSkillQueries.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSkillQuery(item.label)}
                  className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100"
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>
          ) : null}

          {quickActivityQueries.length > 0 || quickAffiliationQueries.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {quickActivityQueries.map((item) => (
                <button
                  key={`activity-${item.label}`}
                  type="button"
                  onClick={() => setActivityQuery(item.label)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  Activity: {item.label}
                </button>
              ))}
              {quickAffiliationQueries.map((item) => (
                <button
                  key={`aff-${item.label}`}
                  type="button"
                  onClick={() => setAffiliationQuery(item.label)}
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100"
                >
                  Affiliation: {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Reset Filters
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading student profiles...</div>
          ) : scopedStudents.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-base font-semibold text-slate-700">No student profiles found.</p>
              <p className="mt-2 text-sm text-slate-500">Try adjusting the filters or add a new student profile.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Student</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Student ID</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Course</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Year / Section</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Highlights</th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <StudentListRow
                    key={student.id}
                    student={student}
                    onView={handleSelectStudent}
                    onEdit={(nextStudent) => {
                      setSelectedStudent(nextStudent);
                      openEditStudentModal(nextStudent);
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedStudent && !showEditModal ? (
        <ModalShell
          onClose={() => {
            setSelectedStudent(null);
            navigate('/users');
          }}
          title="Student Profile"
          description="Comprehensive student information with linked schedules, instructions, activities, and event participation."
          size="max-w-7xl"
        >
          <div className="space-y-6">
            <div className="rounded-[32px] bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-2xl font-bold text-orange-700 shadow-sm ring-1 ring-orange-100">
                    {getInitials(selectedStudent.first_name, selectedStudent.last_name)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">
                        {selectedStudent.first_name} {selectedStudent.middle_name || ''} {selectedStudent.last_name}
                      </h2>
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                        {selectedStudent.course} - {selectedStudent.student_id}
                        {selectedStudent.section ? ` - ${selectedStudent.section}` : ''}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-slate-400" />
                        <span>{selectedStudent.email || 'No email on file'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        <span>{selectedStudent.contact_number || 'No contact number'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap size={14} className="text-slate-400" />
                        <span>{selectedStudent.enrollment_status}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openEditStudentModal(selectedStudent)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Edit3 size={16} />
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteStudent}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
                  >
                    <Trash2 size={16} />
                    Delete Student
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="space-y-6">
                <DetailSectionCard title="Skills" subtitle="Add validated skills used by the query feature." actionLabel="Add skill" onAction={() => openDetailModal('skill')}>
                  {(selectedStudent.skills || []).length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.skills.map((skill) => (
                        <div key={skill.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{skill.skill_name}</p>
                            <p className="text-xs text-slate-500">{skill.level || 'No level specified'}</p>
                          </div>
                          <ItemActionButtons
                            onEdit={() => openDetailModal('skill', skill)}
                            onDelete={() => handleDeleteDetail('skill', skill)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No skills recorded yet.</p>
                  )}
                </DetailSectionCard>

                <DetailSectionCard title="Academic History" subtitle="Track yearly records, institution details, and awards." actionLabel="Add record" onAction={() => openDetailModal('academic')}>
                  {(selectedStudent.academic_history || []).length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.academic_history.map((record) => {
                        const details = parseAcademicDetails(record);
                        return (
                          <div key={record.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-900">
                                  {record.course || selectedStudent.course} â€¢ {record.academic_year || 'Academic year not set'}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {details?.school_name || 'School not specified'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                                  {details?.start_period ? <span>Start: {details.start_period}</span> : null}
                                  {details?.end_period ? <span>End: {details.end_period}</span> : null}
                                  {details?.award ? <span>Award: {details.award}</span> : null}
                                </div>
                                {details?.notes || (!details && record.details) ? (
                                  <p className="mt-2 text-sm text-slate-500">{details?.notes || record.details}</p>
                                ) : null}
                              </div>
                              <ItemActionButtons
                                onEdit={() => openDetailModal('academic', record)}
                                onDelete={() => handleDeleteDetail('academic', record)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No academic history recorded yet.</p>
                  )}
                </DetailSectionCard>

                <DetailSectionCard title="Non-Academic Activities" subtitle="Document organizations, competitions, and student life involvement." actionLabel="Add activity" onAction={() => openDetailModal('activity')}>
                  {(selectedStudent.activities || []).length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.activities.map((activity) => (
                        <div key={activity.id} className="flex items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{activity.activity_name}</p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {activity.activity_type || 'Activity'}
                            </p>
                            {activity.details ? <p className="mt-2 text-sm text-slate-500">{activity.details}</p> : null}
                          </div>
                          <ItemActionButtons
                            onEdit={() => openDetailModal('activity', activity)}
                            onDelete={() => handleDeleteDetail('activity', activity)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No activities recorded yet.</p>
                  )}
                </DetailSectionCard>

                <DetailSectionCard title="Violations" subtitle="Standardized severity levels help avoid inconsistent encoding." actionLabel="Add violation" onAction={() => openDetailModal('violation')}>
                  {(selectedStudent.violations || []).length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.violations.map((violation) => (
                        <div key={violation.id} className="flex items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900">{violation.violation_name}</p>
                              <span
                                className={cn(
                                  'rounded-full px-2.5 py-1 text-[11px] font-bold',
                                  violation.severity === 'Critical'
                                    ? 'bg-red-100 text-red-700'
                                    : violation.severity === 'High'
                                      ? 'bg-orange-100 text-orange-700'
                                      : violation.severity === 'Moderate'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-slate-200 text-slate-700',
                                )}
                              >
                                {violation.severity || 'Unspecified'}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-500">
                              {violation.date ? new Date(violation.date).toLocaleDateString() : 'Date not recorded'}
                            </p>
                            {violation.details ? <p className="mt-2 text-sm text-slate-500">{violation.details}</p> : null}
                          </div>
                          <ItemActionButtons
                            onEdit={() => openDetailModal('violation', violation)}
                            onDelete={() => handleDeleteDetail('violation', violation)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No violations recorded yet.</p>
                  )}
                </DetailSectionCard>

                <DetailSectionCard title="Affiliations" subtitle="Link students to organizations, teams, and clubs for event matching." actionLabel="Add affiliation" onAction={() => openDetailModal('affiliation')}>
                  {(selectedStudent.affiliations || []).length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.affiliations.map((affiliation) => (
                        <div key={affiliation.id} className="flex items-start justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{affiliation.name}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                              {affiliation.category ? <span>{affiliation.category}</span> : null}
                              {affiliation.role ? <span>Role: {affiliation.role}</span> : null}
                            </div>
                          </div>
                          <ItemActionButtons
                            onEdit={() => openDetailModal('affiliation', affiliation)}
                            onDelete={() => handleDeleteDetail('affiliation', affiliation)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No affiliations recorded yet.</p>
                  )}
                </DetailSectionCard>
              </div>

              <div className="space-y-6">
                <DetailSectionCard title="Assigned Schedule" subtitle="Schedules are matched by course and year level for faster advising.">
                  {selectedStudentSchedules.length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudentSchedules.map((schedule) => (
                        <button
                          key={schedule.id}
                          type="button"
                          onClick={() => onNavigate?.('scheduling', { scheduleId: schedule.id })}
                          className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-orange-200 hover:bg-orange-50"
                        >
                          <p className="text-sm font-bold text-slate-900">{schedule.subject}</p>
                          <p className="mt-1 text-sm text-slate-500">{schedule.day} â€¢ {schedule.time}</p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {schedule.instructor} â€¢ {schedule.room}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No schedule currently matches this studentâ€™s course and year level.</p>
                  )}
                </DetailSectionCard>

                <DetailSectionCard title="Instruction Coverage" subtitle="Relevant syllabus, curriculum, and lesson plans tied to this student.">
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Curriculum</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">
                        {selectedStudentCurriculum?.program || 'No curriculum matched'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedStudentCurriculum
                          ? `${selectedStudentCurriculum.totalUnits} total units â€¢ ${selectedStudentCurriculum.year}`
                          : 'Add or align curriculum data for this course to show the full program path.'}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Linked syllabi</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{selectedStudentSyllabi.length} record(s)</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {selectedStudentSyllabi.slice(0, 3).map((syllabus) => (
                          <button
                            key={syllabus.id}
                            type="button"
                            onClick={() => onNavigate?.('instructions', { type: 'syllabus', syllabusId: syllabus.id, course: selectedStudent.course })}
                            className="w-full rounded-2xl bg-white px-3 py-3 text-left transition-colors hover:bg-orange-50"
                          >
                            <p className="text-sm font-bold text-slate-900">{syllabus.code} â€¢ {syllabus.subject}</p>
                            <p className="mt-1 text-xs text-slate-500">{syllabus.semester} â€¢ {syllabus.instructor}</p>
                          </button>
                        ))}
                        {selectedStudentSyllabi.length === 0 ? (
                          <p className="text-sm text-slate-500">No syllabus matches found yet.</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Lesson plans</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{selectedStudentLessons.length} lesson(s) connected</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Lessons are matched from the linked syllabus set for this studentâ€™s current course flow.
                      </p>
                    </div>
                  </div>
                </DetailSectionCard>

                <DetailSectionCard title="Affiliated Events" subtitle="Events are suggested from the studentâ€™s organization affiliations.">
                  {selectedStudentEvents.length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudentEvents.map((eventRecord) => (
                        <button
                          key={eventRecord.id}
                          type="button"
                          onClick={() => onNavigate?.('reports', { eventId: eventRecord.id })}
                          className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-orange-200 hover:bg-orange-50"
                        >
                          <p className="text-sm font-bold text-slate-900">{eventRecord.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{eventRecord.organization || 'General Event'}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                            <span>{new Date(eventRecord.date).toLocaleDateString()}</span>
                            <span>{eventRecord.time || 'TBD'}</span>
                            <span>{eventRecord.venue || 'Venue not set'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No organization-based event match yet. Add affiliations to improve this recommendation list.
                    </p>
                  )}
                </DetailSectionCard>

                <DetailSectionCard title="Presentation Notes" subtitle="Helpful cues for the live demo and defense.">
                  <div className="space-y-3">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <Users className="mt-0.5 text-orange-600" size={18} />
                        <p className="text-sm text-slate-600">
                          This profile already connects to schedule, instructions, and event records so you can demonstrate real data relationships during the presentation.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="mt-0.5 text-orange-600" size={18} />
                        <p className="text-sm text-slate-600">
                          Use the standardized skill, activity, affiliation, and severity values to reduce user error and produce cleaner query results.
                        </p>
                      </div>
                    </div>
                  </div>
                </DetailSectionCard>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {detailModal ? (
        <ModalShell
          onClose={closeDetailModal}
          title={`${detailModal.mode === 'edit' ? 'Edit' : 'Add'} ${detailModal.type === 'academic' ? 'Academic History' : detailModal.type === 'activity' ? 'Non-Academic Activity' : detailModal.type.charAt(0).toUpperCase() + detailModal.type.slice(1)}`}
          description="Use the structured fields below to keep the student profile consistent and searchable."
          size="max-w-3xl"
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDetailModal}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="student-detail-form"
                className="rounded-2xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
              >
                {detailModal.mode === 'edit' ? 'Save Changes' : 'Add Record'}
              </button>
            </div>
          }
        >
          <form id="student-detail-form" onSubmit={handleDetailSubmit} className="space-y-4">
            {renderDetailModalContent()}
          </form>
        </ModalShell>
      ) : null}

      {showAddModal ? (
        <StudentForm
          key="add-student"
          title="Add Student Profile"
          onSubmit={handleAddStudent}
          onCancel={() => setShowAddModal(false)}
          formData={formData}
          setFormData={setFormData}
          lockedCourse={isChairUser ? chairDepartment : ''}
        />
      ) : null}

      {showEditModal ? (
        <StudentForm
          key="edit-student"
          title="Edit Student Profile"
          onSubmit={handleEditStudent}
          onCancel={() => setShowEditModal(false)}
          formData={formData}
          setFormData={setFormData}
          lockedCourse={isChairUser ? chairDepartment : ''}
        />
      ) : null}
    </div>
  );
}





