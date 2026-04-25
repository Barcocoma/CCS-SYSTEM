import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  GraduationCap,
  MapPin,
  RefreshCw,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { CORE_COURSES, YEAR_LEVELS } from '../../lib/formOptions';
import { ScheduleForm } from './ScheduleForm';
import { WeeklyScheduleView } from './WeeklyScheduleView';
import { useUI } from '../ui/UIProvider';

const SEMESTER_OPTIONS = ['1st Semester', '2nd Semester'];

const YEAR_ORDER = {
  '1st Year': 1,
  '2nd Year': 2,
  '3rd Year': 3,
  '4th Year': 4,
};

function buildGroupKey(schedule) {
  return [
    schedule.course || '',
    schedule.semester || '',
    schedule.year_level || '',
    schedule.subject_code || schedule.subject || '',
  ].join('|');
}

export const Scheduling = () => {
  const { showError, showSuccess } = useUI();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('BSIT');
  const [selectedSemester, setSelectedSemester] = useState('1st Semester');
  const [selectedYearLevel, setSelectedYearLevel] = useState('All Year Levels');
  const [assignmentFilter, setAssignmentFilter] = useState('Unassigned');
  const [viewMode, setViewMode] = useState('board');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSchedules = useCallback(async ({ bootstrapFirst = false } = {}) => {
    try {
      setLoading(true);
      setError('');

      if (bootstrapFirst) {
        await apiRequest('/api/schedules/bootstrap', {
          method: 'POST',
          body: {
            course: selectedCourse,
            semester: selectedSemester,
            year_level: selectedYearLevel === 'All Year Levels' ? '' : selectedYearLevel,
          },
        });
      }

      const params = new URLSearchParams({
        course: selectedCourse,
        semester: selectedSemester,
        sync: 'true',
      });
      if (selectedYearLevel !== 'All Year Levels') {
        params.append('year_level', selectedYearLevel);
      }

      const response = await apiRequest(`/api/schedules?${params.toString()}`);
      setSchedules(response.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load schedule offerings.');
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, selectedSemester, selectedYearLevel]);

  useEffect(() => {
    fetchSchedules({ bootstrapFirst: true });
  }, [fetchSchedules]);

  const groupedSchedules = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const map = new Map();

    schedules.forEach((schedule) => {
      const haystack = [
        schedule.subject_code,
        schedule.subject,
        schedule.course,
        schedule.year_level,
        schedule.section,
        schedule.instructor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (normalizedSearch && !haystack.includes(normalizedSearch)) {
        return;
      }

      const key = buildGroupKey(schedule);
      const current = map.get(key) || {
        key,
        course: schedule.course,
        semester: schedule.semester,
        year_level: schedule.year_level,
        subject_code: schedule.subject_code,
        subject: schedule.subject,
        sections: [],
        assignedCount: 0,
      };

      current.sections.push(schedule);
      if (schedule.faculty_id || (schedule.instructor && schedule.instructor !== 'Unassigned')) {
        current.assignedCount += 1;
      }
      map.set(key, current);
    });

    return Array.from(map.values())
      .filter((group) => {
        if (assignmentFilter === 'Assigned') {
          return group.assignedCount === group.sections.length;
        }
        if (assignmentFilter === 'Unassigned') {
          return group.assignedCount < group.sections.length;
        }
        return true;
      })
      .sort((left, right) => {
        const yearDiff = (YEAR_ORDER[left.year_level] || Number.MAX_SAFE_INTEGER) - (YEAR_ORDER[right.year_level] || Number.MAX_SAFE_INTEGER);
        if (yearDiff !== 0) return yearDiff;
        const codeDiff = (left.subject_code || left.subject || '').localeCompare(right.subject_code || right.subject || '');
        if (codeDiff !== 0) return codeDiff;
        return (left.subject || '').localeCompare(right.subject || '');
      });
  }, [assignmentFilter, schedules, searchTerm]);

  useEffect(() => {
    if (!groupedSchedules.some((group) => group.key === selectedGroupKey)) {
      setSelectedGroupKey(groupedSchedules[0]?.key || '');
    }
  }, [groupedSchedules, selectedGroupKey]);

  const selectedGroup = useMemo(
    () => groupedSchedules.find((group) => group.key === selectedGroupKey) || null,
    [groupedSchedules, selectedGroupKey],
  );

  const selectedGroupSections = useMemo(
    () =>
      [...(selectedGroup?.sections || [])].sort((left, right) => (left.section || '').localeCompare(right.section || '')),
    [selectedGroup],
  );

  const visibleSchedules = useMemo(
    () =>
      groupedSchedules.flatMap((group) => (
        [...group.sections].sort((left, right) => {
          const sectionDiff = (left.section || '').localeCompare(right.section || '');
          if (sectionDiff !== 0) return sectionDiff;
          return (left.subject_code || left.subject || '').localeCompare(right.subject_code || right.subject || '');
        })
      )),
    [groupedSchedules],
  );

  const loadFacultyOptions = async (schedule) => {
    try {
      setAssignmentLoading(true);
      const response = await apiRequest(`/api/schedules/${schedule.id}/faculty-options`);
      setFacultyOptions(response.data || []);
      setSelectedSchedule(schedule);
    } catch (requestError) {
      showError('Unable to load faculty options', requestError.message);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await apiRequest('/api/schedules/bootstrap', {
        method: 'POST',
        body: {
          course: selectedCourse,
          semester: selectedSemester,
          year_level: selectedYearLevel === 'All Year Levels' ? '' : selectedYearLevel,
        },
      });
      await fetchSchedules();
      showSuccess('Curriculum synced', 'Missing section schedules were generated from the active curriculum.');
    } catch (requestError) {
      showError('Unable to sync schedules', requestError.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveAssignment = async (payload) => {
    if (!selectedSchedule) return;

    try {
      setAssignmentLoading(true);
      await apiRequest(`/api/schedules/${selectedSchedule.id}`, {
        method: 'PUT',
        body: {
          faculty_id: payload.faculty_id,
          instructor: payload.faculty_id ? undefined : '',
        },
      });
      setSelectedSchedule(null);
      setFacultyOptions([]);
      await fetchSchedules();
      showSuccess('Faculty assignment saved', 'The teaching load was updated successfully.');
    } catch (requestError) {
      showError('Unable to save assignment', requestError.message);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const assignedSectionsCount = useMemo(
    () => schedules.filter((schedule) => schedule.faculty_id || (schedule.instructor && schedule.instructor !== 'Unassigned')).length,
    [schedules],
  );

  const unassignedSectionsCount = schedules.length - assignedSectionsCount;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Teaching Assignment Board</h2>
            <p className="mt-2 text-sm text-slate-500">
              Default section schedules come from the curriculum. Assign faculty per subject section while the system keeps time and room conflicts in check.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Curriculum'}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Total Offerings</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{schedules.length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Assigned Sections</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{assignedSectionsCount}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Still Unassigned</p>
            <p className="mt-2 text-2xl font-bold text-orange-700">{unassignedSectionsCount}</p>
          </article>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,0.55fr))]">
          <label className="relative block">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search subject code or subject title"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <select
            value={selectedCourse}
            onChange={(event) => setSelectedCourse(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
          >
            {CORE_COURSES.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>

          <select
            value={selectedSemester}
            onChange={(event) => setSelectedSemester(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
          >
            {SEMESTER_OPTIONS.map((semester) => (
              <option key={semester} value={semester}>{semester}</option>
            ))}
          </select>

          <select
            value={selectedYearLevel}
            onChange={(event) => setSelectedYearLevel(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
          >
            <option value="All Year Levels">All Year Levels</option>
            {YEAR_LEVELS.map((yearLevel) => (
              <option key={yearLevel} value={yearLevel}>{yearLevel}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {['Unassigned', 'Assigned', 'All'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAssignmentFilter(value)}
              className={[
                'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                assignmentFilter === value
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700',
              ].join(' ')}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {['board', 'week'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={[
                'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                viewMode === mode
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700',
              ].join(' ')}
            >
              {mode === 'board' ? 'Assignment Board' : 'Week View'}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <section className="rounded-[32px] border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle size={16} />
            Unable to load schedule offerings
          </div>
          <p className="mt-2 text-sm">{error}</p>
        </section>
      ) : null}

      {viewMode === 'board' ? (
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">Subject Groups</h3>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading subject offerings...</p>
            ) : groupedSchedules.length === 0 ? (
              <p className="text-sm text-slate-500">No subject groups matched your current filters.</p>
            ) : (
              <div className="space-y-3">
                {groupedSchedules.map((group) => {
                  const remaining = group.sections.length - group.assignedCount;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setSelectedGroupKey(group.key)}
                      className={[
                        'w-full rounded-3xl border p-4 text-left transition-colors',
                        selectedGroupKey === group.key
                          ? 'border-orange-200 bg-orange-50'
                          : 'border-slate-200 bg-slate-50 hover:border-orange-200 hover:bg-orange-50',
                      ].join(' ')}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {group.subject_code ? `${group.subject_code} - ` : ''}
                            {group.subject}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.course} - {group.year_level} - {group.semester}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-orange-700">
                          {group.assignedCount}/{group.sections.length} assigned
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {remaining === 0 ? 'All sections already assigned.' : `${remaining} section(s) still need a faculty assignment.`}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CalendarClock className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">
                {selectedGroup ? `${selectedGroup.subject_code ? `${selectedGroup.subject_code} - ` : ''}${selectedGroup.subject}` : 'Section Offerings'}
              </h3>
            </div>

            {!selectedGroup ? (
              <p className="text-sm text-slate-500">Select a subject group first.</p>
            ) : (
              <div className="space-y-4">
                {selectedGroupSections.map((schedule) => {
                  const isAssigned = Boolean(schedule.faculty_id || (schedule.instructor && schedule.instructor !== 'Unassigned'));
                  return (
                    <article key={schedule.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Section {schedule.section} - {schedule.course} {schedule.year_level}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {schedule.day} - {schedule.time} - {schedule.room}
                          </p>
                        </div>
                        <span className={[
                          'rounded-full px-2.5 py-1 text-[11px] font-bold',
                          isAssigned ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700',
                        ].join(' ')}>
                          {isAssigned ? 'Assigned' : 'Needs faculty'}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Instructor</p>
                          <p className="mt-2 text-sm font-bold text-slate-900">
                            {schedule.instructor && schedule.instructor !== 'Unassigned' ? schedule.instructor : 'Unassigned'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Room</p>
                          <p className="mt-2 text-sm font-bold text-slate-900">{schedule.room}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Students</p>
                          <p className="mt-2 text-sm font-bold text-slate-900">{schedule.students || 0}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={13} />
                            {schedule.day} - {schedule.time}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={13} />
                            {schedule.room}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Users size={13} />
                            {schedule.students || 0} student(s)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadFacultyOptions(schedule)}
                          className="rounded-2xl bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700"
                        >
                          {isAssigned ? 'Reassign Faculty' : 'Assign Faculty'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="text-orange-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">Weekly Schedule View</h3>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading subject offerings...</p>
          ) : (
            <WeeklyScheduleView
              schedules={visibleSchedules}
              emptyMessage="No schedule offerings matched your current filters."
              selectedScheduleId={selectedSchedule?.id}
              onSelect={loadFacultyOptions}
              renderMeta={(schedule) => (
                <>
                  <p>{schedule.course} - {schedule.year_level} - Section {schedule.section}</p>
                  <p>{schedule.semester}</p>
                  <p>{schedule.instructor && schedule.instructor !== 'Unassigned' ? schedule.instructor : 'Professor not assigned yet'}</p>
                </>
              )}
              showProfessorNote
            />
          )}
        </section>
      )}

      {selectedSchedule ? (
        <ScheduleForm
          schedule={selectedSchedule}
          facultyOptions={facultyOptions}
          onSubmit={handleSaveAssignment}
          onCancel={() => {
            setSelectedSchedule(null);
            setFacultyOptions([]);
          }}
          submitting={assignmentLoading}
        />
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="text-orange-600" size={18} />
          <h3 className="text-lg font-bold text-slate-900">Validation Rules</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Room overlaps are blocked automatically. If another section already uses the same room and time, the assignment is rejected.
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Faculty with overlapping schedules stay visible in the picker, but they are disabled and marked with a conflict note.
          </article>
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Every offering keeps its curriculum-based time and room, so you only decide who teaches each section.
          </article>
        </div>
      </section>
    </div>
  );
};
