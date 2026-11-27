import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, ChevronRight } from "lucide-react";
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
    }
  };

  const hasCurrentUserData = notificationUserId === userId;
  const visibleNotifications = hasCurrentUserData ? notifications : [];
  const visibleCounts = hasCurrentUserData ? counts : { total: 0, unread: 0 };
  const visibleNextCursor = hasCurrentUserData ? nextCursor : null;
  const visibleError = hasCurrentUserData ? notificationError : null;

  const openNotification = (notification: NotificationRecord) => {
    void markNotificationAsRead(notification);
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
        title="Notifications"
        onClose={() => setIsNotificationsOpen(false)}
        size="lg"
        className="!max-w-5xl !h-[85dvh] !max-h-[calc(100dvh-2rem)] !p-0 flex flex-col overflow-hidden"
        footer={
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => void markAllNotificationsAsRead()}
              disabled={visibleCounts.unread === 0}
              className="rounded-lg border border-[#dce3ed] px-4 py-2 text-sm font-semibold text-[#1a1f6e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(false)}
              className="rounded-lg bg-[#070b45] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#111a62]"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="h-full space-y-4 overflow-y-auto pr-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#667085]">
              {visibleCounts.unread} unread · {visibleCounts.total} total
            </p>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="notification-category-filter">Filter by category</label>
              <select
                id="notification-category-filter"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded-lg border border-[#dce3ed] bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">All categories</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="FUEL">Fuel</option>
                <option value="REPORT">Reports</option>
                <option value="GENERAL">General</option>
              </select>
              <label className="sr-only" htmlFor="notification-read-filter">Filter by read state</label>
              <select
                id="notification-read-filter"
                value={readFilter}
                onChange={(event) => setReadFilter(event.target.value)}
                className="rounded-lg border border-[#dce3ed] bg-white px-3 py-2 text-sm"
              >
                <option value="ALL">All states</option>
                <option value="UNREAD">Unread</option>
                <option value="READ">Read</option>
              </select>
            </div>
          </div>
          {visibleError ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <span>{visibleError}</span>
              <button type="button" onClick={() => void loadNotifications()} className="font-semibold underline">
                Retry
              </button>
            </div>
          ) : null}
          {isLoadingNotifications && visibleNotifications.length === 0 ? (
            <p className="text-base text-[#667085]">Loading notifications...</p>
          ) : visibleNotifications.length === 0 ? (
            <p className="text-base text-[#667085]">No notifications match this filter.</p>
          ) : (
            visibleNotifications.map((notification) => (
              <button
                key={`${notification.source}-${notification.id}`}
                type="button"
                onClick={() => openNotification(notification)}
                aria-label={`${notification.title}. ${notification.message}${notification.actionTarget ? ". Open related item." : ". Mark as read."}`}
                className={`w-full rounded-lg border p-5 text-left transition ${
                  notification.title === "Critical maintenance escalation" || notification.title === "Critical fuel anomaly"
                    ? notification.isRead
                      ? "border-red-300 bg-red-50"
                      : "border-red-500 bg-red-50 ring-1 ring-red-200"
                    : notification.isRead
                      ? "border-[#dce3ed] bg-[#f7f9fc]"
                      : "border-[#f4c400]/60 bg-[#fffaf0]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {notification.title === "Critical maintenance escalation" || notification.title === "Critical fuel anomaly" ? (
                        <AlertTriangle size={18} className="text-red-700" aria-hidden="true" />
                      ) : null}
                      <p
                        className={`text-lg font-bold ${
                          notification.title === "Critical maintenance escalation" || notification.title === "Critical fuel anomaly"
                            ? "text-red-900"
                            : "text-[#141827]"
                        }`}
                      >
                        {notification.title}
                      </p>
                      {notification.title === "Critical maintenance escalation" || notification.title === "Critical fuel anomaly" ? (
                        <span className="rounded-full bg-red-700 px-2.5 py-1 text-xs font-extrabold tracking-wide text-white">
                          CRITICAL
                        </span>
                      ) : null}
                      {/fleet .*report/i.test(notification.title) ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold tracking-wide text-blue-800">
                          SCHEDULED REPORT
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base leading-6 text-[#667085]">{notification.message}</p>
                  </div>
                  {!notification.isRead && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f4c400]" />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium uppercase tracking-wide text-[#667085]">
                  {new Date(notification.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                {notification.actionTarget ? (
                  <p className="mt-3 text-sm font-semibold text-[#1a1f6e]">Open related item →</p>
                ) : null}
              </button>
            ))
          )}
          {visibleNextCursor ? (
            <button
              type="button"
              onClick={() => void loadNotifications(visibleNextCursor, true)}
              disabled={isLoadingMore}
              className="w-full rounded-lg border border-[#dce3ed] px-4 py-3 text-sm font-semibold text-[#1a1f6e] disabled:opacity-50"
            >
              {isLoadingMore ? "Loading..." : "Load older notifications"}
            </button>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
