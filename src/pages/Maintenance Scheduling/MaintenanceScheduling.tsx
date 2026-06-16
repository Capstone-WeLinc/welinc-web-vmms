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
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { Card, Modal } from "../../components/ui";
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
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { formatWorkOrderNumber } from "../../lib/utils/workOrders";

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
        "bg-[var(--color-status-error)]/15 text-[#c41c3b] hover:bg-[var(--color-status-error)]/25 border border-[var(--color-status-error)]/30 dark:text-[#fca5ac]";
      break;
    case "warning":
      variantClass =
        "bg-[var(--color-status-warning)]/15 text-[#92400e] hover:bg-[var(--color-status-warning)]/25 border border-[var(--color-status-warning)]/30 dark:text-[#fed7aa]";
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
        return "text-[#c41c3b] bg-[var(--color-status-error)]/15 border-[var(--color-status-error)]/30 dark:text-[#fca5ac]";
      case "Flagged":
        return "text-[#92400e] bg-[var(--color-status-warning)]/15 border-[var(--color-status-warning)]/30 dark:text-[#fed7aa]";
      case "In-Progress":
        return "text-[#047857] bg-[var(--color-status-success)]/15 border-[var(--color-status-success)]/30 dark:text-[#a7f3d0]";
      case "Completed":
        return "text-[var(--color-text-secondary)] bg-[var(--color-card-bg)] border-[var(--color-border)]";
      case "Pending":
      default:
        return "text-[#0369a1] bg-[var(--color-status-info)]/15 border-[var(--color-status-info)]/30 dark:text-[#7dd3fc]";
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
const InputField = ({
  label,
  id,
  className = "",
  onChange,
  value,
  placeholder,
  type = "text",
  disabled,
}: {
  label: string;
  id: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="w-full text-left">
      {label && (
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-1.5 text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
    )}
    <input
      id={id}
      className={`w-full px-4 py-2.5 rounded-xl border font-normal text-sm transition-colors duration-200 bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 focus:outline-hidden ${className}`}
      onChange={onChange}
      value={value}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
    />
  </div>
);
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
      return "border border-rose-500/40 bg-rose-500/15 text-rose-700 shadow-sm dark:border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-200";
    case "Flagged":
      return "border border-amber-500/50 bg-amber-500/15 text-amber-800 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200";
    case "In-Progress":
      return "border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200";
    case "Pending":
      return "border border-[var(--color-status-info)]/40 bg-[var(--color-status-info)]/15 text-[#0369a1] shadow-sm dark:border-[var(--color-status-info)]/30 dark:bg-[var(--color-status-info)]/20 dark:text-[#7dd3fc]";
    default:
      return "border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-sm";
  }
};

const MaintenanceSchedulingCombined = () => {
  const schedulesPerPage = 8;
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = useMemo(() => new Date(), []);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");
  const [workOrderTemplateFilter, setWorkOrderTemplateFilter] =
    useState<string>("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("All");
  const [dateSortDirection, setDateSortDirection] = useState<"asc" | "desc">(
    "desc",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [vehicles, setVehicles] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [isOdometerUpdateOpen, setIsOdometerUpdateOpen] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<MaintenanceTask[]>(
    [],
  );
  const [selectedSchedulePage, setSelectedSchedulePage] = useState(0);
  const [confirmDeleteTask, setConfirmDeleteTask] =
    useState<MaintenanceTask | null>(null);

  useBodyScrollLock(Boolean(confirmDeleteTask));

  const loadMaintenanceSchedules = () => {
    getMaintenanceSchedules().then(setTasks).catch(console.error);
  };

  useEffect(() => {
    loadMaintenanceSchedules();
    getVehicles()
      .then((loadedVehicles) => setVehicles(loadedVehicles))
      .catch(() => console.error("Failed to load vehicles"));
  }, []);

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

  const filteredTasks = tasks
    .filter((task) => {
      const statusMatches =
        statusFilter === "All" || task.status === statusFilter;
      const vehicleMatches =
        vehicleFilter === "All" || task.vehicleId === vehicleFilter;
      const templateMatches =
        workOrderTemplateFilter === "All" ||
        task.title === workOrderTemplateFilter;
      const dateMatches = dateFilter(new Date(task.date));
      const searchMatches =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.assignedDriver.toLowerCase().includes(searchQuery.toLowerCase());
      return (
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

  const pendingCount = tasks.filter((task) => task.status === "Pending").length;
  const inProgressCount = tasks.filter(
    (task) => task.status === "In-Progress",
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
    task.status === "Pending" &&
    (task.triggerType === "ODOMETER" || task.triggerType === "MANUAL");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarIcon}
        title="Maintenance Scheduling"
        subtitle="Manage and track fleet maintenance schedules and tasks"
      />

      <div className="flex justify-end mb-4">
        <Button
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
        </Button>
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

        <div className="card-base p-6 transition duration-200 hover:-translate-y-0.5">
          <div className="mb-5 flex flex-col gap-5 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                Maintenance Schedules
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Current and completed scheduled items for the fleet.
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
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white shadow-md dark:border-[var(--color-brand-primary)]/40 dark:bg-[var(--color-brand-primary)]/20 dark:text-white"
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
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white shadow-md dark:border-[var(--color-brand-primary)]/40 dark:bg-[var(--color-brand-primary)]/20 dark:text-white"
                      : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Calendar
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5 mb-6">
            <InputField
              label="Search"
              id="searchF"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
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
              label="Status"
              id="statusF"
              options={[
                { value: "All", label: "All Statuses" },
                { value: "Pending", label: "Pending" },
                { value: "Overdue", label: "Overdue" },
                { value: "In-Progress", label: "In-Progress" },
                { value: "Flagged", label: "Flagged" },
                { value: "Completed", label: "Completed" },
              ]}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
            <SelectField
              label="Date Range"
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

          {viewMode === "list" ? (
            <Card
              padding="none"
              className="overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-[var(--color-text-primary)]">
                <thead className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card-bg)] text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      {"Work Order No."}
                    </th>
                    <th className="px-5 py-3 font-medium">{"Plate No."}</th>
                    <th className="px-5 py-3 font-medium">
                      {"Work Order Template"}
                    </th>
                    <th className="px-5 py-3 font-medium">{"Trigger"}</th>
                    <th className="px-5 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => {
                          setDateSortDirection((direction) =>
                            direction === "desc" ? "asc" : "desc",
                          );
                          setCurrentPage(1);
                        }}
                        className="inline-flex items-center gap-2 uppercase tracking-[0.16em] hover:text-[var(--color-text-primary)]"
                      >
                        <span>Scheduled Date</span>
                        {dateSortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </th>
                    <th className="px-5 py-3 font-medium">{"Mechanic"}</th>
                    <th className="px-5 py-3 font-medium">{"Status"}</th>
                    <th className="px-5 py-3 font-medium">{"Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-divider)]">
                  {filteredTasks.length > 0 ? (
                    paginatedTasks.map((task) => (
                      <tr
                        key={task.id}
                        onClick={() => openScheduleDetails([task])}
                        className="cursor-pointer hover:bg-[var(--color-card-bg-hover)] transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">
                          {formatWorkOrderNumber(task.id)}
                        </td>
                        <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">
                          {task.vehicleId}
                        </td>
                        <td className="px-5 py-3 text-[var(--color-text-secondary)]">{task.title}</td>
                        <td className="px-5 py-3">
                          <span className="inline-block rounded-full bg-[var(--color-card-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                            {task.triggerType === "TIME"
                              ? "Time-Based"
                              : task.triggerType === "MANUAL"
                                ? "Manual"
                                : "Odometer"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[var(--color-text-secondary)]">{task.date}</td>
                        <td className="px-5 py-3 text-[var(--color-text-secondary)]">{task.assignedDriver}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="flex gap-2 px-5 py-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openFullScheduleEdit(task);
                            }}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
                          >
                            Edit
                          </button>
                          {canShowScheduleUpdate(task) ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openOdometerUpdate(task);
                              }}
                              className="rounded-xl border border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10 px-3 py-2 text-xs font-semibold text-[#0369a1] transition hover:bg-[var(--color-status-info)]/20 dark:text-[#7dd3fc]"
                            >
                              Update
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirmDeleteTask(task);
                            }}
                            className="table-delete-button"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]"
                      >
                        {noTasks ? (
                          <>No maintenance schedules exist.</>
                        ) : (
                          <>
                            No maintenance schedules match the current filters.
                            Try adjusting your search or status selection.
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
              {filteredTasks.length > 0 ? (
                <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-6 py-3 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Showing {paginatedTasks.length} of {filteredTasks.length} schedules
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                      disabled={activePage === 1}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span>Page {activePage} of {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                      disabled={activePage === totalPages}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                    {totalPages >= 20 ? (
                      <label className="flex items-center gap-2">
                        <span>Go to</span>
                        <input
                          type="number"
                          min={1}
                          max={totalPages}
                          placeholder={String(activePage)}
                          aria-label="Go to maintenance schedule page"
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            if (!event.currentTarget.value.trim()) return;
                            const requestedPage = Number(event.currentTarget.value);
                            if (!Number.isFinite(requestedPage)) return;
                            setCurrentPage(
                              Math.min(totalPages, Math.max(1, Math.trunc(requestedPage))),
                            );
                            event.currentTarget.value = "";
                          }}
                          className="w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1.5 text-center text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Card>
          ) : (
            <Card padding="none" className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                  {monthName} {yearName}
                </h2>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div key={day} className="py-2">
                      {day}
                    </div>
                  ),
                )}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => {
                  const schedulesForDay = filteredTasks.filter(
                    (task) => task.date === cell.dateStr,
                  );

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (schedulesForDay.length > 0) {
                          openScheduleDetails(schedulesForDay);
                        }
                      }}
                      className={`min-h-44 rounded-xl border p-2 transition duration-200 ${
                        cell.day
                          ? `bg-[var(--color-card-bg)] border-[var(--color-border)] hover:border-[var(--color-brand-primary)] ${
                              schedulesForDay.length > 0 ? "cursor-pointer" : ""
                            }`
                          : "bg-transparent border-transparent"
                      }`}
                    >
                      {cell.day && (
                        <>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-semibold text-sm text-[var(--color-text-secondary)]">
                              {cell.day}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => event.stopPropagation()}
                              className="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] transition opacity-0 group-hover:opacity-100"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {schedulesForDay.map((task) => (
                              <button
                                type="button"
                                key={task.id}
                                className={`block w-full rounded-lg px-2.5 py-2 text-left transition hover:brightness-110 ${getTaskStyle(task.status)}`}
                              >
                                <span className="block truncate text-xs font-semibold">
                                  {formatWorkOrderNumber(task.id)}
                                </span>
                                <span className="block truncate text-xs">
                                  Plate No.: {task.vehicleId}
                                </span>
                                <span className="block truncate text-xs">
                                  Work Order: {task.title}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
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
              { label: "Garage / Cluster", value: selectedSchedule.garageId },
              { label: "Account Type", value: selectedSchedule.accountType },
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

      {confirmDeleteTask && (
        <div className="modal-overlay px-4 backdrop-blur-sm">
          <div className="modal-content w-full max-w-md rounded-xl p-6">
            <h3 className="mb-4 text-lg font-bold text-[var(--color-text-primary)]">
              Confirm Delete
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete this schedule?
              <br />
              <span className="mt-2 block font-bold text-[var(--color-text-primary)]">{confirmDeleteTask.title} - {confirmDeleteTask.vehicleId}</span>
              <br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTask(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteMaintenanceSchedule(confirmDeleteTask.id);
                    setTasks((current) =>
                      current.filter((t) => t.id !== confirmDeleteTask.id),
                    );
                  } catch (err) {
                    console.error("Failed to delete schedule", err);
                    // fallback: still remove locally
                    setTasks((current) =>
                      current.filter((t) => t.id !== confirmDeleteTask.id),
                    );
                  } finally {
                    setConfirmDeleteTask(null);
                  }
                }}
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceSchedulingCombined;
