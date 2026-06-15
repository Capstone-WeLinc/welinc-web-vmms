import { useState } from "react";
import Modal from "../ui/Modal";
import type { UserRecord } from "../../lib/api/authService";
import { NavLink } from "react-router-dom";
import { isMechanicRole, isOperationsRole } from "../../lib/utils/permissions";
import {
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
  LogOut,
  User,
  Moon,
  Sun,
} from "lucide-react";

interface SidebarProps {
  onCollapse?: (collapsed: boolean) => void;
  onLogout?: () => void;
  currentUser?: UserRecord | null;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
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
    return `${base} bg-[var(--color-brand-primary)] text-white border border-[var(--color-brand-primary)]/30 hover:bg-[var(--color-brand-dark)] hover:text-white dark:hover:bg-[var(--color-brand-dark)] dark:hover:text-white`;
  }
  return `${base} text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]`;
};

export default function Sidebar({ onCollapse, onLogout, currentUser, darkMode = false, onToggleDarkMode }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
        
        <button
          className={`${baseButtonClasses} ${collapsed ? 'justify-center' : 'justify-start'}`}
          onClick={onToggleDarkMode}
          title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          type="button"
        >
          {darkMode ? <Sun size={20} strokeWidth={1.7} /> : <Moon size={20} strokeWidth={1.7} />}
          {!collapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        <button className={`${baseButtonClasses} ${collapsed ? 'justify-center' : 'justify-start'}`} onClick={toggleCollapse} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} type="button">
          {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.7} /> : <><PanelLeftClose size={20} strokeWidth={1.7} /><span>Collapse</span></>}
        </button>

        <button className={`${baseButtonClasses} ${collapsed ? 'justify-center' : 'justify-start'}`} title="Logout" onClick={() => setShowConfirm(true)} type="button">
          <LogOut size={20} strokeWidth={1.7} />
          {!collapsed && <span>Logout</span>}
        </button>
        <Modal
          isOpen={showConfirm}
          title="Logout"
          message="Are you sure you want to log out? Your session will be ended." 
          confirmLabel="Log out"
          cancelLabel="Cancel"
          onConfirm={() => { setShowConfirm(false); onLogout?.(); }}
          onClose={() => setShowConfirm(false)}
        />
      </div>
    </aside>
  );
}
