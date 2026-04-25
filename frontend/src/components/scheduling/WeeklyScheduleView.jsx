import React, { useMemo } from 'react';
import { Clock3, MapPin } from 'lucide-react';

const DAY_COLUMNS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export function WeeklyScheduleView({
  schedules = [],
  emptyMessage = 'No schedule entries available.',
  selectedScheduleId = null,
  onSelect = null,
  renderMeta = null,
  showProfessorNote = false,
}) {
  const groupedSchedule = useMemo(() => {
    const groups = new Map(DAY_COLUMNS.map((day) => [day, []]));

    schedules.forEach((schedule) => {
      const day = schedule.day || '';
      if (!groups.has(day)) {
        groups.set(day, []);
      }
      groups.get(day).push(schedule);
    });

    DAY_COLUMNS.forEach((day) => {
      groups.set(day, [...(groups.get(day) || [])].sort((left, right) => (
        parseMeridiemTime(left.start_time) - parseMeridiemTime(right.start_time)
      )));
    });

    return DAY_COLUMNS.map((day) => [day, groups.get(day) || []]);
  }, [schedules]);

  if (schedules.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-6">
      {groupedSchedule.map(([day, items]) => (
        <article key={day} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{day}</p>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-orange-700">
              {items.length}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs text-slate-400">
              No class
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((schedule) => {
                const isSelected = selectedScheduleId === schedule.id;
                const isInteractive = typeof onSelect === 'function';
                const assignedFaculty = schedule.faculty_id || (schedule.instructor && schedule.instructor !== 'Unassigned');
                const content = (
                  <>
                    <p className="text-sm font-bold text-slate-900">
                      {schedule.subject_code ? `${schedule.subject_code} - ` : ''}
                      {schedule.subject}
                    </p>
                    <div className="mt-2 space-y-2 text-xs text-slate-500">
                      <p className="inline-flex items-center gap-1">
                        <Clock3 size={13} />
                        {schedule.time}
                      </p>
                      <p className="inline-flex items-center gap-1">
                        <MapPin size={13} />
                        {schedule.room}
                      </p>
                      {renderMeta ? (
                        <div className="text-xs text-slate-500">
                          {renderMeta(schedule)}
                        </div>
                      ) : null}
                      {showProfessorNote && !assignedFaculty ? (
                        <p className="rounded-2xl bg-orange-50 px-2.5 py-2 text-[11px] font-semibold text-orange-700">
                          Professor not assigned yet
                        </p>
                      ) : null}
                    </div>
                  </>
                );

                const className = [
                  'w-full rounded-2xl border bg-white p-4 text-left transition-colors',
                  isSelected
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-slate-200 hover:border-orange-200 hover:bg-orange-50',
                  !isInteractive ? 'cursor-default' : '',
                ].join(' ');

                if (!isInteractive) {
                  return (
                    <div key={schedule.id} className={className}>
                      {content}
                    </div>
                  );
                }

                return (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => onSelect(schedule)}
                    className={className}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
