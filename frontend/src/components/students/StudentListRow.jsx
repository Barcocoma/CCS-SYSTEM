import React from 'react';
import { Edit3, Eye } from 'lucide-react';
import { getInitials } from '../../lib/display';

export function StudentListRow({ student, onView, onEdit }) {
  return (
    <tr className="transition-colors hover:bg-orange-50/40">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 text-sm font-bold text-orange-700">
            {getInitials(student.first_name, student.last_name)}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {student.last_name}, {student.first_name} {student.middle_name ? `${student.middle_name[0]}.` : ''}
            </p>
            <p className="text-xs text-slate-500">{student.email || 'No email on file'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm font-medium text-slate-600">{student.student_id}</td>
      <td className="px-6 py-4 text-sm text-slate-600">{student.course}</td>
      <td className="px-6 py-4 text-sm text-slate-600">{student.year_level}</td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-2">
          {(student.skills || []).slice(0, 2).map((skill) => (
            <span key={skill.id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              {skill.skill_name}
            </span>
          ))}
          {(student.affiliations || []).slice(0, 1).map((affiliation) => (
            <span key={affiliation.id} className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
              {affiliation.name}
            </span>
          ))}
          {(student.skills || []).length === 0 && (student.affiliations || []).length === 0 ? (
            <span className="text-xs text-slate-400">No enrichment data yet</span>
          ) : null}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onView(student.id)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            <Eye size={14} />
            View
          </button>
          <button
            type="button"
            onClick={() => onEdit(student)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Edit3 size={14} />
            Edit
          </button>
        </div>
      </td>
    </tr>
  );
}
