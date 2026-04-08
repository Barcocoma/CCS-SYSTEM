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
  UserRound,
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
    STUDENT: 'Student',
  };

  const displayRole = roleDisplayMap[accessRole] || accessRole || 'Faculty';
  const displayName = user?.username || 'Presentation User';

  const menuItems = [
    { id: 'student_portal', label: 'Student Portal', icon: UserRound, roles: ['STUDENT'] },
    { id: 'student_schedule', label: 'Section Schedule', icon: Clock, roles: ['STUDENT'] },
    { id: 'student_events', label: 'Events', icon: Calendar, roles: ['STUDENT'] },

    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['DEAN', 'CHAIR', 'SECRETARY'] },
    { id: 'students', label: 'Student Profile', icon: IdCard, roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },
    { id: 'faculty', label: 'Faculty Profile', icon: GraduationCap, roles: ['DEAN', 'CHAIR', 'SECRETARY'] },
    { id: 'scheduling', label: 'Scheduling', icon: Clock, roles: ['DEAN', 'CHAIR', 'FACULTY', 'SECRETARY'] },

    { id: 'research', label: 'College Research', icon: BookOpen, roles: ['DEAN', 'CHAIR', 'FACULTY', 'STUDENT'] },
    { id: 'instructions', label: 'Instructions', icon: FileText, roles: ['DEAN', 'CHAIR', 'SECRETARY'] },
    { id: 'reports', label: 'Events', icon: Calendar, roles: ['DEAN', 'CHAIR', 'FACULTY'] },

    { id: 'audit', label: 'Audit Logs', icon: MessageSquare, roles: ['DEAN'], hasSubmenu: true },
  ];

  const filteredItems = menuItems.filter((item) =>
    item.roles.includes(accessRole || 'FACULTY')
  );

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'z-50 w-[86vw] max-w-80 border-r bg-white',
          'fixed inset-y-0 left-0 transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          <nav className="flex-1 space-y-2 overflow-y-auto p-4">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose?.();
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-4 py-3',
                  activeTab === item.id
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-600 hover:bg-orange-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </div>
                {item.hasSubmenu && <ChevronRight size={14} />}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t">
            <p className="text-sm font-bold">{displayName}</p>
            <p className="text-xs text-gray-500">{displayRole}</p>
            <p className="text-xs text-orange-600">{viewMode} View</p>

            <button
              onClick={() => {
                onLogout?.();
                onClose?.();
              }}
              className="mt-4 w-full text-red-500"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <button onClick={onClose}>
          <X size={18} />
        </button>
      )}
    </>
  );
};