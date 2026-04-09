import React, { useEffect, useRef, useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Search, 
  Plus,
  Edit,
  Eye,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  FileImage,
  FileText
} from 'lucide-react';
import { cn } from '../../constants';
import { ScheduleForm } from './ScheduleForm';
import { useUI } from '../ui/UIProvider';
import { apiRequest } from '../../lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = [
  '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', 
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
];

const EXPORT_COLUMNS = [
  { key: 'course', label: 'Course', required: true },
  { key: 'subject', label: 'Subject', required: false },
  { key: 'instructor', label: 'Instructor', required: false },
  { key: 'room', label: 'Room', required: true },
  { key: 'day', label: 'Day', required: false },
  { key: 'start_time', label: 'Start Time', required: true },
  { key: 'end_time', label: 'End Time', required: true },
  { key: 'year_level', label: 'Year Level', required: false },
  { key: 'section', label: 'Section', required: false },
  { key: 'students', label: 'Number of Students', required: false },
];

const REQUIRED_EXPORT_KEYS = EXPORT_COLUMNS.filter((column) => column.required).map((column) => column.key);
const EXPORT_COLUMN_WIDTHS = [95, 150, 170, 95, 90, 95, 95, 100, 80, 130];
const SCHEDULE_FIELD_LIMITS = {
  course: 100,
  subject: 200,
  instructor: 200,
  room: 100,
  day: 20,
  start_time: 50,
  end_time: 50,
  year_level: 50,
  section: 10,
};

const sanitizeValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const truncateToWidth = (ctx, value, width) => {
  const suffix = '...';
  const text = sanitizeValue(value);
  if (!text) return '';
  if (ctx.measureText(text).width <= width) return text;

  let output = text;
  while (output.length > 0 && ctx.measureText(`${output}${suffix}`).width > width) {
    output = output.slice(0, -1);
  }
  return output ? `${output}${suffix}` : '';
};

const buildCanvasTable = (rows) => {
  const paddingX = 12;
  const rowHeight = 34;
  const headerHeight = 40;
  const tableWidth = EXPORT_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
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
  ctx.fillText('Class Schedule Export', paddingX, 30);
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Arial';
  ctx.fillText(`Generated: ${new Date().toLocaleString()}`, paddingX, 46);

  const tableTop = titleHeight;
  ctx.fillStyle = '#f97316';
  ctx.fillRect(1, tableTop + 1, tableWidth, headerHeight - 1);

  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#ffffff';
  let cursorX = 1;
  EXPORT_COLUMNS.forEach((column, index) => {
    const width = EXPORT_COLUMN_WIDTHS[index];
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
    EXPORT_COLUMNS.forEach((column, columnIndex) => {
      const width = EXPORT_COLUMN_WIDTHS[columnIndex];
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
  EXPORT_COLUMN_WIDTHS.forEach((width) => {
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
};

const FILE_TYPE_OPTIONS = [
  { key: 'excel', label: 'Excel', icon: FileSpreadsheet, accept: '.xlsx,.xls,.csv' },
  { key: 'pdf', label: 'PDF', icon: FileText, accept: '.pdf' },
  { key: 'image', label: 'Image', icon: FileImage, accept: '.png,.jpg,.jpeg,.webp' },
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COLUMN_ALIASES = {
  course: ['course', 'course code', 'coursecode', 'program'],
  subject: ['subject', 'title', 'class', 'course title', 'course subject'],
  instructor: ['instructor', 'teacher', 'professor', 'faculty', 'lecturer'],
  room: ['room', 'room no', 'room number', 'venue', 'location'],
  day: ['day', 'weekday', 'class day'],
  start_time: ['start time', 'starttime', 'start', 'time start', 'from', 'time from'],
  end_time: ['end time', 'endtime', 'end', 'time end', 'to', 'time to'],
  year_level: ['year level', 'yearlevel', 'year', 'level'],
  section: ['section', 'sec', 'section name'],
  students: ['students', 'number of students', 'student count', 'enrolled', 'enrollment'],
};

const normalizeHeaderName = (value) =>
  sanitizeValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeHeaderToken = (value) =>
  sanitizeValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const normalizeMeridiemTime = (value) => {
  const raw = sanitizeValue(value).toUpperCase().replace(/\s+/g, ' ').trim();
  const match = raw.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);
  if (!match) return '';

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();
  if (hour === 0 || hour > 12) return '';
  if (hour < 10) hour = Number(hour);
  return `${hour}:${minute} ${meridiem}`;
};

const clampField = (value, maxLength) => sanitizeValue(value).slice(0, maxLength);

const extractRoomText = (value) => {
  const text = sanitizeValue(value);
  if (!text) return '';

  const roomMatch = text.match(/\b(?:LAB|ROOM|RM)\s*[-A-Z0-9]+\b/i);
  if (roomMatch) {
    return roomMatch[0].replace(/\s+/g, ' ').trim();
  }
  return text;
};

const normalizeCourseText = (value) => {
  const text = sanitizeValue(value);
  if (!text) return '';

  if (/\b(room|lab|rm)\b/i.test(text)) {
    return text.split(/\s+/)[0] || text;
  }
  return text;
};

const normalizeYearLevelText = (value) => {
  const text = sanitizeValue(value);
  const match = text.match(/\b(1ST|2ND|3RD|4TH)\s*YEAR\b/i);
  if (!match) return '';

  const key = match[1].toLowerCase();
  if (key === '1st') return '1st Year';
  if (key === '2nd') return '2nd Year';
  if (key === '3rd') return '3rd Year';
  if (key === '4th') return '4th Year';
  return '';
};

const normalizeSectionText = (value) => {
  const text = sanitizeValue(value);
  if (!text) return '';

  const sectionMatch = text.match(/\bSECTION\s*([A-Z0-9]+)\b/i);
  if (sectionMatch) {
    return sectionMatch[1].toUpperCase();
  }

  if (/^[A-Z0-9]{1,10}$/i.test(text)) {
    return text.toUpperCase();
  }
  return '';
};

const normalizeStudentsCount = (value) => {
  const text = sanitizeValue(value);
  const numbers = text.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 0;
  const last = Number.parseInt(numbers[numbers.length - 1], 10);
  if (!Number.isFinite(last) || last < 0) return 0;
  return Math.min(last, 9999);
};

const headerMatchesAlias = (header, alias) => {
  const headerName = normalizeHeaderName(header);
  const aliasName = normalizeHeaderName(alias);
  if (headerName === aliasName) return true;

  const headerToken = normalizeHeaderToken(header);
  const aliasToken = normalizeHeaderToken(alias);
  if (!headerToken || !aliasToken) return false;
  if (headerToken === aliasToken) return true;
  if (aliasToken.length >= 6 && headerToken.includes(aliasToken)) return true;
  if (headerToken.length >= 6 && aliasToken.includes(headerToken)) return true;
  return false;
};

const scoreHeaderRow = (headers) => {
  const matchedFields = new Set();
  Object.entries(COLUMN_ALIASES).forEach(([fieldKey, aliases]) => {
    const matched = aliases.some((alias) => headers.some((header) => headerMatchesAlias(header, alias)));
    if (matched) matchedFields.add(fieldKey);
  });
  return matchedFields.size;
};

const convertSheetMatrixToObjects = (matrix) => {
  const meaningfulRows = matrix
    .map((row) => (Array.isArray(row) ? row : []))
    .filter((row) => row.some((cell) => sanitizeValue(cell)));

  if (meaningfulRows.length === 0) {
    return { objects: [], headerScore: 0 };
  }

  let bestHeaderIndex = -1;
  let bestScore = -1;
  const maxHeaderScan = Math.min(10, meaningfulRows.length);

  for (let index = 0; index < maxHeaderScan; index += 1) {
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
};

const resolveValueFromAliases = (row, aliases) => {
  if (!row || typeof row !== 'object') return '';
  const entries = Object.entries(row);

  for (const alias of aliases) {
    const found = entries.find(([key]) => headerMatchesAlias(key, alias));
    if (found) return sanitizeValue(found[1]);
  }

  return '';
};

const toSchedulePayload = (rawRow) => {
  const rawCourse = resolveValueFromAliases(rawRow, COLUMN_ALIASES.course);
  const rawRoom = resolveValueFromAliases(rawRow, COLUMN_ALIASES.room);
  const rawYearLevel = resolveValueFromAliases(rawRow, COLUMN_ALIASES.year_level);
  const rawSection = resolveValueFromAliases(rawRow, COLUMN_ALIASES.section);
  const rawStudents = resolveValueFromAliases(rawRow, COLUMN_ALIASES.students);
  const rawSubject = resolveValueFromAliases(rawRow, COLUMN_ALIASES.subject);
  const rawInstructor = resolveValueFromAliases(rawRow, COLUMN_ALIASES.instructor);
  const startTime = normalizeMeridiemTime(resolveValueFromAliases(rawRow, COLUMN_ALIASES.start_time));
  const endTime = normalizeMeridiemTime(resolveValueFromAliases(rawRow, COLUMN_ALIASES.end_time));
  const dayRaw = resolveValueFromAliases(rawRow, COLUMN_ALIASES.day);
  const normalizedDay =
    DAY_NAMES.find((dayName) => dayName.toLowerCase() === dayRaw.toLowerCase()) || 'Monday';

  return {
    course: clampField(normalizeCourseText(rawCourse), SCHEDULE_FIELD_LIMITS.course),
    subject: clampField(rawSubject || 'TBA Subject', SCHEDULE_FIELD_LIMITS.subject),
    instructor: clampField(rawInstructor || 'TBA Instructor', SCHEDULE_FIELD_LIMITS.instructor),
    room: clampField(extractRoomText(rawRoom), SCHEDULE_FIELD_LIMITS.room),
    day: clampField(normalizedDay, SCHEDULE_FIELD_LIMITS.day),
    start_time: clampField(startTime, SCHEDULE_FIELD_LIMITS.start_time),
    end_time: clampField(endTime, SCHEDULE_FIELD_LIMITS.end_time),
    year_level: clampField(normalizeYearLevelText(rawYearLevel), SCHEDULE_FIELD_LIMITS.year_level),
    section: clampField(normalizeSectionText(rawSection), SCHEDULE_FIELD_LIMITS.section),
    students: normalizeStudentsCount(rawStudents),
  };
};

const extractRowsFromPlainText = (text) => {
  const lines = sanitizeValue(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const rows = [];
  const timeRegex = /\b(1[0-2]|0?[1-9]):[0-5][0-9]\s?(AM|PM)\b/gi;
  const dayRegex = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i;

  for (const line of lines) {
    const timeMatches = [...line.matchAll(timeRegex)].map((match) => normalizeMeridiemTime(match[0]));
    if (timeMatches.length < 2) continue;

    const dayMatch = line.match(dayRegex);
    const day = dayMatch ? dayMatch[1] : '';
    const baseText = line
      .replace(dayRegex, ' ')
      .replace(timeRegex, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!baseText) continue;

    const rawTokens = baseText
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (rawTokens.length === 0) continue;

    const roomMatch = baseText.match(/\b(?:LAB|ROOM|RM)\s*[-A-Z0-9]+\b/i);
    const room = roomMatch ? roomMatch[0].replace(/\s+/g, ' ').trim() : '';
    const roomKeywordIndex = rawTokens.findIndex((token) => /^(lab|room|rm)$/i.test(token));
    const roomTokenIndex = rawTokens.findIndex((token) => /^(lab|room|rm)\d+/i.test(token));
    const roomBoundaryIndex = roomKeywordIndex >= 0 ? roomKeywordIndex : roomTokenIndex;

    const course = rawTokens[0] || '';
    const subject = rawTokens[1] || '';

    let instructor = '';
    if (roomBoundaryIndex > 2) {
      instructor = rawTokens.slice(2, roomBoundaryIndex).join(' ');
    } else if (rawTokens.length > 3) {
      instructor = rawTokens.slice(2, Math.min(rawTokens.length, 5)).join(' ');
    }

    const yearMatch = baseText.match(/\b(1st|2nd|3rd|4th)\s*Year\b/i);
    const yearLevel = yearMatch ? yearMatch[0] : '';

    let section = '';
    const sectionExplicit = baseText.match(/\bSection\s*([A-Za-z0-9]+)\b/i);
    if (sectionExplicit) {
      section = sectionExplicit[1];
    } else if (yearMatch) {
      const postYear = baseText.slice(baseText.toLowerCase().indexOf(yearMatch[0].toLowerCase()) + yearMatch[0].length).trim();
      const firstPostToken = postYear.split(/\s+/)[0] || '';
      if (/^[A-Za-z0-9]{1,4}$/.test(firstPostToken)) {
        section = firstPostToken;
      }
    }

    const studentsAtEnd = baseText.match(/(\d+)\s*$/);
    const studentsToken = studentsAtEnd ? studentsAtEnd[1] : '';

    rows.push({
      course,
      subject,
      instructor,
      room,
      day,
      start_time: timeMatches[0],
      end_time: timeMatches[1],
      year_level: yearLevel,
      section,
      students: studentsToken,
    });
  }

  return rows;
};

export const Scheduling = ({ navigationIntent, clearNavigationIntent, onNavigate }) => {
  const { showError, showSuccess, confirm } = useUI();
  const [schedules, setSchedules] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [viewMode, setViewMode] = useState('calendar');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All Courses');
  const [selectedDay, setSelectedDay] = useState('All Days');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState('');
  const [importingFormat, setImportingFormat] = useState('');
  const [openActionMenu, setOpenActionMenu] = useState('');
  const [pendingImportType, setPendingImportType] = useState('excel');
  const actionMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const pendingImportTypeRef = useRef('excel');
  const [formData, setFormData] = useState({
    course: 'BSIT',
    subject: '',
    instructor: '',
    room: '',
    day: 'Monday',
    start_time: '7:00 AM',
    end_time: '9:00 AM',
    students: 0,
    year_level: '1st Year',
    section: ''
  });
  const isProcessingFile = Boolean(exportingFormat || importingFormat);

  useEffect(() => {
    fetchFaculty();
  }, []);

  useEffect(() => {
    fetchLinkedData();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [selectedCourse, selectedDay]);

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

  const fetchFaculty = async () => {
    try {
      setFacultyLoading(true);
      const response = await fetch(`${API_URL}/api/faculty`);
      const data = await response.json();
      if (data.success) {
        setFaculty(data.data);
      }
    } catch (error) {
      console.error('Error fetching faculty:', error);
    } finally {
      setFacultyLoading(false);
    }
  };

  const instructorOptions = faculty.map((f) => {
    const first = f.first_name || '';
    const middle = f.middle_name || '';
    const last = f.last_name || '';
    const name = `${first} ${middle} ${last}`.replace(/\s+/g, ' ').trim();
    const pos = f.position ? `${f.position} ` : '';
    const emp = f.employee_number ? ` (${f.employee_number})` : '';
    const label = `${pos}${name}${emp}`.trim();
    return { value: label, label };
  }).filter((x) => x.value);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCourse !== 'All Courses') params.append('course', selectedCourse);
      if (selectedDay !== 'All Days') params.append('day', selectedDay);
      
      const response = await fetch(`${API_URL}/api/schedules?${params}`);
      const data = await response.json();
      if (data.success) {
        setSchedules(data.data);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setShowAddModal(false);
        setFormData({
          course: 'BSIT',
          subject: '',
          instructor: '',
          room: '',
          day: 'Monday',
          start_time: '7:00 AM',
          end_time: '9:00 AM',
          students: 0,
          year_level: '1st Year',
          section: ''
        });
        fetchSchedules();
        showSuccess('Schedule added', 'The new schedule is now part of the weekly grid.');
      } else {
        showError('Unable to add schedule', data.message);
      }
    } catch (error) {
      showError('Unable to add schedule', error.message);
    }
  };

  const handleEditSchedule = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/schedules/${selectedSchedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setShowEditModal(false);
        setSelectedSchedule(null);
        fetchSchedules();
        showSuccess('Schedule updated', 'The schedule changes were saved successfully.');
      } else {
        showError('Unable to update schedule', data.message);
      }
    } catch (error) {
      showError('Unable to update schedule', error.message);
    }
  };

  const handleDeleteSchedule = async () => {
    const approved = await confirm({
      title: 'Delete schedule?',
      description: `This will remove the ${selectedSchedule?.subject || 'selected'} schedule.`,
      confirmText: 'Delete schedule',
      tone: 'danger',
    });
    if (!approved) return;
    
    try {
      const response = await fetch(`${API_URL}/api/schedules/${selectedSchedule.id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSelectedSchedule(null);
        fetchSchedules();
        showSuccess('Schedule deleted', 'The schedule was removed.');
      } else {
        showError('Unable to delete schedule', data.message);
      }
    } catch (error) {
      showError('Unable to delete schedule', error.message);
    }
  };

  const openEditModal = (schedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      course: schedule.course || 'BSIT',
      subject: schedule.subject || '',
      instructor: schedule.instructor || '',
      room: schedule.room || '',
      day: schedule.day || 'Monday',
      start_time: schedule.start_time || '7:00 AM',
      end_time: schedule.end_time || '9:00 AM',
      students: schedule.students || 0,
      year_level: schedule.year_level || '1st Year',
      section: schedule.section || ''
    });
    setShowEditModal(true);
  };

  const filteredSchedules = schedules.filter(schedule => {
    const matchesSearch = schedule.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.instructor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.room?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'All Courses' || schedule.course === selectedCourse;
    const matchesDay = selectedDay === 'All Days' || schedule.day === selectedDay;
    return matchesSearch && matchesCourse && matchesDay;
  });

  const getValidatedExportRows = () => {
    const labeledRows = [];
    let skippedCount = 0;

    filteredSchedules.forEach((schedule) => {
      const isValid = REQUIRED_EXPORT_KEYS.every((requiredKey) => sanitizeValue(schedule[requiredKey]));
      if (!isValid) {
        skippedCount += 1;
        return;
      }

      const labeledRow = {};
      EXPORT_COLUMNS.forEach((column) => {
        labeledRow[column.label] = sanitizeValue(schedule[column.key]);
      });
      labeledRows.push(labeledRow);
    });

    return { rows: labeledRows, skippedCount };
  };

  const canExportRows = (rowsCount) => {
    if (rowsCount === 0) {
      showError(
        'No rows exported',
        'Every row is missing at least one required field (Course, Room, Start Time, End Time).',
      );
      return false;
    }
    return true;
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

  const exportAsExcel = async () => {
    const { rows, skippedCount } = getValidatedExportRows();
    if (!canExportRows(rows.length)) return;

    setExportingFormat('excel');
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(rows, {
        header: EXPORT_COLUMNS.map((column) => column.label),
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedules');
      XLSX.writeFile(workbook, `schedules-${new Date().toISOString().slice(0, 10)}.xlsx`);
      showExportSummary(rows.length, skippedCount, 'Excel');
    } catch (error) {
      showError('Excel export failed', error.message || 'Unable to export Excel file.');
    } finally {
      setExportingFormat('');
    }
  };

  const exportAsImage = async () => {
    const { rows, skippedCount } = getValidatedExportRows();
    if (!canExportRows(rows.length)) return;

    setExportingFormat('image');
    try {
      const canvas = buildCanvasTable(rows);
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `schedules-${new Date().toISOString().slice(0, 10)}.png`;
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

  const exportAsPdf = async () => {
    const { rows, skippedCount } = getValidatedExportRows();
    if (!canExportRows(rows.length)) return;

    setExportingFormat('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const canvas = buildCanvasTable(rows);
      const imageData = canvas.toDataURL('image/png');

      const documentPdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = documentPdf.internal.pageSize.getWidth();
      const pageHeight = documentPdf.internal.pageSize.getHeight();
      const margin = 24;
      const renderWidth = pageWidth - (margin * 2);
      const renderHeight = (canvas.height * renderWidth) / canvas.width;
      const printableHeight = pageHeight - (margin * 2);

      let heightLeft = renderHeight;
      let positionY = margin;
      documentPdf.addImage(imageData, 'PNG', margin, positionY, renderWidth, renderHeight);
      heightLeft -= printableHeight;

      while (heightLeft > 0) {
        positionY = margin - (renderHeight - heightLeft);
        documentPdf.addPage();
        documentPdf.addImage(imageData, 'PNG', margin, positionY, renderWidth, renderHeight);
        heightLeft -= printableHeight;
      }

      documentPdf.save(`schedules-${new Date().toISOString().slice(0, 10)}.pdf`);
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
      await exportAsExcel();
      return;
    }
    if (typeKey === 'pdf') {
      await exportAsPdf();
      return;
    }
    await exportAsImage();
  };

  const parseExcelImportFile = async (file) => {
    const XLSX = await import('xlsx');
    const rawBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(rawBuffer, { type: 'array', raw: false });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    if (!firstSheet) return [];

    const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });
    const { objects, headerScore } = convertSheetMatrixToObjects(matrix);

    if (objects.length === 0) return [];

    const payloads = objects.map(toSchedulePayload);
    const hasRequiredData = payloads.some((payload) =>
      REQUIRED_EXPORT_KEYS.every((requiredKey) => sanitizeValue(payload[requiredKey])),
    );

    if (!hasRequiredData && headerScore < 2) {
      throw new Error(
        'Could not detect schedule columns. Check that your file has headers like Course, Room, Start Time, End Time.',
      );
    }

    return payloads;
  };

  const parsePdfImportFile = async (file) => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const rawBuffer = await file.arrayBuffer();
    const documentTask = pdfjs.getDocument({ data: new Uint8Array(rawBuffer), disableWorker: true });
    const pdf = await documentTask.promise;
    let aggregatedText = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => sanitizeValue(item.str)).join(' ');
      aggregatedText += `${pageText}\n`;
    }

    return extractRowsFromPlainText(aggregatedText).map(toSchedulePayload);
  };

  const parseImageImportFile = async (file) => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const {
        data: { text },
      } = await worker.recognize(file);
      return extractRowsFromPlainText(text).map(toSchedulePayload);
    } finally {
      await worker.terminate();
    }
  };

  const handleChooseImportType = (typeKey) => {
    if (isProcessingFile) return;
    pendingImportTypeRef.current = typeKey;
    setPendingImportType(typeKey);
    setOpenActionMenu('');

    if (fileInputRef.current) {
      const selectedOption = FILE_TYPE_OPTIONS.find((option) => option.key === typeKey);
      if (selectedOption) {
        fileInputRef.current.setAttribute('accept', selectedOption.accept);
      }
      fileInputRef.current.value = '';
      setTimeout(() => fileInputRef.current?.click(), 0);
    }
  };

  const handleImportFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const importType = pendingImportTypeRef.current;
    setImportingFormat(importType);
    try {
      let parsedPayloads = [];
      if (importType === 'excel') {
        parsedPayloads = await parseExcelImportFile(selectedFile);
      } else if (importType === 'pdf') {
        parsedPayloads = await parsePdfImportFile(selectedFile);
      } else {
        parsedPayloads = await parseImageImportFile(selectedFile);
      }

      if (parsedPayloads.length === 0) {
        showError(
          'Import failed',
          'No schedule rows were detected. Make sure the file contains table rows.',
        );
        return;
      }

      const validPayloads = [];
      let skippedRequired = 0;
      parsedPayloads.forEach((payload) => {
        const hasRequired = REQUIRED_EXPORT_KEYS.every((requiredKey) => sanitizeValue(payload[requiredKey]));
        if (!hasRequired) {
          skippedRequired += 1;
          return;
        }
        validPayloads.push(payload);
      });

      if (validPayloads.length === 0) {
        showError(
          'Import failed',
          'All detected rows are missing required fields (Course, Room, Start Time, End Time).',
        );
        return;
      }

      let createdCount = 0;
      let failedCount = 0;
      let firstFailure = '';
      for (const payload of validPayloads) {
        try {
          await apiRequest('/api/schedules', { method: 'POST', body: payload });
          createdCount += 1;
        } catch (error) {
          failedCount += 1;
          if (!firstFailure) {
            firstFailure = error.message || 'Unknown import error';
          }
        }
      }

      await fetchSchedules();

      if (createdCount > 0) {
        const parts = [`${createdCount} row(s) imported`];
        if (skippedRequired > 0) {
          parts.push(`${skippedRequired} row(s) skipped for missing required fields`);
        }
        if (failedCount > 0) {
          parts.push(`${failedCount} row(s) failed to save`);
        }
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

  const getScheduleByDayAndTime = (day, timeSlot) => {
    return filteredSchedules.find(s => {
      if (s.day !== day) return false;
      const startTime = s.start_time || '';
      return startTime === timeSlot;
    });
  };

  const matchedStudents = selectedSchedule
    ? studentsList.filter(
        (student) =>
          student.course === selectedSchedule.course &&
          (!selectedSchedule.year_level || student.year_level === selectedSchedule.year_level),
      )
    : [];

  const matchedSyllabi = selectedSchedule
    ? syllabi.filter(
        (syllabus) =>
          syllabus.course === selectedSchedule.course &&
          (syllabus.subject?.toLowerCase().includes((selectedSchedule.subject || '').toLowerCase()) ||
            (selectedSchedule.subject || '').toLowerCase().includes((syllabus.subject || '').toLowerCase())),
      )
    : [];

  const matchedLessons = matchedSyllabi.length
    ? lessons.filter((lesson) => matchedSyllabi.some((syllabus) => syllabus.id === lesson.syllabus_id))
    : [];

  useEffect(() => {
    if (navigationIntent?.tab !== 'scheduling') {
      return;
    }

    const context = navigationIntent.context || {};
    if (Object.prototype.hasOwnProperty.call(context, 'course')) {
      setSelectedCourse(context.course || 'All Courses');
    }
    if (context.scheduleId) {
      if (schedules.length === 0) {
        return;
      }
      const record = schedules.find((item) => item.id === context.scheduleId);
      if (record) {
        setSelectedSchedule(record);
      }
    }
    clearNavigationIntent?.();
  }, [navigationIntent, clearNavigationIntent, schedules]);

  const fetchLinkedData = async () => {
    try {
      const [studentsResponse, syllabusResponse, lessonResponse] = await Promise.all([
        apiRequest('/api/students'),
        apiRequest('/api/syllabus'),
        apiRequest('/api/lessons'),
      ]);
      setStudentsList(studentsResponse.data || []);
      setSyllabi(syllabusResponse.data || []);
      setLessons(lessonResponse.data || []);
    } catch (error) {
      showError('Unable to load linked schedule data', error.message);
    }
  };

  const importAccept =
    FILE_TYPE_OPTIONS.find((option) => option.key === pendingImportType)?.accept || '.xlsx,.xls,.csv';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Class Scheduling</h2>
          <p className="text-sm text-gray-500">Manage and view class schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-colors",
                viewMode === 'calendar' 
                  ? "bg-white text-orange-600 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              Calendar View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-colors",
                viewMode === 'list' 
                  ? "bg-white text-orange-600 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              List View
            </button>
          </div>
          <div ref={actionMenuRef} className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenActionMenu(openActionMenu === 'import' ? '' : 'import')}
                disabled={isProcessingFile}
                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenActionMenu(openActionMenu === 'export' ? '' : 'export')}
                disabled={isProcessingFile}
                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
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
            <input
              ref={fileInputRef}
              type="file"
              accept={importAccept}
              onChange={handleImportFileChange}
              className="hidden"
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add Schedule
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by subject, instructor, or room..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          <select 
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
            }}
            className="bg-gray-50 border-none text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option>All Courses</option>
            <option>BSIT</option>
            <option>BSCS</option>
            <option>BSIS</option>
            <option>BSEMC</option>
          </select>
          <select 
            value={selectedDay}
            onChange={(e) => {
              setSelectedDay(e.target.value);
            }}
            className="bg-gray-50 border-none text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option>All Days</option>
            {daysOfWeek.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Weekly Schedule</h3>
              <span className="text-sm font-bold text-gray-500">Current weekly grid</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading schedules...</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-r border-gray-100">Time</th>
                    {daysOfWeek.map(day => (
                      <th key={day} className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-r border-gray-100 last:border-r-0">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((timeSlot, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="px-4 py-3 text-xs font-bold text-gray-500 border-r border-gray-100 whitespace-nowrap">
                        {timeSlot}
                      </td>
                      {daysOfWeek.map(day => {
                        const schedule = getScheduleByDayAndTime(day, timeSlot);
                        return (
                          <td key={day} className="px-2 py-2 border-r border-gray-100 last:border-r-0">
                            {schedule ? (
                              <div 
                                className="bg-orange-50 border border-orange-200 rounded-lg p-3 cursor-pointer hover:bg-orange-100 transition-colors"
                                onClick={() => setSelectedSchedule(schedule)}
                              >
                                <p className="text-xs font-bold text-gray-900 mb-1">{schedule.subject}</p>
                                <p className="text-[10px] text-gray-600 mb-1">{schedule.instructor}</p>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                  <MapPin size={10} />
                                  <span>{schedule.room}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1">
                                  <Users size={10} />
                                  <span>{schedule.students || 0} students</span>
                                </div>
                              </div>
                            ) : (
                              <div className="h-20"></div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading schedules...</div>
          ) : filteredSchedules.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No schedules found</div>
          ) : (
            filteredSchedules.map((schedule) => (
              <div 
                key={schedule.id}
                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedSchedule(schedule)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                        {schedule.course}
                      </span>
                      {schedule.year_level && schedule.section && (
                        <span className="text-xs font-bold text-gray-400">
                          {schedule.year_level} - Section {schedule.section}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{schedule.subject}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="text-gray-400" size={16} />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Instructor</p>
                          <p className="text-sm text-gray-700">{schedule.instructor}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="text-gray-400" size={16} />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Day & Time</p>
                          <p className="text-sm text-gray-700">{schedule.day}, {schedule.time}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="text-gray-400" size={16} />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Room</p>
                          <p className="text-sm text-gray-700">{schedule.room}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="text-gray-400" size={16} />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Students</p>
                          <p className="text-sm text-gray-700">{schedule.students || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(schedule);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSchedule(schedule);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedule Detail Modal */}
      {selectedSchedule && !showEditModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSchedule(null)}>
          <div 
            className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                    {selectedSchedule.course}
                  </span>
                  {selectedSchedule.year_level && selectedSchedule.section && (
                    <span className="text-xs font-bold text-gray-400">
                      {selectedSchedule.year_level} - Section {selectedSchedule.section}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedSchedule.subject}</h2>
              </div>
              <button 
                onClick={() => setSelectedSchedule(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Instructor</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedSchedule.instructor}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Room</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedSchedule.room}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Day</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedSchedule.day}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedSchedule.time}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="text-gray-400" size={16} />
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Enrolled Students</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{selectedSchedule.students || 0} students</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Matched Student Cohort</p>
                  <div className="space-y-2">
                    {matchedStudents.slice(0, 5).map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => onNavigate?.('students', { studentId: student.id })}
                        className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50"
                      >
                        {student.first_name} {student.last_name}
                      </button>
                    ))}
                    {matchedStudents.length === 0 ? <p className="text-sm text-gray-500">No linked students found.</p> : null}
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Instruction Coverage</p>
                  <div className="space-y-2">
                    {matchedSyllabi.slice(0, 3).map((syllabus) => (
                      <button
                        key={syllabus.id}
                        type="button"
                        onClick={() => onNavigate?.('instructions', { type: 'syllabus', syllabusId: syllabus.id, course: syllabus.course })}
                        className="w-full rounded-xl bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50"
                      >
                        {syllabus.code} • {syllabus.subject}
                      </button>
                    ))}
                    {matchedSyllabi.length === 0 ? <p className="text-sm text-gray-500">No syllabus matched yet.</p> : null}
                    <p className="text-xs text-gray-500">{matchedLessons.length} lesson plan(s) linked</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button 
                  onClick={() => openEditModal(selectedSchedule)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors"
                >
                  Edit Schedule
                </button>
                <button 
                  onClick={handleDeleteSchedule}
                  className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  Delete Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ScheduleForm 
          key="add"
          title="Add New Schedule"
          onSubmit={handleAddSchedule}
          onCancel={() => setShowAddModal(false)}
          formData={formData}
          setFormData={setFormData}
          instructors={instructorOptions}
        />
      )}

      {showEditModal && (
        <ScheduleForm 
          key="edit"
          title="Edit Schedule"
          onSubmit={handleEditSchedule}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedSchedule(null);
          }}
          formData={formData}
          setFormData={setFormData}
          instructors={instructorOptions}
        />
      )}
    </div>
  );
};
