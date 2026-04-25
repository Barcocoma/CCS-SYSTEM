import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarClock,
  Clock3,
  MapPin,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useUI } from '../ui/UIProvider';
import { matchesFacultyAssignment } from '../../lib/display';
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
  { key: 'schedule', label: 'Teaching Schedule' },
  { key: 'subjects', label: 'Subject Posts' },
];

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

function normalizeSection(value) {
  return (value || '').trim().toUpperCase();
}

export function FacultyWorkspace({ facultyProfile, schedules = [], students = [] }) {
  const { showError, showSuccess, confirm } = useUI();
  const [activeTab, setActiveTab] = useState('schedule');
  const [scheduleViewMode, setScheduleViewMode] = useState('list');
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [posting, setPosting] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' });

  const facultySchedules = useMemo(
    () =>
      [...schedules]
        .filter((schedule) => matchesFacultyAssignment(schedule, facultyProfile))
        .sort((left, right) => {
          const semesterDiff = (left.semester || '').localeCompare(right.semester || '');
          if (semesterDiff !== 0) return semesterDiff;
          const dayDiff = (DAY_ORDER[left.day] || Number.MAX_SAFE_INTEGER) - (DAY_ORDER[right.day] || Number.MAX_SAFE_INTEGER);
          if (dayDiff !== 0) return dayDiff;
          return parseMeridiemTime(left.start_time) - parseMeridiemTime(right.start_time);
        }),
    [facultyProfile, schedules],
  );

  const handledStudents = useMemo(() => {
    const unique = new Map();
    facultySchedules.forEach((schedule) => {
      students.forEach((student) => {
        if (student.course !== schedule.course) return;
        if (schedule.year_level && student.year_level !== schedule.year_level) return;
        if (schedule.semester && student.semester && student.semester !== schedule.semester) return;
        if (schedule.section && normalizeSection(student.section) !== normalizeSection(schedule.section)) return;
        unique.set(student.id, student);
      });
    });
    return [...unique.values()];
  }, [facultySchedules, students]);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        setAnnouncementsLoading(true);
        const response = await apiRequest('/api/announcements');
        setAnnouncements(response.data || []);
      } catch (error) {
        showError('Unable to load subject posts', error.message);
      } finally {
        setAnnouncementsLoading(false);
      }
    };

    loadAnnouncements();
  }, [showError]);

  useEffect(() => {
    if (!facultySchedules.some((schedule) => schedule.id === selectedScheduleId)) {
      setSelectedScheduleId(facultySchedules[0]?.id || null);
    }
  }, [facultySchedules, selectedScheduleId]);

  const selectedSchedule = useMemo(
    () => facultySchedules.find((schedule) => schedule.id === selectedScheduleId) || null,
    [facultySchedules, selectedScheduleId],
  );

  const selectedAnnouncements = useMemo(
    () => announcements.filter((announcement) => announcement.schedule_id === selectedSchedule?.id),
    [announcements, selectedSchedule?.id],
  );

  const groupedSchedule = useMemo(() => {
    const groups = new Map();
    facultySchedules.forEach((schedule) => {
      const day = schedule.day || 'Unscheduled';
      const current = groups.get(day) || [];
      current.push(schedule);
      groups.set(day, current);
    });
    return Array.from(groups.entries()).sort((left, right) => (
      (DAY_ORDER[left[0]] || Number.MAX_SAFE_INTEGER) - (DAY_ORDER[right[0]] || Number.MAX_SAFE_INTEGER)
    ));
  }, [facultySchedules]);

  const handlePostAnnouncement = async (event) => {
    event.preventDefault();
    if (!selectedSchedule) {
      showError('No subject selected', 'Choose a subject section first before posting an announcement.');
      return;
    }

    try {
      setPosting(true);
      const response = await apiRequest('/api/announcements', {
        method: 'POST',
        body: {
          schedule_id: selectedSchedule.id,
          title: announcementForm.title,
          content: announcementForm.content,
        },
      });
      setAnnouncements((current) => [response.data, ...current]);
      setAnnouncementForm({ title: '', content: '' });
      showSuccess('Announcement posted', 'Students in this section can now read the update in their portal.');
    } catch (error) {
      showError('Unable to post announcement', error.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    const approved = await confirm({
      title: 'Delete announcement?',
      description: 'This will remove the post from the student portal for this subject section.',
      confirmText: 'Delete post',
      tone: 'danger',
    });
    if (!approved) return;

    try {
      await apiRequest(`/api/announcements/${announcementId}`, { method: 'DELETE' });
      setAnnouncements((current) => current.filter((item) => item.id !== announcementId));
      showSuccess('Announcement deleted', 'The post was removed successfully.');
    } catch (error) {
      showError('Unable to delete announcement', error.message);
    }
  };

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
            <p className="mt-2 text-sm text-slate-500">
              {facultyProfile.position || 'Faculty'} - {facultyProfile.department || 'Department not set'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              {facultySchedules.length} assigned class(es)
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {handledStudents.length} student(s)
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

      {activeTab === 'schedule' ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">Teaching Schedule</h3>
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
              <p className="text-sm text-slate-500">No teaching load is assigned yet.</p>
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
                        <button
                          key={schedule.id}
                          type="button"
                          onClick={() => {
                            setSelectedScheduleId(schedule.id);
                            setActiveTab('subjects');
                          }}
                          className="w-full rounded-2xl bg-white p-4 text-left transition-colors hover:bg-orange-50"
                        >
                          <p className="text-sm font-bold text-slate-900">
                            {schedule.subject_code ? `${schedule.subject_code} - ` : ''}
                            {schedule.subject}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={13} />
                              {schedule.time}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={13} />
                              {schedule.room}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users size={13} />
                              {schedule.course} - {schedule.year_level} - Section {schedule.section}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            <WeeklyScheduleView
              schedules={facultySchedules}
              emptyMessage="No teaching load is assigned yet."
              selectedScheduleId={selectedScheduleId}
              onSelect={(schedule) => {
                setSelectedScheduleId(schedule.id);
                setActiveTab('subjects');
              }}
              renderMeta={(schedule) => (
                <>
                  <p>{schedule.course} - {schedule.year_level} - Section {schedule.section}</p>
                  <p>{schedule.semester}</p>
                </>
              )}
            />
          )}
        </section>
      ) : null}

      {activeTab === 'subjects' ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">My Subject Sections</h3>
            </div>

            <div className="space-y-3">
              {facultySchedules.length === 0 ? (
                <p className="text-sm text-slate-500">No assigned subject sections yet.</p>
              ) : (
                facultySchedules.map((schedule) => (
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
                          {schedule.course} - {schedule.year_level} - Section {schedule.section}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">
                        {schedule.semester}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{schedule.day} - {schedule.time}</span>
                      <span>{schedule.room}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BellRing className="text-orange-600" size={18} />
              <h3 className="text-lg font-bold text-slate-900">
                {selectedSchedule ? `Post to ${selectedSchedule.subject}` : 'Subject Posts'}
              </h3>
            </div>

            {!selectedSchedule ? (
              <p className="text-sm text-slate-500">Select a subject section first.</p>
            ) : (
              <>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900">
                    {selectedSchedule.subject_code ? `${selectedSchedule.subject_code} - ` : ''}
                    {selectedSchedule.subject}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedSchedule.course} - {selectedSchedule.year_level} - Section {selectedSchedule.section}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedSchedule.day} - {selectedSchedule.time} - {selectedSchedule.room}
                  </p>
                </div>

                <form onSubmit={handlePostAnnouncement} className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={announcementForm.title}
                    onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Announcement title"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
                    required
                  />
                  <textarea
                    value={announcementForm.content}
                    onChange={(event) => setAnnouncementForm((current) => ({ ...current, content: event.target.value }))}
                    placeholder="Write the message that students should see in their portal."
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
                    required
                  />
                  <button
                    type="submit"
                    disabled={posting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={16} />
                    {posting ? 'Posting...' : 'Post Announcement'}
                  </button>
                </form>

                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-400">Posted Updates</h4>
                  {announcementsLoading ? (
                    <p className="text-sm text-slate-500">Loading announcements...</p>
                  ) : selectedAnnouncements.length === 0 ? (
                    <p className="text-sm text-slate-500">No announcements posted for this subject section yet.</p>
                  ) : (
                    selectedAnnouncements.map((announcement) => (
                      <article key={announcement.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-bold text-slate-900">{announcement.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(announcement.created_at).toLocaleString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                            className="inline-flex items-center gap-1 rounded-2xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-600">{announcement.content}</p>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
