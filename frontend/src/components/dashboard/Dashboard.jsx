import React, { useEffect, useState } from 'react';
import {
  Users,
  UserSquare2,
  UserPlus,
  Calendar,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const emptyChartData = [
  { name: 'BSIT', students: 0 },
  { name: 'BSCS', students: 0 },
];

const formatEventTime = (timeValue) => {
  if (!timeValue) return 'TBD';

  const parsed = new Date(`1970-01-01T${timeValue}`);
  if (Number.isNaN(parsed.getTime())) {
    return timeValue;
  }

  return parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
};

export const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    newStudents: 0,
    upcomingEvents: 0,
  });
  const [chartData, setChartData] = useState(emptyChartData);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const [studentsRes, facultyRes, reportsRes] = await Promise.all([
          fetch(`${API_URL}/api/students`),
          fetch(`${API_URL}/api/faculty`),
          fetch(`${API_URL}/api/reports?report_type=event`),
        ]);

        const studentsData = await studentsRes.json();
        const facultyData = await facultyRes.json();
        const reportsData = await reportsRes.json();

        const students = studentsData.success ? (studentsData.data || []) : [];
        const faculty = facultyData.success ? (facultyData.data || []) : [];
        const reports = reportsData.success ? (reportsData.data || []) : [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const newStudents = students.filter((student) => {
          const created = new Date(student.created_at);
          return created >= thirtyDaysAgo;
        }).length;

        const now = new Date();
        const upcomingEvents = reports
          .filter((report) => {
            const eventDate = new Date(report.date);
            return eventDate >= now;
          })
          .slice(0, 3);

        const courseCounts = {};
        students.forEach((student) => {
          const course = student.course || 'Other';
          courseCounts[course] = (courseCounts[course] || 0) + 1;
        });

        setStats({
          totalStudents: students.length,
          totalFaculty: faculty.length,
          newStudents,
          upcomingEvents: upcomingEvents.length,
        });

        setChartData([
          { name: 'BSIT', students: courseCounts.BSIT || 0 },
          { name: 'BSCS', students: courseCounts.BSCS || 0 },
        ]);

        setEvents(
          upcomingEvents.map((event) => ({
            id: event.id,
            title: event.title,
            date: new Date(event.date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }),
            time: formatEventTime(event.time),
            status: event.status || 'Upcoming',
          })),
        );
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setStats({
          totalStudents: 0,
          totalFaculty: 0,
          newStudents: 0,
          upcomingEvents: 0,
        });
        setChartData(emptyChartData);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const displayStats = [
    {
      label: 'TOTAL STUDENTS',
      value: stats.totalStudents.toLocaleString(),
      icon: Users,
      trend: stats.totalStudents > 0 ? `+${stats.totalStudents}` : '0',
      up: true,
      onClick: () => onNavigate?.('students'),
    },
    {
      label: 'TOTAL FACULTY',
      value: stats.totalFaculty.toString(),
      icon: UserSquare2,
      trend: stats.totalFaculty > 0 ? `+${stats.totalFaculty}` : '0',
      up: true,
      onClick: () => onNavigate?.('faculty'),
    },
    {
      label: 'NEW STUDENTS',
      value: stats.newStudents.toString(),
      icon: UserPlus,
      trend: stats.newStudents > 0 ? `+${stats.newStudents}` : '0',
      up: stats.newStudents > 0,
      onClick: () => onNavigate?.('students'),
    },
    {
      label: 'UPCOMING EVENTS',
      value: stats.upcomingEvents.toString(),
      icon: Calendar,
      trend: stats.upcomingEvents > 0 ? `Next: ${events[0]?.title || 'Event'}` : 'No events',
      up: stats.upcomingEvents > 0,
      onClick: () => onNavigate?.('events'),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading dashboard data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayStats.map((stat, index) => (
          <button
            key={index}
            type="button"
            onClick={stat.onClick}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-shadow text-left hover:border-orange-200 min-h-[170px]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-600">
                <stat.icon size={24} />
              </div>
              <div
                className={cn(
                  'flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full',
                  stat.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
                )}
              >
                {stat.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trend}
              </div>
            </div>
            <p className="text-[11px] font-bold text-gray-400 tracking-[0.24em] uppercase mb-2">{stat.label}</p>
            <h3 className="text-4xl font-bold text-gray-900">{stat.value}</h3>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-gray-900">Student Enrollment by Course</h3>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              Live Records
            </span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar
                  dataKey="students"
                  fill="#ea580c"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  onClick={(data) => onNavigate?.('students', { course: data?.name })}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-8">Upcoming Events</h3>
          <div className="space-y-6">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                No upcoming events yet. Add an event in the Events module to see it here.
              </div>
            ) : (
              events.map((event) => (
                <button
                  key={event.id || event.title}
                  type="button"
                  onClick={() => onNavigate?.('reports', { eventId: event.id })}
                  className="flex w-full gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100 text-left"
                >
                  <div className="p-3 bg-orange-50 rounded-xl h-fit">
                    <Bell className="text-orange-600" size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-1">{event.title}</h4>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                      <span>{event.date}</span>
                      <span>&bull;</span>
                      <span>{event.time}</span>
                    </div>
                    <span
                      className={cn(
                        'inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full',
                        event.status === 'Upcoming'
                          ? 'text-orange-600 bg-orange-50'
                          : event.status === 'Registration Open'
                            ? 'text-red-600 bg-red-50'
                            : event.status === 'Completed'
                              ? 'text-emerald-600 bg-emerald-50'
                              : 'text-gray-600 bg-gray-50',
                      )}
                    >
                      {event.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
