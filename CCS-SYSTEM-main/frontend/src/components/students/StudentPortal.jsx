import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search, Users } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useSession } from '../../context/SessionProvider';

function normalizeSection(value) {
  return (value || '').trim().toUpperCase();
}

export function StudentPortal() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentProfile, setStudentProfile] = useState(null);
  const [allStudents, setAllStudents] = useState([]);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        setError('');
        const [profileResponse, studentsResponse] = await Promise.all([
          apiRequest('/api/students/me'),
          apiRequest('/api/students'),
        ]);

        setStudentProfile(profileResponse.data || null);
        const students = studentsResponse.data || [];
        setAllStudents(students);
      } catch (requestError) {
        setError(requestError.message || 'Unable to load section students.');
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [user?.email]);

  const sectionOptions = useMemo(() => {
    if (!studentProfile) return [];
    const options = new Set();

    allStudents
      .filter((student) => (
        student.course === studentProfile.course &&
        student.year_level === studentProfile.year_level
      ))
      .forEach((student) => {
        const normalized = normalizeSection(student.section);
        if (normalized) options.add(normalized);
      });

    return Array.from(options).sort();
  }, [allStudents, studentProfile]);

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

  const sectionStudents = useMemo(() => {
    if (!studentProfile) return [];

    const students = allStudents.filter((student) => {
      if (student.course !== studentProfile.course) return false;
      if (student.year_level !== studentProfile.year_level) return false;
      if (!selectedSection) return true;
      return normalizeSection(student.section) === selectedSection;
    });

    return students.sort((left, right) => {
      const byLastName = (left.last_name || '').localeCompare(right.last_name || '');
      if (byLastName !== 0) return byLastName;
      return (left.first_name || '').localeCompare(right.first_name || '');
    });
  }, [allStudents, selectedSection, studentProfile]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sectionStudents;

    return sectionStudents.filter((student) => {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(query) ||
        (student.student_id || '').toLowerCase().includes(query) ||
        (student.email || '').toLowerCase().includes(query)
      );
    });
  }, [searchTerm, sectionStudents]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading section students...</p>
      </div>
    );
  }

  if (error) {
    return (
      <section className="rounded-[32px] border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle size={16} />
          Unable to load section students
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
              List of students in your section.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.course || 'Course not set'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {studentProfile?.year_level || 'Year not set'}
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              Section {selectedSection || 'N/A'}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {sectionOptions.length > 0 ? (
            <>
              <label htmlFor="student-portal-section" className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Section
              </label>
              <select
                id="student-portal-section"
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
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-orange-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">Students In Section</h3>
          </div>
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
            {filteredStudents.length} shown
          </span>
        </div>

        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search students"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
          />
        </label>

        <div className="mt-4 space-y-2">
          {filteredStudents.length === 0 ? (
            <p className="text-sm text-slate-500">No students found for this section.</p>
          ) : (
            filteredStudents.map((student) => (
              <article key={student.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">
                  {student.last_name}, {student.first_name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {student.student_id}
                  {student.email ? ` • ${student.email}` : ''}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
