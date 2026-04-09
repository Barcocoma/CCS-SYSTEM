import React from 'react';
import {
  LayoutDashboard,
  IdCard,
  GraduationCap,
  Calendar,
  MessageSquare,
  ChevronRight,
  LogOut,
  Users,
  Clock,
  BookOpen,
  FileText,
  X
} from 'lucide-react';
import { cn } from '../../constants';
import { useSession } from '../../context/SessionProvider';

export const Sidebar = ({ activeTab, setActiveTab, onLogout, open = true, onClose }) => {
  const { user, accessRole, viewMode } = useSession();

  const roleDisplayMap = {
    DEAN: 'Dean',
    CHAIR: 'Department Chair',
    FACULTY: 'Faculty',
    SECRETARY: 'Secretary',
  };

  const displayRole = roleDisplayMap[accessRole] || accessRole || 'Faculty';
  const displayName = user?.username || 'Presentation User';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
    { id: 'students', label: 'Student Profile', icon: IdCard, roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
    { id: 'faculty', label: 'Faculty Profile', icon: GraduationCap, roles: ['DEAN', 'CHAIR', 'SECRETARY'] },
    { id: 'scheduling', label: 'Scheduling', icon: Clock, roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
    { id: 'research', label: 'College Research', icon: BookOpen, roles: ['DEAN', 'CHAIR', 'FACULTY'] },
    { id: 'instructions', label: 'Instructions', icon: FileText, roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
    { id: 'reports', label: 'Events', icon: Calendar, roles: ['DEAN'] },
    { id: 'audit', label: 'Audit Logs', icon: MessageSquare, roles: ['DEAN'], hasSubmenu: true },
  ];

  const filteredItems = menuItems.filter((item) => item.roles.includes(accessRole || 'FACULTY'));

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'z-50 w-[86vw] max-w-80 shrink-0 overflow-hidden border-r border-gray-200 bg-white shadow-sm sm:w-72 lg:w-72',
          'fixed inset-y-0 left-0 transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar navigation"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-100 px-5 py-5">
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-orange-50 via-white to-emerald-50 p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-orange-100">
                <img
                  src="/university-of-cabuyao.png"
                  alt="University of Cabuyao logo"
                  className="h-11 w-11 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold leading-tight text-emerald-800">
                  University of Cabuyao
                </p>
                <p className="mt-1 text-[11px] font-medium leading-snug text-gray-500">
                  College of Computing Studies
                </p>
                <p className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600 ring-1 ring-orange-100">
                  CCS System
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose?.();
                }}
                className={cn(
                  'group flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                  activeTab === item.id
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                    : 'text-gray-600 hover:bg-orange-50 hover:text-gray-900'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                      activeTab === item.id
                        ? 'bg-white/15 text-white'
                        : 'bg-gray-100 text-gray-500 group-hover:bg-white'
                    )}
                  >
                    <item.icon size={18} />
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.hasSubmenu ? (
                  <ChevronRight
                    size={14}
                    className={cn(
                      'shrink-0 transition-transform',
                      activeTab === item.id ? 'rotate-90' : ''
                    )}
                  />
                ) : null}
              </button>
            ))}
          </nav>

          <div className="border-t border-gray-100 p-4">
            <div className="rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                    <Users size={16} />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Signed In User</p>
                    <p className="truncate text-sm font-bold text-gray-800">{displayName}</p>
                    <p className="truncate text-xs text-gray-500">{displayRole}</p>
                    <p className="truncate text-[11px] font-semibold text-orange-600">{viewMode} View</p>
                  </div>
                </div>
                <div className="flex flex-col -space-y-1">
                  <ChevronRight size={10} className="-rotate-90 text-gray-400" />
                  <ChevronRight size={10} className="rotate-90 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-medium text-gray-500">
              <span>System Version</span>
              <span className="rounded-full bg-orange-50 px-2 py-1 font-bold text-orange-600">v2.13</span>
            </div>

            <button
              onClick={() => {
                onLogout?.();
                onClose?.();
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 px-4 py-3 text-sm font-bold text-red-500 transition-colors hover:bg-red-50"
            >
              <LogOut size={14} />
              Logout Session
            </button>
          </div>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          onClick={onClose}
          className="fixed left-3 top-3 z-[60] inline-flex items-center justify-center rounded-2xl bg-white/90 p-2 text-slate-700 shadow-lg ring-1 ring-slate-200 backdrop-blur lg:hidden"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      ) : null}
    </>
  );
};