import React from 'react';
import { Save, X } from 'lucide-react';
import { CORE_COURSES, TERM_SEMESTERS, YEAR_LEVELS } from '../../lib/formOptions';

export const StudentForm = React.memo(({
  onSubmit,
  onCancel,
  title,
  formData,
  setFormData,
  lockedCourse = '',
  sectionOptions = [],
  sectionLoading = false,
}) => {
  const handleChange = React.useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, [setFormData]);

  const sanitizeName = React.useCallback((value) => value.replace(/[^A-Za-z .'-]/g, ''), []);
  const sanitizeStudentId = React.useCallback((value) => value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase(), []);
  const sanitizePhone = React.useCallback((value) => value.replace(/\D/g, '').slice(0, 11), []);

  const selectedCourse = lockedCourse || formData.course || 'BSIT';
  const selectedYearLevel = formData.year_level || '1st Year';
  const selectedSemester = formData.semester || '1st Semester';
  const assignedSection = formData.section || sectionOptions[0]?.section || '';
  const assignedSectionMeta = sectionOptions[0] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Student ID *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={formData.student_id || ''}
                onChange={(event) => handleChange('student_id', sanitizeStudentId(event.target.value))}
                placeholder="e.g., 2024-0001"
                maxLength={20}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Course *</label>
              <select
                required
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={selectedCourse}
                onChange={(event) => {
                  handleChange('course', event.target.value);
                  handleChange('section', '');
                }}
                disabled={Boolean(lockedCourse)}
              >
                {CORE_COURSES.map((course) => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
              {lockedCourse ? <p className="mt-1 text-xs text-gray-400">Course is fixed to your department.</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={formData.first_name || ''}
                onChange={(event) => handleChange('first_name', sanitizeName(event.target.value))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={formData.last_name || ''}
                onChange={(event) => handleChange('last_name', sanitizeName(event.target.value))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Middle Name</label>
              <input
                type="text"
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={formData.middle_name || ''}
                onChange={(event) => handleChange('middle_name', sanitizeName(event.target.value))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Birthday *</label>
              <input
                type="date"
                required
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={formData.birthday || ''}
                onChange={(event) => handleChange('birthday', event.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Year Level *</label>
              <select
                required
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={selectedYearLevel}
                onChange={(event) => {
                  handleChange('year_level', event.target.value);
                  handleChange('section', '');
                }}
              >
                {YEAR_LEVELS.map((yearLevel) => (
                  <option key={yearLevel} value={yearLevel}>{yearLevel}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Semester *</label>
              <select
                required
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={selectedSemester}
                onChange={(event) => {
                  handleChange('semester', event.target.value);
                  handleChange('section', '');
                }}
              >
                {TERM_SEMESTERS.map((semester) => (
                  <option key={semester} value={semester}>{semester}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Section Assignment *</label>
              <input
                type="text"
                readOnly
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-gray-700 outline-none"
                value={
                  sectionLoading
                    ? 'Loading section assignment...'
                    : assignedSection
                      ? `Section ${assignedSection}`
                      : 'Waiting for course, year level, and semester'
                }
              />
              <p className="mt-1 text-xs text-gray-400">
                {sectionLoading
                  ? 'The system is checking the next available section.'
                  : assignedSectionMeta
                    ? assignedSectionMeta.is_virtual
                      ? `${selectedCourse} - ${selectedYearLevel} - ${selectedSemester} will create Section ${assignedSectionMeta.section} on save.`
                      : `${selectedCourse} - ${selectedYearLevel} - ${selectedSemester} still has ${assignedSectionMeta.remaining_slots} slot(s) left in Section ${assignedSectionMeta.section}.`
                    : `${selectedCourse} - ${selectedYearLevel} - ${selectedSemester} sections are limited to 50 students each.`}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={formData.email || ''}
                onChange={(event) => handleChange('email', event.target.value.trimStart())}
                placeholder="student@uc.edu.ph"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contact Number</label>
              <input
                type="tel"
                autoComplete="off"
                className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                value={formData.contact_number || ''}
                onChange={(event) => handleChange('contact_number', sanitizePhone(event.target.value))}
                inputMode="numeric"
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
            >
              <Save size={18} />
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}, (prevProps, nextProps) => (
  prevProps.title === nextProps.title
  && prevProps.formData === nextProps.formData
  && prevProps.onSubmit === nextProps.onSubmit
  && prevProps.onCancel === nextProps.onCancel
  && prevProps.lockedCourse === nextProps.lockedCourse
  && prevProps.sectionOptions === nextProps.sectionOptions
  && prevProps.sectionLoading === nextProps.sectionLoading
));

StudentForm.displayName = 'StudentForm';
