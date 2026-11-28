import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  FileText,
  Fuel,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal } from "../ui";
import { fetchJSON } from "../../lib/api/httpClient";
import { useAuthStore } from "../../store/authStore";

interface NotificationRecord {
  id: string;
  source: "general" | "maintenance";
  category: "MAINTENANCE" | "FUEL" | "REPORT" | "GENERAL";
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
  actionTarget: { type: string; id: string | null } | null;
}

interface NotificationInboxResponse {
  items: NotificationRecord[];
  nextCursor: string | null;
  counts: { total: number; unread: number };
}

const categoryMeta: Record<
  NotificationRecord["category"],
  { label: string; className: string; icon: LucideIcon }
> = {
  MAINTENANCE: { label: "Maintenance", className: "bg-indigo-50 text-indigo-800", icon: Wrench },
  FUEL: { label: "Fuel", className: "bg-amber-50 text-amber-900", icon: Fuel },
  REPORT: { label: "Report", className: "bg-blue-50 text-blue-800", icon: FileText },
  GENERAL: { label: "General", className: "bg-slate-100 text-slate-700", icon: Bell },
};

function hasKnownAction(target: NotificationRecord["actionTarget"]): boolean {
  if (!target) return false;
  if (target.type === "MAINTENANCE_SCHEDULE") return Boolean(target.id);
  return target.type === "FUEL_MANAGEMENT" || target.type === "REPORTS";
}

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const routeMeta: Record<string, { group: string; label: string }> = {
  "/dashboard": { group: "Overview", label: "Dashboard" },
  "/ai-analytics": { group: "Overview", label: "Analytics" },
  "/vehicles": { group: "Assets", label: "Fleet Vehicles" },
  "/garages": { group: "Assets", label: "Service Garages" },
  "/outsourced-providers": { group: "Assets", label: "Outsourced Providers" },
  "/maintenance-scheduling": { group: "Operations", label: "Scheduling" },
  "/work-orders": { group: "Operations", label: "Work Orders" },
  "/checklist-templates": { group: "Operations", label: "Checklists" },
  "/maintenance-logs": { group: "Operations", label: "Service Logs" },
  "/maintenance-reports": { group: "Operations", label: "Reports" },
  "/fuel-management": { group: "Finance", label: "Fuel Management" },
  "/maintenance-costing": { group: "Finance", label: "Maintenance Costing" },
  "/audit-logs": { group: "Administration", label: "Audit Logs" },
  "/settings": { group: "Administration", label: "Settings" },
  "/profile": { group: "Account", label: "Profile" },
};

function breadcrumbForPath(pathname: string): { group: string; label: string } {
  const exact = routeMeta[pathname];
  if (exact) return exact;

  const segment = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
  const label = segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { group: "VMMS", label: label || "Dashboard" };
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const userId = currentUser?.id ?? null;
  const { group: currentGroup, label: currentLabel } = breadcrumbForPath(pathname);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState({ total: 0, unread: 0 });
  const [notificationUserId, setNotificationUserId] = useState(userId);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [readFilter, setReadFilter] = useState("ALL");
  const requestUserId = useRef(userId);

  const loadNotifications = useCallback(async (cursor?: string, append = false) => {
    if (!userId) {
      setNotifications([]);
      setCounts({ total: 0, unread: 0 });
      setNextCursor(null);
      return;
    }

    try {
      if (append) setIsLoadingMore(true);
      else setIsLoadingNotifications(true);
      setNotificationError(null);
      const params = new URLSearchParams({ limit: "30", readState: readFilter });
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (cursor) params.set("cursor", cursor);
      const response = await fetchJSON<NotificationInboxResponse>(`/notifications/inbox?${params.toString()}`);
      if (requestUserId.current !== userId) return;
      setNotifications((current) => append ? [...current, ...response.items] : response.items);
      setCounts(response.counts);
      setNextCursor(response.nextCursor);
    } catch (error) {
      if (requestUserId.current === userId) {
        setNotificationError(error instanceof Error ? error.message : "Unable to load notifications.");
      }
    } finally {
      if (requestUserId.current === userId) {
        setIsLoadingNotifications(false);
        setIsLoadingMore(false);
      }
    }
  }, [categoryFilter, readFilter, userId]);

  useEffect(() => {
    const userChanged = requestUserId.current !== userId;
    requestUserId.current = userId;
    if (userChanged) {
      setNotificationUserId(userId);
    }
    if (!userId) return;
    if (userChanged) {
      setNotifications([]);
      setCounts({ total: 0, unread: 0 });
      setNextCursor(null);
    }
    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [userId, loadNotifications]);

  const markNotificationAsRead = async (notification: NotificationRecord) => {
    try {
      const result = await fetchJSON<{ updated: number }>(
        `/notifications/inbox/${notification.source}/${notification.id}/read`,
        {
          method: "PATCH",
        },
      );
      if (requestUserId.current !== userId) return;
      setNotificationError(null);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id && item.source === notification.source
            ? { ...item, isRead: true }
            : item,
        ),
      );
      if (!notification.isRead && result.updated > 0) {
        setCounts((current) => ({
          ...current,
          unread: Math.max(0, current.unread - 1),
        }));
      }
    } catch (error) {
      if (requestUserId.current === userId) {
        setNotificationError(error instanceof Error ? error.message : "Unable to mark the notification as read.");
      }
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!userId || isMarkingAllRead || visibleCounts.unread === 0) return;

    setIsMarkingAllRead(true);
    try {
      await fetchJSON<{ updated: number }>("/notifications/inbox/read-all", { method: "PATCH" });
      if (requestUserId.current !== userId) return;
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
      setCounts((current) => ({ ...current, unread: 0 }));
      setNotificationError(null);
    } catch (error) {
      if (requestUserId.current === userId) {
        setNotificationError(error instanceof Error ? error.message : "Unable to mark notifications as read.");
      }
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const hasCurrentUserData = notificationUserId === userId;
  const visibleNotifications = hasCurrentUserData ? notifications : [];
  const visibleCounts = hasCurrentUserData ? counts : { total: 0, unread: 0 };
  const visibleNextCursor = hasCurrentUserData ? nextCursor : null;
  const visibleError = hasCurrentUserData ? notificationError : null;
  const hasActiveFilters = categoryFilter !== "ALL" || readFilter !== "ALL";

  const openNotification = (notification: NotificationRecord) => {
    if (!notification.isRead) void markNotificationAsRead(notification);
    const target = notification.actionTarget;
    if (!target?.id) {
      if (target?.type === "FUEL_MANAGEMENT") {
        setIsNotificationsOpen(false);
        navigate("/fuel-management");
      } else if (target?.type === "REPORTS") {
        setIsNotificationsOpen(false);
        navigate("/maintenance-reports");
      }
      return;
    }
    if (target.type === "MAINTENANCE_SCHEDULE") {
      setIsNotificationsOpen(false);
      navigate(`/maintenance-scheduling?search=${encodeURIComponent(target.id)}`);
    } else if (target.type === "FUEL_MANAGEMENT") {
      setIsNotificationsOpen(false);
      navigate("/fuel-management");
    } else if (target.type === "REPORTS") {
      setIsNotificationsOpen(false);
      navigate("/maintenance-reports");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 text-sm">
            <li className="text-[var(--color-text-secondary)]">{currentGroup}</li>
            <li aria-hidden="true" className="text-[var(--color-text-secondary)]">
              <ChevronRight className="size-4" />
            </li>
            <li
              aria-current="page"
              className="truncate font-medium text-[var(--color-text-primary)]"
            >
              {currentLabel}
            </li>
          </ol>
        </nav>

        <button
          type="button"
          onClick={() => setIsNotificationsOpen(true)}
          title="Notifications"
          aria-label={`Notifications${visibleCounts.unread ? `, ${visibleCounts.unread} unread` : ""}`}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] transition-colors hover:bg-slate-50 hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30"
        >
          <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
          {visibleCounts.unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e8b800] px-1 text-[9px] font-bold text-[#0f1445]">
              {visibleCounts.unread > 99 ? "99+" : visibleCounts.unread}
            </span>
          )}
        </button>
      </header>

      <Modal
        isOpen={isNotificationsOpen}
        title={
          <span className="flex items-center gap-3">
            Notifications
            <span className="rounded-full bg-[#eef0fa] px-2.5 py-1 text-xs font-semibold text-[#1a1f6e]">
              {visibleCounts.unread} unread
            </span>
          </span>
        }
        onClose={() => setIsNotificationsOpen(false)}
        size="lg"
        className="!max-w-3xl !h-[min(84dvh,48rem)] !max-h-[calc(100dvh-1rem)] !p-0 flex flex-col overflow-hidden"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void markAllNotificationsAsRead()}
              disabled={visibleCounts.unread === 0 || isMarkingAllRead}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-primary)] transition-colors hover:bg-[var(--color-card-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed sm:w-auto"
            >
              {isMarkingAllRead ? "Marking notifications read..." : "Mark all read"}
            </button>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(false)}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] sm:w-auto"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 pb-1">
          <div className="flex flex-col gap-3 border-b border-[var(--color-divider)] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <p aria-live="polite" className="text-sm font-medium text-[var(--color-text-secondary)]">
              {visibleCounts.unread} unread <span aria-hidden="true">·</span> {visibleCounts.total} total
            </p>
            <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
              <label
                className="grid min-w-0 gap-1 text-xs font-semibold text-[var(--color-text-secondary)]"
                htmlFor="notification-category-filter"
              >
                Category
                <select
                  id="notification-category-filter"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="min-h-10 w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 text-sm font-normal text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
                >
                  <option value="ALL">All categories</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="FUEL">Fuel</option>
                  <option value="REPORT">Reports</option>
                  <option value="GENERAL">General</option>
                </select>
              </label>
              <label
                className="grid min-w-0 gap-1 text-xs font-semibold text-[var(--color-text-secondary)]"
                htmlFor="notification-read-filter"
              >
                Read state
                <select
                  id="notification-read-filter"
                  value={readFilter}
                  onChange={(event) => setReadFilter(event.target.value)}
                  className="min-h-10 w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 text-sm font-normal text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
                >
                  <option value="ALL">All states</option>
                  <option value="UNREAD">Unread</option>
                  <option value="READ">Read</option>
                </select>
              </label>
            </div>
          </div>
          {isLoadingNotifications && visibleNotifications.length > 0 ? (
            <p role="status" className="text-xs text-[var(--color-text-secondary)]">
              Updating notifications...
            </p>
          ) : null}
          {visibleError ? (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
              <span className="break-words">{visibleError}</span>
              <button type="button" onClick={() => void loadNotifications()} className="shrink-0 self-start font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800 sm:self-auto">
                Retry
              </button>
            </div>
          ) : null}
          {isLoadingNotifications && visibleNotifications.length === 0 ? (
            <p role="status" aria-live="polite" className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              Loading notifications...
            </p>
          ) : visibleError && visibleNotifications.length === 0 ? null : visibleNotifications.length === 0 ? (
            <div role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-10 text-center">
              <Bell className="mx-auto size-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
                {hasActiveFilters ? "No notifications match these filters" : "You're all caught up"}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {hasActiveFilters
                  ? "Clear the filters to see more notifications."
                  : "Updates from maintenance, fuel, reports, and other VMMS activity appear here."}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("ALL");
                    setReadFilter("ALL");
                  }}
                  className="mt-4 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-brand-primary)] hover:bg-[var(--color-card-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
              {visibleNotifications.map((notification) => {
                const critical = notification.severity.toUpperCase() === "CRITICAL";
                const actionable = hasKnownAction(notification.actionTarget);
                const category = categoryMeta[notification.category];
                const CategoryIcon = category.icon;
                return (
                  <li key={`${notification.source}-${notification.id}`} className="border-b border-[var(--color-divider)] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      disabled={notification.isRead && !actionable}
                      aria-label={`${notification.title}. ${notification.message}. ${notification.isRead ? "Read." : "Unread."}${actionable ? " Open related item." : notification.isRead ? "" : " Mark as read."}`}
                      className={`group flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--color-card-bg-hover)] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-default disabled:opacity-100 ${
                        notification.isRead ? "" : "bg-[#fffaf0] hover:bg-[#fff6df]"
                      }`}
                    >
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${category.className}`}>
                        <CategoryIcon size={15} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`break-words text-sm font-semibold ${critical ? "text-red-900" : "text-[var(--color-text-primary)]"}`}>
                            {notification.title}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${category.className}`}>
                            {category.label}
                          </span>
                          {critical ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-900">
                              <AlertTriangle size={12} aria-hidden="true" />
                              Critical
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1 block break-words text-sm leading-5 text-[var(--color-text-secondary)]">
                          {notification.message}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                          <time dateTime={notification.createdAt} title={notification.createdAt}>
                            {formatNotificationDate(notification.createdAt)}
                          </time>
                          {actionable ? (
                            <span className="font-semibold text-[var(--color-brand-primary)]">Open related item</span>
                          ) : !notification.isRead ? (
                            <span className="font-semibold text-[var(--color-brand-primary)]">Mark as read</span>
                          ) : null}
                        </span>
                      </span>
                      {!notification.isRead ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#d7a900]" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {visibleNextCursor ? (
            <button
              type="button"
              onClick={() => void loadNotifications(visibleNextCursor, true)}
              disabled={isLoadingMore}
              className="min-h-10 w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-primary)] transition-colors hover:bg-[var(--color-card-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
            >
              {isLoadingMore ? "Loading..." : "Load older notifications"}
            </button>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
