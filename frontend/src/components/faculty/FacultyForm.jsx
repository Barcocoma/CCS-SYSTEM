import React from 'react';
import { X, Save } from 'lucide-react';
import { CORE_COURSES, EMPLOYMENT_STATUSES, FACULTY_POSITIONS } from '../../lib/formOptions';

export const FacultyForm = React.memo(({ onSubmit, onCancel, title, formData, setFormData }) => {
  const handleChange = React.useCallback((field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  }, [setFormData]);

  const sanitizeName = React.useCallback((value) => value.replace(/[^A-Za-z .'-]/g, ''), []);
  const sanitizeEmployeeNumber = React.useCallback((value) => value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase(), []);
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Number *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.employee_number || ''}
                onChange={(e) => handleChange('employee_number', sanitizeEmployeeNumber(e.target.value))}
                placeholder="e.g., FAC-1001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.department || 'BSIT'}
                onChange={(e) => handleChange('department', e.target.value)}
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Birthday *</label>
              <input
                type="date"
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.birthday || ''}
                onChange={(e) => handleChange('birthday', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.position || ''}
                onChange={(e) => handleChange('position', e.target.value)}
              >
                <option value="">Select position</option>
                {FACULTY_POSITIONS.map((positionOption) => (
                  <option key={positionOption} value={positionOption}>
                    {positionOption}
                  </option>
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
                placeholder="faculty@uc.edu.ph"
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Start Date</label>
              <input
                type="date"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.employment_start_date || ''}
                onChange={(e) => handleChange('employment_start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.employment_status || 'Full-time'}
                onChange={(e) => handleChange('employment_status', e.target.value)}
              >
                {EMPLOYMENT_STATUSES.map((status) => (
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

FacultyForm.displayName = 'FacultyForm';

