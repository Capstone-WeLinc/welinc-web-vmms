import type { UserRecord } from "../../lib/api/authService";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { isMechanicRole, isOperationsRole, isChiefMechanicRole } from "../../lib/utils/permissions";
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
  FileBarChart2,
  Fuel,
  DollarSign,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

interface SidebarProps {
  currentUser?: UserRecord | null;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

interface NavGroup {
  category: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    category: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Analytics", icon: BrainCircuit, path: "/ai-analytics" },
    ],
  },
  {
    category: "Fleet & Facilities",
    items: [
      { label: "Fleet Vehicles", icon: Truck, path: "/vehicles" },
      { label: "Service Garages", icon: Warehouse, path: "/garages" },
    ],
  },
  {
    category: "Maintenance",
    items: [
      { label: "Scheduling", icon: CalendarClock, path: "/maintenance-scheduling" },
      { label: "Work Orders", icon: Wrench, path: "/work-orders" },
      { label: "Checklists", icon: ClipboardCheck, path: "/checklist-templates" },
      { label: "Service Logs", icon: ClipboardList, path: "/maintenance-logs" },
      { label: "Reports", icon: FileBarChart2, path: "/maintenance-reports" },
    ],
  },
  {
    category: "Operations & Costs",
    items: [
      { label: "Fuel Records", icon: Fuel, path: "/fuel-management" },
      { label: "Profitability", icon: DollarSign, path: "/expense-profitability" },
    ],
  },
  {
    category: "Administration",
    items: [
      { label: "User Management", icon: Users, path: "/users" },
    ],
  },
];

const roleLabelMap: Record<string, string> = {
  ADMIN: "Administrator",
  OPERATIONS: "Operations",
  MECHANIC: "Mechanic",
  CHIEF_MECHANIC: "Chief Mechanic",
};

const asideBaseClasses =
  "group/sidebar fixed left-0 top-0 z-50 flex h-screen w-20 flex-col overflow-hidden border-r border-[#111a62] bg-[#020849] shadow-[10px_0_32px_rgba(2,8,73,0.28)] transition-[width,box-shadow] duration-300 ease-out hover:w-[280px] hover:shadow-[18px_0_42px_rgba(2,8,73,0.34)]";
const headerClasses =
  "flex h-20 items-center gap-0 border-b border-white/10 px-5 transition-all duration-300 group-hover/sidebar:gap-3 shrink-0";
const logoFrameClasses =
  "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#f4c400]/80 bg-[#061056] shadow-[0_0_0_1px_rgba(244,196,0,0.15)]";
const labelRevealClasses =
  "max-w-0 min-w-0 translate-x-2 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover/sidebar:max-w-[190px] group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100";
const navClasses =
  "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-3 px-2 space-y-3.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full";
const footerClasses = "border-t border-white/10 px-3 py-3 shrink-0 bg-[#020849]/90 backdrop-blur-sm";
const baseButtonClasses =
  "mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-sm font-semibold transition-all duration-200 group-hover/sidebar:mx-0 group-hover/sidebar:w-full group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3.5";

const getNavLinkClass = (isActive: boolean) => {
  const base =
    "mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-sm font-medium tracking-tight transition-all duration-200 group-hover/sidebar:mx-0 group-hover/sidebar:w-full group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3.5";
  if (isActive) {
    return `${base} bg-[#f4c400] text-[#030737] font-bold shadow-[0_4px_16px_rgba(244,196,0,0.25)]`;
  }
  return `${base} text-[#9ba4db] hover:bg-white/10 hover:text-white`;
};

export default function Sidebar({ currentUser }: SidebarProps) {
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const isMechanic = isMechanicRole(currentUser);
  const isOperations = isOperationsRole(currentUser);
  const isChiefMechanic = isChiefMechanicRole(currentUser);

  const isPathAllowed = (path: string) => {
    if (isMechanic) {
      return ["/dashboard", "/work-orders", "/maintenance-logs"].includes(path);
    }
    if (isChiefMechanic) {
      return [
        "/dashboard",
        "/vehicles",
        "/garages",
        "/maintenance-scheduling",
        "/work-orders",
        "/maintenance-logs",
        "/maintenance-reports",
      ].includes(path);
    }
    if (isOperations) {
      return [
        "/dashboard",
        "/vehicles",
        "/garages",
        "/users",
        "/maintenance-scheduling",
        "/work-orders",
        "/maintenance-logs",
        "/maintenance-reports",
        "/fuel-management",
        "/ai-analytics",
      ].includes(path);
    }
    return true;
  };

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isPathAllowed(item.path)),
    }))
    .filter((group) => group.items.length > 0);

  const getSubsystemCount = () => {
    try {
      const token = window.localStorage.getItem("accessToken");
      if (!token) return 0;
      const [, payload] = token.split(".");
      if (!payload) return 0;
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      );
      const decoded = JSON.parse(json) as { roles?: { system: string }[] };
      const subsystemRoles = (decoded.roles || []).filter((r) =>
        ["VRMS", "VMMS", "BMS"].includes(r.system.toUpperCase()),
      );
      const uniqueSystems = new Set(subsystemRoles.map((r) => r.system.toUpperCase()));
      return uniqueSystems.size;
    } catch (err) {
      console.error("Error parsing token to count subsystems:", err);
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
    const token = window.localStorage.getItem("accessToken");
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
            <p className="text-base font-extrabold leading-5 text-white">WeLinc Logistics</p>
            <p className="mt-0.5 text-[10px] font-medium leading-3 text-[#9ba4db]">
              Vehicle Maintenance (VMMS)
            </p>
          </div>
        </div>

        <nav className={navClasses}>
          {visibleGroups.map((group, groupIdx) => (
            <div key={group.category} className="space-y-1">
              {/* Group Heading on hover, subtle line when collapsed */}
              {groupIdx > 0 && (
                <div className="mx-2 my-1 border-t border-white/5 group-hover/sidebar:border-transparent" />
              )}
              <div className="px-3 pt-1 pb-0.5 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-[200px] group-hover/sidebar:opacity-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#f4c400]/90">
                  {group.category}
                </span>
              </div>
              <ul className="m-0 p-0 list-none space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      title={item.label}
                      className={({ isActive }) => getNavLinkClass(isActive)}
                    >
                      <item.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.9} />
                      <span className={labelRevealClasses}>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className={footerClasses}>
          <NavLink
            to="/profile"
            title="Profile"
            className="mb-2.5 flex items-center justify-center gap-0 rounded-lg p-1.5 transition-all duration-200 hover:bg-white/10 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4c400] text-xs font-extrabold text-[#030737] shadow-sm">
              {currentInitials}
            </div>
            <div className={labelRevealClasses}>
              <p className="text-xs font-bold leading-4 text-white truncate max-w-[140px]">
                {currentUser ? currentUser.name : "Admin User"}
              </p>
              <p className="text-[10px] font-medium leading-3 text-[#9ba4db]">{currentRole}</p>
            </div>
          </NavLink>

          {hasMultipleSystems && (
            <button
              className={`${baseButtonClasses} mb-1 text-[#9ba4db] hover:bg-white/10 hover:text-white`}
              onClick={handleSwitchToVrms}
              title="Switch to VRMS"
              type="button"
            >
              <LayoutGrid size={18} strokeWidth={1.8} />
              <span className={labelRevealClasses}>Switch to VRMS</span>
            </button>
          )}

          <button
            className={`${baseButtonClasses} text-[#ef4444] hover:bg-red-500/15`}
            onClick={() => setIsLogoutModalOpen(true)}
            title="Sign Out"
            type="button"
          >
            <LogOut size={18} strokeWidth={1.8} />
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
