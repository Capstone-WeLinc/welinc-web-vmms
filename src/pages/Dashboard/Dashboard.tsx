import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Truck,
  Wrench,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { getVmmsDashboardData, type VmmsDashboardData } from "../../lib/api/dashboardService";
import { getFuelAnomalies, type FuelAnomalyRecord } from "../../lib/api/fuelService";
import { useAuthStore } from "../../store/authStore";
import {
  MaintenanceStatus,
  maintenanceStatusLabels,
  type MaintenanceTask,
} from "../../types/maintenance";
import { getTaskTotalCost } from "../../lib/utils/maintenanceCosts";
import { isMechanicRole } from "../../lib/utils/permissions";

type DashboardFilter = "all" | "month";

const statusColors: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PENDING]: "#64748b",
  [MaintenanceStatus.DUE]: "#7c3aed",
  [MaintenanceStatus.IN_PROGRESS]: "#0284c7",
  [MaintenanceStatus.DONE]: "#d97706",
  [MaintenanceStatus.COMPLETED]: "#059669",
  [MaintenanceStatus.OVERDUE]: "#dc2626",
  [MaintenanceStatus.CANCELLED]: "#94a3b8",
};

const dateOf = (task: MaintenanceTask) =>
  new Date(task.startReferenceDate || task.date || 0);

const isCurrentMonth = (task: MaintenanceTask) => {
  const value = dateOf(task);
  const now = new Date();
  return (
    !Number.isNaN(value.getTime()) &&
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth()
  );
};

const getMaterialCost = (task: MaintenanceTask) => {
  return getTaskTotalCost(task);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const statusBadgeClasses: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PENDING]: "border-slate-300 bg-slate-100 text-slate-700",
  [MaintenanceStatus.DUE]: "border-violet-200 bg-violet-50 text-violet-700",
  [MaintenanceStatus.IN_PROGRESS]: "border-sky-200 bg-sky-50 text-sky-700",
  [MaintenanceStatus.DONE]: "border-amber-200 bg-amber-50 text-amber-700",
  [MaintenanceStatus.COMPLETED]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [MaintenanceStatus.OVERDUE]: "border-red-200 bg-red-50 text-red-700",
  [MaintenanceStatus.CANCELLED]: "border-slate-200 bg-slate-50 text-slate-500",
};

function StatusPill({ status }: { status: MaintenanceStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadgeClasses[status]}`}>
      {maintenanceStatusLabels[status]}
    </span>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card">
      <div className="border-b border-[var(--color-divider)] px-5 py-4">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const isMechanic = isMechanicRole(currentUser);
  const [data, setData] = useState<VmmsDashboardData>({ schedules: [], vehicles: [], garages: [] });
  const [fuelAnomalies, setFuelAnomalies] = useState<FuelAnomalyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DashboardFilter>("all");

  const loadDashboard = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [dashboardData, anomalyRows] = await Promise.all([
        getVmmsDashboardData(),
        currentUser?.role === "ADMIN" || currentUser?.role === "OPERATIONS" ? getFuelAnomalies() : Promise.resolve([]),
      ]);
      setData(dashboardData);
      setFuelAnomalies(anomalyRows);
    } catch (loadError) {
      console.error("Unable to load dashboard", loadError);
      setError("Unable to load maintenance dashboard data.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
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

  const filteredSchedules = filter === "month" ? schedules.filter(isCurrentMonth) : schedules;
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
  const activeWorkOrders = schedules.filter((task) => activeStatuses.has(task.status));
  const underMaintenance = new Set(activeWorkOrders.map((task) => task.vehicleId)).size;
  const completedThisMonth = schedules.filter(
    (task) => task.status === MaintenanceStatus.COMPLETED && isCurrentMonth(task),
  );
  const completedForSelectedPeriod =
    filter === "month"
      ? completedThisMonth
      : schedules.filter((task) => task.status === MaintenanceStatus.COMPLETED);
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
    { label: "Due Maintenance", value: schedules.filter((task) => task.status === MaintenanceStatus.DUE).length, icon: CalendarClock, color: "#7c3aed", path: "/maintenance-scheduling" },
    { label: "Overdue Maintenance", value: schedules.filter((task) => task.status === MaintenanceStatus.OVERDUE).length, icon: AlertTriangle, color: "#dc2626", path: "/maintenance-scheduling" },
    { label: "Open Fuel Anomalies", value: new Set(fuelAnomalies.filter((anomaly) => anomaly.status === "OPEN").map((anomaly) => anomaly.vehicle.plateNumber)).size, icon: AlertTriangle, color: "#b91c1c", path: "/fuel-management" },
    {
      label: filter === "month" ? "Completed This Month" : "Completed Maintenance",
      value: completedForSelectedPeriod.length,
      icon: CheckCircle2,
      color: "#059669",
      path: "/maintenance-logs",
    },
    {
      label: filter === "month" ? "Cost This Month" : "Maintenance Cost",
      value: formatCurrency(maintenanceCost),
      icon: CircleDollarSign,
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

  const overdue = schedules
    .filter((task) => task.status === MaintenanceStatus.OVERDUE)
    .sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime())
    .slice(0, 5);
  const recent = [...schedules]
    .sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="DASHBOARD"
        subtitle={isMechanic ? "Your assigned maintenance workload" : "Vehicle maintenance operations overview"}
        action={
          <select
            aria-label="Dashboard period"
            value={filter}
            onChange={(event) => setFilter(event.target.value as DashboardFilter)}
            className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 text-sm text-[var(--color-text-primary)]"
          >
            <option value="all">All records</option>
            <option value="month">This month</option>
          </select>
        }
      />

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button className="font-bold" onClick={() => void loadDashboard()}>Retry</button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        {loading
          ? Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-input-bg)]" />
              <div className="mt-4 h-6 w-20 rounded bg-[var(--color-input-bg)]" />
            </div>
          ))
          : summaryCards.map((card) => (
            <button key={card.label} onClick={() => navigate(card.path)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-[var(--color-brand-primary)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: card.color, backgroundColor: `${card.color}16` }}>
                <card.icon size={20} />
              </div>
              <div className="mt-4 text-2xl font-bold text-[var(--color-text-primary)]">{card.value}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">{card.label}</div>
            </button>
          ))}
      </div>

      <div>
        <Panel title="Maintenance Status Breakdown" subtitle="Current work order distribution by status">
          <div className="space-y-4 p-5">
            {/* Total Summary */}
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
              <span>Work Order Composition</span>
              <span className="font-bold text-[var(--color-text-primary)]">
                {statusBreakdown.reduce((acc, s) => acc + s.count, 0)} Total Work Orders
              </span>
            </div>

            {/* Stacked Proportional Distribution Bar */}
            {(() => {
              const total = statusBreakdown.reduce((acc, s) => acc + s.count, 0);
              return (
                <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] p-0.5 shadow-inner">
                  {total > 0 ? (
                    statusBreakdown.map(({ status, count }) => {
                      const pct = Math.round((count / total) * 100);
                      if (pct === 0) return null;
                      return (
                        <div
                          key={status}
                          className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${pct}%`, backgroundColor: statusColors[status] }}
                          title={`${maintenanceStatusLabels[status]}: ${count} (${pct}%)`}
                        />
                      );
                    })
                  ) : (
                    <div className="h-full w-full rounded-full bg-[var(--color-border)] opacity-30" />
                  )}
                </div>
              );
            })()}

            {/* Categorical Breakdown Pills / List */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(() => {
                const total = statusBreakdown.reduce((acc, s) => acc + s.count, 0);
                return statusBreakdown.map(({ status, count }) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3 text-sm shadow-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full shadow-xs"
                          style={{ backgroundColor: statusColors[status] }}
                        />
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {maintenanceStatusLabels[status]}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[var(--color-text-primary)]">{count}</span>
                        <span className="ml-1.5 text-xs text-[var(--color-text-secondary)]">({pct}%)</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </Panel>
      </div>

      <div>
        <Panel title="Overdue Maintenance" subtitle="Work orders beyond their maintenance threshold">
          <div className="overflow-x-auto">
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
        </Panel>
      </div>

      <Panel title="Recent Work Orders" subtitle="Latest maintenance work order activity">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#070b45] text-xs uppercase text-white"><tr>{["Work Order No.", "Vehicle", "Assigned Mechanic", "Status"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--color-divider)]">
              {recent.map((task) => <tr key={task.id} className="hover:bg-[var(--color-input-bg)]"><td className="px-4 py-3 font-bold">{task.workOrderNumber ?? "N/A"}</td><td className="px-4 py-3">{plateNumber(task)}</td><td className="px-4 py-3">{task.assignedDriver || "Unassigned"}</td><td className="px-4 py-3"><StatusPill status={task.status} /></td></tr>)}
              {!loading && recent.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-[var(--color-text-secondary)]">No work orders found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>

    </div>
  );
}
