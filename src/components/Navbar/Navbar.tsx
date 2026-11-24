import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, ChevronRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Modal } from "../ui";
import { fetchJSON } from "../../lib/api/httpClient";
import { useAuthStore } from "../../store/authStore";

interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  createdAt: string;
  maintenanceScheduleId?: string | null;
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
  const { group: currentGroup, label: currentLabel } = breadcrumbForPath(pathname);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    try {
      setIsLoadingNotifications(true);
      const nextNotifications = await fetchJSON<NotificationRecord[]>("/notifications");
      setNotifications(Array.isArray(nextNotifications) ? nextNotifications : []);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      // Do not retain one user's notifications after sign-out or account switching.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotifications([]);
      return;
    }
    // Defer the initial request so its loading state is applied after this effect completes.
    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [currentUser, loadNotifications]);

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const updatedNotification = await fetchJSON<NotificationRecord>(`/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: updatedNotification.isRead } : notification,
        ),
      );
    } catch {
      // Ignore update failures and keep the UI responsive.
    }
  };

  const unreadNotificationCount = notifications.filter((notification) => !notification.isRead).length;

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
          aria-label="Notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] transition-colors hover:bg-slate-50 hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30"
        >
          <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
          {unreadNotificationCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e8b800] px-1 text-[9px] font-bold text-[#0f1445]">
              {unreadNotificationCount}
            </span>
          )}
        </button>
      </header>

      <Modal
        isOpen={isNotificationsOpen}
        title="Notifications"
        onClose={() => setIsNotificationsOpen(false)}
        size="lg"
        className="max-w-2xl"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(false)}
              className="rounded-lg bg-[#070b45] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#111a62]"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {isLoadingNotifications ? (
            <p className="text-xs text-[#8a98ad]">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-[#8a98ad]">You have no new notifications.</p>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  void markNotificationAsRead(notification.id);
                  if (notification.maintenanceScheduleId) {
                    setIsNotificationsOpen(false);
                    navigate(
                      `/maintenance-scheduling?search=${encodeURIComponent(notification.maintenanceScheduleId)}`,
                    );
                  }
                }}
                aria-label={`${notification.title}. ${notification.message}${notification.maintenanceScheduleId ? ". Open work order." : ". Mark as read."}`}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  notification.title === "Critical maintenance escalation"
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
                      {notification.title === "Critical maintenance escalation" ? (
                        <AlertTriangle size={15} className="text-red-700" aria-hidden="true" />
                      ) : null}
                      <p
                        className={`text-sm font-bold ${
                          notification.title === "Critical maintenance escalation"
                            ? "text-red-900"
                            : "text-[#141827]"
                        }`}
                      >
                        {notification.title}
                      </p>
                      {notification.title === "Critical maintenance escalation" ? (
                        <span className="rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                          CRITICAL
                        </span>
                      ) : null}
                      {/fleet .*report/i.test(notification.title) ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-blue-800">
                          SCHEDULED REPORT
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[#667085]">{notification.message}</p>
                  </div>
                  {!notification.isRead && (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f4c400]" />
                  )}
                </div>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-[#8a98ad]">
                  {new Date(notification.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                {notification.maintenanceScheduleId ? (
                  <p className="mt-2 text-xs font-semibold text-[#1a1f6e]">Open overdue work order â†’</p>
                ) : null}
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
