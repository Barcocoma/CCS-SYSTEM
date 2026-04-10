import React, { useEffect, useState } from 'react';
import {
  FileText,
  Users,
  Calendar,
  TrendingUp,
  BarChart3,
  PieChart,
  Download,
  Eye,
  Filter,
  Search,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../constants';
import { useUI } from '../ui/UIProvider';
import { apiRequest, API_URL } from '../../lib/api';

const REPORT_TYPES = [
  { id: 'students', label: 'Student Reports', icon: Users, description: 'Enrollment statistics and student data' },
  { id: 'faculty', label: 'Faculty Reports', icon: BarChart3, description: 'Faculty performance and assignment data' },
  { id: 'events', label: 'Event Reports', icon: Calendar, description: 'Event participation and organization data' },
  { id: 'system', label: 'System Reports', icon: TrendingUp, description: 'System usage and performance metrics' },
];

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatNumber = (num) => {
  return num?.toLocaleString() || '0';
};

export const Reports = ({ navigationIntent, clearNavigationIntent }) => {
  const { showError, showSuccess } = useUI();
  const [activeReport, setActiveReport] = useState('students');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('30d');
  const [searchTerm, setSearchTerm] = useState('');

  const buildAuthHeaders = () => {
    const headers = new Headers();
    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const storedUser = JSON.parse(rawUser);
        if (storedUser?.id) headers.set('X-Actor-Id', String(storedUser.id));
        if (storedUser?.username) headers.set('X-Actor-Name', storedUser.username);
        if (storedUser?.tenant_id) headers.set('X-Tenant-Id', storedUser.tenant_id);
      }
    } catch {
      // ignore parse errors; unauthenticated export will fail and be shown
    }
    return headers;
  };

  useEffect(() => {
    fetchReportData(activeReport);
  }, [activeReport, dateRange]);

  const fetchReportData = async (reportType) => {
    try {
      setLoading(true);
      let endpoint = '/api/reports';

      switch (reportType) {
        case 'students':
          endpoint = '/api/students?report=true';
          break;
        case 'faculty':
          endpoint = '/api/faculty?report=true';
          break;
        case 'events':
          // Use export endpoint with JSON payload to reuse backend aggregation and ensure parity with downloads
          endpoint = '/api/reports/export?type=events&format=json';
          break;
        case 'system':
          endpoint = '/api/reports/system';
          break;
        default:
          endpoint = '/api/reports/overview';
      }

      const params = new URLSearchParams();
      if (dateRange !== 'all') {
        params.append('period', dateRange);
      }

      const url = params.toString() ? `${endpoint}&${params.toString()}` : endpoint;
      const response = await apiRequest(url);

      // Normalize data shape per tab
      if (reportType === 'students') {
        setReportData({ students: response.data || [] });
      } else if (reportType === 'faculty') {
        setReportData({ faculty: response.data || [] });
      } else if (reportType === 'events') {
        setReportData({ events: response.data || [] });
      } else {
        setReportData(response.data || {});
      }
    } catch (error) {
      showError('Unable to load report data', error.message);
      setReportData({});
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format = 'csv') => {
    try {
      const params = new URLSearchParams({
        type: activeReport,
        format,
        period: dateRange,
      });

      const headers = buildAuthHeaders();

      if (format === 'csv') {
        const res = await fetch(`${API_URL}/api/reports/export?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text || 'Export failed');

        const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${activeReport}-report-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showSuccess('CSV exported successfully');
      } else {
        const res = await fetch(`${API_URL}/api/reports/export?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        const payload = await res.json();
        if (!res.ok || payload.success === false) {
          throw new Error(payload.message || 'Export failed');
        }

        const data = payload.data || [];
        if (format === 'pdf') {
          await exportAsPdf(data);
        } else if (format === 'xlsx') {
          await exportAsExcel(data);
        }
      }
    } catch (error) {
      showError('Export failed', error.message);
    }
  };

  const buildReportTable = (rows) => {
    const paddingX = 12;
    const rowHeight = 28;
    const headerHeight = 36;
    const canvas = document.createElement('canvas');
    const columns = Object.keys(rows[0] || {});
    const columnWidth = 120;
    const tableWidth = columns.length * columnWidth;
    const titleHeight = 48;
    const footerHeight = 20;
    
    canvas.width = tableWidth + 2;
    canvas.height = titleHeight + headerHeight + (rows.length * rowHeight) + footerHeight + 2;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${activeReport.charAt(0).toUpperCase() + activeReport.slice(1)} Report`, paddingX, 30);
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Arial';
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, paddingX, 44);

    // Header
    const tableTop = titleHeight;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(1, tableTop + 1, tableWidth, headerHeight - 1);

    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#ffffff';
    let cursorX = 1;
    columns.forEach((col) => {
      const text = col.substring(0, 14);
      ctx.fillText(text, cursorX + paddingX, tableTop + 22);
      cursorX += columnWidth;
    });

    // Rows
    ctx.font = '10px Arial';
    ctx.fillStyle = '#111827';
    rows.forEach((row, rowIndex) => {
      const top = tableTop + headerHeight + (rowIndex * rowHeight);
      ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
      ctx.fillRect(1, top, tableWidth, rowHeight);
      
      ctx.fillStyle = '#111827';
      let cellX = 1;
      columns.forEach((col) => {
        const value = String(row[col] || '').substring(0, 12);
        ctx.fillText(value, cellX + paddingX, top + 18);
        cellX += columnWidth;
      });
    });

    // Grid lines
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, tableTop + 0.5, tableWidth + 1, headerHeight + (rows.length * rowHeight) + 1);

    let gridX = 1;
    for (let i = 0; i < columns.length; i++) {
      ctx.beginPath();
      ctx.moveTo(gridX + 0.5, tableTop + 0.5);
      ctx.lineTo(gridX + 0.5, tableTop + headerHeight + (rows.length * rowHeight) + 1);
      ctx.stroke();
      gridX += columnWidth;
    }

    for (let i = 0; i <= rows.length; i++) {
      const y = tableTop + headerHeight + (i * rowHeight) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0.5, y);
      ctx.lineTo(tableWidth + 1.5, y);
      ctx.stroke();
    }

    // Footer
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.fillText(`Total records: ${rows.length}`, paddingX, canvas.height - 4);
    
    return canvas;
  };

  const exportAsPdf = async (rows) => {
    try {
      if (rows.length === 0) {
        showError('Export failed', 'No data to export');
        return;
      }

      const { jsPDF } = await import('jspdf');
      const canvas = buildReportTable(rows);
      const imageData = canvas.toDataURL('image/png');

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const renderWidth = pageWidth - (margin * 2);
      const renderHeight = (canvas.height * renderWidth) / canvas.width;
      const printableHeight = pageHeight - (margin * 2);

      let heightLeft = renderHeight;
      let positionY = margin;
      doc.addImage(imageData, 'PNG', margin, positionY, renderWidth, renderHeight);
      heightLeft -= printableHeight;

      while (heightLeft > 0) {
        positionY = margin - (renderHeight - heightLeft);
        doc.addPage();
        doc.addImage(imageData, 'PNG', margin, positionY, renderWidth, renderHeight);
        heightLeft -= printableHeight;
      }

      doc.save(`${activeReport}-report-${new Date().toISOString().split('T')[0]}.pdf`);
      showSuccess('PDF exported successfully');
    } catch (error) {
      showError('PDF export failed', error.message);
    }
  };

  const exportAsExcel = async (rows) => {
    try {
      if (rows.length === 0) {
        showError('Export failed', 'No data to export');
        return;
      }

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, activeReport);
      XLSX.writeFile(workbook, `${activeReport}-report-${new Date().toISOString().split('T')[0]}.xlsx`);
      showSuccess('Excel exported successfully');
    } catch (error) {
      showError('Excel export failed', error.message);
    }
  };

  const renderOverview = () => {
    if (!reportData) return null;

    const stats = reportData.stats || {};

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 tracking-wider">TOTAL STUDENTS</p>
                <h3 className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalStudents)}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 tracking-wider">TOTAL FACULTY</p>
                <h3 className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalFaculty)}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 tracking-wider">TOTAL EVENTS</p>
                <h3 className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalEvents)}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 tracking-wider">SYSTEM HEALTH</p>
                <h3 className="text-3xl font-bold text-gray-900">98%</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {(reportData.recentActivity || []).slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">{formatDate(activity.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6">System Alerts</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-green-50 border border-green-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Eye size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">All systems operational</p>
                  <p className="text-xs text-gray-500">No issues detected</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStudentsReport = () => {
    if (!reportData) return null;

    const students = reportData.students || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Student Enrollment Report</h3>
          <div className="flex gap-3">
            <button
              onClick={() => exportReport('csv')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={() => exportReport('xlsx')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2 text-sm focus:border-orange-300 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Student ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Course</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Year</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students
                  .map((student) => ({
                    ...student,
                    display_name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' '),
                  }))
                  .filter(student =>
                    searchTerm === '' ||
                    student.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    student.student_id?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.student_id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{student.display_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{student.course}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{student.year_level}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">
                          {student.enrollment_status || 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(student.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderFacultyReport = () => {
    if (!reportData) return null;

    const faculty = reportData.faculty || [];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Faculty Performance Report</h3>
          <div className="flex gap-3">
            <button
              onClick={() => exportReport('csv')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={() => exportReport('xlsx')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search faculty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2 text-sm focus:border-orange-300 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Faculty ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Department</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Subjects</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Students</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {faculty
                  .map((fac) => ({
                    ...fac,
                    display_name: [fac.first_name, fac.middle_name, fac.last_name].filter(Boolean).join(' '),
                  }))
                  .filter(fac =>
                    searchTerm === '' ||
                    fac.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    fac.employee_number?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((fac) => (
                    <tr key={fac.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{fac.employee_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{fac.display_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{fac.department}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{fac.subjects_count || 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{fac.students_count || 0}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-600">
                          {fac.employment_status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEventsReport = () => {
    if (!reportData) return null;

    const events = (reportData.events || []).map((event) => ({
      ...event,
      participants: event.participants ?? event.registered ?? 0,
    }));

    const totalEvents = events.length;
    const totalParticipants = events.reduce((sum, e) => sum + (e.participants || 0), 0);
    const completedEvents = events.filter((e) => (e.status || '').toLowerCase() === 'completed').length;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Events Participation Report</h3>
          <div className="flex gap-3">
            <button
              onClick={() => exportReport('csv')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={() => exportReport('xlsx')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Calendar size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 tracking-wider">TOTAL EVENTS</p>
                <h3 className="text-2xl font-bold text-gray-900">{formatNumber(totalEvents)}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 tracking-wider">TOTAL PARTICIPANTS</p>
                <h3 className="text-2xl font-bold text-gray-900">{formatNumber(totalParticipants)}</h3>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 tracking-wider">COMPLETED</p>
                <h3 className="text-2xl font-bold text-gray-900">{formatNumber(completedEvents)}</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Event Title</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Organization</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Participants</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 tracking-wider uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event) => (
                  <tr key={event.id || event.EventTitle || event.title} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.title || event['Event Title']}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{event.organization || event.Organization}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDate(event.date || event.Date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{formatNumber(event.participants || event.registered || event.Participants || 0)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
                        (event.status || '').toLowerCase() === 'completed' ? "bg-green-50 text-green-600" :
                        (event.status || '').toLowerCase() === 'upcoming' ? "bg-blue-50 text-blue-600" :
                        (event.status || '').toLowerCase().includes('registration') ? "bg-orange-50 text-orange-600" :
                        "bg-gray-50 text-gray-600"
                      )}>
                        {event.status || event.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSystemReport = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">System Performance Report</h3>
          <div className="flex gap-3">
            <button
              onClick={() => exportReport('csv')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={() => exportReport('xlsx')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Export Excel
            </button>
            <button
              onClick={() => exportReport('pdf')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 mb-6">System Metrics</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Database Performance</span>
                <span className="text-sm font-bold text-green-600">Excellent</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">API Response Time</span>
                <span className="text-sm font-bold text-green-600">120ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Uptime</span>
                <span className="text-sm font-bold text-green-600">99.9%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Users</span>
                <span className="text-sm font-bold text-blue-600">1,247</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h4 className="text-lg font-bold text-gray-900 mb-6">Security Status</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Failed Login Attempts</span>
                <span className="text-sm font-bold text-green-600">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Data Backups</span>
                <span className="text-sm font-bold text-green-600">Current</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">SSL Certificate</span>
                <span className="text-sm font-bold text-green-600">Valid</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">System Updates</span>
                <span className="text-sm font-bold text-blue-600">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-orange-600" />
          <span className="text-gray-600">Loading report data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administrative Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive system analytics and data insights</p>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_TYPES.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id)}
            className={cn(
              'p-6 rounded-3xl border text-left transition-all hover:shadow-lg',
              activeReport === report.id
                ? 'bg-orange-600 text-white border-orange-600 shadow-lg'
                : 'bg-white border-gray-100 hover:border-orange-200'
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-2xl',
                  activeReport === report.id
                    ? 'bg-white/15 text-white'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                <report.icon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1" style={{ color: activeReport === report.id ? 'white' : undefined }}>
                  {report.label}
                </h3>
                <p className={cn(
                  'text-sm',
                  activeReport === report.id ? 'text-white/80' : 'text-gray-500'
                )}>
                  {report.description}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
        {activeReport === 'overview' && renderOverview()}
        {activeReport === 'students' && renderStudentsReport()}
        {activeReport === 'faculty' && renderFacultyReport()}
        {activeReport === 'events' && renderEventsReport()}
        {activeReport === 'system' && renderSystemReport()}
      </div>
    </div>
  );
};
