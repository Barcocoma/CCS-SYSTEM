import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  FileText,
  Search,
  User,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '../../constants';
import InstructionsForm from './InstructionsForm';
import { useUI } from '../ui/UIProvider';
import { apiRequest } from '../../lib/api';
import { CORE_COURSES } from '../../lib/formOptions';

const YEAR_ORDER = {
  '1st Year': 1,
  '2nd Year': 2,
  '3rd Year': 3,
  '4th Year': 4,
};

const SEMESTER_ORDER = {
  '1st Semester': 1,
  '2nd Semester': 2,
};

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCurriculumTerm(term) {
  const rawYear = String(term?.year_level || '').trim();
  const rawSemester = String(term?.semester || '').trim();
  const rawLabel = String(term?.term_label || '').trim();
  const combined = `${rawYear} ${rawSemester} ${rawLabel}`.trim();

  let yearLevel = rawYear;
  if (!yearLevel) {
    yearLevel = Object.keys(YEAR_ORDER).find((item) => combined.toLowerCase().includes(item.toLowerCase())) || '';
  }

  let semester = rawSemester;
  if (!semester) {
    semester = Object.keys(SEMESTER_ORDER).find((item) => combined.toLowerCase().includes(item.toLowerCase())) || '';
  }

  const subjects = Array.isArray(term?.subjects) ? term.subjects : [];
  const totalUnits = Number(term?.total_units || subjects.reduce((sum, subject) => sum + (Number(subject?.units) || 0), 0));

  return {
    ...term,
    year_level: yearLevel,
    semester,
    term_label: rawLabel || `${yearLevel} - ${semester}`.trim().replace(/^-\s*/, ''),
    total_units: totalUnits,
    subjects,
  };
}

function subjectMatchesSyllabus(subject, syllabus) {
  const subjectCode = normalizeToken(subject?.code);
  const syllabusCode = normalizeToken(syllabus?.code);
  const subjectName = normalizeToken(subject?.name);
  const syllabusName = normalizeToken(syllabus?.subject);

  if (subjectCode && syllabusCode && subjectCode === syllabusCode) {
    return true;
  }

  return Boolean(subjectName && syllabusName && (subjectName.includes(syllabusName) || syllabusName.includes(subjectName)));
}

export const Instructions = ({ navigationIntent, clearNavigationIntent }) => {
  const { showError, showSuccess } = useUI();
  const initialFormState = {
    course: '',
    subject: '',
    code: '',
    instructor: '',
    semester: '',
    academic_year: '',
    units: 0,
    hours: 0,
    description: '',
    objectives: [],
    topics: [],
    requirements: [],
    program: '',
    year: '',
    total_units: 0,
    semesters: [],
    syllabus_id: '',
    title: '',
    week: 1,
    duration: '',
    type: 'Lecture',
    materials: [],
    activities: [],
  };

  const [syllabi, setSyllabi] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('syllabus');
  const [selectedSyllabus, setSelectedSyllabus] = useState(null);
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('All Courses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState(initialFormState);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [syllabusResponse, curriculumResponse, lessonsResponse] = await Promise.all([
        apiRequest('/api/syllabus'),
        apiRequest('/api/curriculum'),
        apiRequest('/api/lessons'),
      ]);
      setSyllabi(syllabusResponse.data || []);
      setCurricula(curriculumResponse.data || []);
      setLessons(lessonsResponse.data || []);
    } catch (error) {
      showError('Unable to load instruction data', error.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedSyllabus(null);
    setSelectedCurriculum(null);
    setSelectedLesson(null);
    setShowAddModal(false);
    setFormData(initialFormState);
  }, [activeTab]);

  useEffect(() => {
    if (navigationIntent?.tab !== 'instructions') {
      return;
    }

    const context = navigationIntent.context || {};
    if (context.type) {
      setActiveTab(context.type);
    }
    if (Object.prototype.hasOwnProperty.call(context, 'course')) {
      setSelectedCourse(context.course || 'All Courses');
    }
    if (context.syllabusId) {
      const syllabusRecord = syllabi.find((item) => item.id === context.syllabusId);
      if (syllabusRecord) {
        setSelectedSyllabus(syllabusRecord);
      }
    }
    clearNavigationIntent?.();
  }, [clearNavigationIntent, navigationIntent, syllabi]);

  const syllabusById = useMemo(
    () => Object.fromEntries(syllabi.map((syllabus) => [syllabus.id, syllabus])),
    [syllabi],
  );

  const lessonGroupsBySyllabusId = useMemo(() => {
    const map = new Map();
    lessons.forEach((lesson) => {
      const current = map.get(lesson.syllabus_id) || [];
      current.push(lesson);
      map.set(lesson.syllabus_id, current);
    });
    return map;
  }, [lessons]);

  const getSubjectResources = useCallback((course, term, subject) => {
    const relatedSyllabi = syllabi.filter((syllabus) => {
      if (syllabus.course !== course) return false;
      if (term?.semester && syllabus.semester && syllabus.semester !== term.semester) return false;
      return subjectMatchesSyllabus(subject, syllabus);
    });

    const relatedLessons = relatedSyllabi.flatMap((syllabus) => lessonGroupsBySyllabusId.get(syllabus.id) || []);
    return { syllabi: relatedSyllabi, lessons: relatedLessons };
  }, [lessonGroupsBySyllabusId, syllabi]);

  const filteredSyllabi = useMemo(() => syllabi.filter((syllabus) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query
      || syllabus.subject?.toLowerCase().includes(query)
      || syllabus.code?.toLowerCase().includes(query)
      || syllabus.instructor?.toLowerCase().includes(query);
    const matchesCourse = selectedCourse === 'All Courses' || syllabus.course === selectedCourse;
    return matchesSearch && matchesCourse;
  }), [searchTerm, selectedCourse, syllabi]);

  const filteredCurricula = useMemo(() => curricula.filter((curriculum) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query
      || curriculum.program?.toLowerCase().includes(query)
      || curriculum.course?.toLowerCase().includes(query)
      || String(curriculum.year || '').toLowerCase().includes(query);
    const matchesCourse = selectedCourse === 'All Courses' || curriculum.course === selectedCourse;
    return matchesSearch && matchesCourse;
  }), [curricula, searchTerm, selectedCourse]);

  const filteredLessons = useMemo(() => lessons.filter((lesson) => {
    const query = searchTerm.trim().toLowerCase();
    const linkedSyllabus = syllabusById[lesson.syllabus_id];
    const matchesSearch = !query
      || lesson.title?.toLowerCase().includes(query)
      || linkedSyllabus?.subject?.toLowerCase().includes(query)
      || linkedSyllabus?.code?.toLowerCase().includes(query);
    const matchesCourse = selectedCourse === 'All Courses' || linkedSyllabus?.course === selectedCourse;
    return matchesSearch && matchesCourse;
  }), [lessons, searchTerm, selectedCourse, syllabusById]);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    try {
      if (activeTab === 'syllabus') {
        await apiRequest('/api/syllabus', {
          method: 'POST',
          body: {
            course: formData.course,
            subject: formData.subject,
            code: formData.code,
            instructor: formData.instructor,
            semester: formData.semester,
            academic_year: formData.academic_year,
            units: formData.units,
            hours: formData.hours,
            description: formData.description,
            objectives: formData.objectives || [],
            topics: formData.topics || [],
            requirements: formData.requirements || [],
          },
        });
      } else if (activeTab === 'curriculum') {
        await apiRequest('/api/curriculum', {
          method: 'POST',
          body: {
            course: formData.course,
            program: formData.program,
            year: formData.year,
            total_units: formData.total_units,
            semesters: (formData.semesters || []).map((term) => ({
              year_level: term.year_level,
              semester: term.semester,
              subjects: (term.subjects || []).filter((subject) => subject.code && subject.name),
            })),
          },
        });
      } else {
        await apiRequest('/api/lessons', {
          method: 'POST',
          body: {
            syllabus_id: parseInt(formData.syllabus_id, 10),
            title: formData.title,
            week: formData.week,
            duration: formData.duration,
            type: formData.type,
            materials: formData.materials || [],
            activities: formData.activities || [],
            objectives: formData.objectives || [],
          },
        });
      }

      setShowAddModal(false);
      setFormData(initialFormState);
      await fetchData();
      showSuccess(
        `${activeTab === 'syllabus' ? 'Syllabus' : activeTab === 'curriculum' ? 'Curriculum' : 'Lesson'} added`,
        'The instruction record was saved successfully.',
      );
    } catch (error) {
      showError('Unable to add record', error.message);
    }
  }, [activeTab, fetchData, formData, showError, showSuccess]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Instructions</h2>
          <p className="text-sm text-gray-500">Syllabus, curriculum, and lesson plan management</p>
        </div>
        <button
          onClick={() => {
            setFormData(initialFormState);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700"
        >
          <Plus size={18} />
          Add New
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('syllabus')}
          className={cn(
            'border-b-2 px-6 py-3 text-sm font-bold transition-colors',
            activeTab === 'syllabus'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} />
            Syllabus
          </div>
        </button>
        <button
          onClick={() => setActiveTab('curriculum')}
          className={cn(
            'border-b-2 px-6 py-3 text-sm font-bold transition-colors',
            activeTab === 'curriculum'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <div className="flex items-center gap-2">
            <GraduationCap size={16} />
            Curriculum
          </div>
        </button>
        <button
          onClick={() => setActiveTab('lessons')}
          className={cn(
            'border-b-2 px-6 py-3 text-sm font-bold transition-colors',
            activeTab === 'lessons'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} />
            Lessons
          </div>
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
          <select
            value={selectedCourse}
            onChange={(event) => setSelectedCourse(event.target.value)}
            className="rounded-xl bg-gray-50 px-4 py-2 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="All Courses">All Courses</option>
            {CORE_COURSES.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === 'syllabus' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
              Loading syllabi...
            </div>
          ) : filteredSyllabi.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
              No syllabi found. Click "Add New" to create one.
            </div>
          ) : (
            filteredSyllabi.map((syllabus) => (
              <button
                key={syllabus.id}
                type="button"
                onClick={() => setSelectedSyllabus(syllabus)}
                className="w-full rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                        {syllabus.course}
                      </span>
                      <span className="text-xs font-bold text-gray-400">{syllabus.code}</span>
                      <span className="text-xs text-gray-400">{syllabus.semester} {syllabus.academicYear}</span>
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-gray-900">{syllabus.subject}</h3>
                    <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        <span>{syllabus.instructor}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} />
                        <span>{syllabus.units} units</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>{syllabus.hours} hours</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{syllabus.description}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}

      {activeTab === 'curriculum' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
              Loading curricula...
            </div>
          ) : filteredCurricula.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
              No curricula found. Click "Add New" to create one.
            </div>
          ) : (
            filteredCurricula.map((curriculum) => {
              const terms = (curriculum.semesters || [])
                .map(normalizeCurriculumTerm)
                .sort((left, right) => {
                  const yearDiff = (YEAR_ORDER[left.year_level] || Number.MAX_SAFE_INTEGER) - (YEAR_ORDER[right.year_level] || Number.MAX_SAFE_INTEGER);
                  if (yearDiff !== 0) return yearDiff;
                  return (SEMESTER_ORDER[left.semester] || Number.MAX_SAFE_INTEGER) - (SEMESTER_ORDER[right.semester] || Number.MAX_SAFE_INTEGER);
                });

              return (
                <div key={curriculum.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-3">
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                          {curriculum.course}
                        </span>
                        <span className="text-xs text-gray-400">Curriculum {curriculum.year}</span>
                      </div>
                      <h3 className="mb-1 text-lg font-bold text-gray-900">{curriculum.program}</h3>
                      <p className="text-sm text-gray-600">Total Units: {curriculum.totalUnits}</p>
                    </div>
                    <button
                      onClick={() => setSelectedCurriculum(curriculum)}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-700"
                    >
                      View Details
                    </button>
                  </div>

                  <div className="space-y-4">
                    {terms.slice(0, 4).map((term, termIndex) => (
                      <div key={`${curriculum.id}-${term.term_label}-${termIndex}`} className="rounded-xl bg-gray-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-bold text-gray-900">{term.year_level} - {term.semester}</h4>
                          <span className="text-xs font-bold text-orange-600">{term.total_units} units</span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {term.subjects.map((subject) => {
                            const resources = getSubjectResources(curriculum.course, term, subject);
                            return (
                              <div key={`${subject.code}-${subject.name}`} className="rounded-xl bg-white p-3">
                                <p className="text-sm font-bold text-gray-900">{subject.name}</p>
                                <p className="mt-1 text-xs font-mono text-gray-400">{subject.code}</p>
                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                                  <span>{subject.units} units</span>
                                  <span>{resources.syllabi.length} syllabus</span>
                                  <span>{resources.lessons.length} lessons</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {activeTab === 'lessons' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
              Loading lessons...
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-400 shadow-sm">
              No lessons found. Click "Add New" to create one.
            </div>
          ) : (
            filteredLessons.map((lesson) => {
              const linkedSyllabus = syllabusById[lesson.syllabus_id];
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setSelectedLesson(lesson)}
                  className="w-full rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-sm transition-all hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                          Week {lesson.week}
                        </span>
                        <span className="text-xs text-gray-400">{lesson.type}</span>
                        <span className="text-xs text-gray-400">{lesson.duration}</span>
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-gray-900">{lesson.title}</h3>
                      <p className="text-xs text-gray-400">
                        {linkedSyllabus ? `${linkedSyllabus.code} - ${linkedSyllabus.subject}` : 'No linked syllabus'}
                      </p>
                      <div className="mt-4 space-y-2">
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Learning Objectives</p>
                          <ul className="space-y-1 text-sm text-gray-600">
                            {lesson.objectives.map((objective, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                                <span>{objective}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex items-center gap-4 pt-2 text-xs text-gray-500">
                          <span>{lesson.materials.length} materials</span>
                          <span>{lesson.activities.length} activities</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : null}

      {selectedSyllabus ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedSyllabus(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-8 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                    {selectedSyllabus.course}
                  </span>
                  <span className="text-xs font-bold text-gray-400">{selectedSyllabus.code}</span>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-gray-900">{selectedSyllabus.subject}</h2>
                <p className="text-sm text-gray-600">{selectedSyllabus.description}</p>
              </div>
              <button onClick={() => setSelectedSyllabus(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Instructor</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.instructor}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Units</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.units}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Hours</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.hours}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Semester</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.semester}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">Course Objectives</h3>
                <ul className="space-y-2">
                  {selectedSyllabus.objectives.map((objective, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">Course Topics</h3>
                <div className="space-y-2">
                  {selectedSyllabus.topics.map((topic, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Week {topic.week}: {topic.topic}</p>
                        <p className="mt-1 text-xs text-gray-500">{topic.hours} hours</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">Grading System</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedSyllabus.requirements.map((requirement, index) => (
                    <div key={index} className="rounded-xl bg-gray-50 p-4">
                      <p className="text-sm font-bold text-gray-900">{requirement.type}</p>
                      <p className="text-xs text-gray-500">{requirement.weight}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedCurriculum ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedCurriculum(null)}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-8 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                    {selectedCurriculum.course}
                  </span>
                  <span className="text-xs text-gray-400">Curriculum {selectedCurriculum.year}</span>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-gray-900">{selectedCurriculum.program}</h2>
                <p className="text-sm text-gray-600">Total Units: {selectedCurriculum.totalUnits}</p>
              </div>
              <button onClick={() => setSelectedCurriculum(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {(selectedCurriculum.semesters || [])
                .map(normalizeCurriculumTerm)
                .sort((left, right) => {
                  const yearDiff = (YEAR_ORDER[left.year_level] || Number.MAX_SAFE_INTEGER) - (YEAR_ORDER[right.year_level] || Number.MAX_SAFE_INTEGER);
                  if (yearDiff !== 0) return yearDiff;
                  return (SEMESTER_ORDER[left.semester] || Number.MAX_SAFE_INTEGER) - (SEMESTER_ORDER[right.semester] || Number.MAX_SAFE_INTEGER);
                })
                .map((term, termIndex) => (
                  <div key={`${term.term_label}-${termIndex}`} className="rounded-xl bg-gray-50 p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-gray-900">{term.year_level} - {term.semester}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-600">
                        {term.total_units} units
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {term.subjects.map((subject) => {
                        const resources = getSubjectResources(selectedCurriculum.course, term, subject);
                        return (
                          <div key={`${term.term_label}-${subject.code}-${subject.name}`} className="rounded-xl bg-white p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{subject.name}</p>
                                <p className="text-xs font-mono text-gray-400">{subject.code}</p>
                              </div>
                              <span className="text-xs font-bold text-orange-600">{subject.units} units</span>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="rounded-xl bg-gray-50 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Linked Syllabus</p>
                                {resources.syllabi.length > 0 ? (
                                  <div className="mt-2 space-y-2">
                                    {resources.syllabi.map((syllabus) => (
                                      <div key={syllabus.id} className="rounded-lg bg-white p-3">
                                        <p className="text-sm font-bold text-gray-900">{syllabus.code} - {syllabus.subject}</p>
                                        <p className="mt-1 text-xs text-gray-500">{syllabus.instructor || 'Instructor not set'} - {syllabus.semester}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-500">No syllabus linked yet.</p>
                                )}
                              </div>

                              <div className="rounded-xl bg-gray-50 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Linked Lessons</p>
                                {resources.lessons.length > 0 ? (
                                  <div className="mt-2 space-y-2">
                                    {resources.lessons.slice(0, 4).map((lesson) => (
                                      <div key={lesson.id} className="rounded-lg bg-white p-3">
                                        <p className="text-sm font-bold text-gray-900">{lesson.title}</p>
                                        <p className="mt-1 text-xs text-gray-500">Week {lesson.week} - {lesson.type || 'Lesson'}</p>
                                      </div>
                                    ))}
                                    {resources.lessons.length > 4 ? (
                                      <p className="text-xs text-gray-500">+{resources.lessons.length - 4} more lesson(s)</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-sm text-gray-500">No lessons linked yet.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {selectedLesson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedLesson(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-8 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                    Week {selectedLesson.week}
                  </span>
                  <span className="text-xs text-gray-400">{selectedLesson.type}</span>
                  <span className="text-xs text-gray-400">{selectedLesson.duration}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedLesson.title}</h2>
                <p className="mt-2 text-sm text-gray-500">
                  {syllabusById[selectedLesson.syllabus_id]
                    ? `${syllabusById[selectedLesson.syllabus_id].code} - ${syllabusById[selectedLesson.syllabus_id].subject}`
                    : 'No linked syllabus'}
                </p>
              </div>
              <button onClick={() => setSelectedLesson(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">Learning Objectives</h3>
                <ul className="space-y-2">
                  {selectedLesson.objectives.map((objective, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">Materials</h3>
                <div className="space-y-2">
                  {selectedLesson.materials.map((material, index) => (
                    <div key={index} className="rounded-xl bg-gray-50 p-4">
                      <p className="text-sm font-bold text-gray-900">{material.name}</p>
                      <p className="text-xs text-gray-500">{material.type} - {material.size}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-gray-900">Activities</h3>
                <div className="space-y-2">
                  {selectedLesson.activities.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{activity.name}</p>
                        <p className="text-xs text-gray-500">Due: {activity.dueDate ? new Date(activity.dueDate).toLocaleDateString() : 'No due date'}</p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-bold',
                          activity.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-yellow-50 text-yellow-600',
                        )}
                      >
                        {activity.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <InstructionsForm
          activeTab={activeTab}
          formData={formData}
          setFormData={setFormData}
          syllabi={syllabi}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowAddModal(false);
            setFormData(initialFormState);
          }}
        />
      ) : null}
    </div>
  );
};
