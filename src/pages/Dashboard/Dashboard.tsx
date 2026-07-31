import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Filter,
  History,
  LayoutDashboard,
  MapPinned,
  PhilippinePeso,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  DataTable,
  LegendHelp,
  Modal,
  SearchInput,
  SortSelect,
  StatusBadge,
  TableToolbar,
} from "../../components/ui";
import { getVmmsDashboardData, type VmmsDashboardData } from "../../lib/api/dashboardService";
import { getRecentActivity, type ActivityItem } from "../../lib/api/vmmsApi";
import { useAuthStore } from "../../store/authStore";
import {
  MaintenanceStatus,
  maintenanceStatusLabels,
  type MaintenanceTask,
} from "../../types/maintenance";
import { isMechanicRole } from "../../lib/utils/permissions";
import { isChiefMechanicRole, isOperationsRole } from "../../lib/utils/permissions";
import { formatWorkOrderNumber } from "../../lib/utils/workOrders";
import {
  isInTimeFilterRange,
  timeFilterOptions,
  type TimeFilterValue,
} from "../../lib/utils/timeFilters";

type RoleWorkflowItem = {
  title: string;
  value: string;
  detail: string;
  icon: ComponentType<{ size?: number }>;
  tone: string;
  onSelect?: () => void;
};

type VehicleAvailabilitySort = "plate-asc" | "plate-desc" | "vehicle-asc" | "vehicle-desc" | "garage-asc" | "garage-desc";
type DashboardTaskSort = "date-desc" | "date-asc" | "vehicle-asc" | "vehicle-desc" | "mechanic-asc" | "mechanic-desc" | "status-asc" | "status-desc";

const statusColors: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PENDING]: "#64748b",
  [MaintenanceStatus.DUE]: "#7c3aed",
  [MaintenanceStatus.IN_PROGRESS]: "#0284c7",
  [MaintenanceStatus.COMPLETED]: "#059669",
  [MaintenanceStatus.OVERDUE]: "#dc2626",
  [MaintenanceStatus.CANCELLED]: "#94a3b8",
};

const dateOf = (task: MaintenanceTask) =>
  new Date(task.startReferenceDate || task.date || 0);

const getMaterialCost = (task: MaintenanceTask) => {
  const progress = task.workOrderProgress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return 0;

  const execution = (progress as { execution?: unknown }).execution;
  if (!execution || typeof execution !== "object" || Array.isArray(execution)) return 0;

  const items = (execution as { items?: unknown }).items;
  if (!Array.isArray(items)) return 0;

  return items.reduce((total, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return total;
    const value = (item as { partsCost?: unknown }).partsCost;
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(/[^\d.-]/g, ""))
          : 0;
    return total + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="enterprise-panel">
      <div className="enterprise-panel-header">
        <h2 className="text-base font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
      {message}
    </div>
  );
}

function DashboardFilterButton({
  open,
  onToggle,
  options,
  selected,
  onChange,
  onClear,
}: {
  open: boolean;
  onToggle: () => void;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  onClear: () => void;
}) {
  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
          open || selected.length > 0
            ? "border-[#070b45] bg-[#f6f8fc]"
            : "border-[#d8dee8] bg-[#f6f8fc] hover:border-[#070b45]"
        }`}
        aria-expanded={open}
        aria-label="Open filters"
      >
        <Filter className="h-5 w-5 text-[#63728a]" strokeWidth={2.2} />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-[#e0e5ee] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
          onClick={(event) => event.stopPropagation()}
        >
          <h3 className="text-lg font-extrabold text-[#141827]">Filter by</h3>
          <div className="my-4 h-px bg-[#dde3eb]" />
          <p className="text-sm font-semibold text-black">Status</p>
          <div className="mt-3 grid gap-3">
            {options.map((option) => {
              const checked = selected.includes(option);
              return (
                <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-[#141827]">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                      checked ? "border-[#2f7cff] bg-[#eaf2ff]" : "border-[#cbd3df] bg-white"
                    }`}
                  >
                    {checked ? <Check className="h-4 w-4 text-[#2f7cff]" strokeWidth={3} /> : null}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleOption(option)}
                  />
                  {option}
                </label>
              );
            })}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onToggle}
              className="h-10 rounded-lg bg-[#070b45] text-sm font-bold text-white transition hover:bg-[#11175f]"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onClear}
              className="h-10 rounded-lg border-2 border-[#070b45] bg-white text-sm font-bold text-[#070b45] transition hover:bg-[#f6f8fc]"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecentAccountActivity({
  activities,
  currentUserName,
}: {
  activities: ActivityItem[];
  currentUserName?: string;
}) {
  return (
    <Panel
      title="Recent Account Activity"
      subtitle="User and operations events ready for future audit sync"
    >
      <div className="divide-y divide-[var(--color-divider)]">
        {activities.map((activity, index) => (
          <div key={`${activity.action}-${index}`} className="flex items-start gap-3 px-5 py-4">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--color-brand-primary)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {activity.action}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {activity.vehicle} - {activity.time} - {currentUserName ?? "System user"}
              </p>
            </div>
            <StatusBadge
              status={
                maintenanceStatusLabels[
                  activity.status === "completed"
                    ? MaintenanceStatus.COMPLETED
                    : activity.status === "in-progress"
                      ? MaintenanceStatus.IN_PROGRESS
                      : activity.status === "failed"
                        ? MaintenanceStatus.OVERDUE
                        : MaintenanceStatus.PENDING
                ]
              }
            />
          </div>
        ))}
        {activities.length === 0 ? (
          <EmptyState message="No recent account activity." />
        ) : null}
      </div>
    </Panel>
  );
}

function RoleWorkflowPanel({
  roleName,
  items,
}: {
  roleName: string;
  items: RoleWorkflowItem[];
}) {
  return (
    <Panel
      title={`${roleName} Workspace`}
      subtitle="Role-specific controls and operational focus"
    >
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const cardContent = (
            <>
            <div className="flex items-center justify-between gap-3">
              <div
                className="enterprise-icon-box"
                style={{ color: item.tone, backgroundColor: `${item.tone}14` }}
              >
                <item.icon size={20} />
              </div>
              <span className="text-xl font-extrabold text-slate-950">
                {item.value}
              </span>
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-950">
              {item.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {item.detail}
            </p>
            {item.onSelect ? (
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#1a1f6e]">
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            ) : null}
            </>
          );

          return item.onSelect ? (
            <button
              key={item.title}
              type="button"
              onClick={item.onSelect}
              className="enterprise-card p-4 text-left focus-ring"
              aria-label={`Open ${item.title}`}
            >
              {cardContent}
            </button>
          ) : (
            <article key={item.title} className="enterprise-card p-4">
              {cardContent}
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const isMechanic = isMechanicRole(currentUser);
  const isChiefMechanic = isChiefMechanicRole(currentUser);
  const isOperations = isOperationsRole(currentUser);
  const [data, setData] = useState<VmmsDashboardData>({ schedules: [], vehicles: [], garages: [] });
  const [accountActivities, setAccountActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimeFilterValue>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [vehicleAvailabilitySearch, setVehicleAvailabilitySearch] = useState("");
  const [vehicleAvailabilitySort, setVehicleAvailabilitySort] = useState<VehicleAvailabilitySort>("plate-asc");
  const [vehicleAvailabilityFilterOpen, setVehicleAvailabilityFilterOpen] = useState(false);
  const [vehicleAvailabilityStatuses, setVehicleAvailabilityStatuses] = useState<string[]>([]);
  const [overdueSearch, setOverdueSearch] = useState("");
  const [overdueSort, setOverdueSort] = useState<DashboardTaskSort>("date-asc");
  const [overdueFilterOpen, setOverdueFilterOpen] = useState(false);
  const [overdueStatuses, setOverdueStatuses] = useState<string[]>([]);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentSort, setRecentSort] = useState<DashboardTaskSort>("date-desc");
  const [recentFilterOpen, setRecentFilterOpen] = useState(false);
  const [recentStatuses, setRecentStatuses] = useState<string[]>([]);

  const loadDashboard = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      setData(await getVmmsDashboardData());
    } catch (loadError) {
      console.error("Unable to load VMMS dashboard", loadError);
      setError("Unable to load maintenance dashboard data.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    getRecentActivity()
      .then(setAccountActivities)
      .catch(() => setAccountActivities([]));
    const refreshDashboard = () => void loadDashboard(false);
    const refreshInterval = window.setInterval(refreshDashboard, 30_000);
    window.addEventListener("focus", refreshDashboard);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshDashboard);
    };
  }, []);

  const schedules = useMemo(() => {
    if (!isMechanic || !currentUser) return data.schedules;
    const name = currentUser.name.trim().toLowerCase();
    const email = currentUser.email.trim().toLowerCase();
    return data.schedules.filter(
      (task) =>
        task.assignedMechanicId === currentUser.id ||
        task.assignedMechanicEmail?.trim().toLowerCase() === email ||
        task.assignedDriver.trim().toLowerCase() === name,
    );
  }, [currentUser, data.schedules, isMechanic]);

  const filteredSchedules = schedules.filter((task) =>
    isInTimeFilterRange(dateOf(task), filter, customDateFrom, customDateTo),
  );
  const garageNames = new Map(data.garages.map((garage) => [garage.id, garage.name]));
  const vehicleById = new Map(
    data.vehicles.flatMap((vehicle) => [
      ...(vehicle.id ? [[vehicle.id, vehicle] as const] : []),
      [vehicle.value, vehicle] as const,
    ]),
  );
  const vehicleLabel = (task: MaintenanceTask) =>
    vehicleById.get(task.vehicleId)?.label ?? task.vehicleId;
  const plateNumber = (task: MaintenanceTask) =>
    vehicleById.get(task.vehicleId)?.plateNumber ??
    vehicleById.get(task.vehicleId)?.value ??
    task.vehicleId;

  const activeStatuses = new Set<MaintenanceStatus>([
    MaintenanceStatus.DUE,
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.OVERDUE,
  ]);
  const activeWorkOrders = filteredSchedules.filter((task) => activeStatuses.has(task.status));
  const activeWorkOrderByVehicle = new Map<string, MaintenanceTask>();
  activeWorkOrders.forEach((task) => {
    const vehicle = vehicleById.get(task.vehicleId);
    [task.vehicleId, vehicle?.id, vehicle?.value, vehicle?.plateNumber]
      .filter(Boolean)
      .forEach((key) => activeWorkOrderByVehicle.set(String(key), task));
  });
  const getVehicleActiveTask = (vehicle: VmmsDashboardData["vehicles"][number]) =>
    activeWorkOrderByVehicle.get(vehicle.id ?? "") ??
    activeWorkOrderByVehicle.get(vehicle.value) ??
    activeWorkOrderByVehicle.get(vehicle.plateNumber ?? "");
  const underMaintenance = new Set(activeWorkOrders.map((task) => task.vehicleId)).size;
  const completedThisMonth = schedules.filter(
    (task) =>
      task.status === MaintenanceStatus.COMPLETED &&
      isInTimeFilterRange(dateOf(task), "month"),
  );
  const completedForSelectedPeriod = filteredSchedules.filter(
    (task) => task.status === MaintenanceStatus.COMPLETED,
  );
  const maintenanceCost = filteredSchedules.reduce(
    (total, task) => total + getMaterialCost(task),
    0,
  );

  const summaryCards: Array<{
    label: string;
    value: string | number;
    icon: ComponentType<{ size?: number }>;
    color: string;
    path: string;
  }> = [
    { label: "Total Vehicles", value: data.vehicles.length, icon: Truck, color: "#2563eb", path: "/maintenance-scheduling" },
    { label: "Under Maintenance", value: underMaintenance, icon: Wrench, color: "#d97706", path: "/work-orders" },
    { label: "Active Work Orders", value: activeWorkOrders.length, icon: ClipboardList, color: "#0284c7", path: "/work-orders" },
    { label: "Due Maintenance", value: filteredSchedules.filter((task) => task.status === MaintenanceStatus.DUE).length, icon: CalendarClock, color: "#7c3aed", path: "/maintenance-scheduling" },
    { label: "Overdue Maintenance", value: filteredSchedules.filter((task) => task.status === MaintenanceStatus.OVERDUE).length, icon: AlertTriangle, color: "#dc2626", path: "/maintenance-scheduling" },
    {
      label: filter === "all" ? "Completed Maintenance" : "Completed Records",
      value: completedForSelectedPeriod.length,
      icon: CheckCircle2,
      color: "#059669",
      path: "/maintenance-logs",
    },
    {
      label: filter === "all" ? "Maintenance Cost" : "Cost In Period",
      value: formatCurrency(maintenanceCost),
      icon: PhilippinePeso,
      color: "#0f766e",
      path: "/maintenance-logs",
    },
  ];

  const statusBreakdown = Object.values(MaintenanceStatus)
    .filter((status) => status !== MaintenanceStatus.CANCELLED)
    .map((status) => ({
      status,
      count: filteredSchedules.filter((task) => task.status === status).length,
    }));
  const maxStatusCount = Math.max(...statusBreakdown.map((item) => item.count), 1);

  const sortDashboardTasks = (rows: MaintenanceTask[], sort: DashboardTaskSort) =>
    [...rows].sort((left, right) => {
      const direction = sort.endsWith("asc") ? 1 : -1;
      if (sort.startsWith("date")) return (dateOf(left).getTime() - dateOf(right).getTime()) * direction;
      if (sort.startsWith("vehicle")) return plateNumber(left).localeCompare(plateNumber(right)) * direction;
      if (sort.startsWith("mechanic")) return (left.assignedDriver || "Unassigned").localeCompare(right.assignedDriver || "Unassigned") * direction;
      return maintenanceStatusLabels[left.status].localeCompare(maintenanceStatusLabels[right.status]) * direction;
    });

  const filteredVehicleAvailability = [...data.vehicles]
    .filter((vehicle) => {
      const query = vehicleAvailabilitySearch.trim().toLowerCase();
      const activeTask = getVehicleActiveTask(vehicle);
      const status = activeTask ? "With Conflict" : "Ready";
      const garage = activeTask
        ? garageNames.get(activeTask.garageId ?? "") ?? "Unassigned"
        : "Ready for dispatch";
      const matchesSearch =
        !query ||
        (vehicle.plateNumber ?? vehicle.value).toLowerCase().includes(query) ||
        vehicle.label.toLowerCase().includes(query) ||
        garage.toLowerCase().includes(query) ||
        activeTask?.title.toLowerCase().includes(query);
      const matchesStatus =
        vehicleAvailabilityStatuses.length === 0 ||
        vehicleAvailabilityStatuses.includes(status);

      return matchesSearch && matchesStatus;
    })
    .sort((left, right) => {
      const direction = vehicleAvailabilitySort.endsWith("asc") ? 1 : -1;
      if (vehicleAvailabilitySort.startsWith("plate")) {
        return (left.plateNumber ?? left.value).localeCompare(right.plateNumber ?? right.value) * direction;
      }
      if (vehicleAvailabilitySort.startsWith("vehicle")) {
        return left.label.localeCompare(right.label) * direction;
      }
      const leftTask = getVehicleActiveTask(left);
      const rightTask = getVehicleActiveTask(right);
      const leftGarage = leftTask ? garageNames.get(leftTask.garageId ?? "") ?? "Unassigned" : "Ready for dispatch";
      const rightGarage = rightTask ? garageNames.get(rightTask.garageId ?? "") ?? "Unassigned" : "Ready for dispatch";
      return leftGarage.localeCompare(rightGarage) * direction;
    })
    .slice(0, 6);

  const overdue = sortDashboardTasks(
    filteredSchedules.filter((task) => {
      if (task.status !== MaintenanceStatus.OVERDUE) return false;
      const query = overdueSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        vehicleLabel(task).toLowerCase().includes(query) ||
        plateNumber(task).toLowerCase().includes(query) ||
        (task.assignedDriver || "Unassigned").toLowerCase().includes(query) ||
        (garageNames.get(task.garageId ?? "") ?? "Unassigned").toLowerCase().includes(query);
      const matchesStatus =
        overdueStatuses.length === 0 ||
        overdueStatuses.includes(maintenanceStatusLabels[task.status]);
      return matchesSearch && matchesStatus;
    }),
    overdueSort,
  ).slice(0, 5);
  const recent = sortDashboardTasks(
    filteredSchedules.filter((task) => {
      const query = recentSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        formatWorkOrderNumber(task.id).toLowerCase().includes(query) ||
        plateNumber(task).toLowerCase().includes(query) ||
        (task.assignedDriver || "Unassigned").toLowerCase().includes(query) ||
        maintenanceStatusLabels[task.status].toLowerCase().includes(query);
      const matchesStatus =
        recentStatuses.length === 0 ||
        recentStatuses.includes(maintenanceStatusLabels[task.status]);
      return matchesSearch && matchesStatus;
    }),
    recentSort,
  ).slice(0, 6);
  const availableVehicles = data.vehicles.filter(
    (vehicle) => (vehicle.status ?? "").toUpperCase() === "AVAILABLE",
  );
  const pendingApprovals = filteredSchedules.filter(
    (task) => task.status === MaintenanceStatus.IN_PROGRESS,
  ).length;
  const roleName = isChiefMechanic
    ? "Chief Mechanic"
    : isMechanic
      ? "Mechanic"
      : isOperations
        ? "Operations"
        : "Admin";
  const roleWorkflowItems = isChiefMechanic
    ? [
        {
          title: "Active Work Orders",
          value: String(activeWorkOrders.length),
          detail: "Supervise active shop floor work and inspect ready tasks.",
          icon: Wrench,
          tone: "#0284c7",
        },
        {
          title: "Inspection Queue",
          value: String(pendingApprovals),
          detail: "Accept or reject completed maintenance documentation.",
          icon: FileCheck2,
          tone: "#7c3aed",
        },
        {
          title: "Quality Logs",
          value: String(completedThisMonth.length),
          detail: "Completed work available for QA review this month.",
          icon: ShieldCheck,
          tone: "#059669",
        },
        {
          title: "Recent Activity",
          value: String(accountActivities.length),
          detail: "Latest account and maintenance events across the workshop.",
          icon: History,
          tone: "#475569",
        },
      ]
    : isMechanic
      ? [
          {
            title: "Current Task",
            value: String(activeWorkOrders.length),
            detail: "Mobile-ready task list with large work order targets.",
            icon: Wrench,
            tone: "#0284c7",
          },
          {
            title: "Checklist Progress",
            value: `${Math.min(100, completedForSelectedPeriod.length * 20)}%`,
            detail: "Step-by-step checklist, parts logger, and remarks flow.",
            icon: ClipboardList,
            tone: "#7c3aed",
          },
          {
            title: "Parts Logging",
            value: formatCurrency(maintenanceCost),
            detail: "Material cost captured from work order execution.",
            icon: PhilippinePeso,
            tone: "#0f766e",
          },
          {
            title: "Completion Summary",
            value: String(completedForSelectedPeriod.length),
            detail: "Tasks ready for summary review and closeout.",
            icon: CheckCircle2,
            tone: "#059669",
          },
        ]
      : isOperations
        ? [
            {
              title: "Available Vehicles",
              value: String(availableVehicles.length),
              detail: "Live availability list for dispatch and usage planning.",
              icon: MapPinned,
              tone: "#2563eb",
            },
            {
              title: "Scheduler Calendar",
              value: String(filteredSchedules.length),
              detail: "Color-coded maintenance calendar with automatic planning hooks.",
              icon: CalendarClock,
              tone: "#7c3aed",
            },
            {
              title: "Assignment Queue",
              value: String(activeWorkOrders.length),
              detail: "Work orders awaiting coordination or mechanic assignment.",
              icon: ClipboardList,
              tone: "#0284c7",
            },
            {
              title: "Usage Conflicts",
              value: String(underMaintenance),
              detail: "Vehicles to hold from operational booking windows.",
              icon: AlertTriangle,
              tone: "#dc2626",
            },
          ]
        : [
            {
              title: "User Accounts",
              value: currentUser ? "1+" : "0",
              detail: "Admin-ready user account management and role oversight.",
              icon: ShieldCheck,
              tone: "#1a1f6e",
              onSelect: () => navigate("/user-management"),
            },
            {
              title: "Checklist Templates",
              value: "Active",
              detail: "Template builder access for standardized inspections.",
              icon: ClipboardList,
              tone: "#7c3aed",
              onSelect: () => navigate("/checklist-templates"),
            },
            {
              title: "Reports Center",
              value: String(completedForSelectedPeriod.length),
              detail: "Maintenance reports and downloadable operational summaries.",
              icon: FileCheck2,
              tone: "#059669",
              onSelect: () => navigate("/maintenance-reports"),
            },
            {
              title: "Audit Trail",
              value: String(accountActivities.length),
              detail: "System activity panel prepared for administrative audit logs.",
              icon: History,
              tone: "#475569",
              onSelect: () => setIsAuditTrailOpen(true),
            },
          ];
  const plannedSchedules = [...filteredSchedules]
    .sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())
    .slice(0, 4);
  const auditTrail = [
    {
      label: "Work order distribution recalculated",
      detail: `${activeWorkOrders.length} active work orders in the current role scope`,
    },
    {
      label: "Maintenance scheduling rules evaluated",
      detail: `${plannedSchedules.length} upcoming planner entries visible`,
    },
    {
      label: "Vehicle availability snapshot updated",
      detail: `${availableVehicles.length} vehicles available for operations`,
    },
  ];
  const dashboardNotifications = [
    ...overdue.map((task) => ({
      id: `overdue-${task.id}`,
      title: `${plateNumber(task)} overdue`,
      detail: `${task.title} - ${task.assignedDriver || "Unassigned mechanic"}`,
      status: "OVERDUE",
      tone: "#dc2626",
    })),
    ...plannedSchedules.map((task) => ({
      id: `planned-${task.id}`,
      title: `${plateNumber(task)} scheduled`,
      detail: `${task.title} - ${task.date || task.startReferenceDate || "No date set"}`,
      status: maintenanceStatusLabels[task.status] ?? task.status,
      tone: statusColors[task.status] ?? "#2563eb",
    })),
  ];

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        icon={LayoutDashboard}
        title="VMMS DASHBOARD"
        subtitle={isMechanic ? "Your assigned maintenance workload" : "Vehicle maintenance operations overview"}
        action={
          <div className="flex items-center justify-end gap-2">
            <SortSelect
              label="Time-Based Filters"
              value={filter}
              onChange={(value) => setFilter(value as TimeFilterValue)}
              options={timeFilterOptions}
              className="w-44"
            />
            {filter === "custom" ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Dashboard custom date from"
                  value={customDateFrom}
                  onChange={(event) => setCustomDateFrom(event.target.value)}
                  className="h-10 rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-semibold text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                />
                <input
                  type="date"
                  aria-label="Dashboard custom date to"
                  value={customDateTo}
                  onChange={(event) => setCustomDateTo(event.target.value)}
                  className="h-10 rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-semibold text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-[#f6f8fc] text-[#63728a] transition hover:border-[#070b45] hover:text-[#070b45]"
              aria-label="Open dashboard notifications"
            >
              <span className="relative">
                <Bell className="h-5 w-5" />
                {dashboardNotifications.length > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#070b45] px-1 text-[10px] font-extrabold leading-none text-white">
                    {dashboardNotifications.length}
                  </span>
                ) : null}
              </span>
            </button>
            <LegendHelp
              title="Dashboard Legend"
              items={[
                { label: "Time-Based Filters", description: "Limits records by all, today, week, month, quarter, year, or custom dates.", tone: "#2563eb" },
                { label: "Custom Date", description: "Use From and To dates for manual reporting windows.", tone: "#0f766e" },
                { label: "Overdue", description: "Maintenance has passed its expected due date.", tone: "#dc2626" },
                { label: "Due", description: "Maintenance is ready to start.", tone: "#7c3aed" },
              ]}
            />
          </div>
        }
      />

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button className="font-bold" onClick={() => void loadDashboard()}>Retry</button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {loading
          ? Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="enterprise-kpi-card h-32 animate-pulse">
              <div className="ml-2 h-9 w-9 rounded-lg bg-slate-100" />
              <div className="ml-2 mt-4 h-6 w-20 rounded bg-slate-100" />
            </div>
          ))
          : summaryCards.map((card) => (
            <button key={card.label} onClick={() => navigate(card.path)} className="enterprise-kpi-card">
              <div className="relative ml-2 flex items-start justify-between gap-3">
                <div>
                  <div className="enterprise-kpi-label">{card.label}</div>
                  <div className="enterprise-kpi-value">{card.value}</div>
                </div>
                <div className="enterprise-icon-box" style={{ color: card.color, backgroundColor: `${card.color}14` }}>
                  <card.icon size={20} />
                </div>
              </div>
            </button>
          ))}
      </div>

      <RoleWorkflowPanel roleName={roleName} items={roleWorkflowItems} />

      <Modal
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
        title="Audit Trail"
        size="lg"
        className="w-[min(92vw,72rem)] p-0"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsAuditTrailOpen(false)}
              className="h-10 rounded-xl border border-[#1a1f6e] px-6 text-sm font-extrabold text-[#1a1f6e] transition hover:bg-[#1a1f6e] hover:text-white"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Audit Entries</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">
                {auditTrail.length + accountActivities.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Visible Work Orders</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">
                {activeWorkOrders.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Updated Vehicles</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">
                {availableVehicles.length}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-extrabold text-slate-950">System Activity</h3>
            </div>
            <div className="max-h-[420px] divide-y divide-slate-200 overflow-y-auto">
              {auditTrail.map((entry) => (
                <div key={entry.label} className="flex items-start gap-3 px-4 py-4">
                  <History className="mt-0.5 h-4 w-4 text-[#1a1f6e]" />
                  <div>
                    <p className="text-sm font-bold text-slate-950">{entry.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{entry.detail}</p>
                  </div>
                </div>
              ))}
              {accountActivities.map((activity, index) => (
                <div key={`${activity.action}-${activity.time}-${index}`} className="flex items-start gap-3 px-4 py-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-950">{activity.action}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {activity.vehicle} - {activity.time} - {currentUser?.name ?? "System user"}
                    </p>
                  </div>
                  <StatusBadge status={activity.status} />
                </div>
              ))}
              {auditTrail.length + accountActivities.length === 0 ? (
                <EmptyState message="No audit activity available." />
              ) : null}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        title="Dashboard Notifications"
        size="lg"
        className="w-[min(92vw,72rem)] p-0"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(false)}
              className="h-10 rounded-xl border border-[#1a1f6e] px-6 text-sm font-extrabold text-[#1a1f6e] transition hover:bg-[#1a1f6e] hover:text-white"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-extrabold uppercase text-slate-500">Notifications</p>
              <p className="mt-3 text-3xl font-extrabold text-slate-950">{dashboardNotifications.length}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-xs font-extrabold uppercase text-red-700">Overdue</p>
              <p className="mt-3 text-3xl font-extrabold text-red-900">{overdue.length}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-xs font-extrabold uppercase text-blue-700">Planned</p>
              <p className="mt-3 text-3xl font-extrabold text-blue-900">{plannedSchedules.length}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="text-base font-extrabold text-slate-950">Notification Activity</h3>
            </div>
            <div className="max-h-[420px] divide-y divide-slate-200 overflow-y-auto">
              {dashboardNotifications.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: `${item.tone}40`, backgroundColor: `${item.tone}14`, color: item.tone }}>
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-extrabold uppercase" style={{ borderColor: `${item.tone}30`, color: item.tone }}>
                    {item.status}
                  </span>
                </div>
              ))}
              {dashboardNotifications.length === 0 ? (
                <EmptyState message="No dashboard notifications." />
              ) : null}
            </div>
          </div>
        </div>
      </Modal>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Automatic Maintenance Planner"
          subtitle="Upcoming schedules prepared for calendar generation after task completion"
        >
          <div className="divide-y divide-[var(--color-divider)]">
            {plannedSchedules.map((task) => (
              <div key={task.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                    {vehicleLabel(task)} - {task.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {task.date || task.startReferenceDate || "No date set"} - {garageNames.get(task.garageId ?? "") ?? "Unassigned garage"}
                  </p>
                </div>
                <StatusBadge status={maintenanceStatusLabels[task.status]} />
              </div>
            ))}
            {!loading && plannedSchedules.length === 0 ? (
              <EmptyState message="No maintenance schedules available for planning." />
            ) : null}
          </div>
        </Panel>

        <RecentAccountActivity
          activities={accountActivities}
          currentUserName={currentUser?.name}
        />
      </div>

      <div>
        <Panel
          title="Vehicle Availability"
          subtitle="Operational conflict visibility for maintenance and dispatch"
        >
          <div className="px-6 pb-5 pt-6">
            <TableToolbar
              search={
                <SearchInput
                  className="w-full sm:w-96"
                  placeholder="Search plate, vehicle, conflict, or garage..."
                  value={vehicleAvailabilitySearch}
                  onChange={(event) => setVehicleAvailabilitySearch(event.target.value)}
                />
              }
              sort={
                <SortSelect
                  className="w-full sm:w-60"
                  value={vehicleAvailabilitySort}
                  onChange={(value) => setVehicleAvailabilitySort(value as VehicleAvailabilitySort)}
                  options={[
                    { value: "plate-asc", label: "Plate No. - A to Z" },
                    { value: "plate-desc", label: "Plate No. - Z to A" },
                    { value: "vehicle-asc", label: "Vehicle - A to Z" },
                    { value: "vehicle-desc", label: "Vehicle - Z to A" },
                    { value: "garage-asc", label: "Garage - A to Z" },
                    { value: "garage-desc", label: "Garage - Z to A" },
                  ]}
                />
              }
              actions={
                <div className="flex items-center gap-2">
                  <DashboardFilterButton
                    open={vehicleAvailabilityFilterOpen}
                    onToggle={() => setVehicleAvailabilityFilterOpen((current) => !current)}
                    options={["With Conflict", "Ready"]}
                    selected={vehicleAvailabilityStatuses}
                    onChange={setVehicleAvailabilityStatuses}
                    onClear={() => {
                      setVehicleAvailabilityStatuses([]);
                      setVehicleAvailabilityFilterOpen(false);
                    }}
                  />
                  <LegendHelp
                    title="Vehicle Availability Legend"
                    items={[
                      { label: "With Conflict", description: "Vehicle has an active maintenance work order.", tone: "#dc2626" },
                      { label: "Ready", description: "Vehicle has no active maintenance conflict.", tone: "#059669" },
                    ]}
                  />
                </div>
              }
            />
            <DataTable
              data={filteredVehicleAvailability}
              getRowKey={(vehicle) => vehicle.value}
              minWidth="920px"
              adminSelectable={false}
              emptyMessage="No vehicle availability records."
              columns={[
                {
                  key: "plate",
                  header: "Plate No.",
                  width: "16%",
                  render: (vehicle) => (
                    <span className="font-bold">{vehicle.plateNumber ?? vehicle.value}</span>
                  ),
                },
                {
                  key: "vehicle",
                  header: "Vehicle",
                  width: "27%",
                  render: (vehicle) => vehicle.label,
                },
                {
                  key: "conflict",
                  header: "Current Conflict",
                  width: "37%",
                  render: (vehicle) => {
                    const activeTask = getVehicleActiveTask(vehicle);

                    return activeTask ? (
                      <span className="font-semibold text-[#141827]">
                        {formatWorkOrderNumber(activeTask.id)} - {activeTask.title}
                      </span>
                    ) : (
                      <span className="text-[#64748b]">No active conflict</span>
                    );
                  },
                },
                {
                  key: "garage",
                  header: "Garage",
                  width: "20%",
                  render: (vehicle) => {
                    const activeTask = getVehicleActiveTask(vehicle);

                    return activeTask
                      ? garageNames.get(activeTask.garageId ?? "") ?? "Unassigned"
                      : "Ready for dispatch";
                  },
                },
              ]}
            />
          </div>
        </Panel>
      </div>

      <div>
        <Panel title="Maintenance Status Breakdown" subtitle="Current work order distribution by status">
          <div className="p-5">
            <div className="rounded-xl border border-[#dde4ef] bg-white px-5 pb-5 pt-6">
              <div className="grid min-h-64 grid-cols-[2rem_1fr] gap-3">
                <div className="flex items-center justify-center">
                  <span className="-rotate-90 whitespace-nowrap text-xs font-extrabold uppercase tracking-wide text-[#52627a]">
                    Work Orders
                  </span>
                </div>
                <div className="flex h-60 items-end gap-4">
                  {statusBreakdown.map(({ status, count }) => (
                    <div key={status} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-sm font-extrabold text-[#141827]">{count}</span>
                      <div className="flex h-40 w-full items-end justify-center">
                        <div
                          className="w-full max-w-16 rounded-t-xl transition-all"
                          style={{
                            height: `${Math.max(8, (count / maxStatusCount) * 100)}%`,
                            backgroundColor: statusColors[status],
                          }}
                          aria-label={`${maintenanceStatusLabels[status]}: ${count}`}
                        />
                      </div>
                      <span className="min-h-9 text-center text-xs font-semibold leading-4 text-[#52627a]">
                        {maintenanceStatusLabels[status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pl-11 pt-2 text-center text-xs font-extrabold uppercase tracking-wide text-[#52627a]">
                Maintenance Status
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div>
        <Panel title="Overdue Maintenance" subtitle="Work orders beyond their maintenance threshold">
          <div className="px-6 pb-5 pt-6">
            <TableToolbar
              search={
                <SearchInput
                  className="w-full sm:w-96"
                  placeholder="Search vehicle, mechanic, or garage..."
                  value={overdueSearch}
                  onChange={(event) => setOverdueSearch(event.target.value)}
                />
              }
              sort={
                <SortSelect
                  className="w-full sm:w-60"
                  value={overdueSort}
                  onChange={(value) => setOverdueSort(value as DashboardTaskSort)}
                  options={[
                    { value: "date-asc", label: "Date - Oldest" },
                    { value: "date-desc", label: "Date - Newest" },
                    { value: "vehicle-asc", label: "Vehicle - A to Z" },
                    { value: "vehicle-desc", label: "Vehicle - Z to A" },
                    { value: "mechanic-asc", label: "Mechanic - A to Z" },
                    { value: "mechanic-desc", label: "Mechanic - Z to A" },
                  ]}
                />
              }
              actions={
                <div className="flex items-center gap-2">
                  <DashboardFilterButton
                    open={overdueFilterOpen}
                    onToggle={() => setOverdueFilterOpen((current) => !current)}
                    options={["Overdue"]}
                    selected={overdueStatuses}
                    onChange={setOverdueStatuses}
                    onClear={() => {
                      setOverdueStatuses([]);
                      setOverdueFilterOpen(false);
                    }}
                  />
                  <LegendHelp
                    title="Overdue Maintenance Legend"
                    items={[
                      { label: "Overdue", description: "Schedule is past its maintenance threshold.", tone: "#dc2626" },
                    ]}
                  />
                </div>
              }
            />
            <DataTable
              data={overdue}
              getRowKey={(task) => task.id}
              minWidth="860px"
              density="compact"
              adminSelectable={false}
              emptyMessage="No overdue maintenance."
              columns={[
                {
                  key: "vehicle",
                  header: "Vehicle",
                  width: "34%",
                  render: (task) => vehicleLabel(task),
                },
                {
                  key: "days",
                  header: "Days Overdue",
                  width: "18%",
                  render: (task) => {
                    const due = dateOf(task);
                    const days = Number.isNaN(due.getTime())
                      ? "-"
                      : Math.max(0, Math.floor((Date.now() - due.getTime()) / 86400000));

                    return <span className="font-bold text-red-600">{days}</span>;
                  },
                },
                {
                  key: "mechanic",
                  header: "Mechanic",
                  width: "24%",
                  render: (task) => task.assignedDriver || "Unassigned",
                },
                {
                  key: "garage",
                  header: "Garage",
                  width: "24%",
                  render: (task) => garageNames.get(task.garageId ?? "") ?? "Unassigned",
                },
              ]}
            />
          <div className="hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#070b45] text-xs uppercase text-white"><tr>{["Vehicle", "Days Overdue", "Mechanic", "Garage"].map((heading) => <th key={heading} className="px-3 py-2.5">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {overdue.map((task) => {
                  const due = dateOf(task);
                  const days = Number.isNaN(due.getTime()) ? "—" : Math.max(0, Math.floor((Date.now() - due.getTime()) / 86400000));
                  return <tr key={task.id}><td className="px-3 py-3">{vehicleLabel(task)}</td><td className="px-3 py-3 font-bold text-red-600">{days}</td><td className="px-3 py-3">{task.assignedDriver || "Unassigned"}</td><td className="px-3 py-3">{garageNames.get(task.garageId ?? "") ?? "Unassigned"}</td></tr>;
                })}
                {!loading && overdue.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--color-text-secondary)]">No overdue maintenance.</td></tr> : null}
              </tbody>
            </table>
          </div>
          </div>
        </Panel>
      </div>

      <Panel title="Recent Work Orders" subtitle="Latest maintenance work order activity">
        <div className="px-6 pb-5 pt-6">
          <TableToolbar
            search={
              <SearchInput
                className="w-full sm:w-96"
                placeholder="Search work order, vehicle, mechanic, or status..."
                value={recentSearch}
                onChange={(event) => setRecentSearch(event.target.value)}
              />
            }
            sort={
              <SortSelect
                className="w-full sm:w-60"
                value={recentSort}
                onChange={(value) => setRecentSort(value as DashboardTaskSort)}
                options={[
                  { value: "date-desc", label: "Date - Newest" },
                  { value: "date-asc", label: "Date - Oldest" },
                  { value: "vehicle-asc", label: "Vehicle - A to Z" },
                  { value: "vehicle-desc", label: "Vehicle - Z to A" },
                  { value: "mechanic-asc", label: "Mechanic - A to Z" },
                  { value: "mechanic-desc", label: "Mechanic - Z to A" },
                  { value: "status-asc", label: "Status - A to Z" },
                  { value: "status-desc", label: "Status - Z to A" },
                ]}
              />
            }
            actions={
              <div className="flex items-center gap-2">
                <DashboardFilterButton
                  open={recentFilterOpen}
                  onToggle={() => setRecentFilterOpen((current) => !current)}
                  options={["Pending", "Due", "In Progress", "Overdue", "Completed", "Cancelled"]}
                  selected={recentStatuses}
                  onChange={setRecentStatuses}
                  onClear={() => {
                    setRecentStatuses([]);
                    setRecentFilterOpen(false);
                  }}
                />
                <LegendHelp
                  title="Recent Work Orders Legend"
                  items={[
                    { label: "Due", description: "Ready to be started.", tone: "#7c3aed" },
                    { label: "In Progress", description: "Work has started.", tone: "#0f766e" },
                    { label: "Completed", description: "Work has been completed.", tone: "#059669" },
                    { label: "Overdue", description: "Work order needs attention.", tone: "#dc2626" },
                  ]}
                />
              </div>
            }
          />
          <DataTable
            data={recent}
            getRowKey={(task) => task.id}
            minWidth="900px"
            density="compact"
            adminSelectable={false}
            emptyMessage="No work orders found."
            columns={[
              {
                key: "workOrder",
                header: "Work Order No.",
                width: "22%",
                render: (task) => (
                  <span className="font-bold">{formatWorkOrderNumber(task.id)}</span>
                ),
              },
              {
                key: "vehicle",
                header: "Vehicle",
                width: "24%",
                render: (task) => plateNumber(task),
              },
              {
                key: "mechanic",
                header: "Assigned Mechanic",
                width: "28%",
                render: (task) => task.assignedDriver || "Unassigned",
              },
              {
                key: "status",
                header: "Status",
                width: "26%",
                render: (task) => <StatusBadge status={maintenanceStatusLabels[task.status]} />,
              },
            ]}
          />
        <div className="hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#070b45] text-xs uppercase text-white"><tr>{["Work Order No.", "Vehicle", "Assigned Mechanic", "Status"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--color-divider)]">
              {recent.map((task) => <tr key={task.id} className="hover:bg-[var(--color-input-bg)]"><td className="px-4 py-3 font-bold">{formatWorkOrderNumber(task.id)}</td><td className="px-4 py-3">{plateNumber(task)}</td><td className="px-4 py-3">{task.assignedDriver || "Unassigned"}</td><td className="px-4 py-3"><StatusBadge status={maintenanceStatusLabels[task.status]} /></td></tr>)}
              {!loading && recent.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--color-text-secondary)]">No work orders found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        </div>
      </Panel>

    </div>
  );
}
