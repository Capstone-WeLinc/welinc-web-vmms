import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  RefreshCw,
  Timer,
  Truck,
  Wrench,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import MaintenanceStatusBadge from "../../components/ui/MaintenanceStatusBadge";
import KpiCard from "../../components/ui/KpiCard";
import { getVmmsDashboardData, type VmmsDashboardData } from "../../lib/api/dashboardService";
import { getFuelAnomalies, type FuelAnomalyRecord } from "../../lib/api/fuelService";
import { useAuthStore } from "../../store/authStore";
import {
  MaintenanceStatus,
  maintenanceStatusLabels,
} from "../../types/maintenance";
import { canEditWorkOrderPriority, isMechanicRole } from "../../lib/utils/permissions";
import {
  buildModel,
  formatPhp,
  normalizeFilters,
  scopeSchedulesForUser,
  type AttentionItem,
  type DashboardFilters,
  type DashboardRange,
} from "./dashboardModel";

const EMPTY_DATA: VmmsDashboardData = { schedules: [], vehicles: [], garages: [] };
const REFRESH_MS = 30_000;

const breakdownColors: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PENDING]: "#64748b",
  [MaintenanceStatus.DUE]: "#7c3aed",
  [MaintenanceStatus.IN_PROGRESS]: "#0284c7",
  [MaintenanceStatus.DONE]: "#d97706",
  [MaintenanceStatus.COMPLETED]: "#059669",
  [MaintenanceStatus.OVERDUE]: "#dc2626",
  [MaintenanceStatus.CANCELLED]: "#94a3b8",
};

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-divider)] px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QueueList({
  items,
  emptyText,
  onNavigate,
}: {
  items: AttentionItem[];
  emptyText: string;
  onNavigate: (path: string) => void;
}) {
  if (items.length === 0) {
    return <div className="px-5 py-8 text-sm text-[var(--color-text-secondary)]">{emptyText}</div>;
  }
  return (
    <ul className="divide-y divide-[var(--color-divider)]">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-[var(--color-text-primary)]">{item.primary}</p>
              {item.status && (Object.values(MaintenanceStatus) as string[]).includes(item.status) ? (
                <MaintenanceStatusBadge status={item.status as MaintenanceStatus} />
              ) : item.status ? (
                <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {item.status}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.secondary}</p>
            {item.meta ? <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">{item.meta}</p> : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)]"
            onClick={() => onNavigate(item.href)}
          >
            {item.ctaLabel}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useAuthStore((state) => state.currentUser);
  const isMechanic = isMechanicRole(currentUser);
  const canSeeOpsPanels = canEditWorkOrderPriority(currentUser);

  const [data, setData] = useState<VmmsDashboardData>(EMPTY_DATA);
  const [fuelAnomalies, setFuelAnomalies] = useState<FuelAnomalyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedOnce = useRef(false);

  const filters = useMemo(
    () => normalizeFilters(searchParams.get("range"), searchParams.get("from"), searchParams.get("to")),
    [searchParams],
  );

  const updateFilters = useCallback(
    (next: DashboardFilters) => {
      const params = new URLSearchParams();
      params.set("range", next.range);
      if (next.range === "custom") {
        if (next.from) params.set("from", next.from);
        if (next.to) params.set("to", next.to);
      }
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const loadDashboard = useCallback(
    async (showLoading = true) => {
      if (showLoading && !hasLoadedOnce.current) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [dashboardData, anomalyRows] = await Promise.all([
          getVmmsDashboardData(),
          canSeeOpsPanels ? getFuelAnomalies() : Promise.resolve([]),
        ]);
        setData(dashboardData);
        setFuelAnomalies(anomalyRows);
        hasLoadedOnce.current = true;
        setLastUpdated(new Date());
      } catch (loadError) {
        console.error("Unable to load dashboard", loadError);
        setError(
          hasLoadedOnce.current
            ? "Unable to refresh dashboard data. Showing the last loaded data."
            : "Unable to load maintenance dashboard data.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canSeeOpsPanels],
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadDashboard(), 0);
    const refreshDashboard = () => void loadDashboard(false);
    const refreshInterval = window.setInterval(refreshDashboard, REFRESH_MS);
    window.addEventListener("focus", refreshDashboard);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshDashboard);
    };
  }, [loadDashboard]);

  const schedules = useMemo(
    () => scopeSchedulesForUser(data.schedules, currentUser, isMechanic),
    [currentUser, data.schedules, isMechanic],
  );

  const model = useMemo(
    () =>
      buildModel({
        data,
        schedules,
        fuelAnomalies: canSeeOpsPanels ? fuelAnomalies : [],
        filters,
      }),
    [canSeeOpsPanels, data, filters, fuelAnomalies, schedules],
  );

  const dueQueue = useMemo(
    () =>
      schedules
        .filter((task) => task.status === MaintenanceStatus.DUE)
        .slice(0, 5)
        .map((task) => ({
          id: task.id,
          primary: task.workOrderNumber ?? task.vehicleId,
          secondary: task.assignedDriver || "Unassigned mechanic",
          status: task.status,
          href: `/maintenance-scheduling?search=${encodeURIComponent(task.workOrderNumber ?? task.title ?? "")}`,
          ctaLabel: "Open schedule",
          meta: "Due now",
        })),
    [schedules],
  );

  const summaryCards: Array<{
    label: string;
    value: string | number;
    icon: ComponentType<{ size?: number }>;
    color: string;
    path: string;
    hint?: string;
  }> = [
    { label: "Total Vehicles", value: model.current.totalVehicles, icon: Truck, color: "#2563eb", path: "/vehicles", hint: "Current fleet scope" },
    { label: "Vehicles Under Maintenance", value: model.current.vehiclesUnderMaintenance, icon: Wrench, color: "#d97706", path: "/work-orders", hint: "Current operational state" },
    { label: "Active Work Orders", value: model.current.activeWorkOrders, icon: ClipboardList, color: "#0284c7", path: "/work-orders", hint: "Due, in progress, or overdue" },
    { label: "Due Maintenance", value: model.current.due, icon: CalendarClock, color: "#7c3aed", path: "/maintenance-scheduling", hint: "Current operational state" },
    { label: "Overdue Maintenance", value: model.current.overdue, icon: AlertTriangle, color: "#dc2626", path: "/maintenance-scheduling", hint: "Needs immediate attention" },
    ...(canSeeOpsPanels
      ? [{
          label: "Open Fuel Anomalies",
          value: model.current.openFuelAnomalies,
          icon: AlertTriangle,
          color: "#b91c1c",
          path: "/fuel-management",
          hint: `${model.current.openFuelAnomalyVehicles} vehicle(s) affected`,
        }]
      : []),
    { label: "Awaiting Review", value: model.current.awaitingReview, icon: Timer, color: "#b45309", path: "/work-orders", hint: "Done, pending review" },
    {
      label: model.period.isBounded ? "Completed in Period" : "Completed (All Records)",
      value: model.period.isBounded ? model.periodActivity.completedInPeriodByDate : model.current.completedAll,
      icon: CheckCircle2,
      color: "#059669",
      path: "/maintenance-logs",
      hint: model.period.isBounded ? "By recorded work order date" : "Current visible scope",
    },
  ];

  const loadingCards = canSeeOpsPanels ? 8 : 7;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="DASHBOARD"
        subtitle={isMechanic ? "Your assigned maintenance workload" : "Vehicle maintenance operations overview"}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Dashboard period"
              value={filters.range}
              onChange={(event) =>
                updateFilters({
                  ...filters,
                  range: event.target.value as DashboardRange,
                  ...(event.target.value !== "custom" ? { from: "", to: "" } : {}),
                })
              }
              className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 text-sm text-[var(--color-text-primary)]"
            >
              <option value="all">All records</option>
              <option value="today">Today</option>
              <option value="month">This month</option>
              <option value="custom">Custom range</option>
            </select>
            {filters.range === "custom" ? (
              <>
                <input
                  type="date"
                  aria-label="From date"
                  value={filters.from}
                  onChange={(event) => updateFilters({ ...filters, from: event.target.value })}
                  className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 text-sm text-[var(--color-text-primary)]"
                />
                <input
                  type="date"
                  aria-label="To date"
                  value={filters.to}
                  onChange={(event) => updateFilters({ ...filters, to: event.target.value })}
                  className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 text-sm text-[var(--color-text-primary)]"
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void loadDashboard(false)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 text-sm font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)]"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" className="font-bold underline-offset-2 hover:underline" onClick={() => void loadDashboard()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-secondary)]">
        <p>
          <span className="font-semibold text-[var(--color-text-primary)]">Current view:</span> {model.period.label}
          {!model.period.isValid && filters.range === "custom" ? " (invalid custom range)" : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        {loading
          ? Array.from({ length: loadingCards }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5">
                <div className="h-9 w-9 rounded-lg bg-[var(--color-input-bg)]" />
                <div className="mt-4 h-6 w-20 rounded bg-[var(--color-input-bg)]" />
                <div className="mt-2 h-3 w-28 rounded bg-[var(--color-input-bg)]" />
              </div>
            ))
          : summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <KpiCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  icon={<Icon size={20} />}
                  color={card.color}
                  hint={card.hint}
                  onClick={() => navigate(card.path)}
                />
              );
            })}
      </div>

      <Panel
        title="Period activity"
        subtitle={model.period.attributionNote}
        action={
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-3 text-right">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Maintenance cost {model.period.isBounded ? "in period" : "(all records)"}
            </div>
            <div className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
              {formatPhp(model.periodActivity.maintenanceCostInPeriod)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">By recorded work order date</div>
          </div>
        }
      >
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <KpiCard
            label="Work orders in period"
            value={model.periodActivity.workOrdersInPeriod}
            icon={<ClipboardList size={20} />}
            color="#0284c7"
            hint="Current report period"
          />
          <KpiCard
            label="Completed in period"
            value={model.periodActivity.completedInPeriodByDate}
            icon={<CheckCircle2 size={20} />}
            color="#059669"
            hint="Completed status, by recorded date"
          />
          <KpiCard
            label="Visible schedules"
            value={model.visibleSchedules.length}
            icon={<CalendarClock size={20} />}
            color="#7c3aed"
            hint="Current scope (role/entity)"
          />
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Overdue maintenance" subtitle="Tasks currently overdue and needing action">
          <QueueList items={model.queues.overdue} emptyText="No overdue maintenance." onNavigate={navigate} />
        </Panel>
        <Panel title="Due now" subtitle="Work orders currently marked due">
          <QueueList items={dueQueue} emptyText="No work orders are currently due." onNavigate={navigate} />
        </Panel>
        <Panel title="Due soon (next 7 days)" subtitle="Upcoming items with computable due/reference dates">
          <QueueList items={model.queues.dueSoon} emptyText="No upcoming work orders detected in the next 7 days." onNavigate={navigate} />
        </Panel>
        <Panel title="Awaiting review" subtitle="Completed by mechanic and waiting for review (DONE)">
          <QueueList items={model.queues.awaitingReview} emptyText="No work orders are awaiting review." onNavigate={navigate} />
        </Panel>
      </div>

      {canSeeOpsPanels ? (
        <Panel title="Open fuel anomalies" subtitle="Vehicles/entries flagged for fuel review">
          <QueueList items={model.queues.openAnomalies} emptyText="No open fuel anomalies." onNavigate={navigate} />
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Maintenance status breakdown" subtitle="Current visible work orders by status">
          <div className="space-y-4 p-5">
            {(() => {
              const total = model.statusBreakdown.reduce((acc, item) => acc + item.count, 0);
              const maxCount = Math.max(1, ...model.statusBreakdown.map((item) => item.count));
              return (
                <>
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
                    <span>Work orders by status</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{total} total</span>
                  </div>
                  {total === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                      No work orders in the current view.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {model.statusBreakdown.map(({ status, count }) => {
                        const pctOfTotal = Math.round((count / total) * 100);
                        const barPct = (count / maxCount) * 100;
                        const color = breakdownColors[status];
                        return (
                          <div key={status} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                                <span className="truncate font-semibold text-[var(--color-text-primary)]">
                                  {maintenanceStatusLabels[status]}
                                </span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="font-bold text-[var(--color-text-primary)]">{count}</span>
                                <span className="ml-1.5 text-xs text-[var(--color-text-secondary)]">({pctOfTotal}%)</span>
                              </div>
                            </div>
                            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-input-bg)]">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${barPct}%`, backgroundColor: color }}
                                title={`${maintenanceStatusLabels[status]}: ${count} (${pctOfTotal}%)`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </Panel>

        <Panel title="Garage workload" subtitle="Active work orders (due, in progress, overdue) by garage">
          {model.garageWorkload.length === 0 ? (
            <div className="px-5 py-8 text-sm text-[var(--color-text-secondary)]">No active garage workload.</div>
          ) : (
            <div className="divide-y divide-[var(--color-divider)]">
              {model.garageWorkload.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-4">
                  <span className="font-medium text-[var(--color-text-primary)]">{item.name}</span>
                  <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-[var(--color-input-bg)] px-2.5 py-1 text-sm font-bold text-[var(--color-text-primary)]">
                    {item.active}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Recent work orders" subtitle="Latest visible work orders by recorded date">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#070b45] text-xs uppercase text-white">
              <tr>
                {["Work Order", "Vehicle / Assignee", "Recorded Date", "Status"].map((heading) => (
                  <th key={heading} className="px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-divider)]">
              {model.recentWorkOrders.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--color-input-bg)]">
                  <td className="px-4 py-3 font-bold text-[var(--color-text-primary)]">{item.primary}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{item.secondary}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.meta ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.status && (Object.values(MaintenanceStatus) as string[]).includes(item.status) ? (
                      <MaintenanceStatusBadge status={item.status as MaintenanceStatus} />
                    ) : (
                      item.status ?? "—"
                    )}
                  </td>
                </tr>
              ))}
              {!loading && model.recentWorkOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[var(--color-text-secondary)]">No work orders found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
