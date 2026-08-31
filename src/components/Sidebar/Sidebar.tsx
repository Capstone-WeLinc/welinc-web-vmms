import type { UserRecord } from "../../lib/api/authService";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  ChevronDown,
  Compass,
  Building2,
  FolderKanban,
  Layers,
  ShieldCheck,
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
  icon: LucideIcon;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    category: "Overview",
    icon: Compass,
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Analytics", icon: BrainCircuit, path: "/ai-analytics" },
    ],
  },
  {
    category: "Fleet & Facilities",
    icon: Building2,
    items: [
      { label: "Fleet Vehicles", icon: Truck, path: "/vehicles" },
      { label: "Service Garages", icon: Warehouse, path: "/garages" },
    ],
  },
  {
    category: "Maintenance",
    icon: FolderKanban,
    items: [
      { label: "Scheduling", icon: CalendarClock, path: "/maintenance-scheduling" },
      { label: "Work Orders", icon: Wrench, path: "/work-orders" },
      { label: "Checklists", icon: ClipboardCheck, path: "/checklist-templates" },
      { label: "Service Logs", icon: ClipboardList, path: "/maintenance-logs" },
      { label: "Reports", icon: FileBarChart2, path: "/maintenance-reports" },
    ],
  },
  {
    category: "Operations",
    icon: Layers,
    items: [
      { label: "Fuel Management", icon: Fuel, path: "/fuel-management" },
      { label: "Expense & Profitability", icon: DollarSign, path: "/expense-profitability" },
    ],
  },
  {
    category: "Administration",
    icon: ShieldCheck,
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
  "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-3 px-2 space-y-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full";
const footerClasses = "border-t border-white/10 px-3 py-3 shrink-0 bg-[#020849]/90 backdrop-blur-sm";
const baseButtonClasses =
  "mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-sm font-semibold transition-all duration-200 group-hover/sidebar:mx-0 group-hover/sidebar:w-full group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3.5";

const getNavLinkClass = (isActive: boolean) => {
  const base =
    "mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-sm font-medium tracking-tight transition-all duration-200 group-hover/sidebar:mx-0 group-hover/sidebar:w-[calc(100%-0.5rem)] group-hover/sidebar:ml-1.5 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3";
  if (isActive) {
    return `${base} bg-[#f4c400] text-[#030737] font-bold shadow-[0_4px_16px_rgba(244,196,0,0.25)]`;
  }
  return `${base} text-[#9ba4db] hover:bg-white/10 hover:text-white`;
};

const isItemActive = (itemPath: string, currentPath: string) => {
  if (itemPath === "/dashboard") {
    return currentPath === "/dashboard" || currentPath === "/";
  }
  return currentPath === itemPath || (itemPath !== "/" && currentPath.startsWith(itemPath + "/"));
};

export default function Sidebar({ currentUser }: SidebarProps) {
  const location = useLocation();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const isMechanic = isMechanicRole(currentUser);
  const isOperations = isOperationsRole(currentUser);
  const isChiefMechanic = isChiefMechanicRole(currentUser);

  const visibleGroups = useMemo(() => {
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
          "/expense-profitability",
          "/ai-analytics",
        ].includes(path);
      }
      return true;
    };

    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isPathAllowed(item.path)),
      }))
      .filter((group) => group.items.length > 0);
  }, [isMechanic, isChiefMechanic, isOperations]);

  const findActiveGroupCategory = useCallback(
    (pathname: string): string | null => {
      for (const group of visibleGroups) {
        if (group.items.some((item) => isItemActive(item.path, pathname))) {
          return group.category;
        }
      }
      return null;
    },
    [visibleGroups],
  );

  // Initialize expanded group based on active route
  const [expandedCategory, setExpandedCategory] = useState<string | null>(() => {
    return findActiveGroupCategory(location.pathname) ?? visibleGroups[0]?.category ?? null;
  });

  const lastPathRef = useRef(location.pathname);

  // Automatically expand the group containing the active page ONLY when route changes
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      lastPathRef.current = location.pathname;
      const activeCategory = findActiveGroupCategory(location.pathname);
      if (activeCategory) {
        setExpandedCategory(activeCategory);
      }
    }
  }, [location.pathname, findActiveGroupCategory]);

  const toggleGroup = (category: string) => {
    setExpandedCategory((prev) => (prev === category ? null : category));
  };

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
          {visibleGroups.map((group, groupIdx) => {
            const isExpanded = expandedCategory === group.category;
            const hasActiveChild = group.items.some((item) => isItemActive(item.path, location.pathname));
            const GroupIcon = group.icon;
            const groupId = `nav-group-${group.category.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

            return (
              <div key={group.category} className="space-y-1">
                {/* Subtle separator between groups */}
                {groupIdx > 0 && (
                  <div className="mx-2 my-1 border-t border-white/5" />
                )}

                {/* Collapsible Group Header Button */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.category)}
                  className={`group/header relative mx-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-left transition-all duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c400]/50 group-hover/sidebar:mx-0 group-hover/sidebar:h-auto group-hover/sidebar:w-full group-hover/sidebar:justify-between group-hover/sidebar:px-2.5 group-hover/sidebar:py-1.5 ${
                    isExpanded || hasActiveChild
                      ? "bg-white/[0.08] text-[#f4c400]"
                      : "text-[#9ba4db] hover:bg-white/5 hover:text-white"
                  }`}
                  aria-expanded={isExpanded}
                  aria-controls={groupId}
                  title={`${group.category} (${isExpanded ? "Expanded - Click to collapse" : "Collapsed - Click to expand"})`}
                >
                  <div className="flex items-center gap-0 group-hover/sidebar:gap-2.5 min-w-0">
                    <GroupIcon
                      className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        isExpanded || hasActiveChild
                          ? "text-[#f4c400]"
                          : "text-[#9ba4db] group-hover/header:text-white"
                      }`}
                      strokeWidth={2}
                    />
                    <span className="hidden select-none text-[10.5px] font-extrabold uppercase tracking-wider text-[#f4c400] transition-all duration-200 group-hover/sidebar:inline truncate">
                      {group.category}
                    </span>
                  </div>

                  {/* Active dot indicator in collapsed rail mode */}
                  {hasActiveChild && !isExpanded && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#f4c400] shadow-[0_0_8px_#f4c400] group-hover/sidebar:hidden" />
                  )}

                  {/* Chevron Icon in expanded sidebar mode */}
                  <ChevronDown
                    className={`hidden h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover/sidebar:inline ${
                      isExpanded
                        ? "rotate-0 text-[#f4c400]"
                        : "-rotate-90 text-[#9ba4db]/70 group-hover/header:text-white"
                    }`}
                    strokeWidth={2.2}
                  />
                </button>

                {/* Animated Collapsible Child Nav Items */}
                <div
                  id={groupId}
                  className={`grid transition-[grid-template-rows,opacity] duration-250 ease-in-out ${
                    isExpanded
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="overflow-hidden">
                    <ul className="m-0 list-none space-y-0.5 p-0 pt-0.5">
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
                </div>
              </div>
            );
          })}
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
