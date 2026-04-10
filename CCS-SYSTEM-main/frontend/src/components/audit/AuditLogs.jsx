import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, User, Activity, FileText, Trash2, Edit, Eye, LogIn, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const actionIcons = {
  'CREATE': <FileText size={16} className="text-green-600" />,
  'UPDATE': <Edit size={16} className="text-blue-600" />,
  'DELETE': <Trash2 size={16} className="text-red-600" />,
  'VIEW': <Eye size={16} className="text-gray-600" />,
  'LOGIN': <LogIn size={16} className="text-green-600" />,
  'LOGOUT': <LogOut size={16} className="text-orange-600" />
};

const actionColors = {
  'CREATE': 'bg-green-50 text-green-700 border-green-200',
  'UPDATE': 'bg-blue-50 text-blue-700 border-blue-200',
  'DELETE': 'bg-red-50 text-red-700 border-red-200',
  'VIEW': 'bg-gray-50 text-gray-700 border-gray-200',
  'LOGIN': 'bg-green-50 text-green-700 border-green-200',
  'LOGOUT': 'bg-orange-50 text-orange-700 border-orange-200'
};

export const AuditLogs = () => {
  const ENTITY_OPTIONS = [
    'All Entities',
    'STUDENT',
    'FACULTY',
    'SCHEDULE',
    'RESEARCH',
    'REPORT',
    'USER',
  ];
  const entityOptions = ENTITY_OPTIONS;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('All Actions');
  const [filterEntity, setFilterEntity] = useState('All Entities');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [filterAction, filterEntity]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterAction !== 'All Actions') params.append('action', filterAction);
      if (filterEntity !== 'All Entities') params.append('entity_type', filterEntity.toUpperCase());
      params.append('limit', '100');
      
      const response = await fetch(`${API_URL}/api/audit-logs?${params}`);
      const data = await response.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/audit-logs/stats?days=30`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Ensure we have an ISO string with timezone so Safari/older engines don't produce Invalid Date
    const normalized = (() => {
      // already ISO with timezone
      if (/[zZ]|[+-]\d\d:?\d\d$/.test(dateString)) return dateString;
      // if it looks like "2026-04-10T08:52:41" (no zone), append Z to treat as UTC
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateString)) return `${dateString}Z`;
      return dateString;
    })();

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Audit Logs</h2>
          <p className="text-sm text-gray-500">Track all system activities and user actions</p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="text-orange-600" size={20} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Logs</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_logs || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <User className="text-blue-600" size={20} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Users</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.by_user || {}).length}</p>
            <p className="text-xs text-gray-500 mt-1">Unique users</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="text-green-600" size={20} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Most Actions</p>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {Object.keys(stats.by_action || {}).length > 0 
                ? Object.entries(stats.by_action).sort((a, b) => b[1] - a[1])[0][0]
                : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {Object.keys(stats.by_action || {}).length > 0 
                ? `${Object.entries(stats.by_action).sort((a, b) => b[1] - a[1])[0][1]} times`
                : ''}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="text-purple-600" size={20} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Entity Types</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.by_entity_type || {}).length}</p>
            <p className="text-xs text-gray-500 mt-1">Different types</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by user, action, or entity..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
            />
          </div>
          <select 
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-gray-50 border-none text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option>All Actions</option>
            <option>CREATE</option>
            <option>UPDATE</option>
            <option>DELETE</option>
            <option>VIEW</option>
            <option>LOGIN</option>
            <option>LOGOUT</option>
          </select>
          <select 
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="bg-gray-50 border-none text-sm font-medium rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            {entityOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No audit logs found</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entity Type</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entity Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <User size={14} className="text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{log.username}</span>
                      </div>
                    </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${actionColors[log.action] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                      {actionIcons[log.action] || <Activity size={14} />}
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{log.entity_type || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {log.entity_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
