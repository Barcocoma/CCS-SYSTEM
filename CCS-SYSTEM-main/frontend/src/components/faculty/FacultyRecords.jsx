import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock3,
  Edit3,
  Eye,
  MapPin,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { FacultyForm } from './FacultyForm';
import { ModalShell } from '../ui/ModalShell';
import { useUI } from '../ui/UIProvider';
import { useSession } from '../../context/SessionProvider';
import { apiRequest } from '../../lib/api';
import { cn } from '../../constants';
import { CORE_COURSES } from '../../lib/formOptions';
import { formatFacultyLabel, getInitials, matchesFacultyAssignment } from '../../lib/display';

function calculateYearsOfService(startDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  return Math.max(0, now.getFullYear() - start.getFullYear());
}

const DAY_ORDER = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const EVENT_STATUS_STYLE = {
  Upcoming: 'bg-blue-50 text-blue-700',
  'Registration Open': 'bg-orange-50 text-orange-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  'Pending Approval': 'bg-amber-50 text-amber-700',
};

function normalizeSection(value) {
  return (value || '').trim().toUpperCase();
}

function buildSectionKey(course, yearLevel, section) {
  return `${(course || '').trim()}|${(yearLevel || '').trim()}|${normalizeSection(section)}`;
}

function parseMeridiemTime(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = value.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;

  let hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM') hour += 12;
  return (hour * 60) + minute;
}

function toSortableDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatEventDate(value) {
  const parsed = toSortableDate(value);
  if (!parsed) return 'Date not set';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function FacultyRecords({ navigationIntent, clearNavigationIntent, onNavigate }) {
  const { user, accessRole } = useSession();
  const { showError, showSuccess, confirm } = useUI();
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [facultyStudentSearch, setFacultyStudentSearch] = useState('');
  const [facultySectionFilter, setFacultySectionFilter] = useState('ALL');
  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    birthday: '',
    email: '',
    contact_number: '',
    department: 'BSIT',
    position: '',
    employment_start_date: '',
    employment_status: 'Full-time',
  });

  const fetchFaculty = useCallback(async () => {
    try {
      setLoading(true);
      const [facultyResponse, studentsResponse, schedulesResponse, syllabusResponse, eventsResponse] = await Promise.all([
        apiRequest('/api/faculty'),
        apiRequest('/api/students'),
        apiRequest('/api/schedules'),
        apiRequest('/api/syllabus'),
        apiRequest('/api/reports?report_type=event'),
      ]);

      setFaculty(facultyResponse.data || []);
      setStudents(studentsResponse.data || []);
      setSchedules(schedulesResponse.data || []);
      setSyllabi(syllabusResponse.data || []);
      setEvents(eventsResponse.data || []);
    } catch (error) {
      showError('Unable to load faculty records', error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  useEffect(() => {
    if (navigationIntent?.tab !== 'faculty') {
      return;
    }

    const context = navigationIntent.context || {};
    if (Object.prototype.hasOwnProperty.call(context, 'department')) {
      setFilterDepartment(context.department || '');
    }
    if (context.facultyId) {
      if (faculty.length === 0) {
        return;
      }
      const record = faculty.find((item) => item.id === context.facultyId);
      if (record) {
        setSelectedFaculty(record);
      }
    }
    clearNavigationIntent?.();
  }, [navigationIntent, clearNavigationIntent, faculty]);

  const filteredFaculty = useMemo(
    () =>
      faculty.filter((facultyMember) => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          facultyMember.first_name?.toLowerCase().includes(query) ||
          facultyMember.last_name?.toLowerCase().includes(query) ||
          facultyMember.employee_number?.toLowerCase().includes(query) ||
          facultyMember.email?.toLowerCase().includes(query);

        const matchesDepartment = !filterDepartment || facultyMember.department === filterDepartment;
        return matchesSearch && matchesDepartment;
      }),
    [faculty, filterDepartment, searchTerm],
  );

  const selectedFacultySchedules = useMemo(
    () => schedules.filter((schedule) => matchesFacultyAssignment(schedule, selectedFaculty)),
    [schedules, selectedFaculty],
  );

  const assignedStudents = useMemo(() => {
    const seen = new Map();
    selectedFacultySchedules.forEach((schedule) => {
      students
        .filter((student) => student.course === schedule.course && (!schedule.year_level || student.year_level === schedule.year_level))
        .forEach((student) => seen.set(student.id, student));
    });
    return [...seen.values()];
  }, [selectedFacultySchedules, students]);

  const selectedFacultySyllabi = useMemo(() => {
    if (!selectedFaculty) {
      return [];
    }
    const displayName = formatFacultyLabel(selectedFaculty).toLowerCase();
    const lastName = (selectedFaculty.last_name || '').toLowerCase();
    return syllabi.filter((syllabus) => {
      const instructor = (syllabus.instructor || '').toLowerCase();
      return instructor.includes(lastName) || (displayName && instructor.includes(displayName));
    });
  }, [selectedFaculty, syllabi]);

  const facultyLoginTokens = useMemo(
    () => [user?.email, user?.username].map((value) => (value || '').trim().toLowerCase()).filter(Boolean),
    [user?.email, user?.username],
  );

  const matchedFacultyProfile = useMemo(
    () =>
      faculty.find((item) => {
        const email = (item.email || '').trim().toLowerCase();
        const employeeNumber = (item.employee_number || '').trim().toLowerCase();
        return facultyLoginTokens.some((token) => token === email || token === employeeNumber);
      }) || null,
    [faculty, facultyLoginTokens],
  );

  const normalizedFacultyPosition = (matchedFacultyProfile?.position || '').trim().toLowerCase();
  const hasChairPosition = ['department chair', 'dept chair', 'chair', 'chairperson'].includes(normalizedFacultyPosition);
  const isFacultySelfView = accessRole === 'FACULTY' && !hasChairPosition;
  const facultyProfile = isFacultySelfView ? matchedFacultyProfile : null;

  const facultyOwnSchedules = useMemo(() => {
    if (!facultyProfile) {
      return [];
    }

    return [...schedules]
      .filter((schedule) => matchesFacultyAssignment(schedule, facultyProfile))
      .sort((left, right) => {
        const dayDiff = (DAY_ORDER[left.day] || Number.MAX_SAFE_INTEGER) - (DAY_ORDER[right.day] || Number.MAX_SAFE_INTEGER);
        if (dayDiff !== 0) return dayDiff;
        return parseMeridiemTime(left.start_time) - parseMeridiemTime(right.start_time);
      });
  }, [facultyProfile, schedules]);

  const handledSections = useMemo(() => {
    const grouped = new Map();

    facultyOwnSchedules.forEach((schedule) => {
      const course = (schedule.course || '').trim();
      const yearLevel = (schedule.year_level || '').trim();
      const section = normalizeSection(schedule.section);
      const key = buildSectionKey(course, yearLevel, section);

      const existing = grouped.get(key) || {
        key,
        course,
        yearLevel,
        section,
        schedules: [],
      };

      existing.schedules.push(schedule);
      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).sort((left, right) => {
      const courseDiff = (left.course || '').localeCompare(right.course || '');
      if (courseDiff !== 0) return courseDiff;
      const yearDiff = (left.yearLevel || '').localeCompare(right.yearLevel || '');
      if (yearDiff !== 0) return yearDiff;
      return (left.section || '').localeCompare(right.section || '');
    });
  }, [facultyOwnSchedules]);

  const sectionStudentGroups = useMemo(
    () =>
      handledSections.map((sectionGroup) => {
        const matchedStudents = students
          .filter((student) => {
            if (sectionGroup.course && student.course !== sectionGroup.course) return false;
            if (sectionGroup.yearLevel && student.year_level !== sectionGroup.yearLevel) return false;
            if (sectionGroup.section && normalizeSection(student.section) !== sectionGroup.section) return false;
            return true;
          })
          .sort((left, right) => (
            `${left.last_name || ''} ${left.first_name || ''}`.localeCompare(`${right.last_name || ''} ${right.first_name || ''}`)
          ));

        return {
          ...sectionGroup,
          students: matchedStudents,
        };
      }),
    [handledSections, students],
  );

  const facultySectionOptions = useMemo(
    () =>
      handledSections.map((group) => ({
        value: group.key,
        label: `${group.course || 'Course not set'} • ${group.yearLevel || 'All Year Levels'} • ${group.section ? `Section ${group.section}` : 'All Sections'}`,
      })),
    [handledSections],
  );

  useEffect(() => {
    if (!isFacultySelfView) {
      return;
    }
    if (facultySectionFilter === 'ALL') {
      return;
    }
    if (!facultySectionOptions.some((option) => option.value === facultySectionFilter)) {
      setFacultySectionFilter('ALL');
    }
  }, [facultySectionFilter, facultySectionOptions, isFacultySelfView]);

  const normalizedFacultyStudentSearch = facultyStudentSearch.trim().toLowerCase();

  const filteredSectionStudentGroups = useMemo(() => {
    const scopedGroups = sectionStudentGroups.filter((group) => (
      facultySectionFilter === 'ALL' || group.key === facultySectionFilter
    ));

    if (!normalizedFacultyStudentSearch) {
      return scopedGroups;
    }

    return scopedGroups
      .map((group) => {
        const filteredStudents = group.students.filter((student) => {
          const haystack = [
            student.student_id,
            student.first_name,
            student.middle_name,
            student.last_name,
            student.email,
            student.course,
            student.year_level,
            student.section,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(normalizedFacultyStudentSearch);
        });

        return {
          ...group,
          students: filteredStudents,
        };
      })
      .filter((group) => (
        group.students.length > 0
        || `${group.course || ''} ${group.yearLevel || ''} ${group.section || ''}`.toLowerCase().includes(normalizedFacultyStudentSearch)
      ));
  }, [facultySectionFilter, normalizedFacultyStudentSearch, sectionStudentGroups]);

  const filteredFacultyOwnSchedules = useMemo(
    () =>
      facultyOwnSchedules.filter((schedule) => (
        facultySectionFilter === 'ALL'
        || buildSectionKey(schedule.course, schedule.year_level, schedule.section) === facultySectionFilter
      )),
    [facultyOwnSchedules, facultySectionFilter],
  );

  const visibleHandledStudentCount = useMemo(() => {
    const unique = new Map();
    filteredSectionStudentGroups.forEach((group) => {
      group.students.forEach((student) => {
        unique.set(student.id, student);
      });
    });
    return unique.size;
  }, [filteredSectionStudentGroups]);

  const eventSourceGroups = useMemo(
    () =>
      facultySectionFilter === 'ALL'
        ? sectionStudentGroups
        : sectionStudentGroups.filter((group) => group.key === facultySectionFilter),
    [facultySectionFilter, sectionStudentGroups],
  );

  const facultyVisibleEvents = useMemo(() => {
    const sortedEvents = [...events].sort((left, right) => {
      const leftDate = toSortableDate(left.date);
      const rightDate = toSortableDate(right.date);
      if (leftDate && rightDate) return rightDate - leftDate;
      if (leftDate) return -1;
      if (rightDate) return 1;
      return (left.title || '').localeCompare(right.title || '');
    });

    if (sortedEvents.length === 0 || eventSourceGroups.length === 0) {
      return sortedEvents;
    }

    const tokens = new Set();
    eventSourceGroups.forEach((group) => {
      if (group.course) tokens.add(group.course.toLowerCase());
      if (group.yearLevel) tokens.add(group.yearLevel.toLowerCase());
      if (group.section) {
        tokens.add(`section ${group.section.toLowerCase()}`);
        tokens.add(`sec ${group.section.toLowerCase()}`);
      }
    });
    if (facultyProfile?.department) tokens.add(facultyProfile.department.toLowerCase());

    const scored = sortedEvents.map((eventRecord) => {
      const haystack = [
        eventRecord.title,
        eventRecord.organization,
        eventRecord.category,
        eventRecord.description,
        eventRecord.venue,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      let score = 0;
      tokens.forEach((token) => {
        if (token && haystack.includes(token)) {
          score += 1;
        }
      });

      return { eventRecord, score };
    });

    const matching = scored
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    return (matching.length > 0 ? matching : scored).map((item) => item.eventRecord);
  }, [eventSourceGroups, events, facultyProfile?.department]);

  const openEditModal = (facultyMember) => {
    setFormData({
      employee_number: facultyMember.employee_number || '',
      first_name: facultyMember.first_name || '',
      last_name: facultyMember.last_name || '',
      middle_name: facultyMember.middle_name || '',
      birthday: facultyMember.birthday ? String(facultyMember.birthday).split('T')[0] : '',
      email: facultyMember.email || '',
      contact_number: facultyMember.contact_number || '',
      department: facultyMember.department || 'BSIT',
      position: facultyMember.position || '',
      employment_start_date: facultyMember.employment_start_date ? facultyMember.employment_start_date.split('T')[0] : '',
      employment_status: facultyMember.employment_status || 'Full-time',
    });
    setSelectedFaculty(facultyMember);
    setShowEditModal(true);
  };

  const handleAddFaculty = async (event) => {
    event.preventDefault();
    try {
      const response = await apiRequest('/api/faculty', { method: 'POST', body: formData });
      setShowAddModal(false);
      await fetchFaculty();
      const credentialsHint = response.account
        ? `Account ID: ${response.account.email} | Default password: ${response.account.password}`
        : 'The new faculty member can now be used in scheduling.';
      showSuccess('Faculty record added', credentialsHint);
    } catch (error) {
      showError('Unable to add faculty', error.message);
    }
  };

  const handleEditFaculty = async (event) => {
    event.preventDefault();
    if (!selectedFaculty?.id) return;
    try {
      await apiRequest(`/api/faculty/${selectedFaculty.id}`, { method: 'PUT', body: formData });
      setShowEditModal(false);
      await fetchFaculty();
      showSuccess('Faculty record updated', 'The profile changes were saved successfully.');
    } catch (error) {
      showError('Unable to update faculty', error.message);
    }
  };

  const handleDeleteFaculty = async () => {
    if (!selectedFaculty?.id) return;

    const approved = await confirm({
      title: 'Delete faculty profile?',
      description: `This will remove ${selectedFaculty.first_name} ${selectedFaculty.last_name} from the system.`,
      confirmText: 'Delete faculty',
      tone: 'danger',
    });

    if (!approved) return;

    try {
      await apiRequest(`/api/faculty/${selectedFaculty.id}`, { method: 'DELETE' });
      setSelectedFaculty(null);
      await fetchFaculty();
      showSuccess('Faculty record deleted', 'The faculty profile was removed.');
    } catch (error) {
      showError('Unable to delete faculty', error.message);
    }
  };

  if (isFacultySelfView) {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-slate-500">Loading faculty workspace...</p>
        </div>
      );
    }

    if (!facultyProfile) {
      return (
        <section className="rounded-[32px] border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle size={16} />
            Faculty profile not found
          </div>
          <p className="mt-2 text-sm">
            No faculty record is linked to your account yet. Ask a dean or secretary to create your faculty profile first.
          </p>
        </section>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {facultyProfile.first_name} {facultyProfile.last_name}
              </h3>
              <p className="mt-2 text-sm text-slate-500">{formatFacultyLabel(facultyProfile)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                {facultyProfile.department || 'Department not set'}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {facultyProfile.employee_number || 'No employee number'}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Handled Sections</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{sectionStudentGroups.length}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Visible Students</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{visibleHandledStudentCount}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Visible Schedule Slots</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{filteredFacultyOwnSchedules.length}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Visible Events</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{facultyVisibleEvents.length}</p>
            </article>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1.4fr_0.8fr]">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search students by name, ID, course, year, section..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
                value={facultyStudentSearch}
                onChange={(event) => setFacultyStudentSearch(event.target.value)}
              />
            </label>
            <select
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
              value={facultySectionFilter}
              onChange={(event) => setFacultySectionFilter(event.target.value)}
            >
              <option value="ALL">All Handled Sections</option>
              {facultySectionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <p className="mt-3 text-xs font-semibold text-slate-500">
            Showing {filteredSectionStudentGroups.length} section group(s) and {visibleHandledStudentCount} unique student(s) for your current filter.
          </p>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="text-orange-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">Students By Handled Section</h3>
          </div>

          {facultySectionOptions.length === 0 ? (
            <p className="text-sm text-slate-500">No handled sections detected from your assigned schedules yet.</p>
          ) : filteredSectionStudentGroups.length === 0 ? (
            <p className="text-sm text-slate-500">No students matched your current search and section filter.</p>
          ) : (
            <div className="space-y-4">
              {filteredSectionStudentGroups.map((group) => (
                <article key={group.key} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">
                      {group.course || 'Course not set'} • {group.yearLevel || 'All Year Levels'} • {group.section ? `Section ${group.section}` : 'All Sections'}
                    </p>
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                      {group.students.length} student(s)
                    </span>
                  </div>

                  {group.students.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No student profiles match this section yet.</p>
                  ) : (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {group.students.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => onNavigate?.('students', { studentId: student.id })}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-orange-200 hover:bg-orange-50"
                        >
                          <span className="text-sm font-medium text-slate-900">
                            {student.last_name}, {student.first_name}
                          </span>
                          <span className="text-xs text-slate-500">{student.student_id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="text-orange-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">My Schedule</h3>
          </div>

          {filteredFacultyOwnSchedules.length === 0 ? (
            <p className="text-sm text-slate-500">No schedules matched your current section filter.</p>
          ) : (
            <div className="space-y-3">
              {filteredFacultyOwnSchedules.map((schedule) => (
                <article key={schedule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{schedule.subject}</p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {schedule.section ? `Section ${schedule.section}` : 'All Sections'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={13} />
                      {schedule.day} • {schedule.time}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} />
                      {schedule.room || 'Room not set'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Building2 size={13} />
                      {schedule.course || 'Course not set'} • {schedule.year_level || 'All Year Levels'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="text-orange-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">Events</h3>
          </div>

          {facultyVisibleEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No events available.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {facultyVisibleEvents.map((eventRecord) => (
                <article key={eventRecord.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{eventRecord.title}</p>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-bold',
                        EVENT_STATUS_STYLE[eventRecord.status] || 'bg-slate-100 text-slate-700',
                      )}
                    >
                      {eventRecord.status || 'Upcoming'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{formatEventDate(eventRecord.date)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(eventRecord.time || 'Time TBA')} • {(eventRecord.venue || 'Venue TBA')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {eventRecord.organization ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                        {eventRecord.organization}
                      </span>
                    ) : null}
                    {eventRecord.category ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {eventRecord.category}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Faculty Profiles</h3>
            <p className="mt-1 text-sm text-slate-500">Manage faculty records used in scheduling and instruction assignment.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700"
          >
            <Plus size={18} />
            Add Faculty
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1.4fr_0.8fr]">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search faculty..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <select
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
            value={filterDepartment}
            onChange={(event) => setFilterDepartment(event.target.value)}
          >
            <option value="">All Departments</option>
            {CORE_COURSES.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading faculty profiles...</div>
          ) : filteredFaculty.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">No faculty profiles found.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Faculty</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Employee Number</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Department</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Position</th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFaculty.map((facultyMember) => (
                  <tr key={facultyMember.id} className="transition-colors hover:bg-orange-50/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 via-white to-orange-50 text-sm font-bold text-slate-700">
                          {getInitials(facultyMember.first_name, facultyMember.last_name)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {facultyMember.last_name}, {facultyMember.first_name}
                          </p>
                          <p className="text-xs text-slate-500">{facultyMember.email || 'No email on file'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{facultyMember.employee_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{facultyMember.department}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{facultyMember.position || 'Not set'}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedFaculty(facultyMember)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(facultyMember)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                        >
                          <Edit3 size={14} />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {selectedFaculty && !showEditModal ? (
        <ModalShell
          onClose={() => setSelectedFaculty(null)}
          title="Faculty Profile"
          description="Linked schedules, instruction coverage, and student cohorts for this faculty member."
          size="max-w-6xl"
        >
          <div className="space-y-6">
            <div className="rounded-[32px] bg-gradient-to-br from-slate-50 via-white to-orange-50 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-2xl font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                    {getInitials(selectedFaculty.first_name, selectedFaculty.last_name)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {selectedFaculty.first_name} {selectedFaculty.middle_name || ''} {selectedFaculty.last_name}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">{formatFacultyLabel(selectedFaculty)}</p>
                    <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-slate-400" />
                        <span>{selectedFaculty.email || 'No email on file'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        <span>{selectedFaculty.contact_number || 'No contact number'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="text-slate-400" />
                        <span>{calculateYearsOfService(selectedFaculty.employment_start_date)} years of service</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedFaculty)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Edit3 size={16} />
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteFaculty}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
                  >
                    <Trash2 size={16} />
                    Delete Faculty
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assigned Schedules</h3>
                  <p className="mt-1 text-sm text-slate-500">Schedules are matched from the instructor label used in the scheduling module.</p>
                </div>
                {selectedFacultySchedules.length > 0 ? (
                  <div className="space-y-3">
                    {selectedFacultySchedules.map((schedule) => (
                      <button
                        key={schedule.id}
                        type="button"
                        onClick={() => onNavigate?.('scheduling', { scheduleId: schedule.id })}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-orange-200 hover:bg-orange-50"
                      >
                        <p className="text-sm font-bold text-slate-900">{schedule.subject}</p>
                        <p className="mt-1 text-sm text-slate-500">{schedule.day} • {schedule.time}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {schedule.course} • {schedule.year_level || 'All year levels'} • {schedule.room}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No schedules currently point to this faculty member.</p>
                )}
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 text-orange-600" size={18} />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Instruction Coverage</h3>
                      <p className="mt-1 text-sm text-slate-500">{selectedFacultySyllabi.length} syllabus record(s) linked to this faculty member.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedFacultySyllabi.slice(0, 4).map((syllabus) => (
                      <button
                        key={syllabus.id}
                        type="button"
                        onClick={() => onNavigate?.('instructions', { type: 'syllabus', syllabusId: syllabus.id, course: syllabus.course })}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-orange-200 hover:bg-orange-50"
                      >
                        <p className="text-sm font-bold text-slate-900">{syllabus.code} • {syllabus.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">{syllabus.semester} • {syllabus.course}</p>
                      </button>
                    ))}
                    {selectedFacultySyllabi.length === 0 ? (
                      <p className="text-sm text-slate-500">No syllabus assignment found yet.</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 text-orange-600" size={18} />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Student Cohorts</h3>
                      <p className="mt-1 text-sm text-slate-500">{assignedStudents.length} student(s) belong to this faculty member’s matched schedule cohorts.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {assignedStudents.slice(0, 6).map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => onNavigate?.('students', { studentId: student.id })}
                        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-orange-200 hover:bg-orange-50"
                      >
                        <span className="text-sm font-medium text-slate-900">
                          {student.first_name} {student.last_name}
                        </span>
                        <span className="text-xs text-slate-500">{student.course} • {student.year_level}</span>
                      </button>
                    ))}
                    {assignedStudents.length === 0 ? (
                      <p className="text-sm text-slate-500">No linked student cohort was found from the current schedule data.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {showAddModal ? (
        <FacultyForm
          key="add-faculty"
          title="Add Faculty Profile"
          onSubmit={handleAddFaculty}
          onCancel={() => setShowAddModal(false)}
          formData={formData}
          setFormData={setFormData}
        />
      ) : null}

      {showEditModal ? (
        <FacultyForm
          key="edit-faculty"
          title="Edit Faculty Profile"
          onSubmit={handleEditFaculty}
          onCancel={() => setShowEditModal(false)}
          formData={formData}
          setFormData={setFormData}
        />
      ) : null}
    </div>
  );
}
