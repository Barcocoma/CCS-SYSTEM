import React, { useMemo, useState } from 'react';
import { AlertCircle, Save, X } from 'lucide-react';

export const ScheduleForm = React.memo(({
  schedule,
  facultyOptions = [],
  onSubmit,
  onCancel,
  submitting = false,
}) => {
  const [selectedFacultyId, setSelectedFacultyId] = useState(
    schedule?.faculty_id ? String(schedule.faculty_id) : '',
  );

  const selectedOption = useMemo(
    () => facultyOptions.find((option) => String(option.faculty_id) === String(selectedFacultyId)) || null,
    [facultyOptions, selectedFacultyId],
  );

  const handleSave = (event) => {
    event.preventDefault();
    onSubmit?.({
      faculty_id: selectedFacultyId ? Number(selectedFacultyId) : null,
      instructor: selectedFacultyId ? undefined : '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assign Faculty</h2>
            <p className="mt-1 text-sm text-gray-500">Time and room come from the curriculum schedule. Pick the instructor for this section.</p>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Subject</p>
              <p className="mt-2 text-sm font-bold text-slate-900">
                {schedule?.subject_code ? `${schedule.subject_code} • ` : ''}
                {schedule?.subject}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Section</p>
              <p className="mt-2 text-sm font-bold text-slate-900">
                {schedule?.course} • {schedule?.year_level} • Section {schedule?.section}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Schedule</p>
              <p className="mt-2 text-sm font-bold text-slate-900">{schedule?.day} • {schedule?.time}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Room</p>
              <p className="mt-2 text-sm font-bold text-slate-900">{schedule?.room}</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Faculty Assignment</label>
            <select
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-orange-500"
              value={selectedFacultyId}
              onChange={(event) => setSelectedFacultyId(event.target.value)}
            >
              <option value="">Leave unassigned</option>
              {facultyOptions.map((option) => (
                <option
                  key={option.faculty_id}
                  value={option.faculty_id}
                  disabled={!option.available && String(schedule?.faculty_id || '') !== String(option.faculty_id)}
                >
                  {option.available ? option.label : `${option.label} — Time conflict`}
                </option>
              ))}
            </select>
            {selectedOption && !selectedOption.available ? (
              <p className="mt-2 text-xs text-red-600">{selectedOption.reason}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>
                Faculty with overlapping teaching time stay visible here, but they cannot be selected until the conflict is cleared.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || (selectedOption && !selectedOption.available)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} />
              {submitting ? 'Saving...' : 'Save Assignment'}
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
});

ScheduleForm.displayName = 'ScheduleForm';
