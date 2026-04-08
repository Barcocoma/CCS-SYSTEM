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
import { FacultyRecords } from './components/faculty/FacultyRecords';
import { Scheduling } from './components/scheduling/Scheduling';
import { CollegeResearch } from './components/research/CollegeResearch';
import { Instructions } from './components/instructions/Instructions';
import { OrgEventsReports } from './components/events/OrgEventsReports';
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
  reports: { path: '/reports', title: 'Events', roles: ['DEAN', 'CHAIR', 'FACULTY'] },
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

function getDefaultPathForRole(role) {
  if (role === 'STUDENT') return ROUTES.student_portal.path;
  if (role === 'FACULTY') return ROUTES.students.path;
  return ROUTES.dashboard.path;
}

function canAccessRoute(tab, role) {
  const route = ROUTES[tab];
  if (!route || !route.roles) return true;
  return route.roles.includes(role);
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
        <header className="h-16 sm:h-20 bg-white border-b flex items-center justify-between px-4 sm:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
            <h2 className="font-bold">{pageTitle}</h2>
          </div>

          <button onClick={() => setShowAccountSettings(true)}>
            <ShieldCheck size={18} />
            {user.username}
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

            <Route path={ROUTES.reports.path} element={<RoleRoute allow={['DEAN','CHAIR','FACULTY']}><OrgEventsReports /></RoleRoute>} />
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