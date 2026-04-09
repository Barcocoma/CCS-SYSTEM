import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Edit3,
  Eye,
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
import { apiRequest } from '../../lib/api';
import { CORE_COURSES } from '../../lib/formOptions';
import { formatFacultyLabel, getInitials, matchesFacultyAssignment } from '../../lib/display';

function calculateYearsOfService(startDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  return Math.max(0, now.getFullYear() - start.getFullYear());
}

export function FacultyRecords({ navigationIntent, clearNavigationIntent, onNavigate }) {
  const { showError, showSuccess, confirm } = useUI();
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    middle_name: '',
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
      const [facultyResponse, studentsResponse, schedulesResponse, syllabusResponse] = await Promise.all([
        apiRequest('/api/faculty'),
        apiRequest('/api/students'),
        apiRequest('/api/schedules'),
        apiRequest('/api/syllabus'),
      ]);

      setFaculty(facultyResponse.data || []);
      setStudents(studentsResponse.data || []);
      setSchedules(schedulesResponse.data || []);
      setSyllabi(syllabusResponse.data || []);
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

  const openEditModal = (facultyMember) => {
    setFormData({
      employee_number: facultyMember.employee_number || '',
      first_name: facultyMember.first_name || '',
      last_name: facultyMember.last_name || '',
      middle_name: facultyMember.middle_name || '',
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
      await apiRequest('/api/faculty', { method: 'POST', body: formData });
      setShowAddModal(false);
      await fetchFaculty();
      showSuccess('Faculty record added', 'The new faculty member can now be used in scheduling.');
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
