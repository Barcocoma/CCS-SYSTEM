import React, { useCallback } from 'react';
import { X, Save } from 'lucide-react';

export const ScheduleForm = React.memo(({ onSubmit, onCancel, title, formData, setFormData, instructors = [] }) => {
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  }, [setFormData]);

  const hasInstructorOptions = Array.isArray(instructors) && instructors.length > 0;
  const selectedInstructorValue = formData.instructor || '';

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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.course || 'BSIT'}
                onChange={(e) => handleChange('course', e.target.value)}
              >
                <option>BSIT</option>
                <option>BSCS</option>
                <option>BSIS</option>
                <option>BSEMC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.subject || ''}
                onChange={(e) => handleChange('subject', e.target.value)}
                placeholder="e.g., Web Development"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructor *</label>
              {hasInstructorOptions ? (
                <select
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={selectedInstructorValue}
                  onChange={(e) => handleChange('instructor', e.target.value)}
                >
                  <option value="">Select Instructor</option>
                  {instructors.map((ins) => (
                    <option key={ins.value} value={ins.value}>
                      {ins.label}
                    </option>
                  ))}
                  {/* Keep current value visible if it doesn't exist in options (e.g., old saved data). */}
                  {selectedInstructorValue &&
                    !instructors.some((ins) => ins.value === selectedInstructorValue) && (
                      <option value={selectedInstructorValue}>{selectedInstructorValue}</option>
                    )}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={formData.instructor || ''}
                  onChange={(e) => handleChange('instructor', e.target.value)}
                  placeholder="e.g., Prof. John Smith"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room *</label>
              <input
                type="text"
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.room || ''}
                onChange={(e) => handleChange('room', e.target.value)}
                placeholder="e.g., Lab 101"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.day || 'Monday'}
                onChange={(e) => handleChange('day', e.target.value)}
              >
                <option>Monday</option>
                <option>Tuesday</option>
                <option>Wednesday</option>
                <option>Thursday</option>
                <option>Friday</option>
                <option>Saturday</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.start_time || '7:00 AM'}
                onChange={(e) => handleChange('start_time', e.target.value)}
              >
                <option>7:00 AM</option>
                <option>8:00 AM</option>
                <option>9:00 AM</option>
                <option>10:00 AM</option>
                <option>11:00 AM</option>
                <option>12:00 PM</option>
                <option>1:00 PM</option>
                <option>2:00 PM</option>
                <option>3:00 PM</option>
                <option>4:00 PM</option>
                <option>5:00 PM</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <select
                required
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.end_time || '9:00 AM'}
                onChange={(e) => handleChange('end_time', e.target.value)}
              >
                <option>8:00 AM</option>
                <option>9:00 AM</option>
                <option>10:00 AM</option>
                <option>11:00 AM</option>
                <option>12:00 PM</option>
                <option>1:00 PM</option>
                <option>2:00 PM</option>
                <option>3:00 PM</option>
                <option>4:00 PM</option>
                <option>5:00 PM</option>
                <option>6:00 PM</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
              <select
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.year_level || '1st Year'}
                onChange={(e) => handleChange('year_level', e.target.value)}
              >
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <input
                type="text"
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                value={formData.section || ''}
                onChange={(e) => handleChange('section', e.target.value)}
                placeholder="e.g., A"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Student count is assigned automatically based on matching student records for this course, year level, and section.
          </p>
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
  return (
    prevProps.title === nextProps.title &&
    prevProps.formData === nextProps.formData &&
    prevProps.onSubmit === nextProps.onSubmit &&
    prevProps.onCancel === nextProps.onCancel
  );
});

ScheduleForm.displayName = 'ScheduleForm';

