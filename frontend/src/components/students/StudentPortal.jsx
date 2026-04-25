import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  Clock3,
  GraduationCap,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useSession } from '../../context/SessionProvider';
import { WeeklyScheduleView } from '../scheduling/WeeklyScheduleView';

const DAY_ORDER = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const TAB_OPTIONS = [
  { key: 'subjects', label: 'Enrolled Subjects' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'classmates', label: 'Classmates' },
];

function normalizeSection(value) {
  return (value || '').trim().toUpperCase();
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

function hasAssignedFaculty(schedule) {
  return Boolean(schedule?.faculty_id || (schedule?.instructor && schedule.instructor !== 'Unassigned'));
}

export function StudentPortal() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('subjects');
  const [scheduleViewMode, setScheduleViewMode] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentProfile, setStudentProfile] = useState(null);
  const [classmates, setClassmates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        setError('');
        const [profileResponse, classmatesResponse, schedulesResponse, announcementsResponse] = await Promise.all([
          apiRequest('/api/students/me'),
          apiRequest('/api/students'),
          apiRequest('/api/schedules?sync=true'),
          apiRequest('/api/announcements'),
        ]);

        const nextSchedules = [...(schedulesResponse.data || [])].sort((left, right) => {
          const semesterDiff = (left.semester || '').localeCompare(right.semester || '');
          if (semesterDiff !== 0) return semesterDiff;
          const dayDiff = (DAY_ORDER[left.day] || Number.MAX_SAFE_INTEGER) - (DAY_ORDER[right.day] || Number.MAX_SAFE_INTEGER);
          if (dayDiff !== 0) return dayDiff;
          return parseMeridiemTime(left.start_time) - parseMeridiemTime(right.start_time);
        });

        setStudentProfile(profileResponse.data || null);
        setClassmates(classmatesResponse.data || []);
        setSchedules(nextSchedules);
        setAnnouncements(announcementsResponse.data || []);
        setSelectedScheduleId((current) => current || nextSchedules[0]?.id || null);
      } catch (requestError) {
        setError(requestError.message || 'Unable to load student workspace.');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [user?.email]);

  useEffect(() => {
    if (!schedules.some((item) => item.id === selectedScheduleId)) {
      setSelectedScheduleId(schedules[0]?.id || null);
    }
  }, [schedules, selectedScheduleId]);

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId],
  );

  const selectedAnnouncements = useMemo(
    () => announcements.filter((item) => item.schedule_id === selectedSchedule?.id),
    [announcements, selectedSchedule?.id],
  );

  const filteredClassmates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return classmates;
    }

    return classmates.filter((student) => {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(query)
        || (student.student_id || '').toLowerCase().includes(query)
        || (student.email || '').toLowerCase().includes(query)
      );
    });
  }, [classmates, searchTerm]);

  const groupedSchedule = useMemo(() => {
    const groups = new Map();
    schedules.forEach((schedule) => {
      const day = schedule.day || 'Unscheduled';
      const existing = groups.get(day) || [];
      existing.push(schedule);
      groups.set(day, existing);
    });

    return Array.from(groups.entries()).sort((left, right) => (
      (DAY_ORDER[left[0]] || Number.MAX_SAFE_INTEGER) - (DAY_ORDER[right[0]] || Number.MAX_SAFE_INTEGER)
    ));
  }, [schedules]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading student workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <section className="rounded-[32px] border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle size={16} />
          Unable to load student workspace
        </div>
        <p className="mt-2 text-sm">{error}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Student Portal</h2>
            <p className="mt-2 text-sm text-slate-500">
              View your enrolled subjects, weekly class schedule, and professor announcements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.course || 'Course not set'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.year_level || 'Year level not set'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.semester || 'Semester not set'}
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              Section {normalizeSection(studentProfile?.section) || 'N/A'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                activeTab === tab.key
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'subjects' ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="text-orange-600" size={18} />
                <h3 className="text-lg font-bold text-slate-900">Enrolled Subjects</h3>
              </div>
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
                {schedules.length} subject(s)
              </span>
            </div>

            <div className="space-y-3">
              {schedules.length === 0 ? (
                <p className="text-sm text-slate-500">No subject schedules found for your current term yet.</p>
              ) : (
                schedules.map((schedule) => (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => setSelectedScheduleId(schedule.id)}
                    className={[
                      'w-full rounded-3xl border p-4 text-left transition-colors',
                      selectedSchedule?.id === schedule.id
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-slate-200 bg-slate-50 hover:border-orange-200 hover:bg-orange-50',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {schedule.subject_code ? `${schedule.subject_code} - ` : ''}
                          {schedule.subject}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {hasAssignedFaculty(schedule) ? schedule.instructor : 'Professor not assigned yet'}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {schedule.semester}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={13} />
                        {schedule.day} - {schedule.time}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} />
                        {schedule.room}
                      </span>
                    </div>
                    {!hasAssignedFaculty(schedule) ? (
                      <p className="mt-3 rounded-2xl bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-700">
                        Schedule is ready, but the professor has not been assigned yet.
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BellRing className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">
                {selectedSchedule ? `${selectedSchedule.subject} Announcements` : 'Subject Announcements'}
              </h3>
            </div>

            {!selectedSchedule ? (
              <p className="text-sm text-slate-500">Select a subject first to view professor posts.</p>
            ) : !hasAssignedFaculty(selectedSchedule) ? (
              <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-6 text-sm text-orange-700">
                This subject already has a class schedule, but no professor is assigned yet. Announcements will appear here once a faculty member is assigned and posts an update.
              </div>
            ) : selectedAnnouncements.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No announcements have been posted for this subject yet.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedAnnouncements.map((announcement) => (
                  <article key={announcement.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900">{announcement.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {announcement.faculty_name || selectedSchedule.instructor || 'Faculty'} - {new Date(announcement.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-orange-700">
                        {announcement.subject_code || selectedSchedule.subject_code || 'Subject'}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{announcement.content}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === 'schedule' ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">Weekly Schedule</h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {['list', 'week'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScheduleViewMode(mode)}
                  className={[
                    'rounded-2xl px-4 py-2 text-sm font-semibold transition-colors',
                    scheduleViewMode === mode
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700',
                  ].join(' ')}
                >
                  {mode === 'list' ? 'List View' : 'Week View'}
                </button>
              ))}
            </div>
          </div>

          {scheduleViewMode === 'list' ? (
            groupedSchedule.length === 0 ? (
              <p className="text-sm text-slate-500">No class schedule found for your current term yet.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {groupedSchedule.map(([day, items]) => (
                  <article key={day} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{day}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-orange-700">
                        {items.length} class(es)
                      </span>
                    </div>
                    <div className="space-y-3">
                      {items.map((schedule) => (
                        <div key={schedule.id} className="rounded-2xl bg-white p-4">
                          <p className="text-sm font-bold text-slate-900">
                            {schedule.subject_code ? `${schedule.subject_code} - ` : ''}
                            {schedule.subject}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>{schedule.time}</span>
                            <span>{schedule.room}</span>
                            <span>{hasAssignedFaculty(schedule) ? schedule.instructor : 'Professor not assigned yet'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            <WeeklyScheduleView
              schedules={schedules}
              emptyMessage="No class schedule found for your current term yet."
              selectedScheduleId={selectedScheduleId}
              onSelect={(schedule) => {
                setSelectedScheduleId(schedule.id);
                setActiveTab('subjects');
              }}
              renderMeta={(schedule) => (
                <>
                  <p>{schedule.semester}</p>
                  <p>{hasAssignedFaculty(schedule) ? schedule.instructor : 'Professor not assigned yet'}</p>
                </>
              )}
              showProfessorNote
            />
          )}
        </section>
      ) : null}

      {activeTab === 'classmates' ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">Classmates</h3>
            </div>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
              {filteredClassmates.length} student(s)
            </span>
          </div>

          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search classmates"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <div className="mt-4 space-y-2">
            {filteredClassmates.length === 0 ? (
              <p className="text-sm text-slate-500">No classmates matched your search.</p>
            ) : (
              filteredClassmates.map((student) => (
                <article key={student.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">
                    {student.last_name}, {student.first_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {student.student_id}
                    {student.email ? ` - ${student.email}` : ''}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
