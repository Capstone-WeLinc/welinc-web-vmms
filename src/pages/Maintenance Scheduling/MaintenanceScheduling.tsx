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
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import CreateSchedule from "./CreateSchedule";
import {
  type MaintenanceStatus,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  getMaintenanceSchedules,
  deleteMaintenanceSchedule,
  getVehicles,
} from "../../api/fleetService";

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
  <div className="card-base p-5 transition duration-200 hover:-translate-y-0.5">
    <div className="mb-4 flex items-center justify-between">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: iconBgColor, color: iconColor }}
      >
        {icon}
      </div>
    </div>
    <div className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
      {value}
    </div>
    <div className="mt-2 text-sm text-[var(--color-text-secondary)]">{label}</div>
    <div className="mt-3 text-sm font-medium" style={{ color: iconColor }}>
      {subtitle}
    </div>
  </div>
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
        "bg-[#1a1f6e] hover:bg-[#151b4f] text-white border border-[#1a1f6e]";
      break;
    case "secondary":
      variantClass =
        "bg-[var(--color-card-bg)] hover:bg-[var(--color-card-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]";
      break;
    case "danger":
      variantClass =
        "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20";
      break;
    case "warning":
      variantClass =
        "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20";
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
        return "text-rose-400 bg-rose-500/15 border-rose-500/20";
      case "Flagged":
        return "text-amber-400 bg-amber-500/15 border-amber-500/20";
      case "In-Progress":
        return "text-emerald-400 bg-emerald-500/15 border-emerald-500/20";
      case "Completed":
        return "text-[var(--color-text-secondary)] bg-[var(--color-card-bg)] border-[var(--color-border)]";
      case "Pending":
      default:
        return "text-sky-400 bg-sky-500/15 border-sky-500/20";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${getStatusDetails()}`}
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
      return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
    case "Flagged":
      return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    case "In-Progress":
      return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    case "Pending":
      return "bg-sky-500/20 text-sky-300 border border-sky-500/30";
    default:
      return "bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)]";
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
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [vehicleFilter, setVehicleFilter] = useState<string>("All");
  const [workOrderTemplateFilter, setWorkOrderTemplateFilter] =
    useState<string>("All");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("All");
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [vehicles, setVehicles] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] =
    useState<MaintenanceTask | null>(null);

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

  const filteredTasks = tasks.filter((task) => {
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
  });

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
          onClick={() => setIsModalOpen(true)}
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
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] pb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {"Active Maintenance Schedules"}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {"Current scheduled items for the fleet."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${viewMode === "list" ? "active-filter" : "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]"}`}
              >
                <List className="mr-2 inline-block w-4 h-4" />
                List View
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${viewMode === "calendar" ? "active-filter" : "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]"}`}
              >
                <CalendarIcon className="mr-2 inline-block w-4 h-4" />
                Calendar View
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5 mb-6">
            <InputField
              label="Search"
              id="searchF"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <SelectField
              label="Vehicle"
              id="vehicleF"
              options={vehicleOptions}
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
            />
            <SelectField
              label="Work Order Template"
              id="typeF"
              options={workOrderTemplateOptions}
              value={workOrderTemplateFilter}
              onChange={(e) => setWorkOrderTemplateFilter(e.target.value)}
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
              onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setDateRangeFilter(e.target.value)}
            />
          </div>

          {viewMode === "list" ? (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]">
                <thead className="bg-[var(--color-card-bg)] border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-6 py-4 font-semibold">{"Plate No."}</th>
                    <th className="px-6 py-4 font-semibold">
                      {"Work Order Template"}
                    </th>
                    <th className="px-6 py-4 font-semibold">{"Trigger"}</th>
                    <th className="px-6 py-4 font-semibold">
                      {"Scheduled Date"}
                    </th>
                    <th className="px-6 py-4 font-semibold">{"Mechanic"}</th>
                    <th className="px-6 py-4 font-semibold">{"Status"}</th>
                    <th className="px-6 py-4 font-semibold">{"Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-divider)]">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="hover:bg-[var(--color-card-bg-hover)] transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-[var(--color-text-primary)]">
                          {task.vehicleId}
                        </td>
                        <td className="px-6 py-4">{task.title}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block rounded-full bg-[var(--color-card-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                            {task.triggerType === "TIME"
                              ? "Time-Based"
                              : task.triggerType === "MANUAL"
                                ? "Manual"
                                : "Odometer"}
                          </span>
                        </td>
                        <td className="px-6 py-4">{task.date}</td>
                        <td className="px-6 py-4">{task.assignedDriver}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-6 py-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask(task);
                              setIsModalOpen(true);
                            }}
                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTask(task)}
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
                        colSpan={6}
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
          ) : (
            <div className="card-base p-6">
              <div className="mb-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
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
              <div className="grid grid-cols-7 gap-2 text-center text-sm text-[var(--color-text-secondary)] mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div key={day} className="py-2 font-medium">
                      {day}
                    </div>
                  ),
                )}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((cell, idx) => (
                  <div
                    key={idx}
                    className={`min-h-30 rounded-xl border p-2 transition duration-200 ${cell.day ? "bg-[var(--color-card-bg)] border-[var(--color-border)] hover:border-[var(--color-border)]" : "bg-transparent border-transparent"}`}
                  >
                    {cell.day && (
                      <>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-sm text-[var(--color-text-secondary)]">
                            {cell.day}
                          </span>
                          <button
                            type="button"
                            className="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] transition opacity-0 group-hover:opacity-100"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {filteredTasks
                            .filter((task) => task.date === cell.dateStr)
                            .map((task) => (
                              <div
                                key={task.id}
                                className={`truncate rounded-md px-2 py-1 font-medium ${getTaskStyle(task.status)}`}
                              >
                                {task.title}
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <CreateSchedule
        isOpen={isModalOpen}
        editingTask={editingTask ?? undefined}
        existingSchedules={tasks}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
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
        }}
      />

      {confirmDeleteTask && (
        <div className="modal-overlay px-4 backdrop-blur-sm">
          <div className="modal-content w-full max-w-md rounded-xl p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete this schedule?
              <br />
              <span className="mt-2 block font-semibold text-[var(--color-text-primary)]">{confirmDeleteTask.title} - {confirmDeleteTask.vehicleId}</span>
              <br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTask(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
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
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
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
