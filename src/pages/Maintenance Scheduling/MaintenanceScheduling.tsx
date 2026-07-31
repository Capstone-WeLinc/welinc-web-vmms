import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  Plus,
  List,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  Bell,
  Edit2,
  RefreshCw,
  Ban,
  Power,
  PowerOff,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  Card,
  ActionMenu,
  ActionButton,
  ConfirmationModal,
  DataTable,
  DropdownSelect,
  FilterDropdown,
  LegendHelp,
  Modal,
  Pagination,
  SearchInput,
  SortSelect,
  StatusBadge as StandardStatusBadge,
  TableToolbar,
  ToastNotification,
} from "../../components/ui";
import CreateSchedule from "./CreateSchedule";
import {
  MaintenanceStatus,
  MaintenanceTriggerType,
  maintenanceStatusLabels,
  maintenanceTriggerTypeLabels,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  getMaintenanceSchedules,
  deleteMaintenanceSchedule,
  updateMaintenanceSchedule,
} from "../../lib/api/maintenanceService";
import { getVehicles, type VehicleOption } from "../../lib/api/vehicleService";
import { getGarages } from "../../lib/api/locationService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import {
  formatWorkOrderNumber,
  getCalculatedMaintenanceStatus,
  getOdometerActivationRange,
  getTimeBasedActivationDate,
  isInProgressStatus,
  isDueStatus,
  isOverdueStatus,
  isPendingStatus,
} from "../../lib/utils/workOrders";
import { isMechanicRole } from "../../lib/utils/permissions";
import { useAuthStore } from "../../store/authStore";

type GarageOption = { id: string; name: string };
type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};

type ScheduleStatusAction = "cancel" | "activate" | "deactivate";
type ScheduleSortField = "date" | "vehicle" | "workOrder" | "mechanic" | "status";
type SortDirection = "asc" | "desc";
type PendingScheduleAction = {
  action: ScheduleStatusAction;
  task: MaintenanceTask;
};

interface KPIStatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  subtitle: string;
  iconBgColor: string;
  iconColor: string;
}

const KPIStatCard = ({
  icon,
  value,
  label,
  subtitle,
  iconBgColor,
  iconColor,
}: KPIStatCardProps) => (
  <Card
    padding="none"
    className="p-5"
  >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
        <p className="mt-3 text-3xl font-bold text-[var(--color-text-primary)]">
          {value}
        </p>
        <p className="mt-2 text-sm font-medium" style={{ color: iconColor }}>
          {subtitle}
        </p>
      </div>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)]"
        style={{ background: iconBgColor, color: iconColor }}
      >
        {icon}
      </div>
    </div>
  </Card>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
}

const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) => {
  let variantClass = "";
  switch (variant) {
    case "primary":
      variantClass =
        "bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-dark)] text-white border border-[var(--color-brand-primary)]";
      break;
    case "secondary":
      variantClass =
        "bg-[var(--color-card-bg)] hover:bg-[var(--color-card-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]";
      break;
    case "danger":
      variantClass =
        "bg-[var(--color-status-error)]/15 text-[#c41c3b] hover:bg-[var(--color-status-error)]/25 border border-[var(--color-status-error)]/30";
      break;
    case "warning":
      variantClass =
        "bg-[var(--color-status-warning)]/15 text-[#92400e] hover:bg-[var(--color-status-warning)]/25 border border-[var(--color-status-warning)]/30";
      break;
  }

  let sizeClass = "";
  switch (size) {
    case "sm":
      sizeClass = "h-10 px-3 text-xs";
      break;
    case "md":
      sizeClass = "h-10 px-4 text-sm";
      break;
    case "lg":
      sizeClass = "h-10 px-6 text-base";
      break;
  }

  return (
    <button
      className={`inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 active:scale-95 focus:outline-hidden ${variantClass} ${sizeClass} ${className}`}
      onClick={props.onClick}
      disabled={props.disabled}
      type={props.type || "button"}
      title={props.title}
    >
      {props.children}
    </button>
  );
};

const StatusBadge = ({ status }: { status: MaintenanceStatus }) => {
  const getStatusDetails = () => {
    switch (status) {
      case MaintenanceStatus.OVERDUE:
        return "border-[#fca5a5] bg-[#fee2e2] text-[#dc2626]";
      case MaintenanceStatus.DUE:
        return "border-[#93c5fd] bg-[#dbeafe] text-[#2563eb]";
      case MaintenanceStatus.IN_PROGRESS:
        return "border-[#5eead4] bg-[#ccfbf1] text-[#0f766e]";
      case MaintenanceStatus.COMPLETED:
        return "border-[#86efac] bg-[#dcfce7] text-[#059669]";
      case MaintenanceStatus.CANCELLED:
        return "border-[#fca5a5] bg-[#fee2e2] text-[#dc2626]";
      case MaintenanceStatus.PENDING:
      default:
        return "border-[#fcd34d] bg-[#fef3c7] text-[#d97706]";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusDetails()}`}
    >
      {maintenanceStatusLabels[status] ?? status}
    </span>
  );
};

const formatScheduleDate = (task: MaintenanceTask) =>
  task.startReferenceDate || task.date || "Not scheduled";

const formatNextDueDate = (task: MaintenanceTask) => {
  if (task.triggerType === MaintenanceTriggerType.TIME) {
    return getTimeBasedActivationDate(task)?.toLocaleDateString("en-CA") ?? "Needs start date";
  }

  return task.startReferenceDate || task.date || "Manual review";
};

const formatNextDueOdometer = (task: MaintenanceTask) => {
  if (task.triggerType !== MaintenanceTriggerType.ODOMETER) return "N/A";
  const range = getOdometerActivationRange(task);
  return range ? `${range.dueMileage.toLocaleString()} km` : "Needs interval";
};

const formatOdometerRange = (task: MaintenanceTask) => {
  if (task.triggerType !== MaintenanceTriggerType.ODOMETER) return "N/A";
  const range = getOdometerActivationRange(task);
  return range
    ? `${range.activationMileage.toLocaleString()}-${range.dueMileage.toLocaleString()} km`
    : "Needs setup";
};
const getDaysInMonth = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const daysCount = new Date(y, m + 1, 0).getDate();
  const startDayOfWeek = new Date(y, m, 1).getDay();
  return { daysCount, startDayOfWeek };
};

const formatDateStr = (year: number, month: number, day: number) => {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

const getTaskStyle = (status: MaintenanceStatus) => {
  switch (status) {
    case MaintenanceStatus.OVERDUE:
      return "border border-rose-500/40 bg-rose-500/15 text-rose-700 shadow-sm";
    case MaintenanceStatus.DUE:
      return "border border-violet-500/40 bg-violet-500/15 text-violet-700 shadow-sm";
    case MaintenanceStatus.IN_PROGRESS:
      return "border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 shadow-sm";
    case MaintenanceStatus.PENDING:
      return "border border-[var(--color-status-info)]/40 bg-[var(--color-status-info)]/15 text-[#0369a1] shadow-sm";
    default:
      return "border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-sm";
  }
};

const MaintenanceSchedulingCombined = () => {
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const isMechanic = isMechanicRole(currentUser);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState("All");
  const [workOrderFilter, setWorkOrderFilter] = useState("All");
  const [mechanicFilter, setMechanicFilter] = useState("All");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [scheduleSortField, setScheduleSortField] = useState<ScheduleSortField>("date");
  const [dateSortDirection, setDateSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [schedulesPerPage, setSchedulesPerPage] = useState(8);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [garages, setGarages] = useState<GarageOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [isOdometerUpdateOpen, setIsOdometerUpdateOpen] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<MaintenanceTask[]>(
    [],
  );
  const [selectedSchedulePage, setSelectedSchedulePage] = useState(0);
  const [pendingAction, setPendingAction] =
    useState<PendingScheduleAction | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useBodyScrollLock(Boolean(pendingAction));

  const loadMaintenanceSchedules = async () => {
    const loadedTasks = await getMaintenanceSchedules();
    setTasks(loadedTasks);
    return loadedTasks;
  };

  useEffect(() => {
    loadMaintenanceSchedules().catch(console.error);
    getVehicles()
      .then((loadedVehicles) => setVehicles(loadedVehicles))
      .catch(() => console.error("Failed to load vehicles"));
    getGarages()
      .then((loadedGarages) => setGarages(loadedGarages))
      .catch(() => console.error("Failed to load garages"));
  }, []);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("create") !== "true") return;
    if (isMechanic) return;
    setEditingTask(null);
    setIsOdometerUpdateOpen(false);
    setIsModalOpen(true);
  }, [isMechanic, location.search]);

  useEffect(() => {
    const closeActionMenu = () => setOpenActionMenuId(null);
    document.addEventListener("click", closeActionMenu);
    return () => document.removeEventListener("click", closeActionMenu);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const getVehicleOption = (vehicleId?: string) =>
    vehicles.find(
      (vehicle) =>
        vehicle.value === vehicleId ||
        vehicle.id === vehicleId ||
        vehicle.plateNumber === vehicleId,
    );
  const getVehiclePlateNumber = (vehicleId?: string) => {
    if (!vehicleId) return "";
    const vehicle = getVehicleOption(vehicleId);
    return vehicle?.plateNumber ?? vehicle?.value ?? vehicleId;
  };
  const isAssignedToCurrentMechanic = (task: MaintenanceTask) => {
    if (!isMechanic || !currentUser) return true;

    const currentNames = [currentUser.id, currentUser.name, currentUser.email]
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter(Boolean);
    const assignedNames = [
      task.assignedMechanicId,
      task.assignedMechanicEmail,
      task.assignedDriver,
    ]
      .map((value) => String(value ?? "").trim().toLowerCase())
      .filter(Boolean);

    return currentNames.some((name) =>
      assignedNames.some(
        (assigned) =>
          assigned === name ||
          assigned.includes(name) ||
          name.includes(assigned),
      ),
    );
  };
  const visibleTasks = tasks.filter(isAssignedToCurrentMechanic);
  const scheduleStatusOptions = [
    MaintenanceStatus.PENDING,
    MaintenanceStatus.DUE,
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.OVERDUE,
    MaintenanceStatus.CANCELLED,
  ];
  const scheduleVehicleOptions = useMemo(
    () => ["All", ...Array.from(new Set(visibleTasks.map((task) => getVehiclePlateNumber(task.vehicleId)).filter(Boolean))).sort()],
    [visibleTasks, vehicles],
  );
  const scheduleWorkOrderOptions = useMemo(
    () => ["All", ...Array.from(new Set(visibleTasks.map((task) => task.title).filter(Boolean))).sort()],
    [visibleTasks],
  );
  const scheduleMechanicOptions = useMemo(
    () => ["All", ...Array.from(new Set(visibleTasks.map((task) => task.assignedDriver || "Unassigned").filter(Boolean))).sort()],
    [visibleTasks],
  );

  const filteredTasks = visibleTasks
    .filter((task) => {
      const isVisibleSchedule =
        isPendingStatus(task.status) ||
        isDueStatus(task.status) ||
        isInProgressStatus(task.status) ||
        isOverdueStatus(task.status) ||
        task.status === MaintenanceStatus.CANCELLED;
      const statusMatches =
        selectedStatusFilters.length === 0 ||
        selectedStatusFilters.some(
          (status) =>
            (status === MaintenanceStatus.PENDING && isPendingStatus(task.status)) ||
            (status === MaintenanceStatus.DUE && isDueStatus(task.status)) ||
            (status === MaintenanceStatus.IN_PROGRESS && isInProgressStatus(task.status)) ||
            (status === MaintenanceStatus.OVERDUE && isOverdueStatus(task.status)) ||
            status === task.status,
        );
      const dateMatches =
        (!dateFromFilter || task.date >= dateFromFilter) &&
        (!dateToFilter || task.date <= dateToFilter);
      const vehicleMatches =
        vehicleFilter === "All" ||
        getVehiclePlateNumber(task.vehicleId) === vehicleFilter;
      const workOrderMatches =
        workOrderFilter === "All" || task.title === workOrderFilter;
      const mechanicMatches =
        mechanicFilter === "All" ||
        (task.assignedDriver || "Unassigned") === mechanicFilter;
      const searchMatches =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getVehiclePlateNumber(task.vehicleId)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        task.assignedDriver.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        isVisibleSchedule &&
        statusMatches &&
        dateMatches &&
        vehicleMatches &&
        workOrderMatches &&
        mechanicMatches &&
        searchMatches
      );
    })
    .sort((left, right) => {
      const direction = dateSortDirection === "asc" ? 1 : -1;
      if (scheduleSortField === "date") {
        const dateComparison = left.date.localeCompare(right.date);
        if (dateComparison !== 0) return dateComparison * direction;
        return right.id.localeCompare(left.id);
      }
      if (scheduleSortField === "vehicle") {
        return getVehiclePlateNumber(left.vehicleId).localeCompare(getVehiclePlateNumber(right.vehicleId)) * direction;
      }
      if (scheduleSortField === "workOrder") {
        return left.title.localeCompare(right.title) * direction;
      }
      if (scheduleSortField === "mechanic") {
        return left.assignedDriver.localeCompare(right.assignedDriver) * direction;
      }
      return maintenanceStatusLabels[left.status].localeCompare(maintenanceStatusLabels[right.status]) * direction;
    });
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTasks.length / schedulesPerPage),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice(
    (activePage - 1) * schedulesPerPage,
    activePage * schedulesPerPage,
  );

  const noTasks = visibleTasks.length === 0;

  const pendingCount = visibleTasks.filter((task) => isPendingStatus(task.status)).length;
  const dueCount = visibleTasks.filter((task) => isDueStatus(task.status)).length;
  const inProgressCount = visibleTasks.filter(
    (task) => isInProgressStatus(task.status),
  ).length;
  const overdueCount = visibleTasks.filter((task) => task.status === MaintenanceStatus.OVERDUE).length;
  const completedCount = visibleTasks.filter(
    (task) => task.status === MaintenanceStatus.COMPLETED,
  ).length;
  const complianceCount = pendingCount + completedCount;
  const compliance = complianceCount
    ? Math.round((completedCount / complianceCount) * 100)
    : 0;
  const dueSoonCount = visibleTasks.filter((task) => {
    const dueDate = new Date(task.startReferenceDate || task.date);
    if (Number.isNaN(dueDate.getTime())) return false;
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  }).length;
  const overdueAlertCount = visibleTasks.filter((task) => task.status === MaintenanceStatus.OVERDUE).length;
  const dueSoonTasks = visibleTasks.filter((task) => {
    const dueDate = new Date(task.startReferenceDate || task.date);
    if (Number.isNaN(dueDate.getTime())) return false;
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });
  const overdueAlertTasks = visibleTasks.filter((task) => task.status === MaintenanceStatus.OVERDUE);
  const notificationItems = [
    ...overdueAlertTasks.map((task) => ({
      id: `overdue-${task.id}`,
      title: `${getVehiclePlateNumber(task.vehicleId)} overdue`,
      detail: `${task.title} - ${task.assignedDriver || "Unassigned mechanic"}`,
      status: "OVERDUE",
      tone: "#dc2626",
    })),
    ...dueSoonTasks.map((task) => ({
      id: `due-${task.id}`,
      title: `${getVehiclePlateNumber(task.vehicleId)} due soon`,
      detail: `${task.title} - ${formatNextDueDate(task)}`,
      status: "DUE SOON",
      tone: "#f59e0b",
    })),
  ];
  const { daysCount, startDayOfWeek } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const yearName = currentDate.getFullYear();
  const monthOptions = Array.from({ length: 12 }, (_, month) => ({
    value: month,
    label: new Date(yearName, month, 1).toLocaleString("default", {
      month: "long",
    }),
  }));

  const calendarCells = Array.from(
    { length: startDayOfWeek + daysCount },
    (_, idx) => {
      const day = idx >= startDayOfWeek ? idx - startDayOfWeek + 1 : null;
      return {
        day,
        dateStr: day
          ? formatDateStr(yearName, currentDate.getMonth(), day)
          : undefined,
      };
    },
  );

  const prevMonth = () =>
    setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1));
  const jumpToCalendarMonth = (year: number, month: number) => {
    setCurrentDate(new Date(year, month, 1));
  };

  const openScheduleDetails = (schedules: MaintenanceTask[]) => {
    setSelectedSchedules(schedules);
    setSelectedSchedulePage(0);
  };

  const closeScheduleDetails = () => {
    setSelectedSchedules([]);
    setSelectedSchedulePage(0);
  };

  const selectedSchedule =
    selectedSchedules[selectedSchedulePage] ?? selectedSchedules[0] ?? null;

  const getGarageName = (garageId?: string) => {
    if (!garageId) return undefined;
    return garages.find((garage) => garage.id === garageId)?.name ?? garageId;
  };

  const isInProgressScheduleLocked = (task: MaintenanceTask) =>
    isInProgressStatus(task.status);

  const openFullScheduleEdit = (task: MaintenanceTask) => {
    if (isInProgressScheduleLocked(task)) {
      setToast({
        type: "warning",
        message: "In-progress schedules cannot be edited.",
      });
      return;
    }
    setEditingTask(task);
    setIsOdometerUpdateOpen(false);
    setIsModalOpen(true);
  };

  const openOdometerUpdate = (task: MaintenanceTask) => {
    if (isInProgressScheduleLocked(task)) {
      setToast({
        type: "warning",
        message: "In-progress schedules cannot be updated.",
      });
      return;
    }
    setEditingTask(task);
    setIsOdometerUpdateOpen(true);
    setIsModalOpen(true);
  };

  const canShowScheduleUpdate = (task: MaintenanceTask) =>
    !isInProgressScheduleLocked(task) &&
    task.status !== MaintenanceStatus.COMPLETED &&
    task.status !== MaintenanceStatus.CANCELLED &&
    (task.triggerType === MaintenanceTriggerType.ODOMETER ||
      task.triggerType === MaintenanceTriggerType.MANUAL);

  const confirmScheduleAction = async () => {
    if (!pendingAction) return;
    const { action, task } = pendingAction;

    if (action === "cancel" && isInProgressScheduleLocked(task)) {
      setToast({
        type: "warning",
        message: "In-progress schedules cannot be cancelled.",
      });
      setPendingAction(null);
      return;
    }

    try {
      if (action === "cancel" || action === "activate") {
        const updatedTask = await updateMaintenanceSchedule({
          ...task,
          status:
            action === "cancel"
              ? MaintenanceStatus.CANCELLED
              : MaintenanceStatus.PENDING,
        });
        setTasks((current) =>
          current.map((currentTask) =>
            currentTask.id === task.id ? updatedTask : currentTask,
          ),
        );
        setToast({
          type: "success",
          message:
            action === "cancel"
              ? "Schedule cancelled. Its history remains available."
              : "Schedule activated and returned to active scheduling.",
        });
      } else {
        await deleteMaintenanceSchedule(task.id);
        setTasks((current) =>
          current.filter((currentTask) => currentTask.id !== task.id),
        );
        setToast({
          type: "success",
          message: "Schedule deactivated. Existing work orders and history were retained.",
        });
      }
    } catch (err) {
      console.error(`Failed to ${action} schedule`, err);
      setToast({
        type: "warning",
        message: `Schedule was not ${action === "cancel" ? "cancelled" : action === "activate" ? "activated" : "deactivated"} because the server update failed.`,
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="fixed right-6 top-6 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>

      <PageHeader
        icon={CalendarIcon}
        title="MAINTENANCE SCHEDULING"
        subtitle="Manage and track fleet maintenance schedules and tasks"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-[#f6f8fc] text-[#63728a] transition hover:border-[#070b45] hover:text-[#070b45]"
              aria-label="Open maintenance notifications"
            >
              <span className="relative">
                <Bell className="h-5 w-5" />
                {dueSoonCount + overdueAlertCount > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#070b45] px-1 text-[10px] font-extrabold leading-none text-white">
                    {dueSoonCount + overdueAlertCount}
                  </span>
                ) : null}
              </span>
            </button>
            <LegendHelp
              title="Schedule Legend"
              items={[
                { label: "Due Soon", description: "Scheduled within the next 7 days.", tone: "#f59e0b" },
                { label: "Overdue", description: "Past due and still active.", tone: "#dc2626" },
                { label: "Due", description: "Ready to be started.", tone: "#7c3aed" },
                { label: "In Progress", description: "Work has already started.", tone: "#0f766e" },
              ]}
            />
            {!isMechanic ? (
              <ActionButton
                variant="primary"
                className="flex h-10 items-center gap-2 px-4"
                onClick={() => {
                  setEditingTask(null);
                  setIsOdometerUpdateOpen(false);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                <span>{"Create Schedule"}</span>
              </ActionButton>
            ) : null}
          </div>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <KPIStatCard
            icon={<TrendingUp size={20} strokeWidth={1.8} />}
            value={`${compliance}%`}
            label="Compliance"
            subtitle="Fleet score"
            iconColor="#22c55e"
            iconBgColor="rgba(34, 197, 94, 0.12)"
          />
          <KPIStatCard
            icon={<Clock size={20} strokeWidth={1.8} />}
            value={pendingCount}
            label="Pending"
            subtitle="Awaiting start"
            iconColor="#3b82f6"
            iconBgColor="rgba(59, 130, 246, 0.12)"
          />
          <KPIStatCard
            icon={<AlertCircle size={20} strokeWidth={1.8} />}
            value={dueCount}
            label="Due"
            subtitle="Ready to start"
            iconColor="#7c3aed"
            iconBgColor="rgba(124, 58, 237, 0.12)"
          />
          <KPIStatCard
            icon={<Play size={20} strokeWidth={1.8} />}
            value={inProgressCount}
            label="In-Progress"
            subtitle="Ongoing tasks"
            iconColor="#14b8a6"
            iconBgColor="rgba(20, 184, 166, 0.12)"
          />
          <KPIStatCard
            icon={<AlertCircle size={20} strokeWidth={1.8} />}
            value={overdueCount}
            label="Overdue"
            subtitle="Tasks overdue"
            iconColor="#ef4444"
            iconBgColor="rgba(239, 68, 68, 0.12)"
          />
          <KPIStatCard
            icon={<CheckCircle2 size={20} strokeWidth={1.8} />}
            value={completedCount}
            label="Completed"
            subtitle="Finished tasks"
            iconColor="#94a3b8"
            iconBgColor="rgba(148, 163, 184, 0.12)"
          />
        </div>

        <Modal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          title="Maintenance Notifications"
          size="lg"
          className="w-[min(92vw,72rem)] p-0"
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="h-10 rounded-xl border border-[#070b45] px-6 text-sm font-extrabold text-[#070b45] transition hover:bg-[#070b45] hover:text-white"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-extrabold uppercase text-slate-500">Total Alerts</p>
                <p className="mt-3 text-3xl font-extrabold text-slate-950">{notificationItems.length}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-xs font-extrabold uppercase text-amber-700">Due Soon</p>
                <p className="mt-3 text-3xl font-extrabold text-amber-900">{dueSoonCount}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                <p className="text-xs font-extrabold uppercase text-red-700">Overdue</p>
                <p className="mt-3 text-3xl font-extrabold text-red-900">{overdueAlertCount}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <h3 className="text-base font-extrabold text-slate-950">Notification Activity</h3>
              </div>
              <div className="max-h-[420px] divide-y divide-slate-200 overflow-y-auto">
                {notificationItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: `${item.tone}40`, backgroundColor: `${item.tone}14`, color: item.tone }}>
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-extrabold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                    </div>
                    <span className="rounded-full border px-3 py-1 text-xs font-extrabold" style={{ borderColor: `${item.tone}30`, color: item.tone }}>
                      {item.status}
                    </span>
                  </div>
                ))}
                {notificationItems.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                    No maintenance notifications.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Modal>

        <section className="overflow-visible">
          <div className="mb-5 flex flex-col gap-5 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Maintenance Schedules
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Pending, in-progress, and overdue scheduled items for the fleet.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                  className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-warning)] ${
                    viewMode === "list"
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                      : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <List className="mr-2 h-4 w-4" />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  aria-pressed={viewMode === "calendar"}
                  className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-warning)] ${
                    viewMode === "calendar"
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                      : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Calendar
                </button>
              </div>
            </div>
          </div>

          <TableToolbar
            search={
              <SearchInput
                className="w-full sm:w-96"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            }
            sort={
              <SortSelect
                className="w-full sm:w-60"
                value={`${scheduleSortField}-${dateSortDirection}`}
                onChange={(value) => {
                  const [field, direction] = value.split("-") as [ScheduleSortField, SortDirection];
                  setScheduleSortField(field);
                  setDateSortDirection(direction);
                  setCurrentPage(1);
                }}
                options={[
                  { value: "date-desc", label: "Date - Newest" },
                  { value: "date-asc", label: "Date - Oldest" },
                  { value: "vehicle-asc", label: "Vehicle - A to Z" },
                  { value: "vehicle-desc", label: "Vehicle - Z to A" },
                  { value: "workOrder-asc", label: "Work Order - A to Z" },
                  { value: "workOrder-desc", label: "Work Order - Z to A" },
                  { value: "mechanic-asc", label: "Mechanic - A to Z" },
                  { value: "mechanic-desc", label: "Mechanic - Z to A" },
                  { value: "status-asc", label: "Status - A to Z" },
                  { value: "status-desc", label: "Status - Z to A" },
                ]}
              />
            }
            filters={
              <FilterDropdown
                open={showFilters}
                onToggle={() => setShowFilters((current) => !current)}
                statuses={scheduleStatusOptions}
                selectedStatuses={selectedStatusFilters}
                onStatusChange={(statuses) => {
                  setSelectedStatusFilters(statuses);
                  setCurrentPage(1);
                }}
                dateFrom={dateFromFilter}
                dateTo={dateToFilter}
                onDateFromChange={(value) => {
                  setDateFromFilter(value);
                  setCurrentPage(1);
                }}
                onDateToChange={(value) => {
                  setDateToFilter(value);
                  setCurrentPage(1);
                }}
                onApply={() => setShowFilters(false)}
                onClear={() => {
                  setSelectedStatusFilters([]);
                  setVehicleFilter("All");
                  setWorkOrderFilter("All");
                  setMechanicFilter("All");
                  setDateFromFilter("");
                  setDateToFilter("");
                  setCurrentPage(1);
                }}
                legendTitle="Schedule Table Legend"
                legendItems={[
                  { label: "Status", description: "Current schedule state such as pending, due, in progress, overdue, cancelled, or completed.", tone: "#7c3aed" },
                  { label: "Trigger", description: "Basis used to activate the schedule: odometer, time, or a manual entry.", tone: "#2563eb" },
                  { label: "Next Due Date", description: "Date-based schedule target, when available for the selected trigger.", tone: "#c2410c" },
                  { label: "Odometer Range", description: "Activation window built from reference reading, interval, and buffer distance.", tone: "#0f766e" },
                ]}
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Vehicle</span>
                    <DropdownSelect
                      className="mt-2"
                      value={vehicleFilter}
                      onChange={(value) => {
                        setVehicleFilter(value);
                        setCurrentPage(1);
                      }}
                      label="Vehicle"
                      options={scheduleVehicleOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All vehicles" : option,
                      }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Work order</span>
                    <DropdownSelect
                      className="mt-2"
                      value={workOrderFilter}
                      onChange={(value) => {
                        setWorkOrderFilter(value);
                        setCurrentPage(1);
                      }}
                      label="Work order"
                      options={scheduleWorkOrderOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All work orders" : option,
                      }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Mechanic</span>
                    <DropdownSelect
                      className="mt-2"
                      value={mechanicFilter}
                      onChange={(value) => {
                        setMechanicFilter(value);
                        setCurrentPage(1);
                      }}
                      label="Mechanic"
                      options={scheduleMechanicOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All mechanics" : option,
                      }))}
                    />
                  </label>
                </div>
              </FilterDropdown>
            }
          />

          {viewMode === "list" ? (
            <div className="overflow-visible">
              <DataTable
                data={paginatedTasks}
                getRowKey={(task) => task.id}
                minWidth="1180px"
                density="compact"
                maxHeight="min(34rem, calc(100vh - 22rem))"
                emptyMessage={
                  noTasks
                    ? "No maintenance schedules exist."
                    : "No maintenance schedules match the current filters."
                }
                columns={[
                  {
                    key: "workOrderNo",
                    header: "Work Order No.",
                    width: "11%",
                    render: (task) => formatWorkOrderNumber(task.id),
                  },
                  {
                    key: "plateNo",
                    header: "Plate No.",
                    width: "10%",
                    render: (task) => (
                      <span className="font-medium">
                        {getVehiclePlateNumber(task.vehicleId)}
                      </span>
                    ),
                  },
                  {
                    key: "workOrder",
                    header: "Work Order",
                    width: "17%",
                    render: (task) => task.title,
                  },
                  {
                    key: "trigger",
                    header: "Trigger",
                    width: "10%",
                    render: (task) => (
                      <span className="inline-block rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-bold text-[#475569]">
                        {task.triggerType
                          ? maintenanceTriggerTypeLabels[task.triggerType]
                          : maintenanceTriggerTypeLabels[MaintenanceTriggerType.ODOMETER]}
                      </span>
                    ),
                  },
                  {
                    key: "createdDate",
                    header: "Schedule Date",
                    width: "11%",
                    render: (task) => formatScheduleDate(task),
                  },
                  {
                    key: "nextDueDate",
                    header: "Next Due Date",
                    width: "11%",
                    render: (task) => formatNextDueDate(task),
                  },
                  {
                    key: "nextDueOdometer",
                    header: "Next Due Odometer",
                    width: "12%",
                    render: (task) => formatNextDueOdometer(task),
                  },
                  {
                    key: "odometerRange",
                    header: "Odometer Range",
                    width: "12%",
                    render: (task) => formatOdometerRange(task),
                  },
                  {
                    key: "mechanic",
                    header: "Mechanic",
                    width: "13%",
                    render: (task) => task.assignedDriver,
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "12%",
                    render: (task) => <StandardStatusBadge status={task.status} />,
                  },
                  ...(!isMechanic
                    ? [{
                        key: "actions",
                        header: "",
                        width: "7%",
                        align: "center" as const,
                        render: (task: MaintenanceTask) => (
                          <ActionMenu
                            open={openActionMenuId === task.id}
                            onToggle={(event) => {
                              event.stopPropagation();
                              setOpenActionMenuId((current) =>
                                current === task.id ? null : task.id,
                              );
                            }}
                            items={[
                              ...(!isInProgressScheduleLocked(task)
                                ? [{
                                    label: "Edit",
                                    icon: Edit2,
                                    onClick: () => {
                                      setOpenActionMenuId(null);
                                      openFullScheduleEdit(task);
                                    },
                                  }]
                                : []),
                              ...(canShowScheduleUpdate(task)
                                ? [{
                                    label: "Update",
                                    icon: RefreshCw,
                                    onClick: () => {
                                      setOpenActionMenuId(null);
                                      openOdometerUpdate(task);
                                    },
                                  }]
                                : []),
                              ...(!isInProgressScheduleLocked(task) &&
                              task.status !== MaintenanceStatus.CANCELLED
                                ? [{
                                    label: "Cancel",
                                    icon: Ban,
                                    danger: true,
                                    onClick: () => {
                                      setOpenActionMenuId(null);
                                      setPendingAction({ action: "cancel", task });
                                    },
                                  }]
                                : task.status === MaintenanceStatus.CANCELLED
                                ? [{
                                    label: "Activate",
                                    icon: Power,
                                    onClick: () => {
                                      setOpenActionMenuId(null);
                                      setPendingAction({ action: "activate", task });
                                    },
                                  }]
                                : []),
                              {
                                label: "Deactivate",
                                icon: PowerOff,
                                danger: true,
                                onClick: () => {
                                  setOpenActionMenuId(null);
                                  setPendingAction({ action: "deactivate", task });
                                },
                              },
                            ]}
                          />
                        ),
                      }]
                    : []),
                ]}
              />
              {filteredTasks.length > 0 ? (
                <div>
                  <Pagination
                    page={activePage}
                    totalPages={totalPages}
                    totalItems={filteredTasks.length}
                    pageSize={schedulesPerPage}
                    pageSizeOptions={[5, 8, 10, 15, 20]}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(pageSize) => {
                      setSchedulesPerPage(pageSize);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <Card padding="none" className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="relative text-center">
                  <button
                    type="button"
                    onClick={() => setIsMonthPickerOpen((open) => !open)}
                    className="rounded-lg px-3 py-1 text-base font-bold text-[var(--color-text-primary)] transition hover:bg-[var(--color-card-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-warning)] sm:text-lg"
                    aria-expanded={isMonthPickerOpen}
                    aria-label="Choose calendar month and year"
                  >
                    {monthName} {yearName}
                  </button>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {filteredTasks.length} visible schedules
                  </p>
                  {isMonthPickerOpen ? (
                    <div className="absolute left-1/2 top-full z-20 mt-2 grid w-64 -translate-x-1/2 grid-cols-2 gap-3 rounded-xl border border-[var(--color-border)] bg-white p-3 text-left shadow-xl">
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                        Month
                        <DropdownSelect
                          value={String(currentDate.getMonth())}
                          onChange={(value) => {
                            jumpToCalendarMonth(yearName, Number(value));
                          }}
                          label="Month"
                          className="mt-1"
                          buttonClassName="rounded-lg font-semibold"
                          options={monthOptions.map((month) => ({
                            value: String(month.value),
                            label: month.label,
                          }))}
                        />
                      </label>
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                        Year
                        <input
                          type="number"
                          min="1900"
                          max="2100"
                          value={yearName}
                          onChange={(event) => {
                            const nextYear = Number(event.target.value);
                            if (Number.isFinite(nextYear)) {
                              jumpToCalendarMonth(nextYear, currentDate.getMonth());
                            }
                          }}
                          className="mt-1 h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1 rounded-lg bg-[#070b45] px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white sm:gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div key={day}>
                      {day}
                    </div>
                  ),
                )}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarCells.map((cell, idx) => {
                  const schedulesForDay = filteredTasks.filter(
                    (task) => formatScheduleDate(task) === cell.dateStr,
                  );
                  const isToday = Boolean(cell.dateStr) && cell.dateStr === formatLocalDate(today);
                  const visibleSchedules = schedulesForDay.slice(0, 2);
                  const hiddenScheduleCount = schedulesForDay.length - visibleSchedules.length;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (schedulesForDay.length > 0) {
                          openScheduleDetails(schedulesForDay);
                        }
                      }}
                      className={`group min-h-28 rounded-lg border p-1.5 transition duration-200 sm:min-h-32 sm:p-2 ${
                        cell.day
                          ? `bg-white ${isToday ? "border-[#070b45] shadow-sm" : "border-[#dde4ef]"} hover:border-[var(--color-brand-primary)] hover:bg-[#f8fafc] ${
                              schedulesForDay.length > 0 ? "cursor-pointer" : ""
                            }`
                          : "bg-transparent border-transparent"
                      }`}
                    >
                      {cell.day && (
                        <>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span
                              className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${
                                isToday
                                  ? "bg-[#070b45] text-white"
                                  : "text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {cell.day}
                            </span>
                            {schedulesForDay.length > 0 ? (
                              <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-bold text-[#070b45]">
                                {schedulesForDay.length}
                              </span>
                            ) : null}
                            {!isMechanic ? (
                              <button
                                type="button"
                                aria-label={`Create schedule for ${cell.dateStr}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingTask(null);
                                  setIsOdometerUpdateOpen(false);
                                  setIsModalOpen(true);
                                }}
                                className="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] transition opacity-0 group-hover:opacity-100"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            ) : null}
                          </div>
                          <div className="space-y-1 text-xs">
                            {visibleSchedules.map((task) => (
                              <button
                                type="button"
                                key={task.id}
                                className={`block w-full rounded-md px-2 py-1.5 text-left transition hover:brightness-105 ${getTaskStyle(task.status)}`}
                              >
                                <span className="block truncate text-[11px] font-bold">
                                  {formatWorkOrderNumber(task.id)}
                                </span>
                                <span className="block truncate text-[11px]">
                                  {getVehiclePlateNumber(task.vehicleId)}
                                </span>
                              </button>
                            ))}
                            {hiddenScheduleCount > 0 ? (
                              <div className="rounded-md bg-[#f1f5f9] px-2 py-1 text-[11px] font-bold text-[#475569]">
                                +{hiddenScheduleCount} more
                              </div>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </section>
      </div>
      <Modal
        isOpen={selectedSchedules.length > 0}
        title={
          selectedSchedules.length > 1
            ? `Maintenance Schedules (${selectedSchedules.length})`
            : "Maintenance Schedule Details"
        }
        size="lg"
        className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden"
        onClose={closeScheduleDetails}
        footer={
          isMechanic && selectedSchedules.length <= 1 ? undefined :
          <div className="grid w-full grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            {selectedSchedules.length > 1 ? (
              <>
                <span className="text-left text-base font-medium text-[#64748b]">
                  {selectedSchedules.length} schedules
                </span>
                <div className="flex items-center justify-center gap-2">
                  {selectedSchedules.map((schedule, index) => (
                    <button
                      key={schedule.id}
                      type="button"
                      onClick={() => setSelectedSchedulePage(index)}
                      aria-label={`Go to schedule ${index + 1}`}
                      aria-current={selectedSchedulePage === index ? "page" : undefined}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-bold transition ${
                        selectedSchedulePage === index
                          ? "bg-[#070b45] text-white shadow-[0_8px_18px_rgba(7,11,69,0.18)]"
                          : "text-[#070b45] hover:bg-[#eef2ff]"
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span />
                <span />
              </>
            )}
            <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
              {!isMechanic && selectedSchedule && !isInProgressScheduleLocked(selectedSchedule) ? (
                <Button
                  size="sm"
                  onClick={() => {
                    closeScheduleDetails();
                    openFullScheduleEdit(selectedSchedule);
                  }}
                >
                  Edit
                </Button>
              ) : null}
              {!isMechanic && selectedSchedule && canShowScheduleUpdate(selectedSchedule) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    closeScheduleDetails();
                    openOdometerUpdate(selectedSchedule);
                  }}
                >
                  Update
                </Button>
              ) : null}
            </div>
          </div>
        }
      >
        {selectedSchedule && (
            <section
              className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]"
            >
              <div className="flex items-center justify-between gap-4 border-b border-[var(--color-divider)] px-4 py-3">
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                    {selectedSchedule.title}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {getVehiclePlateNumber(selectedSchedule.vehicleId)} - {selectedSchedule.date}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {[
              {
                label: "Work Order No.",
                value: formatWorkOrderNumber(selectedSchedule.id),
              },
              {
                label: "Plate No.",
                value: getVehiclePlateNumber(selectedSchedule.vehicleId),
              },
              { label: "Checklist Template", value: selectedSchedule.title },
              {
                label: "Trigger",
                value:
                  selectedSchedule.triggerType
                    ? maintenanceTriggerTypeLabels[selectedSchedule.triggerType]
                    : "Not specified",
              },
              { label: "Date Created", value: selectedSchedule.date },
              { label: "Mechanic", value: selectedSchedule.assignedDriver },
              { label: "Status", value: selectedSchedule.status },
              { label: "Garage/Cluster", value: getGarageName(selectedSchedule.garageId) },
              { label: "Account Type", value: selectedSchedule.accountType },
              {
                label: "Provider",
                value: selectedSchedule.outsourcedProvider,
              },
              {
                label: "System Affected",
                value: selectedSchedule.systemAffected,
              },
              {
                label: "Odometer Reading",
                value:
                  selectedSchedule.triggerType === MaintenanceTriggerType.ODOMETER &&
                  selectedSchedule.odometerReading
                  ? `${selectedSchedule.odometerReading} km`
                  : undefined,
              },
              {
                label: "Interval Type",
                value:
                  selectedSchedule.triggerType === MaintenanceTriggerType.TIME
                    ? selectedSchedule.intervalType
                    : undefined,
              },
              {
                label: "Interval",
                value:
                  selectedSchedule.triggerType === MaintenanceTriggerType.ODOMETER &&
                  selectedSchedule.intervalKm
                  ? `${selectedSchedule.intervalKm} km`
                  : undefined,
              },
              {
                label: "Buffer Distance",
                value:
                  selectedSchedule.triggerType === MaintenanceTriggerType.ODOMETER &&
                  selectedSchedule.bufferDistanceKm
                  ? `${selectedSchedule.bufferDistanceKm} km`
                  : undefined,
              },
              {
                label: "Starting Reference",
                value:
                  selectedSchedule.triggerType === MaintenanceTriggerType.ODOMETER &&
                  selectedSchedule.startingReferenceReadingKm
                  ? `${selectedSchedule.startingReferenceReadingKm} km`
                  : undefined,
              },
              {
                label: "Start Reference Date",
                value:
                  selectedSchedule.triggerType === MaintenanceTriggerType.TIME
                    ? selectedSchedule.startReferenceDate
                    : undefined,
              },
            ]
              .filter((detail) => detail.value)
              .map((detail) => (
                <div
                  key={detail.label}
                  className="flex flex-col gap-2"
                >
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {detail.label}
                  </p>
                  <div className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
                    {detail.label === "Status" ? (
                      <StatusBadge status={selectedSchedule.status} />
                    ) : (
                      detail.value
                    )}
                  </div>
                </div>
              ))}

            {selectedSchedule.notes && (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Notes
                </p>
                <div className="min-h-24 whitespace-pre-wrap rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
                  {selectedSchedule.notes}
                </div>
              </div>
            )}
              </div>
            </section>
        )}
      </Modal>

      <CreateSchedule
        isOpen={isModalOpen}
        editingTask={editingTask ?? undefined}
        odometerOnly={isOdometerUpdateOpen}
        existingSchedules={tasks}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
          setIsOdometerUpdateOpen(false);
        }}
        onSaved={async (task) => {
          const recalculatedTask = {
            ...task,
            status: getCalculatedMaintenanceStatus(task),
          };

          // Update immediately, then refresh the entire collection so schedules
          // on every pagination page receive server-calculated status changes.
          setTasks((current) =>
            current.some((existingTask) => existingTask.id === recalculatedTask.id)
              ? current.map((existingTask) =>
                  existingTask.id === recalculatedTask.id
                    ? { ...existingTask, ...recalculatedTask }
                    : existingTask,
                )
              : [recalculatedTask, ...current],
          );

          try {
            await loadMaintenanceSchedules();
          } catch (error) {
            console.error("Failed to refresh maintenance schedules", error);
          }
          setIsModalOpen(false);
          setEditingTask(null);
          setIsOdometerUpdateOpen(false);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(pendingAction)}
        variant="danger"
        message={
          pendingAction ? (
            <>
              {pendingAction.action === "cancel"
                ? "Cancel this maintenance schedule?"
                : pendingAction.action === "activate"
                  ? "Activate this maintenance schedule?"
                  : "Deactivate this maintenance schedule?"}
              <span className="mt-2 block font-normal">
                {pendingAction.action === "cancel"
                  ? "It will be marked as cancelled and removed from active scheduling. Its maintenance history will remain available."
                  : pendingAction.action === "activate"
                    ? "It will return to active scheduling and its status will be recalculated from the schedule trigger."
                    : "It will be soft deleted and removed from Maintenance Scheduling, but existing work orders and maintenance history will remain available."}
              </span>
              <span className="mt-2 block font-bold">
                {pendingAction.task.title} - {pendingAction.task.vehicleId}
              </span>
            </>
          ) : (
            ""
          )
        }
        confirmLabel={
          pendingAction?.action === "cancel"
            ? "Cancel Schedule"
            : pendingAction?.action === "activate"
              ? "Activate Schedule"
              : "Deactivate Schedule"
        }
        onConfirm={confirmScheduleAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default MaintenanceSchedulingCombined;
