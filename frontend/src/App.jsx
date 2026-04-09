import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Login } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { StudentRecords } from './components/students/StudentRecords';
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
  dashboard: { path: '/dashboard', title: 'Dashboard' },
  students: { path: '/users', title: 'Student Profile' },
  faculty: { path: '/faculty', title: 'Faculty Profile' },
  scheduling: { path: '/scheduling', title: 'Scheduling' },
  research: { path: '/research', title: 'College Research' },
  instructions: { path: '/instructions', title: 'Instructions' },
  reports: { path: '/reports', title: 'Events', adminOnly: true },
  audit: { path: '/audit-logs', title: 'Audit Logs', adminOnly: true },
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

function canAccessRoute(tab, isAdmin) {
  const route = ROUTES[tab];
  if (!route) return true;
  if (route.adminOnly) return isAdmin;
  return true;
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser, accessRole, isAdmin } = useSession();
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

  const handleNavigate = (tab, context = null) => {
    if (!canAccessRoute(tab, isAdmin)) {
      setNavigationIntent(null);
      if (location.pathname !== ROUTES.dashboard.path) {
        navigate(ROUTES.dashboard.path);
      }
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
            navigate(ROUTES.dashboard.path, { replace: true });
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
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-semibold text-gray-900">{user.username}</p>
              <p className="text-xs text-gray-500">{accessRole}</p>
            </div>
          </button>
        </header>

        <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-8">
          <Routes>
            <Route path="/" element={<Navigate to={ROUTES.dashboard.path} replace />} />
            <Route path={ROUTES.dashboard.path} element={<Dashboard onNavigate={handleNavigate} />} />
            <Route
              path={ROUTES.students.path}
              element={
                <StudentRecords
                  navigationIntent={navigationIntent}
                  clearNavigationIntent={clearNavigationIntent}
                  onNavigate={handleNavigate}
                />
              }
            />
            <Route
              path={`${ROUTES.students.path}/:id`}
              element={
                <StudentRecords
                  navigationIntent={navigationIntent}
                  clearNavigationIntent={clearNavigationIntent}
                  onNavigate={handleNavigate}
                />
              }
            />
            <Route
              path={ROUTES.faculty.path}
              element={
                <FacultyRecords
                  navigationIntent={navigationIntent}
                  clearNavigationIntent={clearNavigationIntent}
                  onNavigate={handleNavigate}
                />
              }
            />
            <Route
              path={ROUTES.scheduling.path}
              element={
                <Scheduling
                  navigationIntent={navigationIntent}
                  clearNavigationIntent={clearNavigationIntent}
                  onNavigate={handleNavigate}
                />
              }
            />
            <Route path={ROUTES.research.path} element={<CollegeResearch />} />
            <Route
              path={ROUTES.instructions.path}
              element={
                <Instructions
                  navigationIntent={navigationIntent}
                  clearNavigationIntent={clearNavigationIntent}
                />
              }
            />
            <Route
              path={ROUTES.reports.path}
              element={
                <RoleRoute allow="admin">
                  <OrgEventsReports
                    navigationIntent={navigationIntent}
                    clearNavigationIntent={clearNavigationIntent}
                    onNavigate={handleNavigate}
                  />
                </RoleRoute>
              }
            />
            <Route
              path={ROUTES.audit.path}
              element={
                <RoleRoute allow="admin">
                  <AuditLogs />
                </RoleRoute>
              }
            />
            <Route path="*" element={<Navigate to={ROUTES.dashboard.path} replace />} />
          </Routes>
        </div>
      </main>

      {showAccountSettings ? (
        <AccountSettingsModal onClose={() => setShowAccountSettings(false)} />
      ) : null}
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