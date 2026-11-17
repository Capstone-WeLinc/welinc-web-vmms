import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  ArrowUp,
  ArrowDown,
  Edit2,
  RefreshCw,
  Ban,
  Power,
  CheckCircle2 as ApproveIcon,
  X as RejectIcon,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  Card,
  ActionMenu,
  ActionButton,
  ConfirmationModal,
  DataTable,
  FilterDropdown,
  Modal,
  Pagination,
  SearchInput,
  StatusBadge as StandardStatusBadge,
  ToastNotification,
} from "../../components/ui";
import CreateSchedule from "./CreateSchedule";
import { useAuthStore } from "../../store/authStore";
import { canEditWorkOrderPriority, canManageSchedules } from "../../lib/utils/permissions";
import { timeIntervalFields } from '../../lib/utils/timeInterval';
import {
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceTriggerType,
  maintenancePriorityLabels,
  maintenanceStatusLabels,
  maintenanceTriggerTypeLabels,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  getMaintenanceSchedules,
  cancelMaintenanceSchedule,
  reviewMaintenanceScheduleCancellation,
  updateMaintenanceOdometerThreshold,
  updateMaintenanceSchedule,
  updateWorkOrderPriority,
} from "../../lib/api/maintenanceService";
import { getVehicles, type VehicleOption } from "../../lib/api/vehicleService";
import { getGarages } from "../../lib/api/locationService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import {
  getCalculatedMaintenanceStatus,
  isInProgressStatus,
  isDueStatus,
  isOverdueStatus,
  isPendingStatus,
} from "../../lib/utils/workOrders";

type GarageOption = { id: string; name: string };
type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};

type ScheduleStatusAction = "request-cancel" | "approve-cancel" | "reject-cancel" | "activate";
type PendingScheduleAction = {
  action: ScheduleStatusAction;
  task: MaintenanceTask;
  requestId?: string;
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
    className="p-5 transition duration-200 hover:-translate-y-0.5"
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border)]"
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
      sizeClass = "px-3 py-1.5 text-xs";
      break;
    case "md":
      sizeClass = "px-4 py-2 text-sm";
      break;
    case "lg":
      sizeClass = "px-6 py-3 text-base";
      break;
  }

  return (
    <button
      className={`font-semibold rounded-xl transition-all duration-200 active:scale-95 focus:outline-hidden ${variantClass} ${sizeClass} ${className}`}
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
        return "text-[#c41c3b] bg-[var(--color-status-error)]/15 border-[var(--color-status-error)]/30";
      case MaintenanceStatus.DUE:
        return "text-[#6d28d9] bg-[#ede9fe] border-[#c4b5fd]";
      case MaintenanceStatus.IN_PROGRESS:
        return "text-[#047857] bg-[var(--color-status-success)]/15 border-[var(--color-status-success)]/30";
      case MaintenanceStatus.COMPLETED:
        return "text-[var(--color-text-secondary)] bg-[var(--color-card-bg)] border-[var(--color-border)]";
      case MaintenanceStatus.CANCELLED:
        return "text-slate-600 bg-slate-100 border-slate-300";
      case MaintenanceStatus.PENDING:
      default:
        return "text-[#0369a1] bg-[var(--color-status-info)]/15 border-[var(--color-status-info)]/30";
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
const SelectField = ({
  label,
  id,
  options,
  className = "",
  onChange,
  value,
  disabled,
}: {
  label: string;
  id: string;
  options: { value: string; label: string }[];
  className?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="w-full text-left">
    {label && (
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
    )}
    <select
      id={id}
      className={`w-full px-4 py-2.5 rounded-xl border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 focus:outline-hidden appearance-none ${className}`}
      onChange={onChange}
      value={value}
      disabled={disabled}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
        >
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

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

const getPendingCancellationRequest = (task: MaintenanceTask) =>
  task.logNumber
    ? undefined
    : task.cancellations?.find((entry) => entry.reviewStatus === "PENDING");

const MaintenanceSchedulingCombined = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const canSchedule = canManageSchedules(currentUser);
  const isAdmin = currentUser?.role === "ADMIN";
  const canEditPriority = canEditWorkOrderPriority(currentUser);
  const location = useLocation();
  const navigate = useNavigate();
  const focusScheduleId = new URLSearchParams(location.search).get("scheduleId");
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriority | "All">("All");
  const [priorityOrder, setPriorityOrder] = useState<"NONE" | "HIGH_TO_LOW" | "LOW_TO_HIGH">("NONE");
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");
  const [checklistTemplateFilter, setChecklistTemplateNameFilter] =
    useState<string>("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("All");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dateSortDirection, setDateSortDirection] = useState<"asc" | "desc">(
    "desc",
  );
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
  const [thresholdEditTask, setThresholdEditTask] = useState<MaintenanceTask | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");
  const [thresholdReason, setThresholdReason] = useState("");
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [thresholdError, setThresholdError] = useState("");
  const [cancellationReason, setCancellationReason] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    // Reset confirmation input when the selected action changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCancellationReason('');
    setActionError('');
  }, [pendingAction]);
  useEffect(() => {
    // Initialize this dialog's draft fields when a different schedule is selected for editing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThresholdValue(thresholdEditTask?.dueOdometer != null ? String(thresholdEditTask.dueOdometer) : "");
    setThresholdReason("");
    setThresholdError("");
  }, [thresholdEditTask]);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [savingPriorityId, setSavingPriorityId] = useState<string | null>(null);

  useBodyScrollLock(Boolean(pendingAction));

  const loadMaintenanceSchedules = async () => {
    const loadedTasks = await getMaintenanceSchedules();
    setTasks(loadedTasks);
    return loadedTasks;
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadMaintenanceSchedules().catch(console.error), 0);
    getVehicles()
      .then((loadedVehicles) => setVehicles(loadedVehicles))
      .catch(() => console.error("Failed to load vehicles"));
    getGarages()
      .then((loadedGarages) => setGarages(loadedGarages))
      .catch(() => console.error("Failed to load garages"));
    return () => window.clearTimeout(initialLoad);
  }, []);

  useEffect(() => {
    if (!canSchedule || new URLSearchParams(location.search).get("create") !== "true") return;
    // A create query parameter opens a fresh schedule form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingTask(null);
    setIsOdometerUpdateOpen(false);
    setIsModalOpen(true);
  }, [location.search, canSchedule]);

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
  const getDateRangeFilter = () => {
    return (taskDate: Date) => {
      if (dateRangeFilter === "All") return true;

      const taskDateStr = formatLocalDate(taskDate);
      const todayStr = formatLocalDate(today);

      if (dateRangeFilter === "Today") {
        return taskDateStr === todayStr;
      }

      if (dateRangeFilter === "This Week") {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        return taskDate >= weekStart && taskDate <= weekEnd;
      }

      if (dateRangeFilter === "This Month") {
        return (
          taskDate.getMonth() === today.getMonth() &&
          taskDate.getFullYear() === today.getFullYear()
        );
      }

      return true;
    };
  };

  const dateFilter = getDateRangeFilter();

  const checklistTemplates = Array.from(
    new Set(tasks.map((task) => task.title)),
  ).sort();
  const checklistTemplateOptions = [
    { value: "All", label: "All Types" },
    ...checklistTemplates.map((template) => ({
      value: template,
      label: template,
    })),
  ];

  const vehicleOptions = [{ value: "All", label: "All Vehicles" }, ...vehicles];
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
  const scheduleStatusOptions = [
    MaintenanceStatus.PENDING,
    MaintenanceStatus.DUE,
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.OVERDUE,
  ];

  const filteredTasks = tasks
    .filter((task) => {
      const isVisibleSchedule =
        isPendingStatus(task.status) ||
        isDueStatus(task.status) ||
        isInProgressStatus(task.status) ||
        isOverdueStatus(task.status);
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
      const priorityMatches = priorityFilter === "All" ||
        (task.priority ?? MaintenancePriority.MEDIUM) === priorityFilter;
      const taskVehicle = getVehicleOption(task.vehicleId);
      const vehicleMatches =
        vehicleFilter === "All" ||
        task.vehicleId === vehicleFilter ||
        taskVehicle?.value === vehicleFilter ||
        taskVehicle?.id === vehicleFilter ||
        taskVehicle?.plateNumber === vehicleFilter;
      const templateMatches =
        checklistTemplateFilter === "All" ||
        task.title === checklistTemplateFilter;
      const candidateDates = viewMode === 'calendar' ? [task.startDate, task.dueDate] : [task.startDate];
      const dateMatches = (dateRangeFilter === 'All' && !dateFromFilter && !dateToFilter) ||
        candidateDates.some((date) => date && dateFilter(new Date(`${date}T00:00:00`)) &&
          (!dateFromFilter || date >= dateFromFilter) && (!dateToFilter || date <= dateToFilter));
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
        priorityMatches &&
        vehicleMatches &&
        templateMatches &&
        dateMatches &&
        searchMatches
      );
    })
    .sort((left, right) => {
      if (priorityOrder !== "NONE") {
        const rank: Record<MaintenancePriority, number> = {
          [MaintenancePriority.HIGH]: 3,
          [MaintenancePriority.MEDIUM]: 2,
          [MaintenancePriority.LOW]: 1,
        };
        const priorityDifference = rank[left.priority ?? MaintenancePriority.MEDIUM] - rank[right.priority ?? MaintenancePriority.MEDIUM];
        if (priorityDifference !== 0) {
          return priorityOrder === "HIGH_TO_LOW" ? -priorityDifference : priorityDifference;
        }
      }
      const dateComparison = (left.startDate ?? '').localeCompare(right.startDate ?? '');
      if (dateComparison !== 0) {
        return dateSortDirection === "asc" ? dateComparison : -dateComparison;
      }
      return right.id.localeCompare(left.id);
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

  const noTasks = tasks.length === 0;

  const pendingCount = tasks.filter((task) => isPendingStatus(task.status)).length;
  const dueCount = tasks.filter((task) => isDueStatus(task.status)).length;
  const inProgressCount = tasks.filter(
    (task) => isInProgressStatus(task.status),
  ).length;
  const overdueCount = tasks.filter((task) => task.status === MaintenanceStatus.OVERDUE).length;
  const completedCount = tasks.filter(
    (task) => task.status === MaintenanceStatus.COMPLETED,
  ).length;
  const complianceCount = pendingCount + completedCount;
  const compliance = complianceCount
    ? Math.round((completedCount / complianceCount) * 100)
    : 0;

  const { daysCount, startDayOfWeek } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const yearName = currentDate.getFullYear();

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
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  const nextMonth = () =>
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );

  const openScheduleDetails = (schedules: MaintenanceTask[]) => {
    setSelectedSchedules(schedules);
    setSelectedSchedulePage(0);
  };

  useEffect(() => {
    if (!focusScheduleId) return;
    const schedule = tasks.find((task) => task.id === focusScheduleId);
    if (!schedule) return;
    // The focus query selects the requested schedule once its asynchronous list is loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSchedules([schedule]);
    setSelectedSchedulePage(0);
    navigate(location.pathname, { replace: true });
  }, [focusScheduleId, location.pathname, navigate, tasks]);

  const closeScheduleDetails = () => {
    setSelectedSchedules([]);
    setSelectedSchedulePage(0);
  };

  const selectedSchedule =
    selectedSchedules[selectedSchedulePage] ?? selectedSchedules[0] ?? null;

  const handlePriorityChange = async (task: MaintenanceTask, priority: MaintenancePriority) => {
    if (!canEditPriority || priority === (task.priority ?? MaintenancePriority.MEDIUM)) return;
    setSavingPriorityId(task.id);
    try {
      const updated = await updateWorkOrderPriority(task.id, priority);
      setTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, ...updated } : entry));
      setSelectedSchedules((current) => current.map((entry) => entry.id === task.id ? { ...entry, ...updated } : entry));
      setToast({ type: "success", message: "Work-order priority updated." });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Could not update work-order priority." });
    } finally {
      setSavingPriorityId(null);
    }
  };

  const getGarageName = (garageId?: string) => {
    if (!garageId) return undefined;
    return garages.find((garage) => garage.id === garageId)?.name ?? garageId;
  };

  const isInProgressScheduleLocked = (task: MaintenanceTask) =>
    isInProgressStatus(task.status);

  const openFullScheduleEdit = (task: MaintenanceTask) => {
    if (!canSchedule) return;
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
    if (!canSchedule) return;
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
    canSchedule &&
    !isInProgressScheduleLocked(task) &&
    task.status !== MaintenanceStatus.COMPLETED &&
    task.status !== MaintenanceStatus.CANCELLED &&
    (task.triggerType === MaintenanceTriggerType.ODOMETER ||
      task.triggerType === MaintenanceTriggerType.MANUAL);

  const confirmScheduleAction = async () => {
    if (!pendingAction || actionSaving) return;
    const { action, task, requestId } = pendingAction;
    const isCancellationRequest = action === "request-cancel";
    const isCancellationReview = action === "approve-cancel" || action === "reject-cancel";
    if ((isCancellationRequest || action === "activate") && !canSchedule) return;
    if (isCancellationReview && !isAdmin) return;
    if ((isCancellationRequest || action === "reject-cancel") && !cancellationReason.trim()) return;

    if (isCancellationRequest && isInProgressScheduleLocked(task)) {
      setToast({
        type: "warning",
        message: "Schedule cannot be cancelled once work has started. Use ‘Extension’ instead.",
      });
      setPendingAction(null);
      return;
    }

    setActionSaving(true);
    setActionError('');
    try {
      if (isCancellationRequest) {
        const updatedTask = await cancelMaintenanceSchedule(task, cancellationReason);
        setTasks((current) =>
          current.map((currentTask) =>
            currentTask.id === task.id ? updatedTask : currentTask,
          ),
        );
        setToast({
          type: "success",
          message: "Cancellation request sent. The schedule stays active until an Admin approves it.",
        });
      } else if (isCancellationReview && requestId) {
        const reviewedTask = await reviewMaintenanceScheduleCancellation(
          task.id,
          requestId,
          action === "approve-cancel" ? "APPROVE" : "REJECT",
          action === "reject-cancel" ? cancellationReason : undefined,
        );
        const updatedTask = { ...task, ...reviewedTask };
        setTasks((current) => current.map((currentTask) =>
          currentTask.id === task.id ? updatedTask : currentTask,
        ));
        setToast({
          type: "success",
          message: action === "approve-cancel"
            ? "Cancellation approved. The schedule is now retained as CANCELLED."
            : "Cancellation request rejected. The schedule remains active.",
        });
      } else {
        const updatedTask = await updateMaintenanceSchedule({ ...task, status: MaintenanceStatus.PENDING });
        setTasks((current) =>
          current.map((currentTask) => currentTask.id === task.id ? updatedTask : currentTask),
        );
        setToast({
          type: "success",
          message: "Schedule activated and returned to active scheduling.",
        });
      }
      setPendingAction(null);
    } catch (err) {
      console.error(`Failed to ${action} schedule`, err);
      setActionError(err instanceof Error ? err.message : 'The schedule could not be updated. Please try again.');
      setToast({
        type: "warning",
        message: err instanceof Error ? err.message : 'The schedule could not be updated. Please try again.',
      });
    } finally {
      setActionSaving(false);
    }
  };

  const saveOdometerThreshold = async () => {
    if (!thresholdEditTask || !isAdmin || isSavingThreshold) return;
    const thresholdKm = Number(thresholdValue);
    const vehicleReading = vehicles.find((vehicle) => vehicle.value === thresholdEditTask.vehicleId)?.odometer ?? 0;
    const currentOdometer = Math.max(vehicleReading, Number(thresholdEditTask.odometerReading ?? 0));
    if (!Number.isSafeInteger(thresholdKm) || thresholdKm <= 0) {
      setThresholdError("Enter a positive whole-number odometer threshold.");
      return;
    }
    if (thresholdKm <= currentOdometer) {
      setThresholdError(`The target must be in the future. This truck is at ${currentOdometer.toLocaleString()} km; choose a higher threshold or schedule its maintenance immediately.`);
      return;
    }
    if (!thresholdReason.trim()) {
      setThresholdError("A reason for changing the threshold is required.");
      return;
    }

    setIsSavingThreshold(true);
    setThresholdError("");
    try {
      const result = await updateMaintenanceOdometerThreshold(
        thresholdEditTask.id,
        thresholdKm,
        thresholdReason,
      );
      const updatedTask = { ...thresholdEditTask, ...result };
      setTasks((current) => current.map((task) => task.id === updatedTask.id ? updatedTask : task));
      setSelectedSchedules((current) => current.map((task) => task.id === updatedTask.id ? updatedTask : task));
      setThresholdEditTask(null);
      setToast({ type: "success", message: `Odometer threshold updated to ${thresholdKm.toLocaleString()} km and audited.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update the odometer threshold.";
      setThresholdError(message);
      setToast({ type: "error", message });
    } finally {
      setIsSavingThreshold(false);
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
      />

      {canSchedule && <div className="flex justify-end mb-4">
        <ActionButton
          variant="primary"
          className="flex items-center gap-2"
          onClick={() => {
            setEditingTask(null);
            setIsOdometerUpdateOpen(false);
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          <span>{"Create Schedule"}</span>
        </ActionButton>
      </div>}

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
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white shadow-md"
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
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white shadow-md"
                      : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Calendar
                </button>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <SearchInput
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex gap-3">
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
                  setPriorityFilter("All");
                  setPriorityOrder("NONE");
                  setDateFromFilter("");
                  setDateToFilter("");
                  setVehicleFilter("All");
                  setChecklistTemplateNameFilter("All");
                  setDateRangeFilter("All");
                  setCurrentPage(1);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Vehicle"
                    id="vehicleF"
                    options={vehicleOptions}
                    value={vehicleFilter}
                    onChange={(e) => {
                      setVehicleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  <SelectField
                    label="Checklist Template"
                    id="typeF"
                    options={checklistTemplateOptions}
                    value={checklistTemplateFilter}
                    onChange={(e) => {
                      setChecklistTemplateNameFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  <SelectField
                    label="Priority"
                    id="priorityF"
                    options={[
                      { value: "All", label: "All Priorities" },
                      ...Object.values(MaintenancePriority).map((priority) => ({
                        value: priority,
                        label: maintenancePriorityLabels[priority],
                      })),
                    ]}
                    value={priorityFilter}
                    onChange={(e) => {
                      setPriorityFilter(e.target.value as MaintenancePriority | "All");
                      setCurrentPage(1);
                    }}
                  />
                  <SelectField
                    label="Priority Order"
                    id="priorityOrderF"
                    options={[
                      { value: "NONE", label: "Use Start Date" },
                      { value: "HIGH_TO_LOW", label: "High to Low" },
                      { value: "LOW_TO_HIGH", label: "Low to High" },
                    ]}
                    value={priorityOrder}
                    onChange={(e) => {
                      setPriorityOrder(e.target.value as typeof priorityOrder);
                      setCurrentPage(1);
                    }}
                  />
                  <SelectField
                    label="Quick Date"
                    id="dateRF"
                    options={[
                      { value: "All", label: "All Time" },
                      { value: "Today", label: "Today" },
                      { value: "This Week", label: "This Week" },
                      { value: "This Month", label: "This Month" },
                    ]}
                    value={dateRangeFilter}
                    onChange={(e) => {
                      setDateRangeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </FilterDropdown>
            </div>
          </div>

          {viewMode === "list" ? (
            <div className="overflow-visible">
              <DataTable
                data={paginatedTasks}
                getRowKey={(task) => task.id}
                minWidth="900px"
                density="compact"
                onRowClick={(task) => openScheduleDetails([task])}
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
                    render: (task) => task.workOrderNumber ?? "N/A",
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
                    key: "priority",
                    header: "Priority",
                    width: "9%",
                    render: (task) => {
                      const priority = task.priority ?? MaintenancePriority.MEDIUM;
                      const color = priority === MaintenancePriority.HIGH
                        ? "bg-rose-100 text-rose-800"
                        : priority === MaintenancePriority.LOW
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800";
                      return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{maintenancePriorityLabels[priority]}</span>;
                    },
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
                    header: (
                      <button
                        type="button"
                        onClick={() => {
                          setDateSortDirection((direction) =>
                            direction === "desc" ? "asc" : "desc",
                          );
                          setCurrentPage(1);
                        }}
                        className="inline-flex items-center gap-2 uppercase tracking-wide hover:text-white/80"
                      >
                        <span>Start Date</span>
                        {dateSortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ),
                    width: "12%",
                    render: (task) => task.startDate || 'Not recorded',
                  },
                  {
                    key: "mechanic",
                    header: "Mechanic",
                    width: "15%",
                    render: (task) => task.assignedDriver,
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "15%",
                    render: (task) => (
                      <div className="flex flex-col items-start gap-1">
                        <StandardStatusBadge status={task.status} />
                        {getPendingCancellationRequest(task) && (
                          <span className="text-xs font-medium text-amber-700">Cancellation awaiting Admin review</span>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    width: "8%",
                    align: "center",
                    render: (task) => (
                      <ActionMenu
                        open={openActionMenuId === task.id}
                        onToggle={(event) => {
                          event.stopPropagation();
                          setOpenActionMenuId((current) =>
                            current === task.id ? null : task.id,
                          );
                        }}
                        items={[
                          ...(isAdmin &&
                          !task.logNumber &&
                          task.triggerType === MaintenanceTriggerType.ODOMETER &&
                          ([MaintenanceStatus.PENDING, MaintenanceStatus.DUE, MaintenanceStatus.OVERDUE] as MaintenanceStatus[]).includes(task.status) &&
                          !getPendingCancellationRequest(task)
                            ? [{
                                label: "Edit Odometer Threshold",
                                icon: Edit2,
                                onClick: () => {
                                  setOpenActionMenuId(null);
                                  setThresholdEditTask(task);
                                },
                              }]
                            : []),
                          ...(canSchedule && !isInProgressScheduleLocked(task)
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
                          ...(canSchedule && !isInProgressScheduleLocked(task) &&
                          ([MaintenanceStatus.PENDING, MaintenanceStatus.DUE, MaintenanceStatus.OVERDUE] as MaintenanceStatus[]).includes(task.status) &&
                          !getPendingCancellationRequest(task)
                            ? [{
                                label: "Request Cancellation",
                                icon: Ban,
                                danger: true,
                                onClick: () => {
                                  setOpenActionMenuId(null);
                                  setPendingAction({ action: "request-cancel", task });
                                },
                              }]
                            : canSchedule && task.status === MaintenanceStatus.CANCELLED
                            ? [{
                                label: "Activate",
                                icon: Power,
                                onClick: () => {
                                  setOpenActionMenuId(null);
                                  setPendingAction({ action: "activate", task });
                                },
                              }]
                            : []),
                          ...(isAdmin && getPendingCancellationRequest(task)
                            ? [
                                {
                                  label: "Approve Cancellation Request",
                                  icon: ApproveIcon,
                                  onClick: () => {
                                    setOpenActionMenuId(null);
                                    setPendingAction({
                                      action: "approve-cancel",
                                      task,
                                      requestId: getPendingCancellationRequest(task)?.id,
                                    });
                                  },
                                },
                                {
                                  label: "Reject Cancellation Request",
                                  icon: RejectIcon,
                                  danger: true,
                                  onClick: () => {
                                    setOpenActionMenuId(null);
                                    setPendingAction({
                                      action: "reject-cancel",
                                      task,
                                      requestId: getPendingCancellationRequest(task)?.id,
                                    });
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
                    ),
                  },
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
                <div className="text-center">
                  <h2 className="text-base font-bold text-[var(--color-text-primary)] sm:text-lg">
                    {monthName} {yearName}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {filteredTasks.length} visible schedules
                  </p>
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
                    (task) => Boolean(cell.dateStr) && (task.startDate === cell.dateStr || task.dueDate === cell.dateStr),
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
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] transition opacity-0 group-hover:opacity-100"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="space-y-1 text-xs">
                            {visibleSchedules.map((task) => (
                              <button
                                type="button"
                                key={task.id}
                                className={`block w-full rounded-md px-2 py-1.5 text-left transition hover:brightness-105 ${getTaskStyle(task.status)}`}
                              >
                                <span className="block truncate text-[11px] font-bold">
                                  {task.startDate === cell.dateStr ? 'Start' : 'Due'}{task.startDate === cell.dateStr && task.dueDate === cell.dateStr ? ' / Due' : ''}: {' '}
                                  {task.workOrderNumber ?? "N/A"}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            {selectedSchedules.length > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={selectedSchedulePage === 0}
                  onClick={() =>
                    setSelectedSchedulePage((page) => Math.max(0, page - 1))
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {selectedSchedulePage + 1} of {selectedSchedules.length}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    selectedSchedulePage >= selectedSchedules.length - 1
                  }
                  onClick={() =>
                    setSelectedSchedulePage((page) =>
                      Math.min(selectedSchedules.length - 1, page + 1),
                    )
                  }
                >
                  Next
                </Button>
              </div>
            ) : (
              <span />
            )}
            <Button
              variant="secondary"
              onClick={closeScheduleDetails}
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedSchedule && (
            <section
              className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card"
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
                <div className="flex flex-wrap items-center gap-2">
                  {canSchedule && !isInProgressScheduleLocked(selectedSchedule) ? (
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
                  {canShowScheduleUpdate(selectedSchedule) ? (
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

              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {[
              {
                label: "Work Order No.",
                value: selectedSchedule.workOrderNumber ?? "N/A",
              },
              {
                label: "Plate No.",
                value: getVehiclePlateNumber(selectedSchedule.vehicleId),
              },
              { label: "Checklist Template", value: selectedSchedule.title },
              { label: "Priority", value: selectedSchedule.priority ?? MaintenancePriority.MEDIUM },
              {
                label: "Trigger",
                value:
                  selectedSchedule.triggerType
                    ? maintenanceTriggerTypeLabels[selectedSchedule.triggerType]
                    : "Not specified",
              },
              { label: "Date Created", value: selectedSchedule.date },
              { label: "Start Date", value: selectedSchedule.startDate || 'Not recorded' },
              { label: "Due Date", value: selectedSchedule.dueDate },
              { label: "Due Odometer", value: selectedSchedule.dueOdometer != null ? `${selectedSchedule.dueOdometer} km` : undefined },
              { label: "Mechanic", value: selectedSchedule.assignedDriver },
              {
                label: "Chief Mechanic",
                value: selectedSchedule.chiefMechanic || "Not Assigned",
              },
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
                    ? `${timeIntervalFields(selectedSchedule).value} ${timeIntervalFields(selectedSchedule).unit.toLowerCase()}`
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
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {detail.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                    {detail.label === "Status" ? (
                      <StatusBadge status={selectedSchedule.status} />
                    ) : detail.label === "Priority" ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${detail.value === MaintenancePriority.HIGH ? "bg-rose-100 text-rose-800" : detail.value === MaintenancePriority.LOW ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {maintenancePriorityLabels[detail.value as MaintenancePriority]}
                      </span>
                    ) : (
                      detail.value
                    )}
                  </p>
                </div>
              ))}

            {canEditPriority && selectedSchedule.status !== MaintenanceStatus.COMPLETED && selectedSchedule.status !== MaintenanceStatus.CANCELLED && (
              <div className="border-t border-[var(--color-divider)] p-4">
                <label htmlFor="schedule-detail-priority" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Change priority</label>
                <select
                  id="schedule-detail-priority"
                  value={selectedSchedule.priority ?? MaintenancePriority.MEDIUM}
                  disabled={savingPriorityId === selectedSchedule.id}
                  onChange={(event) => void handlePriorityChange(selectedSchedule, event.target.value as MaintenancePriority)}
                  className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2.5 text-sm text-[var(--color-text-primary)] disabled:opacity-60"
                >
                  {Object.values(MaintenancePriority).map((priority) => (
                    <option key={priority} value={priority}>{maintenancePriorityLabels[priority]}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedSchedule.cancellations?.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-[var(--color-border)] p-4 sm:col-span-2">
                <p className="font-semibold">
                  {entry.reviewStatus === "PENDING"
                    ? "Cancellation request awaiting Admin review"
                    : entry.reviewStatus === "LEGACY" || !entry.reviewedByName
                      ? "Cancellation history (no Admin review recorded)"
                      : "Reviewed cancellation request"}
                </p>
                <p className="whitespace-pre-wrap">{entry.reason}</p>
                <p className="text-sm">Requested by {entry.actorName} ({entry.actorEmail}) — {new Date(entry.createdAt).toLocaleString()}</p>
                {entry.reviewedByName && (
                  <p className="text-sm">
                    {entry.reviewStatus === "APPROVED" ? "Approved" : "Rejected"} by {entry.reviewedByName}
                    {entry.reviewedAt ? ` — ${new Date(entry.reviewedAt).toLocaleString()}` : ""}
                  </p>
                )}
                {entry.reviewReason && <p className="text-sm">Admin note: {entry.reviewReason}</p>}
              </div>
            ))}
            {selectedSchedule.notes && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                  {selectedSchedule.notes}
                </p>
              </div>
            )}
              </div>
            </section>
        )}
      </Modal>

      <CreateSchedule
        isOpen={canSchedule && isModalOpen}
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
        isOpen={Boolean(thresholdEditTask)}
        busy={isSavingThreshold}
        title="Edit Odometer Threshold"
        variant="primary"
        confirmLabel="Save Threshold"
        confirmDisabled={!thresholdValue.trim() || !thresholdReason.trim()}
        message={thresholdEditTask ? (
          <div className="space-y-3 text-left">
            <p>
              The threshold is the odometer reading that triggers the next maintenance event. It must remain ahead of the truck's current reading; if the truck is already at the target, use the existing due work order rather than moving the target into the past.
            </p>
            <p className="font-semibold">{thresholdEditTask.title} — {thresholdEditTask.vehicleId}</p>
            <p className="text-sm">
              Current odometer: {Math.max(
                vehicles.find((vehicle) => vehicle.value === thresholdEditTask.vehicleId)?.odometer ?? 0,
                Number(thresholdEditTask.odometerReading ?? 0),
              ).toLocaleString()} km
            </p>
            <label className="block text-sm font-medium">
              New threshold (km)
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={thresholdValue}
                disabled={isSavingThreshold}
                onChange={(event) => setThresholdValue(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-[#c8ced8] bg-white p-3 text-sm outline-none focus:border-[#070b45]"
              />
            </label>
            <label className="block text-sm font-medium">
              Reason (required)
              <textarea
                required
                maxLength={2000}
                rows={3}
                value={thresholdReason}
                disabled={isSavingThreshold}
                onChange={(event) => setThresholdReason(event.target.value)}
                className="mt-2 block w-full rounded-lg border border-[#c8ced8] bg-white p-3 text-sm outline-none focus:border-[#070b45]"
              />
            </label>
            {thresholdError && <p role="alert" className="text-sm text-red-700">{thresholdError}</p>}
          </div>
        ) : ""}
        onConfirm={() => void saveOdometerThreshold()}
        onCancel={() => { if (!isSavingThreshold) setThresholdEditTask(null); }}
      />

      <ConfirmationModal
        isOpen={Boolean(pendingAction)}
        busy={actionSaving}
        confirmDisabled={
          (pendingAction?.action === "request-cancel" || pendingAction?.action === "reject-cancel") &&
          !cancellationReason.trim()
        }
        variant="danger"
        message={
          pendingAction ? (
            <>
              {pendingAction.action === "request-cancel"
                ? "Request cancellation for this maintenance schedule?"
                : pendingAction.action === "activate"
                  ? "Activate this maintenance schedule?"
                  : pendingAction.action === "approve-cancel"
                    ? "Approve this cancellation request?"
                    : pendingAction.action === "reject-cancel"
                      ? "Reject this cancellation request?"
                      : "Review this cancellation request?"}
              <span className="mt-2 block font-normal">
                {pendingAction.action === "request-cancel"
                  ? "The schedule remains active and unchanged until an Admin approves the request. The reason and decision will be retained in its history."
                  : pendingAction.action === "activate"
                    ? "It will return to active scheduling and its status will be recalculated from the schedule trigger."
                    : pendingAction.action === "approve-cancel"
                      ? "The schedule will then be marked CANCELLED and retained in Maintenance History."
                      : "The schedule will remain active. A reason for rejection will be recorded."}
              </span>
              <span className="mt-2 block font-bold">
                {pendingAction.task.title} - {pendingAction.task.vehicleId}
              </span>
              {(pendingAction.action === "request-cancel" || pendingAction.action === "reject-cancel") && (
                <label className="mt-4 block text-left text-sm">
                  {pendingAction.action === "request-cancel" ? "Cancellation request reason" : "Rejection reason"} (required)
                  <textarea required maxLength={2000} value={cancellationReason}
                    disabled={actionSaving} onChange={(event) => setCancellationReason(event.target.value)}
                    className="mt-2 block w-full rounded border border-gray-300 p-2" rows={3} />
                </label>
              )}
              {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
            </>
          ) : (
            ""
          )
        }
        confirmLabel={
          pendingAction?.action === "request-cancel"
            ? "Send Cancellation Request"
            : pendingAction?.action === "activate"
              ? "Activate Schedule"
              : pendingAction?.action === "approve-cancel"
                ? "Approve and Cancel"
                : pendingAction?.action === "reject-cancel"
                  ? "Reject Request"
                  : "Confirm"
        }
        onConfirm={confirmScheduleAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
};

export default MaintenanceSchedulingCombined;
