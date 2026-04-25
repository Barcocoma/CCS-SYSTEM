import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Clock3,
  GraduationCap,
  MapPin,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useSession } from '../../context/SessionProvider';

const DAY_ORDER = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

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

export function StudentSectionSchedule() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [studentProfile, setStudentProfile] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');

  useEffect(() => {
    const loadScheduleData = async () => {
      try {
        setLoading(true);
        setError('');
        const [profileResponse, studentsResponse, schedulesResponse] = await Promise.all([
          apiRequest('/api/students/me'),
          apiRequest('/api/students'),
          apiRequest('/api/schedules'),
        ]);

        const profile = profileResponse.data || null;
        const students = studentsResponse.data || [];
        const schedules = schedulesResponse.data || [];
        setStudentProfile(profile);
        setAllStudents(students);
        setAllSchedules(schedules);
      } catch (requestError) {
        setError(requestError.message || 'Unable to load section schedule.');
      } finally {
        setLoading(false);
      }
    };

    loadScheduleData();
  }, [user?.email]);

  const sectionOptions = useMemo(() => {
    if (!studentProfile) return [];

    const options = new Set();
    const profileSection = normalizeSection(studentProfile.section);
    if (profileSection) options.add(profileSection);

    allStudents
      .filter((student) => (
        student.course === studentProfile.course &&
        student.year_level === studentProfile.year_level
      ))
      .forEach((student) => {
        const normalized = normalizeSection(student.section);
        if (normalized) options.add(normalized);
      });

    allSchedules
      .filter((schedule) => (
        schedule.course === studentProfile.course &&
        (!schedule.year_level || schedule.year_level === studentProfile.year_level) &&
        (!schedule.semester || !studentProfile.semester || schedule.semester === studentProfile.semester)
      ))
      .forEach((schedule) => {
        const normalized = normalizeSection(schedule.section);
        if (normalized) options.add(normalized);
      });

    return Array.from(options).sort();
  }, [allSchedules, allStudents, studentProfile]);

  useEffect(() => {
    if (!studentProfile) return;
    const profileSection = normalizeSection(studentProfile.section);
    if (profileSection) {
      setSelectedSection(profileSection);
      return;
    }
    if (sectionOptions.length > 0) {
      setSelectedSection(sectionOptions[0]);
      return;
    }
    setSelectedSection('');
  }, [studentProfile?.id, studentProfile?.section, sectionOptions]);

  const sectionClassCount = useMemo(() => {
    if (!studentProfile) return 0;
    const hasSection = Boolean(selectedSection);

    return allStudents.filter((student) => {
      if (student.course !== studentProfile.course) return false;
      if (student.year_level !== studentProfile.year_level) return false;
      if (!hasSection) return true;
      return normalizeSection(student.section) === selectedSection;
    }).length;
  }, [allStudents, selectedSection, studentProfile]);

  const scopedSchedules = useMemo(() => {
    if (!studentProfile) return [];

    const filtered = allSchedules.filter((schedule) => {
      if (schedule.course !== studentProfile.course) return false;
      if (schedule.year_level && studentProfile.year_level && schedule.year_level !== studentProfile.year_level) {
        return false;
      }
      if (schedule.semester && studentProfile.semester && schedule.semester !== studentProfile.semester) {
        return false;
      }

      if (!selectedSection) return true;
      const scheduleSection = normalizeSection(schedule.section);
      return !scheduleSection || scheduleSection === selectedSection;
    });

    return [...filtered].sort((left, right) => {
      const dayDiff = (DAY_ORDER[left.day] || Number.MAX_SAFE_INTEGER) - (DAY_ORDER[right.day] || Number.MAX_SAFE_INTEGER);
      if (dayDiff !== 0) return dayDiff;
      return parseMeridiemTime(left.start_time) - parseMeridiemTime(right.start_time);
    });
  }, [allSchedules, selectedSection, studentProfile]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading section schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <section className="rounded-[32px] border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle size={16} />
          Unable to load section schedule
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
            <h2 className="text-2xl font-bold text-slate-900">Section Schedule</h2>
            <p className="mt-2 text-sm text-slate-500">
              View class schedules scoped to your course, year level, and section.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.course || 'Course not set'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.year_level || 'Year not set'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.semester || 'Semester not set'}
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              Section {selectedSection || 'N/A'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {sectionOptions.length > 0 ? (
            <>
              <label htmlFor="student-schedule-section" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Section
              </label>
              <select
                id="student-schedule-section"
                value={selectedSection}
                onChange={(event) => setSelectedSection(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
              >
                {sectionOptions.map((option) => (
                  <option key={option} value={option}>Section {option}</option>
                ))}
              </select>
            </>
          ) : (
            <p className="text-sm text-slate-500">No section labels available yet for this profile.</p>
          )}

          <span className="ml-auto rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
            <Users size={12} className="mr-1 inline" />
            {sectionClassCount} student(s)
          </span>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="text-orange-600" size={18} />
          <h3 className="text-lg font-bold text-slate-900">Class Timetable</h3>
        </div>

        <div className="space-y-3">
          {scopedSchedules.length === 0 ? (
            <p className="text-sm text-slate-500">No schedules found for the selected section.</p>
          ) : (
            scopedSchedules.map((schedule) => (
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
                    {schedule.room}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GraduationCap size={13} />
                    {schedule.instructor && schedule.instructor !== 'Unassigned' ? schedule.instructor : 'Professor not assigned yet'}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
