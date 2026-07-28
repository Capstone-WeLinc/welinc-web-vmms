import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Search, TrendingUp, AlertTriangle, ShieldCheck, Activity, Sparkles, ArrowUpRight } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { Card } from "../../components/ui";
import {
  getAnalyticsOverview,
  getAnalyticsVehicles,
  getAnalyticsAlerts,
  searchMaintenanceSchedules,
  type AnalyticsOverviewResponse,
  type AnalyticsVehicleResponse,
  type AnalyticsAlertResponse,
} from "../../lib/api/analyticsService";

const formatValue = (value: unknown) => {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

function MetricTile({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof Activity }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{hint}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2.5 text-[var(--color-brand-primary)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function StatusBars({ items }: { items: Array<{ status: string; percentage?: number; scheduleCount?: number }> }) {
  const normalizedItems = items.map((item) => ({
    status: String(item.status ?? "Unknown"),
    percentage: Number(item.percentage ?? item.scheduleCount ?? 0),
    scheduleCount: Number(item.scheduleCount ?? 0),
  }));
  const maxValue = Math.max(1, ...normalizedItems.map((item) => Number(item.percentage ?? item.scheduleCount ?? 0)));

  return (
    <div className="space-y-3">
      {normalizedItems.map((item) => {
        const value = Number(item.percentage ?? item.scheduleCount ?? 0);
        const width = Math.max(8, Math.round((value / maxValue) * 100));
        return (
          <div key={item.status}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--color-text-primary)]">{item.status}</span>
              <span className="text-[var(--color-text-secondary)]">{value}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--color-input-bg)]">
              <div className="h-2.5 rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendBars({ items }: { items: Array<{ monthKey: string; scheduledCount?: number; completedCount?: number; activeCount?: number; overdueCount?: number }> }) {
  const normalizedItems = items.map((item) => ({
    monthKey: String(item.monthKey ?? "Unknown"),
    scheduledCount: Number(item.scheduledCount ?? 0),
    completedCount: Number(item.completedCount ?? 0),
    activeCount: Number(item.activeCount ?? 0),
    overdueCount: Number(item.overdueCount ?? 0),
  }));
  const maxValue = Math.max(1, ...normalizedItems.map((item) => item.scheduledCount));

  return (
    <div className="mt-4 flex items-end gap-3 overflow-x-auto pb-2">
      {normalizedItems.map((item) => {
        const scheduled = item.scheduledCount;
        const completed = item.completedCount;
        const height = Math.max(24, Math.round((scheduled / maxValue) * 100));
        return (
          <div key={item.monthKey} className="min-w-[70px] flex-1 text-center">
            <div className="flex h-28 items-end justify-center gap-1 rounded-2xl bg-[var(--color-input-bg)] p-2">
              <div className="w-full rounded-t-xl bg-[var(--color-brand-primary)]" style={{ height: `${height}%` }} />
              <div className="w-full rounded-t-xl bg-emerald-500/70" style={{ height: `${Math.max(8, Math.round((completed / maxValue) * 100))}%` }} />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{item.monthKey.slice(5)}</p>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ value, max, label }: { value: number; max: number; label: string }) {
  const percentage = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full border-[8px] border-[var(--color-input-bg)]"
        style={{ background: `conic-gradient(var(--color-brand-primary) ${percentage}%, rgba(148,163,184,0.2) 0)` }}
      >
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{percentage}%</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{value} / {max}</p>
      </div>
    </div>
  );
}

export default function AIAnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [vehicles, setVehicles] = useState<AnalyticsVehicleResponse | null>(null);
  const [alerts, setAlerts] = useState<AnalyticsAlertResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; vehicleId: string; status: string; score?: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [overviewData, vehicleData, alertsData] = await Promise.all([
          getAnalyticsOverview(),
          getAnalyticsVehicles(),
          getAnalyticsAlerts(),
        ]);
        setOverview(overviewData);
        setVehicles(vehicleData);
        setAlerts(alertsData);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        const results = await searchMaintenanceSchedules(searchQuery, 6);
        setSearchResults(results);
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const stats = useMemo(() => {
    const snapshot = overview?.snapshot ?? {};
    return [
      {
        label: "Fleet vehicles",
        value: formatValue(snapshot.totalVehicles),
        hint: "Tracked assets",
        icon: Activity,
      },
      {
        label: "Active schedules",
        value: formatValue(snapshot.totalSchedules),
        hint: "Scheduled work",
        icon: TrendingUp,
      },
      {
        label: "Overdue items",
        value: formatValue(snapshot.overdueSchedules),
        hint: "Needs attention",
        icon: AlertTriangle,
      },
      {
        label: "Maintenance cost",
        value: formatValue(snapshot.totalMaintenanceCost),
        hint: "Estimated spend",
        icon: ShieldCheck,
      },
    ];
  }, [overview]);

  const completionRatio = useMemo(() => {
    const snapshot = overview?.snapshot ?? {};
    const total = Number(snapshot.totalSchedules ?? 0);
    const completed = Number(snapshot.completedSchedules ?? 0);
    return { value: completed, max: total || 1 };
  }, [overview]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BrainCircuit}
        title="AI / ANALYTICS"
        subtitle="Operational intelligence from the backend analytics data mart and smart schedule search"
      />

      <Card className="overflow-hidden border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card-bg)] to-[var(--color-input-bg)] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-1 text-sm text-[var(--color-text-secondary)]">
              <Sparkles className="h-4 w-4 text-[var(--color-brand-primary)]" />
              AI-powered fleet insights
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--color-text-primary)]">Semantic schedule search</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Search maintenance schedules by title, vehicle, mechanic, or status using the backend search flow.</p>
          </div>
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Try “brake”, “oil”, or a vehicle plate"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {searchResults.length === 0 && searchQuery.trim() ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)] md:col-span-2 xl:col-span-3">
              No schedule matches for that query yet.
            </div>
          ) : null}
          {searchResults.map((result) => (
            <div key={result.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{result.title}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{result.vehicleId}</p>
                </div>
                {typeof result.score === "number" ? (
                  <span className="rounded-full bg-[var(--color-status-info)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)]">{result.score.toFixed(2)}</span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                <span>Status: {result.status}</span>
                <span className="inline-flex items-center gap-1 font-medium text-[var(--color-brand-primary)]">
                  Open <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {loading ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-8 text-sm text-[var(--color-text-secondary)]">
          Loading analytics from the backend...
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <MetricTile key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} icon={stat.icon} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Maintenance trend</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Recent monthly cycle across scheduled, completed, and overdue work.</p>
            </div>
            <div className="rounded-full bg-[var(--color-status-success)]/15 px-3 py-1 text-sm font-medium text-emerald-600">Improving</div>
          </div>
          <TrendBars items={(overview?.monthlyTrend ?? []).map((item) => ({
            monthKey: String((item as Record<string, unknown>).monthKey ?? "Unknown"),
            scheduledCount: Number((item as Record<string, unknown>).scheduledCount ?? 0),
            completedCount: Number((item as Record<string, unknown>).completedCount ?? 0),
            activeCount: Number((item as Record<string, unknown>).activeCount ?? 0),
            overdueCount: Number((item as Record<string, unknown>).overdueCount ?? 0),
          }))} />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Status distribution</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">How the fleet maintenance workload is currently segmented.</p>
          <div className="mt-5">
            <StatusBars items={(overview?.statusBreakdown ?? []).map((item) => ({
              status: String((item as Record<string, unknown>).status ?? "Unknown"),
              percentage: Number((item as Record<string, unknown>).percentage ?? (item as Record<string, unknown>).scheduleCount ?? 0),
              scheduleCount: Number((item as Record<string, unknown>).scheduleCount ?? 0),
            }))} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Completion health</h3>
            <div className="mt-4 space-y-3">
              <DonutChart value={completionRatio.value} max={completionRatio.max} label="Completed schedules" />
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 text-sm text-[var(--color-text-secondary)]">
                Average response window is trending well with fewer overdue items than the previous cycle.
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Data freshness</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Last generated {formatDate(overview?.dataSource?.generatedAt as string | undefined)}</p>
            <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 text-sm text-[var(--color-text-secondary)]">
              Source: {String(overview?.dataSource?.type ?? "—")}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Priority alerts</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">The most urgent maintenance follow-ups for the next window.</p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-medium text-amber-700">{alerts?.alerts?.length ?? 0} active</span>
          </div>
          <div className="mt-4 space-y-3">
            {(alerts?.alerts ?? []).map((alert) => (
              <div key={String(alert.alertId)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{String(alert.maintenanceTitle)}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{String(alert.message)}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-status-info)]/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">{String(alert.severity)}</span>
                </div>
                <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Recommended action: {String(alert.recommendedAction ?? "Review the work order")}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Vehicle KPI snapshot</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(vehicles?.vehicles ?? []).map((vehicle) => (
            <div key={String(vehicle.vehicleId)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--color-text-primary)]">{String(vehicle.plateNumber)}</p>
                <span className="rounded-full bg-[var(--color-status-info)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)]">{String(vehicle.riskLevel)}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{String(vehicle.vehicleModel)}</p>
              <div className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
                <div>Completion rate: {formatValue(vehicle.completionRate)}%</div>
                <div>Overdue: {formatValue(vehicle.overdueSchedules)}</div>
                <div>Next due: {formatValue(vehicle.nextDueDate)}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
