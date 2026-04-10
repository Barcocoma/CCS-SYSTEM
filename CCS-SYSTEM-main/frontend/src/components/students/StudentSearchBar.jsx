import React from 'react';
import { Search } from 'lucide-react';

export function StudentSearchBar({ value, onChange }) {
  return (
    <label className="relative block xl:col-span-1">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input
        type="text"
        placeholder="Search name, student ID, or email..."
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}