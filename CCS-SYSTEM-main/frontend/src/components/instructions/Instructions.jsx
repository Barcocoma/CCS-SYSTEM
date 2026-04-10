import React, { useState, useEffect, useCallback } from 'react';
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
    activities: []
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

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedCourse]);

  useEffect(() => {
    setSelectedSyllabus(null);
    setSelectedCurriculum(null);
    setSelectedLesson(null);
    setShowAddModal(false);
    setFormData(initialFormState);
  }, [activeTab]);

  useEffect(() => {
    // Fetch syllabi when switching to lessons tab (needed for dropdown)
    if (activeTab === 'lessons') {
      fetch(`${API_URL}/api/syllabus`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSyllabi(data.data);
          }
        })
        .catch(err => console.error('Error fetching syllabi:', err));
    }
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
      if (syllabi.length === 0) {
        return;
      }
      const syllabusRecord = syllabi.find((item) => item.id === context.syllabusId);
      if (syllabusRecord) {
        setSelectedSyllabus(syllabusRecord);
      }
    }
    clearNavigationIntent?.();
  }, [navigationIntent, clearNavigationIntent, syllabi]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'syllabus') {
        const response = await fetch(`${API_URL}/api/syllabus`);
        const data = await response.json();
        if (data.success) {
          setSyllabi(data.data);
        }
      } else if (activeTab === 'curriculum') {
        const response = await fetch(`${API_URL}/api/curriculum`);
        const data = await response.json();
        if (data.success) {
          setCurricula(data.data);
        }
      } else if (activeTab === 'lessons') {
        const response = await fetch(`${API_URL}/api/lessons`);
        const data = await response.json();
        if (data.success) {
          setLessons(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const filteredSyllabi = syllabi.filter(syllabus => {
    const matchesSearch = syllabus.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         syllabus.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         syllabus.instructor?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'All Courses' || syllabus.course === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  const filteredCurricula = curricula.filter(curriculum => {
    const matchesSearch = curriculum.program?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         curriculum.course?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'All Courses' || curriculum.course === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.title?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      let url = '';
      let payload = {};

      if (activeTab === 'syllabus') {
        url = `${API_URL}/api/syllabus`;
        payload = {
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
          requirements: formData.requirements || []
        };
      } else if (activeTab === 'curriculum') {
        url = `${API_URL}/api/curriculum`;
        payload = {
          course: formData.course,
          program: formData.program,
          year: formData.year,
          total_units: formData.total_units,
          semesters: formData.semesters || [] // Use semesters from form data
        };
      } else if (activeTab === 'lessons') {
        url = `${API_URL}/api/lessons`;
        payload = {
          syllabus_id: parseInt(formData.syllabus_id),
          title: formData.title,
          week: formData.week,
          duration: formData.duration,
          type: formData.type,
          materials: formData.materials || [],
          activities: formData.activities || [],
          objectives: formData.objectives || []
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        setShowAddModal(false);
        setFormData(initialFormState);
        await fetchData();
        showSuccess(
          `${activeTab === 'syllabus' ? 'Syllabus' : activeTab === 'curriculum' ? 'Curriculum' : 'Lesson'} added`,
          'The instruction record was saved successfully.',
        );
      } else {
        showError('Unable to add record', data.message);
      }
    } catch (error) {
      showError('Unable to add record', error.message);
    }
  }, [activeTab, formData, fetchData, showError, showSuccess]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Instructions</h2>
          <p className="text-sm text-gray-500">Syllabus, Curriculum, and Lessons management</p>
        </div>
        <button 
          onClick={() => {
            setFormData(initialFormState);
            setShowAddModal(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Add New
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('syllabus')}
          className={cn(
            "px-6 py-3 text-sm font-bold transition-colors border-b-2",
            activeTab === 'syllabus'
              ? "text-orange-600 border-orange-600"
              : "text-gray-500 border-transparent hover:text-gray-700"
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
            "px-6 py-3 text-sm font-bold transition-colors border-b-2",
            activeTab === 'curriculum'
              ? "text-orange-600 border-orange-600"
              : "text-gray-500 border-transparent hover:text-gray-700"
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
            "px-6 py-3 text-sm font-bold transition-colors border-b-2",
            activeTab === 'lessons'
              ? "text-orange-600 border-orange-600"
              : "text-gray-500 border-transparent hover:text-gray-700"
          )}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={16} />
            Lessons
          </div>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          <select 
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-gray-50 border-none text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option>All Courses</option>
            <option>BSIT</option>
            <option>BSCS</option>
            <option>BSIS</option>
            <option>BSEMC</option>
          </select>
        </div>
      </div>

      {/* Syllabus Tab */}
      {activeTab === 'syllabus' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400">
              Loading syllabi...
            </div>
          ) : filteredSyllabi.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400">
              No syllabi found. Click "Add New" to create one.
            </div>
          ) : (
            filteredSyllabi.map((syllabus) => (
            <div 
              key={syllabus.id}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedSyllabus(syllabus)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                      {syllabus.course}
                    </span>
                    <span className="text-xs font-bold text-gray-400">{syllabus.code}</span>
                    <span className="text-xs text-gray-400">{syllabus.semester} {syllabus.academicYear}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{syllabus.subject}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
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
            </div>
            ))
          )}
        </div>
      )}

      {/* Curriculum Tab */}
      {activeTab === 'curriculum' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400">
              Loading curricula...
            </div>
          ) : filteredCurricula.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400">
              No curricula found. Click "Add New" to create one.
            </div>
          ) : (
            filteredCurricula.map((curriculum) => (
            <div 
              key={curriculum.id}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                      {curriculum.course}
                    </span>
                    <span className="text-xs text-gray-400">Curriculum {curriculum.year}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{curriculum.program}</h3>
                  <p className="text-sm text-gray-600">Total Units: {curriculum.totalUnits}</p>
                </div>
                <button 
                  onClick={() => setSelectedCurriculum(curriculum)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  View Details
                </button>
              </div>
              
              <div className="space-y-3">
                {curriculum.semesters.slice(0, 2).map((sem, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl">
                    <h4 className="text-sm font-bold text-gray-900 mb-3">{sem.semester}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {sem.subjects.map((subject, sIdx) => (
                        <div key={sIdx} className="text-sm text-gray-600">
                          <span className="font-mono text-xs text-gray-400">{subject.code}</span> - {subject.name} ({subject.units} units)
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            ))
          )}
        </div>
      )}

      {/* Lessons Tab */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400">
              Loading lessons...
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400">
              No lessons found. Click "Add New" to create one.
            </div>
          ) : (
            filteredLessons.map((lesson) => (
            <div 
              key={lesson.id}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedLesson(lesson)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                      Week {lesson.week}
                    </span>
                    <span className="text-xs text-gray-400">{lesson.type}</span>
                    <span className="text-xs text-gray-400">{lesson.duration}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{lesson.title}</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Learning Objectives</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {lesson.objectives.map((obj, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                            <span>{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                      <span>{lesson.materials.length} materials</span>
                      <span>{lesson.activities.length} activities</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      )}

      {/* Syllabus Detail Modal */}
      {selectedSyllabus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSyllabus(null)}>
          <div 
            className="bg-white rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                    {selectedSyllabus.course}
                  </span>
                  <span className="text-xs font-bold text-gray-400">{selectedSyllabus.code}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedSyllabus.subject}</h2>
                <p className="text-sm text-gray-600">{selectedSyllabus.description}</p>
              </div>
              <button 
                onClick={() => setSelectedSyllabus(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Instructor</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.instructor}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Units</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.units}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Hours</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.hours}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Semester</p>
                  <p className="text-sm font-bold text-gray-900">{selectedSyllabus.semester}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Course Objectives</h3>
                <ul className="space-y-2">
                  {selectedSyllabus.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Course Topics</h3>
                <div className="space-y-2">
                  {selectedSyllabus.topics.map((topic, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Week {topic.week}: {topic.topic}</p>
                        <p className="text-xs text-gray-500 mt-1">{topic.hours} hours</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Grading System</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedSyllabus.requirements.map((req, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-sm font-bold text-gray-900">{req.type}</p>
                      <p className="text-xs text-gray-500">{req.weight}%</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Curriculum Detail Modal */}
      {selectedCurriculum && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCurriculum(null)}>
          <div 
            className="bg-white rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                    {selectedCurriculum.course}
                  </span>
                  <span className="text-xs text-gray-400">Curriculum {selectedCurriculum.year}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCurriculum.program}</h2>
                <p className="text-sm text-gray-600">Total Units: {selectedCurriculum.totalUnits}</p>
              </div>
              <button 
                onClick={() => setSelectedCurriculum(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {selectedCurriculum.semesters.map((sem, idx) => (
                <div key={idx} className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{sem.semester}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sem.subjects.map((subject, sIdx) => (
                      <div key={sIdx} className="p-3 bg-white rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{subject.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{subject.code}</p>
                          </div>
                          <span className="text-xs font-bold text-orange-600">{subject.units} units</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lesson Detail Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLesson(null)}>
          <div 
            className="bg-white rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                    Week {selectedLesson.week}
                  </span>
                  <span className="text-xs text-gray-400">{selectedLesson.type}</span>
                  <span className="text-xs text-gray-400">{selectedLesson.duration}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedLesson.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedLesson(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Learning Objectives</h3>
                <ul className="space-y-2">
                  {selectedLesson.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Materials</h3>
                <div className="space-y-2">
                  {selectedLesson.materials.map((material, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="text-gray-400" size={18} />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{material.name}</p>
                          <p className="text-xs text-gray-500">{material.type} • {material.size}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Activities</h3>
                <div className="space-y-2">
                  {selectedLesson.activities.map((activity, i) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{activity.name}</p>
                        <p className="text-xs text-gray-500">Due: {new Date(activity.dueDate).toLocaleDateString()}</p>
                      </div>
                      <span className={cn(
                        "text-xs font-bold px-3 py-1 rounded-full",
                        activity.status === 'Completed' 
                          ? "bg-emerald-50 text-emerald-600" 
                          : "bg-yellow-50 text-yellow-600"
                      )}>
                        {activity.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
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
      )}
    </div>
  );
};

