import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, Search } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { cn } from '../../constants';

const EVENT_STATUS_STYLE = {
  Upcoming: 'bg-blue-50 text-blue-700',
  'Registration Open': 'bg-orange-50 text-orange-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-700',
  'Pending Approval': 'bg-amber-50 text-amber-700',
};

function toSortableDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatEventDate(value) {
  const parsed = toSortableDate(value);
  if (!parsed) return 'Date not set';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function StudentSectionEvents() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [allEvents, setAllEvents] = useState([]);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError('');
        const eventsResponse = await apiRequest('/api/reports?report_type=event');
        setAllEvents(eventsResponse.data || []);
      } catch (requestError) {
        setError(requestError.message || 'Unable to load events.');
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const sorted = [...allEvents].sort((left, right) => {
      const leftDate = toSortableDate(left.date);
      const rightDate = toSortableDate(right.date);
      if (leftDate && rightDate) return rightDate - leftDate;
      if (leftDate) return -1;
      if (rightDate) return 1;
      return (left.title || '').localeCompare(right.title || '');
    });

    if (!query) return sorted;
    return sorted.filter((eventRecord) => (
      (eventRecord.title || '').toLowerCase().includes(query) ||
      (eventRecord.organization || '').toLowerCase().includes(query) ||
      (eventRecord.category || '').toLowerCase().includes(query) ||
      (eventRecord.status || '').toLowerCase().includes(query)
    ));
  }, [allEvents, searchTerm]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading events...</p>
      </div>
    );
  }

  if (error) {
    return (
      <section className="rounded-[32px] border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle size={16} />
          Unable to load events
        </div>
        <p className="mt-2 text-sm">{error}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Events</h2>
            <p className="mt-2 text-sm text-slate-500">
              All events are visible here.
            </p>
          </div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
            {filteredEvents.length} event(s)
          </span>
        </div>

        <label className="relative mt-5 block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search events"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-200"
          />
        </label>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="text-orange-600" size={18} />
          <h3 className="text-lg font-bold text-slate-900">All Events</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No events found.</p>
          ) : (
            filteredEvents.map((eventRecord) => (
              <article key={eventRecord.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{eventRecord.title}</p>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-bold',
                      EVENT_STATUS_STYLE[eventRecord.status] || 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {eventRecord.status || 'Upcoming'}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500">{formatEventDate(eventRecord.date)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {eventRecord.time || 'Time TBA'} - {eventRecord.venue || 'Venue TBA'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {eventRecord.organization ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                      {eventRecord.organization}
                    </span>
                  ) : null}
                  {eventRecord.category ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {eventRecord.category}
                    </span>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

