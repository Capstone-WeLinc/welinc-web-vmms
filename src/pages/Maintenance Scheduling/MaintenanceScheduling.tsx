import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Edit2,
  RefreshCw,
  Trash2,
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
import {
  type MaintenanceStatus,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  getMaintenanceSchedules,
  deleteMaintenanceSchedule,
} from "../../lib/api/maintenanceService";
import { getVehicles } from "../../lib/api/vehicleService";
import { getGarages } from "../../lib/api/locationService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import {
  formatWorkOrderNumber,
  isInProgressStatus,
  isOverdueStatus,
  isPendingStatus,
} from "../../lib/utils/workOrders";

type GarageOption = { id: string; name: string };
type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
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
      case "Overdue":
        return "text-[#c41c3b] bg-[var(--color-status-error)]/15 border-[var(--color-status-error)]/30";
      case "Flagged":
        return "text-[#92400e] bg-[var(--color-status-warning)]/15 border-[var(--color-status-warning)]/30";
      case "In-Progress":
      case "In Progress":
        return "text-[#047857] bg-[var(--color-status-success)]/15 border-[var(--color-status-success)]/30";
      case "Completed":
        return "text-[var(--color-text-secondary)] bg-[var(--color-card-bg)] border-[var(--color-border)]";
      case "Pending":
      default:
        return "text-[#0369a1] bg-[var(--color-status-info)]/15 border-[var(--color-status-info)]/30";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusDetails()}`}
    >
      {status}
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
    case "Overdue":
      return "border border-rose-500/40 bg-rose-500/15 text-rose-700 shadow-sm";
    case "Flagged":
      return "border border-amber-500/50 bg-amber-500/15 text-amber-800 shadow-sm";
    case "In-Progress":
    case "In Progress":
      return "border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 shadow-sm";
    case "Pending":
      return "border border-[var(--color-status-info)]/40 bg-[var(--color-status-info)]/15 text-[#0369a1] shadow-sm";
    default:
      return "border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-sm";
  }
};

const MaintenanceSchedulingCombined = () => {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");
  const [workOrderTemplateFilter, setWorkOrderTemplateFilter] =
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
  const [vehicles, setVehicles] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [garages, setGarages] = useState<GarageOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [isOdometerUpdateOpen, setIsOdometerUpdateOpen] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<MaintenanceTask[]>(
    [],
  );
  const [selectedSchedulePage, setSelectedSchedulePage] = useState(0);
  const [confirmDeleteTask, setConfirmDeleteTask] =
    useState<MaintenanceTask | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useBodyScrollLock(Boolean(confirmDeleteTask));

  const loadMaintenanceSchedules = () => {
    getMaintenanceSchedules().then(setTasks).catch(console.error);
  };

  useEffect(() => {
    loadMaintenanceSchedules();
    getVehicles()
      .then((loadedVehicles) => setVehicles(loadedVehicles))
      .catch(() => console.error("Failed to load vehicles"));
    getGarages()
      .then((loadedGarages) => setGarages(loadedGarages))
      .catch(() => console.error("Failed to load garages"));
  }, []);

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

  const workOrderTemplates = Array.from(
    new Set(tasks.map((task) => task.title)),
  ).sort();
  const workOrderTemplateOptions = [
    { value: "All", label: "All Types" },
    ...workOrderTemplates.map((template) => ({
      value: template,
      label: template,
    })),
  ];

  const vehicleOptions = [{ value: "All", label: "All Vehicles" }, ...vehicles];
  const scheduleStatusOptions = [
    "Pending",
    "In Progress",
    "Overdue",
  ];

  const filteredTasks = tasks
    .filter((task) => {
      const isActiveSchedule =
        isPendingStatus(task.status) ||
        isInProgressStatus(task.status) ||
        isOverdueStatus(task.status);
      const statusMatches =
        selectedStatusFilters.length === 0 ||
        selectedStatusFilters.some(
          (status) =>
            (status === "Pending" && isPendingStatus(task.status)) ||
            (status === "In Progress" && isInProgressStatus(task.status)) ||
            (status === "Overdue" && isOverdueStatus(task.status)) ||
            status === task.status,
        );
      const vehicleMatches =
        vehicleFilter === "All" || task.vehicleId === vehicleFilter;
      const templateMatches =
        workOrderTemplateFilter === "All" ||
        task.title === workOrderTemplateFilter;
      const dateMatches =
        dateFilter(new Date(task.date)) &&
        (!dateFromFilter || task.date >= dateFromFilter) &&
        (!dateToFilter || task.date <= dateToFilter);
      const searchMatches =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assignedDriver.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        isActiveSchedule &&
        statusMatches &&
        vehicleMatches &&
        templateMatches &&
        dateMatches &&
        searchMatches
      );
    })
    .sort((left, right) => {
      const dateComparison = left.date.localeCompare(right.date);
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
  const inProgressCount = tasks.filter(
    (task) => isInProgressStatus(task.status),
  ).length;
  const overdueCount = tasks.filter((task) => task.status === "Overdue").length;
  const flaggedCount = tasks.filter((task) => task.status === "Flagged").length;
  const completedCount = tasks.filter(
    (task) => task.status === "Completed",
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

  const openFullScheduleEdit = (task: MaintenanceTask) => {
    setEditingTask(task);
    setIsOdometerUpdateOpen(false);
    setIsModalOpen(true);
  };

  const openOdometerUpdate = (task: MaintenanceTask) => {
    setEditingTask(task);
    setIsOdometerUpdateOpen(true);
    setIsModalOpen(true);
  };

  const canShowScheduleUpdate = (task: MaintenanceTask) =>
    isPendingStatus(task.status) &&
    (task.triggerType === "ODOMETER" || task.triggerType === "MANUAL");

  const confirmScheduleDelete = async () => {
    if (!confirmDeleteTask) return;
    const taskId = confirmDeleteTask.id;

    try {
      await deleteMaintenanceSchedule(taskId);
      setToast({ type: "error", message: "Record deleted successfully." });
    } catch (err) {
      console.error("Failed to delete schedule", err);
      setToast({
        type: "warning",
        message: "Schedule removed locally. Server delete failed.",
      });
    } finally {
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setConfirmDeleteTask(null);
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

      <div className="flex justify-end mb-4">
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
      </div>

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
            icon={<AlertTriangle size={20} strokeWidth={1.8} />}
            value={flaggedCount}
            label="Flagged"
            subtitle="Needs attention"
            iconColor="#f59e0b"
            iconBgColor="rgba(245, 158, 11, 0.12)"
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
                  setDateFromFilter("");
                  setDateToFilter("");
                  setVehicleFilter("All");
                  setWorkOrderTemplateFilter("All");
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
                    label="Work Order Template"
                    id="typeF"
                    options={workOrderTemplateOptions}
                    value={workOrderTemplateFilter}
                    onChange={(e) => {
                      setWorkOrderTemplateFilter(e.target.value);
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
                    render: (task) => formatWorkOrderNumber(task.id),
                  },
                  {
                    key: "plateNo",
                    header: "Plate No.",
                    width: "10%",
                    render: (task) => <span className="font-medium">{task.vehicleId}</span>,
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
                        {task.triggerType === "TIME"
                          ? "Time-Based"
                          : task.triggerType === "MANUAL"
                            ? "Manual"
                            : "Odometer"}
                      </span>
                    ),
                  },
                  {
                    key: "scheduledDate",
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
                        <span>Date Created</span>
                        {dateSortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ),
                    width: "12%",
                    render: (task) => task.date,
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
                    render: (task) => <StandardStatusBadge status={task.status} />,
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
                          {
                            label: "Edit",
                            icon: Edit2,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              openFullScheduleEdit(task);
                            },
                          },
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
                          {
                            label: "Delete",
                            icon: Trash2,
                            danger: true,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              setConfirmDeleteTask(task);
                            },
                          },
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
                    (task) => task.date === cell.dateStr,
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
                                  {formatWorkOrderNumber(task.id)}
                                </span>
                                <span className="block truncate text-[11px]">
                                  {task.vehicleId}
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
                    {selectedSchedule.vehicleId} - {selectedSchedule.date}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      closeScheduleDetails();
                      openFullScheduleEdit(selectedSchedule);
                    }}
                  >
                    Edit
                  </Button>
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
                value: formatWorkOrderNumber(selectedSchedule.id),
              },
              { label: "Plate No.", value: selectedSchedule.vehicleId },
              { label: "Work Order Template", value: selectedSchedule.title },
              {
                label: "Trigger",
                value:
                  selectedSchedule.triggerType === "TIME"
                    ? "Time-Based"
                    : selectedSchedule.triggerType === "MANUAL"
                      ? "Manual"
                      : selectedSchedule.triggerType === "ODOMETER"
                        ? "Odometer"
                        : "Not specified",
              },
              { label: "Scheduled Date", value: selectedSchedule.date },
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
                value: selectedSchedule.odometerReading
                  ? `${selectedSchedule.odometerReading} km`
                  : undefined,
              },
              { label: "Interval Type", value: selectedSchedule.intervalType },
              {
                label: "Interval",
                value: selectedSchedule.intervalKm
                  ? `${selectedSchedule.intervalKm} km`
                  : undefined,
              },
              {
                label: "Buffer Distance",
                value: selectedSchedule.bufferDistanceKm
                  ? `${selectedSchedule.bufferDistanceKm} km`
                  : undefined,
              },
              {
                label: "Starting Reference",
                value: selectedSchedule.startingReferenceReadingKm
                  ? `${selectedSchedule.startingReferenceReadingKm} km`
                  : undefined,
              },
              {
                label: "Start Reference Date",
                value: selectedSchedule.startReferenceDate,
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
                    ) : (
                      detail.value
                    )}
                  </p>
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
        isOpen={isModalOpen}
        editingTask={editingTask ?? undefined}
        odometerOnly={isOdometerUpdateOpen}
        existingSchedules={tasks}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
          setIsOdometerUpdateOpen(false);
        }}
        onSaved={(task) => {
          setTasks((current) =>
            current.some((existingTask) => existingTask.id === task.id)
              ? current.map((existingTask) =>
                  existingTask.id === task.id
                    ? { ...existingTask, ...task }
                    : existingTask,
                )
              : [task, ...current],
          );
          setIsModalOpen(false);
          setEditingTask(null);
          setIsOdometerUpdateOpen(false);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(confirmDeleteTask)}
        variant="danger"
        message={
          confirmDeleteTask ? (
            <>
              Are you sure you want to delete this schedule?
              <span className="mt-2 block font-bold">
                {confirmDeleteTask.title} - {confirmDeleteTask.vehicleId}
              </span>
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Yes"
        onConfirm={confirmScheduleDelete}
        onCancel={() => setConfirmDeleteTask(null)}
      />
    </div>
  );
};

export default MaintenanceSchedulingCombined;
