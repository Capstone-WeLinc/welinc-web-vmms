import type { UserRecord } from "../../lib/api/authService";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { isMechanicRole, isOperationsRole } from "../../lib/utils/permissions";
import { ConfirmationModal } from "../ui";
import logo from "../../assets/logo.png";
import {
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Users,
  CalendarClock,
  Wrench,
  ClipboardList,
  ClipboardCheck,
  BrainCircuit,
} from "lucide-react";

interface SidebarProps {
  currentUser?: UserRecord | null;
}

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "User Management", icon: Users, path: "/users" },
  { label: "Maintenance Scheduling", icon: CalendarClock, path: "/maintenance-scheduling" },
  { label: "Work Orders", icon: Wrench, path: "/work-orders" },
  { label: "Checklist Templates", icon: ClipboardCheck, path: "/checklist-templates" },
  { label: "Maintenance Logs", icon: ClipboardList, path: "/maintenance-logs" },
  { label: "AI / Analytics", icon: BrainCircuit, path: "/ai-analytics" },
//  { label: "Maintenance Reports", icon: FileBarChart2, path: "/maintenance-reports" },
//  { label: "Fuel Management", icon: Fuel, path: "/fuel-management" },
//  { label: "Expense & Profitability", icon: DollarSign, path: "/expense-profitability" },
];

const roleLabelMap: Record<string, string> = {
  ADMIN: "Administrator",
  OPERATIONS: "Operations",
  MECHANIC: "Mechanic",
};

const asideBaseClasses = "group/sidebar fixed left-0 top-0 z-50 flex h-screen w-20 flex-col overflow-hidden border-r border-[#111a62] bg-[#020849] shadow-[10px_0_32px_rgba(2,8,73,0.28)] transition-[width,box-shadow] duration-300 ease-out hover:w-[292px] hover:shadow-[18px_0_42px_rgba(2,8,73,0.34)]";
const headerClasses = "flex h-24 items-center gap-0 border-b border-white/5 px-5 transition-all duration-300 group-hover/sidebar:gap-3";
const logoFrameClasses = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-[#f4c400] bg-[#061056] shadow-[0_0_0_1px_rgba(244,196,0,0.12)]";
const labelRevealClasses = "max-w-0 min-w-0 translate-x-2 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover/sidebar:max-w-[190px] group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100";
const navClasses = "flex min-h-0 flex-1 overflow-hidden py-2";
const navListClasses = 'm-0 p-0 list-none';
const navItemClasses = 'mb-0.5';
const footerClasses = "border-t border-white/5 px-4 py-4";
const baseButtonClasses = "mx-auto flex h-10 w-10 items-center justify-center gap-0 rounded-full text-sm font-bold transition-all duration-300 group-hover/sidebar:mx-0 group-hover/sidebar:w-full group-hover/sidebar:justify-start group-hover/sidebar:gap-4 group-hover/sidebar:px-5";

const getNavLinkClass = (isActive: boolean) => {
  const base = "mx-4 flex h-10 items-center justify-center gap-0 rounded-full text-sm font-bold tracking-[-0.01em] transition-all duration-300 group-hover/sidebar:mx-0 group-hover/sidebar:justify-start group-hover/sidebar:gap-4 group-hover/sidebar:rounded-none group-hover/sidebar:px-10";
  if (isActive) {
    return `${base} bg-[#f4c400] text-[#030737] shadow-[0_12px_24px_rgba(244,196,0,0.18)]`;
  }
  return `${base} text-[#8e96cf] hover:bg-white/5 hover:text-white group-hover/sidebar:hover:rounded-none`;
};

export default function Sidebar({ currentUser }: SidebarProps) {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const isMechanic = isMechanicRole(currentUser);
  const isOperations = isOperationsRole(currentUser);
  const visibleNavItems = isMechanic
    ? navItems.filter((item) => ["/dashboard", "/work-orders", "/maintenance-logs"].includes(item.path))
    : isOperations
      ? navItems.filter((item) =>
          ["/dashboard", "/maintenance-scheduling", "/work-orders", "/maintenance-logs", "/maintenance-reports", "/fuel-management", "/ai-analytics"].includes(item.path),
        )
      : navItems;

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
    setIsLogoutModalOpen(false);
    window.localStorage.removeItem("accessToken");
    try {
      window.localStorage.removeItem("session_login_time");
      window.localStorage.removeItem("session_last_activity");
    } catch (e) {
      console.error(e);
    }
    const portalUrl = import.meta.env.VITE_PORTAL_URL || "http://localhost:8000";
    window.location.href = `${portalUrl}/login?logout=true`;
  };

  const handleSwitchToVrms = () => {
    const token = window.localStorage.getItem('accessToken');
    const vrmsUrl = import.meta.env.VITE_VRMS_URL || "http://localhost:8001";
    if (token) {
      window.location.href = `${vrmsUrl}/login?token=${token}`;
    } else {
      window.location.href = vrmsUrl;
    }
  };

  const currentRole = currentUser ? roleLabelMap[currentUser.role] ?? currentUser.role : "Administrator";
  const currentInitials = currentUser
    ? currentUser.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "AD";

  return (
    <>
    <aside className={asideBaseClasses} data-sidebar-mode="hover-expand">
      <div className={headerClasses}>
        <div className={logoFrameClasses}>
          <img src={logo} alt="WeLinc Logistics" className="h-full w-full object-cover" />
        </div>
        <div className={labelRevealClasses}>
          <p className="text-lg font-extrabold leading-5 text-white">WeLinc Logistics</p>
          <p className="mt-1 text-[10px] font-semibold leading-4 text-white">Vehicle Maintenance Management System</p>
        </div>
      </div>

      <nav className={navClasses}>
        <ul className={`${navListClasses} w-full`}>
          {visibleNavItems.map((item) => (
            <li key={item.path} className={navItemClasses}>
              <NavLink to={item.path} title={item.label} className={({ isActive }) => getNavLinkClass(isActive)}>
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.9} />
                <span className={labelRevealClasses}>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={footerClasses}>
        <NavLink
          to="/profile"
          title="Profile"
          className="mb-4 flex items-center justify-center gap-0 rounded-full transition-all duration-300 hover:bg-white/5 group-hover/sidebar:justify-start group-hover/sidebar:gap-4 group-hover/sidebar:px-5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4c400] text-sm font-extrabold text-[#030737]">
            {currentInitials}
          </div>
          <div className={labelRevealClasses}>
            <p className="text-sm font-extrabold leading-5 text-white">{currentUser ? currentUser.name : "username"}</p>
            <p className="text-xs leading-4 text-white">{currentRole}</p>
          </div>
        </NavLink>

        {hasMultipleSystems && (
          <button
            className={`${baseButtonClasses} mb-1 text-[#8e96cf] hover:bg-white/5 hover:text-white`}
            onClick={handleSwitchToVrms}
            title="Switch to VRMS"
            type="button"
          >
            <LayoutGrid size={20} strokeWidth={1.7} />
            <span className={labelRevealClasses}>Switch to VRMS</span>
          </button>
        )}

        <button
          className={`${baseButtonClasses} text-[#ef4444] hover:bg-red-500/10`}
          onClick={() => setIsLogoutModalOpen(true)}
          title="Sign Out"
          type="button"
        >
          <LogOut size={20} strokeWidth={1.7} />
          <span className={labelRevealClasses}>Sign Out</span>
        </button>
      </div>
    </aside>
    <ConfirmationModal
      isOpen={isLogoutModalOpen}
      title="Confirm Sign Out"
      message="Are you sure you want to sign out of your account?"
      onConfirm={handleSignOut}
      onCancel={() => setIsLogoutModalOpen(false)}
      confirmLabel="Sign Out"
      variant="danger"
    />
    </>
  );
}
