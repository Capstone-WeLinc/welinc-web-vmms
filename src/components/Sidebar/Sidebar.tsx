import { useState } from "react";
import type { UserRecord } from "../../lib/api/authService";
import { NavLink } from "react-router-dom";
import { isMechanicRole, isOperationsRole } from "../../lib/utils/permissions";
import {
  LayoutGrid,
  LogOut,
  LayoutDashboard,
  Users,
  CalendarClock,
  Wrench,
  ClipboardList,
  ClipboardCheck,
  FileBarChart2,
  Fuel,
  DollarSign,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from "lucide-react";

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
  currentUser?: UserRecord | null;
}

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "User Management", icon: Users, path: "/users" },
  { label: "Maintenance Scheduling", icon: CalendarClock, path: "/maintenance-scheduling" },
  { label: "Work Orders", icon: Wrench, path: "/work-orders" },
  { label: "Work Order Templates", icon: ClipboardCheck, path: "/inspection-checklists" },
  { label: "Maintenance Logs", icon: ClipboardList, path: "/maintenance-logs" },
  { label: "Maintenance Reports", icon: FileBarChart2, path: "/maintenance-reports" },
  { label: "Fuel Management", icon: Fuel, path: "/fuel-management" },
  { label: "Expense & Profitability", icon: DollarSign, path: "/expense-profitability" },
];

const roleLabelMap: Record<string, string> = {
  ADMIN: "Administrator",
  OPERATIONS: "Operations",
  MECHANIC: "Mechanic",
};

const asideBaseClasses = 'fixed top-0 left-0 z-50 h-screen flex flex-col border-r border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-[4px_0_24px_rgba(0,0,0,0.1)] transition-all overflow-hidden';

const headerClasses = 'flex items-center gap-3 p-5';

const avatarClasses = 'flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--color-brand-primary)] text-white transition-transform';

const userInfoClasses = 'overflow-hidden';

const userNameClasses = 'truncate text-sm font-semibold text-[var(--color-text-primary)]';

const userRoleClasses = 'text-xs text-[var(--color-text-secondary)]';

const dividerClasses = 'h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent';

const navClasses = 'flex-1 overflow-y-auto p-2';
const navListClasses = 'm-0 p-0 list-none';
const navItemClasses = 'mb-2';
const buttonGroupClasses = 'block p-3';
const sectionDividerClasses = 'h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent';

const baseButtonClasses = 'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-transparent border border-transparent transition-colors';

const getNavLinkClass = (isActive: boolean, collapsed: boolean) => {
  const base = `${collapsed ? 'p-2 justify-center' : 'px-3 py-2 justify-start'} flex items-center gap-3 rounded-xl text-sm font-medium transition-colors`;
  if (isActive) {
    return `${base} bg-[var(--color-brand-primary)] text-white border border-[var(--color-brand-primary)]/30 hover:bg-[var(--color-brand-dark)] hover:text-white`;
  }
  return `${base} text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]`;
};

export default function Sidebar({ onCollapse, currentUser }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedWidth = collapsed ? "80px" : "256px";
  const isMechanic = isMechanicRole(currentUser);
  const isOperations = isOperationsRole(currentUser);
  const visibleNavItems = isMechanic
    ? navItems.filter((item) => item.path === "/work-orders" || item.path === "/maintenance-logs")
    : isOperations
      ? navItems.filter((item) =>
          ["/dashboard", "/maintenance-scheduling", "/work-orders", "/maintenance-logs", "/maintenance-reports", "/fuel-management"].includes(item.path),
        )
      : navItems;

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapse?.(next);
  };

  const getSubsystemCount = () => {
    try {
      const token = window.localStorage.getItem('accessToken');
      if (!token) return 0;
      const [, payload] = token.split('.');
      if (!payload) return 0;
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      const decoded = JSON.parse(json) as { roles?: { system: string }[] };
      const subsystemRoles = (decoded.roles || []).filter((r) =>
        ['VRMS', 'VMMS', 'BMS'].includes(r.system.toUpperCase())
      );
      const uniqueSystems = new Set(subsystemRoles.map(r => r.system.toUpperCase()));
      return uniqueSystems.size;
    } catch (err) {
      console.error('Error parsing token to count subsystems:', err);
      return 2;
    }
  };

  const hasMultipleSystems = getSubsystemCount() > 1;

  const handleSignOut = () => {
    window.localStorage.removeItem("accessToken");
    try {
      window.localStorage.removeItem("session_login_time");
      window.localStorage.removeItem("session_last_activity");
    } catch (e) {
      console.error(e);
    }
    const portalUrl = import.meta.env.VITE_PORTAL_URL || "http://localhost:5176";
    window.location.href = `${portalUrl}/login?logout=true`;
  };

  const handleBackToPortal = () => {
    const portalUrl = import.meta.env.VITE_PORTAL_URL || "http://localhost:5176";
    window.location.href = portalUrl;
  };

  const resolvedAvatarClass = `${avatarClasses} ${collapsed ? 'mx-auto' : ''}`;

  const currentRole = currentUser ? roleLabelMap[currentUser.role] ?? currentUser.role : "Administrator";

  return (
    <aside className={asideBaseClasses} style={{ width: collapsedWidth }}>
      <div className={headerClasses}>
        <div className={resolvedAvatarClass}>
          <User size={collapsed ? 18 : 22} strokeWidth={1.8} />
        </div>
        {!collapsed && (
          <div className={userInfoClasses}>
            <p className={userNameClasses}>{currentUser ? currentUser.name : "Admin User"}</p>
            <p className={userRoleClasses}>{currentRole}</p>
          </div>
        )}
      </div>

      <div className={`${collapsed ? 'mx-3' : 'mx-4'} ${dividerClasses}`} />

      <nav className={navClasses}>
        <ul className={navListClasses}>
          {visibleNavItems.map((item) => (
            <li key={item.path} className={navItemClasses}>
              <NavLink to={item.path} title={collapsed ? item.label : undefined} className={({ isActive }) => getNavLinkClass(isActive, collapsed)}>
                <item.icon size={20} strokeWidth={1.7} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={buttonGroupClasses}>
        <div className={sectionDividerClasses} />

        {hasMultipleSystems ? (
          <button
            className={`${baseButtonClasses} ${collapsed ? 'justify-center' : 'justify-start'}`}
            onClick={handleBackToPortal}
            title="Switch Subsystem"
            type="button"
          >
            <LayoutGrid size={20} strokeWidth={1.7} />
            {!collapsed && <span>Switch Subsystem</span>}
          </button>
        ) : (
          <button
            className={`${baseButtonClasses} ${collapsed ? 'justify-center' : 'justify-start'}`}
            onClick={handleSignOut}
            title="Sign Out"
            type="button"
            style={{ color: '#ef4444' }}
          >
            <LogOut size={20} strokeWidth={1.7} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        )}

        <button className={`${baseButtonClasses} ${collapsed ? 'justify-center' : 'justify-start'}`} onClick={toggleCollapse} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} type="button">
          {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.7} /> : <><PanelLeftClose size={20} strokeWidth={1.7} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
