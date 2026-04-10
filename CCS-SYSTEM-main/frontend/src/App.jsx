import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { StudentRecords } from './components/students/StudentRecords';
import { StudentPortal } from './components/students/StudentPortal';
import { StudentSectionSchedule } from './components/students/StudentSectionSchedule';
import { StudentSectionEvents } from './components/students/StudentSectionEvents';
import { OrgEventsReports } from './components/events/OrgEventsReports';
import { FacultyRecords } from './components/faculty/FacultyRecords';
import { Scheduling } from './components/scheduling/Scheduling';
import { CollegeResearch } from './components/research/CollegeResearch';
import { Instructions } from './components/instructions/Instructions';
import { Reports } from './components/reports/Reports';
import { AuditLogs } from './components/audit/AuditLogs';
import { Menu, ShieldCheck } from 'lucide-react';
import { apiRequest } from './lib/api';
import { UIProvider, useUI } from './components/ui/UIProvider';
import { AccountSettingsModal } from './components/account/AccountSettingsModal';
import { SessionProvider, useSession } from './context/SessionProvider';
import { RoleRoute } from './components/routing/RoleRoute';

const ROUTES = {
  student_portal: { path: '/student-portal', title: 'Student Portal', roles: ['STUDENT'] },
  student_schedule: { path: '/student-section-schedule', title: 'Section Schedule', roles: ['STUDENT'] },
  student_events: { path: '/student-section-events', title: 'Events', roles: ['STUDENT'] },

  dashboard: { path: '/dashboard', title: 'Dashboard', roles: ['DEAN', 'CHAIR', 'SECRETARY'] },
  students: { path: '/users', title: 'Student Profile', roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
  faculty: { path: '/faculty', title: 'Faculty Profile', roles: ['DEAN', 'CHAIR', 'SECRETARY'] },
  scheduling: { path: '/scheduling', title: 'Scheduling', roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
  research: { path: '/research', title: 'College Research', roles: ['DEAN', 'CHAIR', 'FACULTY', 'STUDENT'] },
  instructions: { path: '/instructions', title: 'Instructions', roles: ['DEAN', 'CHAIR', 'SECRETARY'] },
  events: { path: '/events', title: 'Events', roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
  reports: { path: '/reports', title: 'Reports', roles: ['DEAN'] },
  audit: { path: '/audit-logs', title: 'Audit Logs', roles: ['DEAN'] },
};

function getTabFromPath(pathname) {
  if (pathname === ROUTES.students.path || pathname.startsWith(`${ROUTES.students.path}/`)) {
    return 'students';
  }

  const matched = Object.entries(ROUTES).find(([, config]) => config.path === pathname);
  return matched?.[0] || 'dashboard';
}

function getPathForTab(tab, context = null) {
  if (tab === 'students' && context?.studentId) {
    return `${ROUTES.students.path}/${context.studentId}`;
  }
  return ROUTES[tab]?.path || ROUTES.dashboard.path;
}

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

function getDefaultPathForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'STUDENT') return ROUTES.student_portal.path;
  if (normalizedRole === 'FACULTY') return ROUTES.students.path;
  return ROUTES.dashboard.path;
}

function canAccessRoute(tab, role) {
  const normalizedRole = normalizeRole(role);
  const route = ROUTES[tab];
  if (!route || !route.roles) return true;
  return route.roles.some((allowedRole) => String(allowedRole || '').trim().toUpperCase() === normalizedRole);
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser, accessRole } = useSession();

  const [showRegister, setShowRegister] = useState(false);
  const [navigationIntent, setNavigationIntent] = useState(null);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showError } = useUI();

  const activeTab = getTabFromPath(location.pathname);
  const pageTitle = ROUTES[activeTab]?.title || 'Dashboard';

  useEffect(() => {
    if (!sidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!user) return;
    const currentTab = getTabFromPath(location.pathname);
    if (!canAccessRoute(currentTab, accessRole)) {
      const fallbackPath = getDefaultPathForRole(accessRole);
      if (location.pathname !== fallbackPath) {
        navigate(fallbackPath, { replace: true });
      }
    }
  }, [accessRole, location.pathname, navigate, user]);

  const handleNavigate = (tab, context = null) => {
    if (!canAccessRoute(tab, accessRole)) {
      const fallbackPath = getDefaultPathForRole(accessRole);
      navigate(fallbackPath);
      return;
    }

    setNavigationIntent({
      tab,
      context,
      timestamp: Date.now(),
    });

    const nextPath = getPathForTab(tab, context);
    if (location.pathname !== nextPath) {
      navigate(nextPath);
    }
  };

  const clearNavigationIntent = () => {
    setNavigationIntent(null);
  };

  if (!user) {
    if (showRegister) {
      return (
        <Register
          onRegisterSuccess={() => setShowRegister(false)}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }

    return (
      <Login
        onLogin={(userData) => {
          setUser(userData);
          if (location.pathname === '/') {
            navigate(getDefaultPathForRole(userData?.role), { replace: true });
          }
        }}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50 font-sans text-gray-900">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={async () => {
          try {
            await apiRequest('/api/auth/logout', {
              method: 'POST',
              body: {
                username: user?.username,
                email: user?.email,
                tenant_id: user?.tenant_id,
              },
            });
          } catch (error) {
            showError('Logout sync failed', error.message);
          } finally {
            setUser(null);
            navigate('/', { replace: true });
          }
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="h-16 sm:h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <h2 className="truncate text-base sm:text-xl font-bold text-gray-900">{pageTitle}</h2>
          </div>

          <button
            type="button"
            onClick={() => setShowAccountSettings(true)}
            className="flex items-center gap-3 rounded-2xl bg-orange-50 px-3 py-2 sm:px-4 text-left text-sm transition-colors hover:bg-orange-100"
          >
            <ShieldCheck className="text-orange-600" size={18} />
            <div className="hidden sm:block leading-tight">
              <p className="font-semibold text-gray-900">{user.username}</p>
              <p className="text-xs text-gray-500">{accessRole}</p>
            </div>
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-8">
          <Routes>
            <Route path="/" element={<Navigate to={getDefaultPathForRole(accessRole)} replace />} />

            <Route path={ROUTES.student_portal.path} element={<RoleRoute allow={['STUDENT']}><StudentPortal /></RoleRoute>} />
            <Route path={ROUTES.student_schedule.path} element={<RoleRoute allow={['STUDENT']}><StudentSectionSchedule /></RoleRoute>} />
            <Route path={ROUTES.student_events.path} element={<RoleRoute allow={['STUDENT']}><StudentSectionEvents /></RoleRoute>} />

            <Route path={ROUTES.dashboard.path} element={<Dashboard onNavigate={handleNavigate} />} />
            <Route path={ROUTES.students.path} element={<StudentRecords onNavigate={handleNavigate} />} />
            <Route path={`${ROUTES.students.path}/:id`} element={<StudentRecords onNavigate={handleNavigate} />} />
            <Route path={ROUTES.faculty.path} element={<FacultyRecords onNavigate={handleNavigate} />} />
            <Route path={ROUTES.scheduling.path} element={<Scheduling onNavigate={handleNavigate} />} />
            <Route path={ROUTES.research.path} element={<CollegeResearch />} />
            <Route path={ROUTES.instructions.path} element={<Instructions />} />
            <Route path={ROUTES.events.path} element={<RoleRoute allow={['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY']}><OrgEventsReports navigationIntent={navigationIntent} clearNavigationIntent={clearNavigationIntent} /></RoleRoute>} />

            <Route path={ROUTES.reports.path} element={<RoleRoute allow={['DEAN']}><Reports /></RoleRoute>} />
            <Route path={ROUTES.audit.path} element={<RoleRoute allow={['DEAN']}><AuditLogs /></RoleRoute>} />

            <Route path="*" element={<Navigate to={getDefaultPathForRole(accessRole)} replace />} />
          </Routes>
        </div>
      </main>

      {showAccountSettings && <AccountSettingsModal onClose={() => setShowAccountSettings(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <UIProvider>
      <SessionProvider>
        <AppShell />
      </SessionProvider>
    </UIProvider>
  );
}