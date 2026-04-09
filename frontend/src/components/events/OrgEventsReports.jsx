import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Users,
  Search,
  Building2,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Eye,
  Plus,
  X,
  Save,
  Trash2,
  Edit,
} from 'lucide-react';
import { cn } from '../../constants';
import { useUI } from '../ui/UIProvider';
import { apiRequest } from '../../lib/api';
import { EVENT_CATEGORIES, EVENT_STATUSES } from '../../lib/formOptions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const emptyEventForm = {
  title: '',
  description: '',
  organization: '',
  date: '',
  time: '',
  venue: '',
  status: 'Upcoming',
  participants: 0,
  registered: 0,
  category: 'Academic',
  report_type: 'event',
};

const emptyOrgForm = {
  name: '',
  full_name: '',
  members: 0,
  events_count: 0,
  status: 'Active',
  color: 'bg-blue-500',
  description: '',
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-50 text-emerald-600';
    case 'Upcoming':
      return 'bg-blue-50 text-blue-600';
    case 'Registration Open':
      return 'bg-orange-50 text-orange-600';
    case 'Pending Approval':
      return 'bg-yellow-50 text-yellow-600';
    case 'Cancelled':
      return 'bg-red-50 text-red-600';
    default:
      return 'bg-gray-50 text-gray-600';
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'Completed':
      return CheckCircle2;
    case 'Upcoming':
      return Clock;
    case 'Registration Open':
      return TrendingUp;
    case 'Pending Approval':
      return AlertCircle;
    case 'Cancelled':
      return XCircle;
    default:
      return AlertCircle;
  }
};

const formatEventDate = (dateValue) => {
  if (!dateValue) return 'No date';
  return new Date(dateValue).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const OrgEventsReports = ({ navigationIntent, clearNavigationIntent }) => {
  const { showError, showSuccess, confirm } = useUI();
  const [reports, setReports] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgLoading, setOrgLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventFormData, setEventFormData] = useState(emptyEventForm);
  const [orgFormData, setOrgFormData] = useState(emptyOrgForm);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (activeTab === 'events') {
      fetchReports();
    }
  }, [activeTab, filterOrg]);

  useEffect(() => {
    setSelectedEvent(null);
    setSelectedOrg(null);
  }, [activeTab]);

  useEffect(() => {
    if (navigationIntent?.tab !== 'reports') {
      return;
    }

    const context = navigationIntent.context || {};
    setActiveTab('events');
    if (context.eventId) {
      if (reports.length === 0) {
        return;
      }
      const record = reports.find((item) => item.id === context.eventId);
      if (record) {
        setSelectedEvent(record);
      }
    }
    clearNavigationIntent?.();
  }, [navigationIntent, clearNavigationIntent, reports]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ report_type: 'event' });
      if (filterOrg) params.append('organization', filterOrg);

      const response = await fetch(`${API_URL}/api/reports?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setReports(data.data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      setOrgLoading(true);
      const response = await fetch(`${API_URL}/api/organizations`);
      const data = await response.json();
      if (data.success) {
        setOrganizations(data.data);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setOrgLoading(false);
    }
  };

  const openAddEventModal = () => {
    setEditingEventId(null);
    setEventFormData(emptyEventForm);
    setShowEventModal(true);
  };

  const openEditEventModal = (event) => {
    setEditingEventId(event.id);
    setSelectedEvent(event);
    setEventFormData({
      title: event.title || '',
      description: event.description || '',
      organization: event.organization || '',
      date: event.date || '',
      time: event.time || '',
      venue: event.venue || '',
      status: event.status || 'Upcoming',
      participants: event.participants || 0,
      registered: event.registered || 0,
      category: event.category || 'Academic',
      report_type: event.report_type || 'event',
    });
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEditingEventId(null);
    setEventFormData(emptyEventForm);
  };

  const handleSubmitEvent = async (e) => {
    e.preventDefault();

    try {
      const data = await apiRequest(`/api/reports${editingEventId ? `/${editingEventId}` : ''}`, {
        method: editingEventId ? 'PUT' : 'POST',
        body: eventFormData,
      });

      closeEventModal();
      await fetchReports();
      if (selectedEvent?.id === data.data.id) {
        setSelectedEvent(data.data);
      }
      showSuccess(editingEventId ? 'Event updated' : 'Event added', 'The event record was saved successfully.');
    } catch (error) {
      showError('Unable to save event', error.message);
    }
  };

  const handleAddOrganization = async (e) => {
    e.preventDefault();

    try {
      await apiRequest('/api/organizations', {
        method: 'POST',
        body: orgFormData,
      });

      setShowAddOrgModal(false);
      setOrgFormData(emptyOrgForm);
      await fetchOrganizations();
      showSuccess('Organization added', 'The organization is now available for affiliations and events.');
    } catch (error) {
      showError('Unable to add organization', error.message);
    }
  };

  const handleDeleteReport = async () => {
    if (!selectedEvent?.id) return;
    const approved = await confirm({
      title: 'Delete event?',
      description: `This will permanently remove "${selectedEvent.title}".`,
      confirmText: 'Delete event',
      tone: 'danger',
    });
    if (!approved) return;

    try {
      await apiRequest(`/api/reports/${selectedEvent.id}`, {
        method: 'DELETE',
      });

      setSelectedEvent(null);
      await fetchReports();
      showSuccess('Event deleted', 'The selected event was removed.');
    } catch (error) {
      showError('Unable to delete event', error.message);
    }
  };

  const filteredEvents = reports.filter((event) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch =
      event.title?.toLowerCase().includes(query) ||
      event.organization?.toLowerCase().includes(query) ||
      event.category?.toLowerCase().includes(query);
    const matchesOrg = !filterOrg || event.organization === filterOrg;

    return matchesSearch && matchesOrg;
  });

  const filteredOrgs = organizations.filter((org) => {
    const query = searchTerm.toLowerCase();
    return (
      org.name?.toLowerCase().includes(query) ||
      org.fullName?.toLowerCase().includes(query) ||
      org.full_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Events</h2>
          <p className="text-sm text-gray-500">Manage campus events and supporting student organizations.</p>
        </div>
        {activeTab === 'events' ? (
          <button
            onClick={openAddEventModal}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Add Event
          </button>
        ) : (
          <button
            onClick={() => setShowAddOrgModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Add Organization
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('events')}
          className={cn(
            'px-6 py-3 text-sm font-bold transition-colors border-b-2',
            activeTab === 'events'
              ? 'text-orange-600 border-orange-600'
              : 'text-gray-500 border-transparent hover:text-gray-700',
          )}
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            Events
          </div>
        </button>
        <button
          onClick={() => setActiveTab('organizations')}
          className={cn(
            'px-6 py-3 text-sm font-bold transition-colors border-b-2',
            activeTab === 'organizations'
              ? 'text-orange-600 border-orange-600'
              : 'text-gray-500 border-transparent hover:text-gray-700',
          )}
        >
          <div className="flex items-center gap-2">
            <Building2 size={16} />
            Organizations
          </div>
        </button>
      </div>

      {activeTab === 'events' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by title, organization, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                />
              </div>
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                className="bg-gray-50 border-none text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">All Organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.name}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {loading ? (
              <div className="col-span-full p-8 text-center text-gray-400">Loading events...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="col-span-full p-8 text-center text-gray-400">No events found.</div>
            ) : (
              filteredEvents.map((event) => {
                const StatusIcon = getStatusIcon(event.status);
                const orgColor = organizations.find((org) => org.name === event.organization)?.color || 'bg-gray-300';

                return (
                  <div
                    key={event.id}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={cn('w-3 h-3 rounded-full', orgColor)}></div>
                          <span className="text-xs font-bold text-gray-400">{event.organization || 'No organization'}</span>
                          <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1', getStatusColor(event.status))}>
                            <StatusIcon size={10} />
                            {event.status}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{event.title}</h3>
                        <p className="text-sm text-gray-600 mb-4">{event.description || 'No description provided.'}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <Calendar size={14} />
                        <span>{formatEventDate(event.date)}</span>
                        <Clock size={14} />
                        <span>{event.time || 'TBD'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <MapPin size={14} />
                        <span>{event.venue || 'Venue not set'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Participation</p>
                          <p className="text-sm font-bold text-gray-900">{event.registered} / {event.participants} registered</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</p>
                          <p className="text-sm font-bold text-gray-900">{event.category || 'General'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'organizations' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {orgLoading ? (
              <div className="col-span-full p-8 text-center text-gray-400">Loading organizations...</div>
            ) : filteredOrgs.length === 0 ? (
              <div className="col-span-full p-8 text-center text-gray-400">No organizations found.</div>
            ) : (
              filteredOrgs.map((org) => (
                <div
                  key={org.id}
                  className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedOrg(org)}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold', org.color || 'bg-gray-400')}>
                        {org.name}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{org.name}</h3>
                        <p className="text-sm text-gray-500">{org.fullName || org.full_name}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                      {org.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="text-gray-400" size={16} />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Members</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{org.members}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="text-gray-400" size={16} />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Events</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{org.events || org.events_count || 0}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrg(org);
                    }}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye size={16} />
                    View Profile
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedEvent && activeTab === 'events' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <div
            className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn('w-3 h-3 rounded-full', organizations.find((org) => org.name === selectedEvent.organization)?.color || 'bg-gray-300')}></div>
                  <span className="text-xs font-bold text-gray-400">{selectedEvent.organization || 'No organization'}</span>
                  <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1', getStatusColor(selectedEvent.status))}>
                    {selectedEvent.status}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedEvent.title}</h2>
                <p className="text-sm text-gray-600">{selectedEvent.description || 'No description provided.'}</p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{formatEventDate(selectedEvent.date)}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedEvent.time || 'TBD'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Venue</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedEvent.venue || 'Venue not set'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="text-gray-400" size={16} />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Participants</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedEvent.registered} / {selectedEvent.participants}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Category</p>
                <p className="text-sm font-bold text-gray-900">{selectedEvent.category || 'General'}</p>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => openEditEventModal(selectedEvent)}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Edit size={16} />
                  Edit Event
                </button>
                <button
                  onClick={handleDeleteReport}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOrg && activeTab === 'organizations' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrg(null)}>
          <div
            className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold', selectedOrg.color || 'bg-gray-400')}>
                  {selectedOrg.name}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedOrg.name}</h2>
                  <p className="text-sm text-gray-500">{selectedOrg.fullName || selectedOrg.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrg(null)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                  <p className="text-sm font-bold text-gray-900">{selectedOrg.status}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Total Members</p>
                  <p className="text-sm font-bold text-gray-900">{selectedOrg.members}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Events Handled</p>
                  <p className="text-sm font-bold text-gray-900">{selectedOrg.events || selectedOrg.events_count || 0}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Short Name</p>
                  <p className="text-sm font-bold text-gray-900">{selectedOrg.name}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Description</p>
                <p className="text-sm text-gray-700">{selectedOrg.description || 'No description provided.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeEventModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingEventId ? 'Edit Event' : 'Add Event'}</h2>
              <button type="button" onClick={closeEventModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmitEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  autoComplete="off"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.organization}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, organization: e.target.value }))}
                  >
                    <option value="">Select Organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.name}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.date}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.time}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <input
                    type="text"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.venue}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, venue: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.status}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    {EVENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.category}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {EVENT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
                  <input
                    type="number"
                    min="0"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.participants}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, participants: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registered</label>
                  <input
                    type="number"
                    min="0"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={eventFormData.registered}
                    onChange={(e) => setEventFormData((prev) => ({ ...prev, registered: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  {editingEventId ? 'Save Changes' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={closeEventModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddOrgModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddOrgModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Organization</h2>
              <button type="button" onClick={() => setShowAddOrgModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddOrganization} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Short) *</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={orgFormData.name}
                  onChange={(e) => setOrgFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., SITES"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={orgFormData.full_name}
                  onChange={(e) => setOrgFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  autoComplete="off"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  value={orgFormData.description}
                  onChange={(e) => setOrgFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Members</label>
                  <input
                    type="number"
                    min="0"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={orgFormData.members}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, members: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Events Count</label>
                  <input
                    type="number"
                    min="0"
                    autoComplete="off"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={orgFormData.events_count}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, events_count: parseInt(e.target.value, 10) || 0 }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={orgFormData.status}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <select
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={orgFormData.color}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, color: e.target.value }))}
                  >
                    <option value="bg-blue-500">Blue</option>
                    <option value="bg-green-500">Green</option>
                    <option value="bg-orange-500">Orange</option>
                    <option value="bg-red-500">Red</option>
                    <option value="bg-yellow-500">Yellow</option>
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
                  onClick={() => setShowAddOrgModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
