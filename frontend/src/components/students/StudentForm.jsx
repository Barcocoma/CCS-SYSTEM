import React from 'react';
import { X, Save } from 'lucide-react';
import { CORE_COURSES, ENROLLMENT_STATUSES, YEAR_LEVELS } from '../../lib/formOptions';

export const StudentForm = React.memo(({ onSubmit, onCancel, title, formData, setFormData }) => {
  const handleChange = React.useCallback((field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  }, [setFormData]);

  const sanitizeName = React.useCallback((value) => value.replace(/[^A-Za-z .'-]/g, ''), []);
  const sanitizeStudentId = React.useCallback((value) => value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase(), []);
  const sanitizePhone = React.useCallback((value) => value.replace(/\D/g, '').slice(0, 11), []);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.student_id || ''}
                onChange={(e) => handleChange('student_id', sanitizeStudentId(e.target.value))}
                placeholder="e.g., 2024-0001"
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.course || 'BSIT'}
                onChange={(e) => handleChange('course', e.target.value)}
              >
                {CORE_COURSES.map((course) => (
                  <option key={course}>{course}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.first_name || ''}
                onChange={(e) => handleChange('first_name', sanitizeName(e.target.value))}
                inputMode="text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.last_name || ''}
                onChange={(e) => handleChange('last_name', sanitizeName(e.target.value))}
                inputMode="text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input
                type="text"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.middle_name || ''}
                onChange={(e) => handleChange('middle_name', sanitizeName(e.target.value))}
                inputMode="text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year Level *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.year_level || '1st Year'}
                onChange={(e) => handleChange('year_level', e.target.value)}
              >
                {YEAR_LEVELS.map((yearLevel) => (
                  <option key={yearLevel}>{yearLevel}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value.trimStart())}
                placeholder="student@uc.edu.ph"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
              <input
                type="tel"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.contact_number || ''}
                onChange={(e) => handleChange('contact_number', sanitizePhone(e.target.value))}
                inputMode="numeric"
                placeholder="09XXXXXXXXX"
              />
              <p className="mt-1 text-xs text-gray-400">Numbers only. Example: 09171234567</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Status *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.enrollment_status || 'Enrolled'}
                onChange={(e) => handleChange('enrollment_status', e.target.value)}
              >
                {ENROLLMENT_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return (
    prevProps.title === nextProps.title &&
    prevProps.formData === nextProps.formData &&
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.onCancel === nextProps.onCancel
  );
});

StudentForm.displayName = 'StudentForm';

