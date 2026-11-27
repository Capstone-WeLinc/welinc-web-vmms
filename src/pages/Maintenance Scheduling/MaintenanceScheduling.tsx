import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Edit2,
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
  MaintenanceStatusBadge,
  MaintenanceStatusLegend,
  ToastNotification,
} from "../../components/ui";
import KpiCard from "../../components/ui/KpiCard";
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
  type MaintenancePrediction,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  getMaintenancePredictions,
  getMaintenanceSchedules,
  cancelMaintenanceSchedule,
  reviewMaintenanceScheduleCancellation,
  updateMaintenanceSchedule,
  updateWorkOrderPriority,
  getMaintenanceScheduleExtensionHistory,
  getPendingMaintenanceScheduleExtensions,
  reviewMaintenanceScheduleExtension,
  type MaintenanceScheduleExtensionHistory,
  type PendingMaintenanceScheduleExtension,
} from "../../lib/api/maintenanceService";
import { getVehicles, type VehicleOption } from "../../lib/api/vehicleService";
import { getGarages } from "../../lib/api/locationService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import {
  isInProgressWorkOrder,
  isInProgressStatus,
  isDueStatus,
  isOverdueStatus,
  isPendingStatus,
} from "../../lib/utils/workOrders";
import { getMaintenanceStatusClasses } from "../../lib/utils/maintenanceStatusPresentation";

type GarageOption = { id: string; name: string };
type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};

const formatExtensionTimestamp = (value: string) =>
  new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila" });

type ScheduleStatusAction = "request-cancel" | "approve-cancel" | "reject-cancel" | "activate";
type ScheduleSortOrder =
  | "DUE_DATE_DESC"
  | "DUE_DATE_ASC"
  | "PRIORITY_DESC"
  | "PRIORITY_ASC"
  | "TYPE_ASC"
  | "TYPE_DESC"
  | "BRANCH_ASC"
  | "BRANCH_DESC";
type PendingScheduleAction = {
  action: ScheduleStatusAction;
  task: MaintenanceTask;
  requestId?: string;
};

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
  return `border ${getMaintenanceStatusClasses(status)}`;
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
  const locationSearchKey = `${location.pathname}${location.search}`;
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = useMemo(() => new Date(), []);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() =>
    formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("search") || params.get("q") || "";
  });
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriority | "All">("All");
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");
  const [garageBranchFilter, setGarageBranchFilter] = useState("All");
  const [checklistTemplateFilter, setChecklistTemplateNameFilter] =
    useState<string>("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("All");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] =
    useState<ScheduleSortOrder>("DUE_DATE_DESC");
  const [currentPage, setCurrentPage] = useState(1);
  const [handledLocationSearch, setHandledLocationSearch] =
    useState(locationSearchKey);
  const [schedulesPerPage, setSchedulesPerPage] = useState(8);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [predictions, setPredictions] = useState<MaintenancePrediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(true);
  const [predictionsError, setPredictionsError] = useState("");
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [garages, setGarages] = useState<GarageOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [selectedSchedules, setSelectedSchedules] = useState<MaintenanceTask[]>(
    [],
  );
  const [selectedSchedulePage, setSelectedSchedulePage] = useState(0);
  const [pendingAction, setPendingAction] =
    useState<PendingScheduleAction | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    // Reset confirmation input when the selected action changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCancellationReason('');
    setActionError('');
  }, [pendingAction]);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [savingPriorityId, setSavingPriorityId] = useState<string | null>(null);
  const [extensionQueueOpen, setExtensionQueueOpen] = useState(false);
  const [extensionRequests, setExtensionRequests] = useState<
    PendingMaintenanceScheduleExtension[]
  >([]);
  const [extensionCursor, setExtensionCursor] = useState<string | null>(null);
  const [extensionQueueLoading, setExtensionQueueLoading] = useState(false);
  const [extensionQueueError, setExtensionQueueError] = useState("");
  const [extensionReviewingId, setExtensionReviewingId] = useState<string | null>(null);
  const [extensionReviewReasons, setExtensionReviewReasons] = useState<
    Record<string, string>
  >({});
  const [extensionHistoryState, setExtensionHistoryState] = useState<{
    scheduleId: string;
    history: MaintenanceScheduleExtensionHistory | null;
    error: string;
  } | null>(null);
  const extensionHistoryRequest = useRef(0);

  if (handledLocationSearch !== locationSearchKey) {
    setHandledLocationSearch(locationSearchKey);
    const params = new URLSearchParams(location.search);
    const search = params.get("search") || params.get("q");
    if (search) {
      setSearchQuery(search);
      setCurrentPage(1);
    }
  }

  useBodyScrollLock(Boolean(pendingAction));

  const refreshMaintenancePredictions = () => {
    setPredictionsLoading(true);
    void getMaintenancePredictions()
      .then((loadedPredictions) => {
        setPredictions(loadedPredictions);
        setPredictionsError("");
      })
      .catch((error: unknown) => {
        setPredictions([]);
        setPredictionsError(
          error instanceof Error
            ? error.message
            : "Could not load maintenance predictions.",
        );
      })
      .finally(() => setPredictionsLoading(false));
  };

  const loadMaintenanceSchedules = async () => {
    const loadedTasks = await getMaintenanceSchedules();
    setTasks(loadedTasks);
    return loadedTasks;
  };

  const loadExtensionHistory = useCallback(async (scheduleId: string) => {
    const requestId = ++extensionHistoryRequest.current;
    try {
      const history = await getMaintenanceScheduleExtensionHistory(scheduleId);
      if (requestId === extensionHistoryRequest.current) {
        setExtensionHistoryState({ scheduleId, history, error: "" });
      }
    } catch (error) {
      if (requestId === extensionHistoryRequest.current) {
        setExtensionHistoryState({
          scheduleId,
          history: null,
          error:
            error instanceof Error
              ? error.message
              : "Could not load schedule extension history.",
        });
      }
    }
  }, []);

  const loadPendingExtensions = async (
    cursor: string | null = null,
    append = false,
  ) => {
    setExtensionQueueLoading(true);
    setExtensionQueueError("");
    try {
      const page = await getPendingMaintenanceScheduleExtensions(cursor);
      setExtensionRequests((current) =>
        append ? [...current, ...page.items] : page.items,
      );
      setExtensionCursor(page.nextCursor);
    } catch (error) {
      setExtensionQueueError(
        error instanceof Error
          ? error.message
          : "Could not load pending extension requests.",
      );
    } finally {
      setExtensionQueueLoading(false);
    }
  };

  const reviewExtension = async (
    request: PendingMaintenanceScheduleExtension,
    decision: "APPROVE" | "REJECT",
  ) => {
    const reason = extensionReviewReasons[request.id]?.trim() ?? "";
    if (decision === "REJECT" && !reason) {
      setExtensionQueueError("Enter a reason before rejecting this request.");
      return;
    }

    setExtensionReviewingId(request.id);
    setExtensionQueueError("");
    try {
      const result = await reviewMaintenanceScheduleExtension(
        request.scheduleId,
        request.id,
        decision,
        reason,
      );
      const updateSchedule = (schedule: MaintenanceTask) =>
        schedule.id === result.scheduleId
          ? {
              ...schedule,
              status: result.status,
              targetDueDate: result.targetDueDate,
              dueDate: result.targetDueDate ?? schedule.dueDate,
            }
          : schedule;
      setTasks((current) => current.map(updateSchedule));
      setSelectedSchedules((current) => current.map(updateSchedule));
      setExtensionRequests((current) =>
        current.filter((entry) => entry.id !== request.id),
      );
      setExtensionReviewReasons((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      setToast({
        type: "success",
        message:
          decision === "APPROVE"
            ? "Schedule extension approved."
            : "Schedule extension rejected.",
      });
      if (selectedSchedule?.id === result.scheduleId) {
        void loadExtensionHistory(result.scheduleId);
      }
    } catch (error) {
      setExtensionQueueError(
        error instanceof Error
          ? error.message
          : "Could not review the extension request.",
      );
    } finally {
      setExtensionReviewingId(null);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadMaintenanceSchedules().catch(console.error), 0);
    getVehicles(false)
      .then((loadedVehicles) => setVehicles(loadedVehicles))
      .catch(() => console.error("Failed to load vehicles"));
    getGarages()
      .then((loadedGarages) => setGarages(loadedGarages))
      .catch(() => console.error("Failed to load garages"));
    return () => window.clearTimeout(initialLoad);
  }, []);

  useEffect(() => {
    if (!canSchedule) return;
    let cancelled = false;
    void getMaintenancePredictions()
      .then((loadedPredictions) => {
        if (cancelled) return;
        setPredictions(loadedPredictions);
        setPredictionsError("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPredictions([]);
        setPredictionsError(
          error instanceof Error
            ? error.message
            : "Could not load maintenance predictions.",
        );
      })
      .finally(() => {
        if (!cancelled) setPredictionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canSchedule]);

  useEffect(() => {
    if (!canSchedule || new URLSearchParams(location.search).get("create") !== "true") return;
    // A create query parameter opens a fresh schedule form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingTask(null);
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
    { value: "All", label: "All Maintenance Types" },
    ...checklistTemplates.map((template) => ({
      value: template,
      label: template,
    })),
  ];

  const vehicleOptions = [{ value: "All", label: "All Vehicles" }, ...vehicles];
  const vehiclesByIdentifier = useMemo(() => {
    const lookup = new Map<string, VehicleOption>();
    for (const vehicle of vehicles) {
      lookup.set(vehicle.value, vehicle);
      if (vehicle.id) lookup.set(vehicle.id, vehicle);
      if (vehicle.plateNumber) lookup.set(vehicle.plateNumber, vehicle);
    }
    return lookup;
  }, [vehicles]);
  const getVehicleOption = (vehicleId?: string) =>
    vehicleId ? vehiclesByIdentifier.get(vehicleId) : undefined;
  const garageNameById = useMemo(
    () => new Map(garages.map((garage) => [garage.id, garage.name])),
    [garages],
  );
  const branchGarageIds = Array.from(
    new Set(
      vehicles.flatMap((vehicle) =>
        vehicle.branchGarageId ? [vehicle.branchGarageId] : [],
      ),
    ),
  );
  const branchFilterOptions = [
    { value: "All", label: "All Garage Branches" },
    ...branchGarageIds
      .map((id) => ({
        value: id,
        label: garageNameById.get(id) ?? "Unknown Garage",
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    ...(vehicles.some((vehicle) => !vehicle.branchGarageId)
      ? [{ value: "unassigned", label: "Unassigned" }]
      : []),
  ];
  const getVehicleBranchName = (vehicleId?: string) => {
    const branchGarageId = getVehicleOption(vehicleId)?.branchGarageId;
    return branchGarageId
      ? garageNameById.get(branchGarageId) ?? "Unknown Garage"
      : "Unassigned";
  };
  const getVehiclePlateNumber = (vehicleId?: string) => {
    if (!vehicleId) return "";
    const vehicle = getVehicleOption(vehicleId);
    return vehicle?.plateNumber ?? vehicle?.value ?? vehicleId;
  };
  const trimmedSearchQuery = searchQuery.trim();
  const uuidSearchMatch =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmedSearchQuery,
    )
      ? tasks.find((task) => task.id === trimmedSearchQuery)
      : undefined;
  const displaySearchQuery = uuidSearchMatch
    ? uuidSearchMatch.workOrderNumber?.trim() ||
      getVehiclePlateNumber(uuidSearchMatch.vehicleId) ||
      uuidSearchMatch.title ||
      trimmedSearchQuery
    : searchQuery;
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
            (status === MaintenanceStatus.IN_PROGRESS && isInProgressWorkOrder(task)) ||
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
      const taskBranchGarageId = taskVehicle?.branchGarageId;
      const garageBranchMatches =
        garageBranchFilter === "All" ||
        (garageBranchFilter === "unassigned"
          ? Boolean(taskVehicle) && !taskBranchGarageId
          : taskBranchGarageId === garageBranchFilter);
      const candidateDates = [task.dueDate];
      const dateMatches = (dateRangeFilter === 'All' && !dateFromFilter && !dateToFilter) ||
        candidateDates.some((date) => date && dateFilter(new Date(`${date}T00:00:00`)) &&
          (!dateFromFilter || date >= dateFromFilter) && (!dateToFilter || date <= dateToFilter));
      const query = displaySearchQuery.toLowerCase();
      const searchMatches =
        task.id.toLowerCase().includes(query) ||
        (task.workOrderNumber ?? "").toLowerCase().includes(query) ||
        task.title.toLowerCase().includes(query) ||
        task.vehicleId.toLowerCase().includes(query) ||
        getVehiclePlateNumber(task.vehicleId).toLowerCase().includes(query) ||
        task.assignedDriver.toLowerCase().includes(query);
      return (
        isVisibleSchedule &&
        statusMatches &&
        priorityMatches &&
        vehicleMatches &&
        garageBranchMatches &&
        templateMatches &&
        dateMatches &&
        searchMatches
      );
    })
    .sort((left, right) => {
      const dateComparison = (left.dueDate ?? "").localeCompare(
        right.dueDate ?? "",
      );
      if (sortOrder === "DUE_DATE_ASC" || sortOrder === "DUE_DATE_DESC") {
        const dueDateOrder =
          sortOrder === "DUE_DATE_ASC" ? dateComparison : -dateComparison;
        if (dueDateOrder !== 0) return dueDateOrder;
        return right.id.localeCompare(left.id);
      }

      let comparison = 0;
      if (sortOrder === "PRIORITY_ASC" || sortOrder === "PRIORITY_DESC") {
        const rank: Record<MaintenancePriority, number> = {
          [MaintenancePriority.HIGH]: 3,
          [MaintenancePriority.MEDIUM]: 2,
          [MaintenancePriority.LOW]: 1,
        };
        comparison =
          rank[left.priority ?? MaintenancePriority.MEDIUM] -
          rank[right.priority ?? MaintenancePriority.MEDIUM];
        if (sortOrder === "PRIORITY_DESC") comparison *= -1;
      } else if (sortOrder === "TYPE_ASC" || sortOrder === "TYPE_DESC") {
        comparison = left.title.localeCompare(right.title, undefined, {
          sensitivity: "base",
        });
        if (sortOrder === "TYPE_DESC") comparison *= -1;
      } else if (sortOrder === "BRANCH_ASC" || sortOrder === "BRANCH_DESC") {
        comparison = getVehicleBranchName(left.vehicleId).localeCompare(
          getVehicleBranchName(right.vehicleId),
          undefined,
          { sensitivity: "base" },
        );
        if (sortOrder === "BRANCH_DESC") comparison *= -1;
      }
      if (comparison !== 0) return comparison;
      if (dateComparison !== 0) return -dateComparison;
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

  const selectedCalendarDateLabel = new Date(
    `${selectedCalendarDate}T00:00:00`,
  ).toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const selectedDaySchedules = filteredTasks.filter(
    (task) => task.dueDate === selectedCalendarDate,
  );
  const currentMonthKey = formatDateStr(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  ).slice(0, 7);
  const monthDueScheduleCount = filteredTasks.filter((task) =>
    task.dueDate?.startsWith(currentMonthKey),
  ).length;

  const setCalendarMonth = (date: Date) => {
    setCurrentDate(date);
    setSelectedCalendarDate(
      formatDateStr(date.getFullYear(), date.getMonth(), 1),
    );
  };
  const prevMonth = () =>
    setCalendarMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  const nextMonth = () =>
    setCalendarMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  const goToToday = () => {
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedCalendarDate(
      formatDateStr(today.getFullYear(), today.getMonth(), today.getDate()),
    );
  };

  const openScheduleDetails = (schedules: MaintenanceTask[]) => {
    setSelectedSchedules(schedules);
    setSelectedSchedulePage(0);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const search = params.get("search") || params.get("q");
    if (!search) return;
    params.delete("search");
    params.delete("q");
    const nextSearch = params.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const closeScheduleDetails = () => {
    extensionHistoryRequest.current += 1;
    setExtensionHistoryState(null);
    setSelectedSchedules([]);
    setSelectedSchedulePage(0);
  };

  const selectedSchedule =
    selectedSchedules[selectedSchedulePage] ?? selectedSchedules[0] ?? null;
  const selectedScheduleId = selectedSchedule?.id;
  const currentExtensionHistory =
    extensionHistoryState?.scheduleId === selectedScheduleId
      ? extensionHistoryState
      : null;
  const extensionHistory = currentExtensionHistory?.history ?? null;
  const extensionHistoryLoading =
    Boolean(selectedScheduleId) && !currentExtensionHistory;
  const extensionHistoryError = currentExtensionHistory?.error ?? "";

  useEffect(() => {
    if (!selectedScheduleId) return;
    const requestId = ++extensionHistoryRequest.current;
    void getMaintenanceScheduleExtensionHistory(selectedScheduleId)
      .then((history) => {
        if (requestId === extensionHistoryRequest.current) {
          setExtensionHistoryState({
            scheduleId: selectedScheduleId,
            history,
            error: "",
          });
        }
      })
      .catch((error: unknown) => {
        if (requestId === extensionHistoryRequest.current) {
          setExtensionHistoryState({
            scheduleId: selectedScheduleId,
            history: null,
            error:
              error instanceof Error
                ? error.message
                : "Could not load schedule extension history.",
          });
        }
      });
    return () => {
      if (requestId === extensionHistoryRequest.current) {
        extensionHistoryRequest.current += 1;
      }
    };
  }, [selectedScheduleId]);

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

  const getGarageName = (garageId?: string | null) => {
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
    setIsModalOpen(true);
  };

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

      <MaintenanceStatusLegend />

      {canSchedule && (
        <section
          aria-labelledby="maintenance-predictions-title"
          className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-divider)] px-5 py-4">
            <div>
              <h2
                id="maintenance-predictions-title"
                className="text-base font-bold text-[var(--color-text-primary)]"
              >
                Projected odometer due dates
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Read-only suggestions based on recent vehicle readings. They do not create or change schedules.
              </p>
            </div>
            <button
              type="button"
              disabled={predictionsLoading}
              onClick={refreshMaintenancePredictions}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-card-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {predictionsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {predictionsLoading && (
            <p role="status" className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
              Loading odometer projections...
            </p>
          )}
          {predictionsError && (
            <div role="alert" className="px-5 py-4 text-sm text-red-700">
              {predictionsError} Use Refresh to try again.
            </div>
          )}
          {!predictionsLoading && !predictionsError && predictions.length === 0 && (
            <p role="status" className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
              No eligible odometer schedules are projected to reach their due reading within 30 days.
            </p>
          )}
          {predictions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-[52rem] w-full text-left text-sm">
                <caption className="sr-only">
                  Odometer-based maintenance schedules projected due within 30 days
                </caption>
                <thead className="bg-[var(--color-card-bg-hover)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Vehicle and schedule</th>
                    <th scope="col" className="px-5 py-3">Odometer</th>
                    <th scope="col" className="px-5 py-3">Projected due</th>
                    <th scope="col" className="px-5 py-3">Reading history</th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-divider)]">
                  {predictions.map((prediction) => (
                    <tr key={prediction.scheduleId}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {prediction.vehicleId}
                        </p>
                        <p className="mt-1 text-[var(--color-text-secondary)]">
                          {prediction.title} · {prediction.workOrderNumber}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-[var(--color-text-primary)]">
                        {prediction.currentOdometer.toLocaleString("en-PH")} km
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          Due at {prediction.dueOdometer.toLocaleString("en-PH")} km
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {prediction.remainingKm.toLocaleString("en-PH")} km remaining
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {new Date(`${prediction.estimatedDueDate}T00:00:00+08:00`).toLocaleDateString(
                            "en-PH",
                            { timeZone: "Asia/Manila", dateStyle: "medium" },
                          )}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {prediction.daysUntilDue === 0
                            ? "Expected today"
                            : `Expected in ${prediction.daysUntilDue} days`}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                        <p>{prediction.historyCount} readings</p>
                        <p className="mt-1 text-xs">
                          {prediction.historyStartDate} to {prediction.historyEndDate}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `${location.pathname}?search=${encodeURIComponent(prediction.workOrderNumber ?? prediction.title ?? "")}`,
                            )
                          }
                          aria-label={`Open ${prediction.vehicleId} ${prediction.title} schedule`}
                          className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-brand-primary)] underline underline-offset-4 transition hover:bg-[var(--color-card-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]"
                        >
                          Open schedule
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {(canSchedule || isAdmin) && (
        <div className="mb-4 flex flex-wrap justify-end gap-3">
          {isAdmin && (
            <ActionButton
              variant={extensionQueueOpen ? "secondary" : "primary"}
              onClick={() => {
                const nextOpen = !extensionQueueOpen;
                setExtensionQueueOpen(nextOpen);
                if (nextOpen) void loadPendingExtensions();
              }}
            >
              {extensionQueueOpen ? "Hide Extension Requests" : "Review Extensions"}
            </ActionButton>
          )}
          {canSchedule && (
            <ActionButton
              variant="primary"
              className="flex items-center gap-2"
              onClick={() => {
                setEditingTask(null);
                setIsModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Create Schedule</span>
            </ActionButton>
          )}
        </div>
      )}

      {isAdmin && extensionQueueOpen && (
        <section
          aria-labelledby="schedule-extension-queue-title"
          className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-divider)] px-5 py-4">
            <div>
              <h2
                id="schedule-extension-queue-title"
                className="text-base font-bold text-[var(--color-text-primary)]"
              >
                Pending schedule extensions
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Review requests from assigned Mechanics. Rejections require a reason.
              </p>
            </div>
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              Up to 50 requests per page
            </span>
          </div>

          {extensionQueueError && (
            <div role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {extensionQueueError}
            </div>
          )}
          {extensionQueueLoading && (
            <p role="status" className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
              Loading extension requests…
            </p>
          )}
          {!extensionQueueLoading && !extensionQueueError && extensionRequests.length === 0 && (
            <p role="status" className="px-5 py-4 text-sm text-[var(--color-text-secondary)]">
              No pending extension requests.
            </p>
          )}

          {extensionRequests.length > 0 && (
            <div className="divide-y divide-[var(--color-divider)]">
              {extensionRequests.map((request) => (
                <article
                  key={request.id}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-[var(--color-text-primary)]">
                      {request.schedule.workOrderNumber ?? request.schedule.title}
                      {" · "}
                      {getVehiclePlateNumber(request.schedule.vehicleId)}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {request.schedule.title} · {maintenanceStatusLabels[request.schedule.status]}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Requested by {request.actorName} on {formatExtensionTimestamp(request.requestedAt)}
                    </p>
                    <p className="text-sm text-[var(--color-text-primary)]">
                      Current due date: {request.schedule.targetDueDate ?? "Not recorded"} · Requested: {request.requestedDueDate}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                      {request.reason}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor={`extension-review-reason-${request.id}`}
                      className="block text-xs font-semibold text-[var(--color-text-secondary)]"
                    >
                      Rejection reason (required to reject)
                    </label>
                    <textarea
                      id={`extension-review-reason-${request.id}`}
                      maxLength={2000}
                      rows={2}
                      value={extensionReviewReasons[request.id] ?? ""}
                      disabled={extensionReviewingId === request.id}
                      onChange={(event) =>
                        setExtensionReviewReasons((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 disabled:opacity-60"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton
                        disabled={extensionReviewingId === request.id}
                        onClick={() => void reviewExtension(request, "APPROVE")}
                      >
                        Approve
                      </ActionButton>
                      <ActionButton
                        variant="danger"
                        disabled={
                          extensionReviewingId === request.id ||
                          !(extensionReviewReasons[request.id] ?? "").trim()
                        }
                        onClick={() => void reviewExtension(request, "REJECT")}
                      >
                        Reject
                      </ActionButton>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {extensionCursor && (
            <div className="border-t border-[var(--color-divider)] px-5 py-3 text-right">
              <ActionButton
                variant="secondary"
                disabled={extensionQueueLoading}
                onClick={() => void loadPendingExtensions(extensionCursor, true)}
              >
                Load more requests
              </ActionButton>
            </div>
          )}
        </section>
      )}

      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            icon={<TrendingUp size={20} strokeWidth={1.8} />}
            value={`${compliance}%`}
            label="Compliance"
            hint="Fleet score"
            color="#22c55e"
            iconBackgroundColor="rgba(34, 197, 94, 0.12)"
          />
          <KpiCard
            icon={<Clock size={20} strokeWidth={1.8} />}
            value={pendingCount}
            label="Pending"
            hint="Awaiting start"
            color="#047857"
            iconBackgroundColor="rgba(4, 120, 87, 0.12)"
          />
          <KpiCard
            icon={<AlertCircle size={20} strokeWidth={1.8} />}
            value={dueCount}
            label="Due"
            hint="Ready to start"
            color="#c2410c"
            iconBackgroundColor="rgba(194, 65, 12, 0.12)"
          />
          <KpiCard
            icon={<Play size={20} strokeWidth={1.8} />}
            value={inProgressCount}
            label="In-Progress"
            hint="Ongoing tasks"
            color="#14b8a6"
            iconBackgroundColor="rgba(20, 184, 166, 0.12)"
          />
          <KpiCard
            icon={<AlertCircle size={20} strokeWidth={1.8} />}
            value={overdueCount}
            label="Overdue"
            hint="Tasks overdue"
            color="#ef4444"
            iconBackgroundColor="rgba(239, 68, 68, 0.12)"
          />
          <KpiCard
            icon={<CheckCircle2 size={20} strokeWidth={1.8} />}
            value={completedCount}
            label="Completed"
            hint="Finished tasks"
            color="#94a3b8"
            iconBackgroundColor="rgba(148, 163, 184, 0.12)"
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
              <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-1">
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

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <SearchInput
                placeholder="Search tasks..."
                value={displaySearchQuery}
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
                  setGarageBranchFilter("All");
                  setSortOrder("DUE_DATE_DESC");
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
                    label="Garage Branch"
                    id="garageBranchF"
                    options={branchFilterOptions}
                    value={garageBranchFilter}
                    onChange={(e) => {
                      setGarageBranchFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                  <SelectField
                    label="Maintenance Type"
                    id="maintenanceTypeF"
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
                    label="Sort by"
                    id="sortOrderF"
                    options={[
                      { value: "DUE_DATE_DESC", label: "Due Date: Descending" },
                      { value: "DUE_DATE_ASC", label: "Due Date: Ascending" },
                      { value: "PRIORITY_DESC", label: "Priority: High to Low" },
                      { value: "PRIORITY_ASC", label: "Priority: Low to High" },
                      { value: "TYPE_ASC", label: "Maintenance Type: A to Z" },
                      { value: "TYPE_DESC", label: "Maintenance Type: Z to A" },
                      { value: "BRANCH_ASC", label: "Garage Branch: A to Z" },
                      { value: "BRANCH_DESC", label: "Garage Branch: Z to A" },
                    ]}
                    value={sortOrder}
                    onChange={(e) => {
                      setSortOrder(e.target.value as ScheduleSortOrder);
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
                    header: "Maintenance Type",
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
                    key: "dueDate",
                    header: "Due Date",
                    width: "12%",
                    render: (task) => task.dueDate || 'Not recorded',
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
                        <MaintenanceStatusBadge status={task.status} />
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
              <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2">
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
                    {monthDueScheduleCount} due{" "}
                    {monthDueScheduleCount === 1 ? "schedule" : "schedules"} this month
                  </p>
                </div>
                <button
                  type="button"
                  onClick={goToToday}
                  className="min-h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-card-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]"
                >
                  Today
                </button>
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
                    (task) =>
                      Boolean(cell.dateStr) && task.dueDate === cell.dateStr,
                  );
                  const isToday = Boolean(cell.dateStr) && cell.dateStr === formatLocalDate(today);
                  const isSelected = cell.dateStr === selectedCalendarDate;
                  const visibleSchedules = schedulesForDay.slice(0, 2);
                  const hiddenScheduleCount = schedulesForDay.length - visibleSchedules.length;
                  const dateLabel = cell.dateStr
                    ? new Date(`${cell.dateStr}T00:00:00`).toLocaleDateString(
                        "en-PH",
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )
                    : "";

                  return (
                    <div
                      key={cell.dateStr ?? `blank-${idx}`}
                      className={`min-h-16 rounded-lg border p-1 sm:min-h-20 sm:p-1.5 lg:min-h-32 lg:p-2 ${
                        cell.day
                          ? `bg-white ${isSelected ? "border-[var(--color-brand-primary)] ring-1 ring-[var(--color-brand-primary)]/30" : isToday ? "border-[#070b45]" : "border-[#dde4ef]"}`
                          : "bg-transparent border-transparent"
                      }`}
                    >
                      {cell.day && (
                        <>
                          <div className="mb-1 flex items-center justify-between">
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={`${dateLabel}, ${schedulesForDay.length} due ${
                                schedulesForDay.length === 1 ? "schedule" : "schedules"
                              }`}
                              onClick={() =>
                                cell.dateStr &&
                                setSelectedCalendarDate(cell.dateStr)
                              }
                              className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] sm:h-9 sm:min-w-9 ${
                                isSelected
                                  ? "bg-[var(--color-brand-primary)] text-white"
                                  : isToday
                                    ? "bg-[#070b45] text-white"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]"
                              }`}
                            >
                              {cell.day}
                            </button>
                            {schedulesForDay.length > 0 ? (
                              <span className="rounded-full bg-[#eef2ff] px-1.5 py-0.5 text-[10px] font-bold text-[#070b45] sm:px-2">
                                {schedulesForDay.length}
                              </span>
                            ) : null}
                          </div>
                          <div className="hidden space-y-1 text-xs lg:block">
                            {visibleSchedules.map((task) => (
                              <button
                                type="button"
                                key={task.id}
                                aria-label={`${task.title}, ${getVehiclePlateNumber(task.vehicleId)}, due ${dateLabel}, ${maintenanceStatusLabels[task.status]}`}
                                onClick={() => openScheduleDetails([task])}
                                className={`block w-full rounded-md px-2 py-1.5 text-left transition hover:brightness-105 ${getTaskStyle(task.status)}`}
                              >
                                <span className="block truncate text-[11px] font-bold">
                                  {task.title}
                                </span>
                                <span className="block truncate text-[11px] opacity-80">
                                  {getVehiclePlateNumber(task.vehicleId)} ·{" "}
                                  {task.workOrderNumber ?? "No work order"}
                                </span>
                              </button>
                            ))}
                            {hiddenScheduleCount > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openScheduleDetails(
                                    schedulesForDay.slice(visibleSchedules.length),
                                  )
                                }
                                aria-label={`Show ${hiddenScheduleCount} more due ${
                                  hiddenScheduleCount === 1
                                    ? "schedule"
                                    : "schedules"
                                } for ${dateLabel}`}
                                className="min-h-9 w-full rounded-md bg-[#f1f5f9] px-2 py-1 text-left text-[11px] font-bold text-[#475569] hover:bg-[#e2e8f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]"
                              >
                                +{hiddenScheduleCount} more
                              </button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <section
                aria-labelledby="selected-calendar-day"
                className="mt-4 border-t border-[var(--color-border)] pt-4 lg:hidden"
              >
                <h3
                  id="selected-calendar-day"
                  className="text-base font-semibold text-[var(--color-text-primary)]"
                >
                  Due schedules for {selectedCalendarDateLabel}
                </h3>
                {selectedDaySchedules.length ? (
                  <ul className="mt-3 divide-y divide-[var(--color-border)]">
                    {selectedDaySchedules.map((task) => (
                      <li key={task.id} className="py-2 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => openScheduleDetails([task])}
                          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--color-card-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                              {task.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-[var(--color-text-secondary)]">
                              {getVehiclePlateNumber(task.vehicleId)} ·{" "}
                              {task.workOrderNumber ?? "No work order"}
                              {task.dueOdometer != null
                                ? ` · ${task.dueOdometer.toLocaleString()} km`
                                : ""}
                            </span>
                          </span>
                          <MaintenanceStatusBadge status={task.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    No due schedules on this day.
                  </p>
                )}
              </section>
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
              className="overflow-hidden"
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
                      <MaintenanceStatusBadge status={selectedSchedule.status} />
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
            <section
              aria-labelledby="schedule-extension-history-title"
              className="space-y-3 rounded-xl border border-[var(--color-border)] p-4 sm:col-span-2"
            >
              <div>
                <h4
                  id="schedule-extension-history-title"
                  className="font-semibold text-[var(--color-text-primary)]"
                >
                  Extension and reschedule history
                </h4>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Request decisions and date changes are retained for audit.
                </p>
              </div>
              {extensionHistoryLoading && (
                <p role="status" className="text-sm text-[var(--color-text-secondary)]">
                  Loading schedule history…
                </p>
              )}
              {extensionHistoryError && (
                <p role="alert" className="text-sm text-red-700">
                  {extensionHistoryError}
                </p>
              )}
              {extensionHistory && (
                <>
                  {extensionHistory.requests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {request.reviewStatus === "PENDING"
                            ? "Extension requested"
                            : `Extension ${request.reviewStatus.toLowerCase()}`}
                        </p>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {formatExtensionTimestamp(request.requestedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Requested by {request.actorName} · New due date {request.requestedDueDate}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                        {request.reason}
                      </p>
                      {request.reviewedByName && (
                        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                          Reviewed by {request.reviewedByName}
                          {request.reviewedAt
                            ? ` · ${formatExtensionTimestamp(request.reviewedAt)}`
                            : ""}
                        </p>
                      )}
                      {request.reviewReason && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">
                          Rejection reason: {request.reviewReason}
                        </p>
                      )}
                    </article>
                  ))}
                  {extensionHistory.rescheduleEvents.map((event, index) => (
                    <article
                      key={`${event.changedAt}-${event.source}-${index}`}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3"
                    >
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {event.source === "EXTENSION_APPROVAL"
                          ? "Extension date change"
                          : "Manual schedule date change"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Changed by {event.actorName} · {formatExtensionTimestamp(event.changedAt)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                        Due date: {event.previousTargetDueDate ?? "Not recorded"} → {event.newTargetDueDate ?? "Not recorded"}
                      </p>
                      {(event.previousStartDate || event.newStartDate) && (
                        <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                          Start date: {event.previousStartDate ?? "Not recorded"} → {event.newStartDate ?? "Not recorded"}
                        </p>
                      )}
                    </article>
                  ))}
                  {extensionHistory.requests.length === 0 &&
                    extensionHistory.rescheduleEvents.length === 0 && (
                      <p role="status" className="text-sm text-[var(--color-text-secondary)]">
                        No extension or reschedule history recorded.
                      </p>
                    )}
                </>
              )}
            </section>
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
        existingSchedules={tasks}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSaved={async (task) => {
          // Update immediately, then refresh the entire collection so schedules
          // on every pagination page receive server-calculated status changes.
          setTasks((current) =>
            current.some((existingTask) => existingTask.id === task.id)
              ? current.map((existingTask) =>
                  existingTask.id === task.id
                    ? { ...existingTask, ...task }
                    : existingTask,
                )
              : [task, ...current],
          );

          try {
            await loadMaintenanceSchedules();
          } catch (error) {
            console.error("Failed to refresh maintenance schedules", error);
          }
          refreshMaintenancePredictions();
          setIsModalOpen(false);
          setEditingTask(null);
        }}
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
