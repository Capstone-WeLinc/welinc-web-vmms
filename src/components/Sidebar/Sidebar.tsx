import type { UserRecord } from "../../lib/mocks/vmmsMocks";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  canSeeVmmsNavigationPath,
} from "../../lib/utils/permissions";
import { Button, ConfirmationModal, Modal } from "../ui";
import { PORTAL_URL, signOut } from "../../lib/session/session";
import logo from "../../assets/logo.png";
import {
  LayoutDashboard,
  LogOut,
  Users,
  CalendarClock,
  Wrench,
  ClipboardList,
  ClipboardCheck,
  BrainCircuit,
  FileBarChart2,
  Fuel,
  CircleDollarSign,
  Truck,
  Warehouse,
  ChevronDown,
  ChevronUp,
  Compass,
  Building2,
  FolderKanban,
  House,
  Layers,
  ShieldCheck,
  ScrollText,
  Settings2,
  type LucideIcon,
} from "lucide-react";

interface SidebarProps {
  currentUser?: UserRecord | null;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  externalHref?: string;
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
    category: "Assets",
    icon: Building2,
    items: [
      { label: "Fleet Vehicles", icon: Truck, path: "/vehicles" },
      { label: "Service Garages", icon: Warehouse, path: "/garages" },
      { label: "Outsourced Providers", icon: Warehouse, path: "/outsourced-providers" },
    ],
  },
  {
    category: "Operations",
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
    category: "Finance",
    icon: Layers,
    items: [
      { label: "Fuel Management", icon: Fuel, path: "/fuel-management" },
      { label: "Maintenance Costing", icon: CircleDollarSign, path: "/maintenance-costing" },
    ],
  },
  {
    category: "Administration",
    icon: ShieldCheck,
    items: [
      { label: "Settings", icon: Settings2, path: "/settings" },
      {
        label: "Manage people",
        icon: Users,
        path: "/admin/people?system=VMMS",
        externalHref: `${String(import.meta.env.VITE_PORTAL_URL ?? "").replace(/\/+$/, "")}/admin/people?system=VMMS`,
      },
      { label: "Audit Logs", icon: ScrollText, path: "/audit-logs" },
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
  "group/sidebar fixed left-0 top-0 z-50 flex h-screen w-20 flex-col overflow-hidden border-r border-white/[0.08] bg-[#0f1445] text-white transition-[width,box-shadow] duration-300 ease-out hover:w-[280px]";
const headerClasses =
  "flex h-20 items-center gap-0 border-b border-white/[0.08] px-5 transition-all duration-300 group-hover/sidebar:gap-3 shrink-0";
const logoFrameClasses =
  "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.08]";
const labelRevealClasses =
  "max-w-0 min-w-0 translate-x-2 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover/sidebar:max-w-[190px] group-hover/sidebar:translate-x-0 group-hover/sidebar:opacity-100";
const navClasses =
  "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-3 px-2 space-y-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full";
const footerClasses = "border-t border-white/[0.08] px-3 py-3 shrink-0 bg-[#0f1445]";
const baseButtonClasses =
  "mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-lg text-sm font-medium transition-all duration-200 group-hover/sidebar:mx-0 group-hover/sidebar:w-full group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3.5";

const getNavLinkClass = (isActive: boolean) => {
  const base =
    "mx-auto flex h-9 w-9 items-center justify-center gap-0 rounded-md text-sm font-medium tracking-tight transition-colors duration-200 group-hover/sidebar:mx-0 group-hover/sidebar:w-[calc(100%-0.5rem)] group-hover/sidebar:ml-1.5 group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-3 outline-none focus-visible:ring-2 focus-visible:ring-white/70";
  if (isActive) {
    return `${base} bg-white/[0.13] text-[#e8b800] font-semibold`;
  }
  return `${base} text-white/70 hover:bg-white/[0.08] hover:text-white`;
};

const isItemActive = (itemPath: string, currentPath: string) => {
  if (itemPath === "/dashboard") {
    return currentPath === "/dashboard" || currentPath === "/";
  }
  return currentPath === itemPath || (itemPath !== "/" && currentPath.startsWith(itemPath + "/"));
};

export default function Sidebar({ currentUser }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSignOutErrorOpen, setIsSignOutErrorOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [accountMenuPath, setAccountMenuPath] = useState(location.pathname);
  const [accountMenuExpanded, setAccountMenuExpanded] = useState(false);
  const [accountMenuPosition, setAccountMenuPosition] = useState<{
    left: number;
    bottom: number;
  } | null>(null);
  if (accountMenuPath !== location.pathname) {
    setAccountMenuPath(location.pathname);
    setAccountMenuExpanded(false);
    setAccountMenuPosition(null);
  }
  const isAccountMenuOpen =
    accountMenuPath === location.pathname && accountMenuExpanded;
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuPanelRef = useRef<HTMLDivElement | null>(null);

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          canSeeVmmsNavigationPath(item.path, currentUser),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [currentUser]);

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
        // Route changes should expand the matching group while preserving manual toggles otherwise.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpandedCategory(activeCategory);
      }
    }
  }, [location.pathname, findActiveGroupCategory]);

  const toggleGroup = (category: string) => {
    setExpandedCategory((prev) => (prev === category ? null : category));
  };

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (accountMenuRef.current?.contains(target) || accountMenuPanelRef.current?.contains(target)) {
        return;
      }
      setAccountMenuExpanded(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuExpanded(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const updatePosition = () => {
      const rect = accountMenuRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAccountMenuPosition({
        left: rect.left,
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isAccountMenuOpen]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const result = await signOut();
    setIsSigningOut(false);
    setIsLogoutModalOpen(false);
    if (result === "failed") setIsSignOutErrorOpen(true);
  };

  const retrySignOut = () => {
    setIsSignOutErrorOpen(false);
    void handleSignOut();
  };

  const handleBackToHome = () => {
    setAccountMenuExpanded(false);
    window.location.assign(PORTAL_URL ? `${PORTAL_URL}/` : "/");
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
  const showBackToHome = currentUser?.role !== "OPERATIONS";

  return (
    <>
      <aside className={asideBaseClasses} data-sidebar-mode="hover-expand">
        <div className={headerClasses}>
          <div className={logoFrameClasses}>
            <img src={logo} alt="WeLinc Logistics" className="h-full w-full object-cover" />
          </div>
          <div className={labelRevealClasses}>
            <p className="text-base font-extrabold leading-5 text-white">WeLinc Logistics</p>
            <p className="mt-0.5 text-[10px] font-medium leading-3 text-white/55">
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
                  <div className="mx-2 my-1 border-t border-white/[0.08]" />
                )}

                {/* Collapsible Group Header Button */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.category)}
                  className={`group/header relative mx-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 group-hover/sidebar:mx-0 group-hover/sidebar:h-auto group-hover/sidebar:w-full group-hover/sidebar:justify-between group-hover/sidebar:px-2.5 group-hover/sidebar:py-1.5 ${
                    isExpanded || hasActiveChild
                      ? "bg-white/[0.08] text-white"
                      : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                  }`}
                  aria-expanded={isExpanded}
                  aria-controls={groupId}
                  title={`${group.category} (${isExpanded ? "Expanded - Click to collapse" : "Collapsed - Click to expand"})`}
                >
                  <div className="flex items-center gap-0 group-hover/sidebar:gap-2.5 min-w-0">
                    <GroupIcon
                      className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        isExpanded || hasActiveChild
                          ? "text-white"
                          : "text-white/70 group-hover/header:text-white"
                      }`}
                      strokeWidth={2}
                    />
                    <span className="hidden select-none text-[10.5px] font-semibold uppercase tracking-wider text-white/55 transition-all duration-200 group-hover/sidebar:inline truncate">
                      {group.category}
                    </span>
                  </div>

                  {/* Active dot indicator in collapsed rail mode */}
                  {hasActiveChild && !isExpanded && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white/80 group-hover/sidebar:hidden" />
                  )}

                  {/* Chevron Icon in expanded sidebar mode */}
                  <ChevronDown
                    className={`hidden h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover/sidebar:inline ${
                      isExpanded
                        ? "rotate-0 text-white/70"
                        : "-rotate-90 text-white/55 group-hover/header:text-white"
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
                          {item.externalHref ? (
                            <a href={item.externalHref} target="_blank" rel="noreferrer" title={item.label} className={getNavLinkClass(false)}>
                              <item.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.9} />
                              <span className={labelRevealClasses}>{item.label}</span>
                            </a>
                          ) : (
                            <NavLink
                              to={item.path}
                              title={item.label}
                              className={({ isActive }) => getNavLinkClass(isActive)}
                            >
                              <item.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.9} />
                              <span className={labelRevealClasses}>{item.label}</span>
                            </NavLink>
                          )}
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
          {showBackToHome && (
            <button
              className={`${baseButtonClasses} mb-1 text-white/70 hover:bg-white/[0.08] hover:text-white`}
              onClick={handleBackToHome}
              title="Back to home"
              type="button"
            >
              <House size={18} strokeWidth={1.8} />
              <span className={labelRevealClasses}>Back to home</span>
            </button>
          )}

          <div ref={accountMenuRef} className="relative mt-1">
            {isAccountMenuOpen && accountMenuPosition && createPortal(
              <div
                ref={accountMenuPanelRef}
                role="menu"
                aria-label="Account menu"
                className="fixed z-[70] w-56 rounded-lg border border-white/[0.12] bg-[#1a2158] p-1.5 shadow-lg"
                style={{ left: accountMenuPosition.left, bottom: accountMenuPosition.bottom }}
              >
                <div className="border-b border-white/[0.08] px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-white">
                    {currentUser ? currentUser.name : "Admin User"}
                  </p>
                  <p className="truncate text-xs text-white/60">
                    {currentUser?.email ?? currentRole}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
                  onClick={() => {
                    setAccountMenuExpanded(false);
                    navigate("/profile");
                  }}
                >
                  <Users size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/15 hover:text-red-200"
                  onClick={() => {
                    setAccountMenuExpanded(false);
                    setIsLogoutModalOpen(true);
                  }}
                >
                  <LogOut size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>,
              document.body,
            )}

            <button
              type="button"
              onClick={() => {
                setAccountMenuPosition(null);
                setAccountMenuExpanded(!isAccountMenuOpen);
              }}
              aria-label={`Account menu for ${currentUser ? currentUser.name : "Admin User"}`}
              aria-expanded={isAccountMenuOpen}
              className="flex w-full items-center justify-center gap-0 rounded-md p-1.5 transition-colors duration-200 hover:bg-white/[0.08] group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
              title={currentUser ? currentUser.name : "Account"}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-xs font-bold text-white">
                {currentInitials}
              </div>
              <div className={labelRevealClasses}>
                <p className="max-w-[140px] truncate text-xs font-semibold leading-4 text-white">
                  {currentUser ? currentUser.name : "Admin User"}
                </p>
                <p className="text-[10px] font-medium leading-3 text-white/55">{currentRole}</p>
              </div>
              <ChevronUp
                size={14}
                className={`ml-auto hidden text-white/55 transition-transform group-hover/sidebar:block ${isAccountMenuOpen ? "" : "rotate-180"}`}
                aria-hidden="true"
              />
            </button>
          </div>
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

      <Modal
        isOpen={isSignOutErrorOpen}
        title="Couldn't sign out"
        message="VMMS could not reach the sign-in service, so your session may still be active. Check your connection and try again."
        onClose={() => setIsSignOutErrorOpen(false)}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsSignOutErrorOpen(false)}>
              Stay here
            </Button>
            <Button onClick={retrySignOut}>Try again</Button>
          </div>
        }
      />

    </>
  );
}


