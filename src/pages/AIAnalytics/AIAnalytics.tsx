import React, { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Search,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Sparkles,
  RefreshCw,
  FileText,
  AlertOctagon,
  Car,
  Clock,
  Layers,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { Card, Button, Badge } from "../../components/ui";
import {
  getAnalyticsHealth,
  getAnalyticsOverview,
  getAnalyticsVehicles,
  getAnalyticsAlerts,
  getAnalyticsInsights,
  getAnalyticsReport,
  searchMaintenanceSchedules,
  type AnalyticsOverviewResponse,
  type AnalyticsVehicleResponse,
  type AnalyticsAlertResponse,
  type AnalyticsInsightsResponse,
  type AnalyticsReportResponse,
  type ScheduleSearchResult,
} from "../../lib/api/analyticsService";
import { formatWorkOrderNumber } from "../../lib/utils/workOrders";

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
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

/** Inline bold: **text** → <strong>text</strong> */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-[var(--color-text-primary)]">{part.slice(2, -2)}</strong>
      : part
  );
}

type AiBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; items: string[] }
  | { kind: "numbered"; items: string[] };

function parseAiSummary(raw: string): AiBlock[] {
  // Normalise line endings and strip markdown heading hashes
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();

  const lines = text.split("\n");
  const blocks: AiBlock[] = [];

  let bulletAccum: string[] = [];
  let numberedAccum: string[] = [];

  const flushBullet = () => {
    if (bulletAccum.length) { blocks.push({ kind: "bullet", items: [...bulletAccum] }); bulletAccum = []; }
  };
  const flushNumbered = () => {
    if (numberedAccum.length) { blocks.push({ kind: "numbered", items: [...numberedAccum] }); numberedAccum = []; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue; // treat blank lines as visual breaks only

    // Numbered list item: "1. …" or "1) …"
    const numberedMatch = line.match(/^\d+[\).]\s+(.+)/);
    if (numberedMatch) {
      flushBullet();
      numberedAccum.push(numberedMatch[1]);
      continue;
    }

    // Bullet list item: "- …" or "* …" or "• …"
    const bulletMatch = line.match(/^[-*•]\s+(.+)/);
    if (bulletMatch) {
      flushNumbered();
      bulletAccum.push(bulletMatch[1]);
      continue;
    }

    // Anything else — flush lists first
    flushBullet();
    flushNumbered();

    // Detect inline section heading patterns: ends with ":" and is short, or is ALL-CAPS short phrase
    const isHeading =
      (line.endsWith(":") && line.length < 80 && !line.includes(".")) ||
      /^[A-Z][A-Z\s\d&/–-]{4,}$/.test(line);

    if (isHeading) {
      blocks.push({ kind: "heading", text: line.replace(/:$/, "") });
    } else {
      blocks.push({ kind: "paragraph", text: line });
    }
  }

  flushBullet();
  flushNumbered();

  return blocks;
}

function renderAiSummary(summary?: string) {
  if (!summary?.trim()) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">No AI insights available.</p>
    );
  }

  const blocks = parseAiSummary(summary);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <p key={i} className={`${i > 0 ? "pt-2" : ""} text-xs font-bold uppercase tracking-wider text-[var(--color-brand-primary)]`}>
              {block.text}
            </p>
          );
        }

        if (block.kind === "numbered") {
          return (
            <ol key={i} className="space-y-1.5 pl-4 text-sm leading-relaxed text-[var(--color-text-secondary)]" style={{ listStyleType: "decimal" }}>
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.kind === "bullet") {
          return (
            <ul key={i} className="space-y-1.5 pl-4 text-sm leading-relaxed text-[var(--color-text-secondary)]" style={{ listStyleType: "disc" }}>
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        // paragraph
        return (
          <p key={i} className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function MetricTile({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof Activity }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-3 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2.5 text-[var(--color-brand-primary)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function StatusBars({ items }: { items: Array<{ status: string; percentage?: number; scheduleCount?: number }> }) {
  const normalizedItems = items.map((item) => ({
    status: String(item.status ?? "Unknown"),
    percentage: Number(item.percentage ?? 0),
    scheduleCount: Number(item.scheduleCount ?? 0),
  }));

  const totalCount = normalizedItems.reduce((sum, item) => sum + (item.scheduleCount || 0), 0);

  const itemsWithPct = normalizedItems.map((item) => {
    const calcPct = totalCount > 0 ? Math.round((item.scheduleCount / totalCount) * 100) : item.percentage;
    return {
      ...item,
      displayPercentage: Math.min(100, Math.max(0, calcPct)),
    };
  });

  const getStatusConfig = (status: string) => {
    const key = status.toUpperCase();
    if (key === "COMPLETED") {
      return {
        bg: "bg-emerald-500",
        text: "text-emerald-500",
        lightBg: "bg-emerald-500/10 border-emerald-500/20",
        icon: CheckCircle2,
      };
    }
    if (key === "IN_PROGRESS" || key === "IN PROGRESS") {
      return {
        bg: "bg-amber-500",
        text: "text-amber-500",
        lightBg: "bg-amber-500/10 border-amber-500/20",
        icon: Clock,
      };
    }
    if (key === "OVERDUE") {
      return {
        bg: "bg-rose-500",
        text: "text-rose-500",
        lightBg: "bg-rose-500/10 border-rose-500/20",
        icon: AlertTriangle,
      };
    }
    return {
      bg: "bg-[var(--color-brand-primary)]",
      text: "text-[var(--color-brand-primary)]",
      lightBg: "bg-[var(--color-brand-primary)]/10 border-[var(--color-brand-primary)]/20",
      icon: Layers,
    };
  };

  return (
    <div className="space-y-4">
      {/* Total schedules summary header */}
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)]">
        <span>Fleet Maintenance Distribution</span>
        <span className="font-bold text-[var(--color-text-primary)]">{totalCount} total schedules</span>
      </div>

      {/* Multi-Segment Stacked Proportion Distribution Bar */}
      <div className="flex h-3.5 w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] p-0.5 shadow-inner">
        {totalCount > 0 ? (
          itemsWithPct.map((item) => {
            if (item.displayPercentage === 0) return null;
            const config = getStatusConfig(item.status);
            return (
              <div
                key={item.status}
                className={`h-full transition-all duration-300 ${config.bg} first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${item.displayPercentage}%` }}
                title={`${item.status}: ${item.scheduleCount} (${item.displayPercentage}%)`}
              />
            );
          })
        ) : (
          <div className="h-full w-full rounded-full bg-[var(--color-border)] opacity-30" />
        )}
      </div>

      {/* Categorical Details Breakdown Grid */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {itemsWithPct.map((item) => {
          const config = getStatusConfig(item.status);
          const Icon = config.icon;

          return (
            <div
              key={item.status}
              className={`flex items-center justify-between rounded-xl border p-3 ${config.lightBg}`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20 ${config.text}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)]">{item.status}</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">{item.scheduleCount} schedules</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-extrabold ${config.text} bg-white/80 dark:bg-black/30 shadow-xs`}>
                  {item.displayPercentage}%
                </span>
                <p className="mt-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">fleet share</p>
              </div>
            </div>
          );
        })}
      </div>
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

  const maxVal = Math.max(
    1,
    ...normalizedItems.flatMap((item) => [item.scheduledCount, item.completedCount])
  );

  return (
    <div className="mt-4 flex items-end gap-3 overflow-x-auto pb-2">
      {normalizedItems.map((item) => {
        const scheduled = item.scheduledCount;
        const completed = item.completedCount;
        const scheduledHeight = scheduled > 0 ? Math.max(12, Math.round((scheduled / maxVal) * 100)) : 4;
        const completedHeight = completed > 0 ? Math.max(12, Math.round((completed / maxVal) * 100)) : 4;

        return (
          <div key={item.monthKey} className="min-w-[75px] flex-1 text-center">
            <div className="flex h-32 items-end justify-center gap-1.5 rounded-xl border border-[var(--color-border)]/50 bg-[var(--color-input-bg)] p-2">
              <div className="group relative flex w-full flex-col items-center justify-end h-full">
                <span className="mb-1 text-[10px] font-bold text-[var(--color-brand-primary)] transition-opacity group-hover:opacity-100 sm:opacity-80">
                  {scheduled}
                </span>
                <div
                  className="w-full rounded-t-md bg-[var(--color-brand-primary)] shadow-sm transition-all duration-300 hover:brightness-110"
                  style={{ height: `${scheduledHeight}%` }}
                  title={`Scheduled: ${scheduled}`}
                />
              </div>

              <div className="group relative flex w-full flex-col items-center justify-end h-full">
                <span className="mb-1 text-[10px] font-bold text-emerald-500 transition-opacity group-hover:opacity-100 sm:opacity-80">
                  {completed}
                </span>
                <div
                  className="w-full rounded-t-md bg-emerald-500 shadow-sm transition-all duration-300 hover:brightness-110"
                  style={{ height: `${completedHeight}%` }}
                  title={`Completed: ${completed}`}
                />
              </div>
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              {item.monthKey.slice(5)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function AIAnalyticsPage({ initialTab = "overview" }: { initialTab?: "overview" | "vehicles" | "alerts" | "report" }) {
  const [activeTab, setActiveTab] = useState<"overview" | "vehicles" | "alerts" | "report">(initialTab);
  const [overview, setOverview] = useState<AnalyticsOverviewResponse | null>(null);
  const [vehicles, setVehicles] = useState<AnalyticsVehicleResponse | null>(null);
  const [alerts, setAlerts] = useState<AnalyticsAlertResponse | null>(null);
  const [aiInsights, setAiInsights] = useState<AnalyticsInsightsResponse | null>(null);
  const [fullReport, setFullReport] = useState<AnalyticsReportResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ScheduleSearchResult[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [vehicleRiskFilter, setVehicleRiskFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [, overviewData, vehicleData, alertsData, aiInsightsData, reportData] = await Promise.all([
        getAnalyticsHealth(),
        getAnalyticsOverview(),
        getAnalyticsVehicles(),
        getAnalyticsAlerts(),
        getAnalyticsInsights(),
        getAnalyticsReport(),
      ]);
      setOverview(overviewData);
      setVehicles(vehicleData);
      setAlerts(alertsData);
      setAiInsights(aiInsightsData);
      setFullReport(reportData);
      setHasGenerated(true);
    } catch (err: unknown) {
      console.error("Failed to load analytics data:", err);
      const message = err instanceof Error ? err.message : "Failed to connect to analytics service.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualGenerate = () => {
    void loadData();
  };

  const handleRefreshInsights = async () => {
    setRefreshingInsights(true);
    try {
      const insightsData = await getAnalyticsInsights();
      setAiInsights(insightsData);
    } finally {
      setRefreshingInsights(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        if (!searchQuery.trim()) {
          setSearchResults([]);
          return;
        }
        const results = await searchMaintenanceSchedules(searchQuery, 6);
        setSearchResults(results);
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const snapshot = overview?.snapshot ?? {};
  const summaryMetrics = overview?.summaryMetrics;
  const forecast = overview?.forecast;
  const anomalies = overview?.anomalies;
  const stats = useMemo(() => {
    return [
      {
        label: "Total Vehicles",
        value: formatValue(snapshot.totalVehicles),
        hint: `Active Fleet Rate: ${summaryMetrics?.activeFleetRate ?? 0}%`,
        icon: Car,
      },
      {
        label: "Total Maintenance Cost",
        value: snapshot.totalMaintenanceCost !== undefined ? `₱${Number(snapshot.totalMaintenanceCost).toLocaleString()}` : "—",
        hint: `Avg/Vehicle: ₱${summaryMetrics?.avgCostPerVehicle ?? 0}`,
        icon: ShieldCheck,
      },
      {
        label: "Overdue Schedules",
        value: formatValue(snapshot.overdueSchedules),
        hint: `Overdue Rate: ${summaryMetrics?.overdueRate ?? 0}%`,
        icon: AlertTriangle,
      },
      {
        label: "Completion Rate",
        value: snapshot.completionRate !== undefined ? `${snapshot.completionRate}%` : "—",
        hint: `Due in 7 days: ${forecast?.dueIn7Days ?? snapshot.dueWithin7Days ?? 0}`,
        icon: TrendingUp,
      },
    ];
  }, [snapshot, summaryMetrics, forecast]);

  const filteredVehicles = useMemo(() => {
    let list = vehicles?.vehicles ?? [];
    if (vehicleRiskFilter !== "ALL") {
      list = list.filter((v) => String(v.riskLevel).toUpperCase() === vehicleRiskFilter);
    }
    if (vehicleSearch.trim()) {
      const q = vehicleSearch.toLowerCase();
      list = list.filter(
        (v) =>
          String(v.plateNumber ?? "").toLowerCase().includes(q) ||
          String(v.vehicleModel ?? "").toLowerCase().includes(q) ||
          String(v.riskReason ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [vehicles, vehicleRiskFilter, vehicleSearch]);

  const filteredAlerts = useMemo(() => {
    let list = alerts?.alerts ?? [];
    if (alertSeverityFilter !== "ALL") {
      list = list.filter((a) => String(a.severity).toUpperCase() === alertSeverityFilter);
    }
    return list;
  }, [alerts, alertSeverityFilter]);

  const printCleanAnalyticsReport = (isPdfOnly: boolean) => {
    if (!fullReport) {
      alert("No analytics report data available to export or print.");
      return;
    }
    const printWin = window.open("", "_blank");
    if (!printWin) {
      alert("Please allow pop-ups to export or print the report.");
      return;
    }

    const generatedDate = fullReport.dataSource?.generatedAt
      ? formatDate(fullReport.dataSource.generatedAt)
      : formatDate(new Date().toISOString());

    const schedulesRows = (fullReport.schedules ?? [])
      .map(
        (s) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${formatWorkOrderNumber(String(s.scheduleId))}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${s.vehiclePlate || "—"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${s.maintenanceTitle || "—"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${s.assignedMechanic || "Unassigned"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${s.scheduleStatus || "PENDING"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${formatDate(s.nextDueDate)}</td>
      </tr>
    `,
      )
      .join("");

    const vehiclesRows = (fullReport.vehicles ?? [])
      .map(
        (v) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${v.plateNumber}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${v.vehicleModel || "Commercial Truck"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${v.riskLevel === "HIGH" ? "#dc2626" : v.riskLevel === "MEDIUM" ? "#d97706" : "#16a34a"}">${v.riskLevel} (${v.riskScore}/100)</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${v.riskReason || "Normal"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${(v.currentOdometer || 0).toLocaleString()} KM</td>
      </tr>
    `,
      )
      .join("");

    const alertsRows = (fullReport.alerts ?? [])
      .map(
        (a) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: ${a.severity === "HIGH" ? "#dc2626" : "#d97706"}">${a.severity}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${a.maintenanceTitle}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${a.vehiclePlate}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${a.message}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${a.recommendedAction || "Inspect vehicle"}</td>
      </tr>
    `,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Aggregated Fleet Analytics Report ${isPdfOnly ? "(PDF Export)" : "(Print Summary)"}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #0f172a; background: #ffffff; line-height: 1.5; }
    h1 { font-size: 20px; text-transform: uppercase; color: #1a1f6e; margin-bottom: 4px; border-bottom: 2px solid #1a1f6e; padding-bottom: 8px; }
    .subtitle { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; }
    .card-title { font-weight: bold; color: #1a1f6e; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 24px; font-size: 11px; }
    th { background: #1a1f6e; color: #ffffff; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 600; }
    h2 { font-size: 14px; text-transform: uppercase; color: #1a1f6e; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Vehicle Maintenance Management System</h1>
  <div class="subtitle">Aggregated Fleet Analytics & Diagnostic Report • Generated: ${generatedDate}</div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Report Metadata</div>
      <div>Data Source: <strong>${fullReport.dataSource?.type ?? "DUCKDB_DATAMART"}</strong></div>
      <div>Generated Date: ${generatedDate}</div>
      <div>Total Tracked Vehicles: <strong>${fullReport.vehicles?.length ?? 0}</strong></div>
      <div>Total Active Alerts: <strong>${fullReport.alerts?.length ?? 0}</strong></div>
      <div>Total Maintenance Schedules: <strong>${fullReport.schedules?.length ?? 0}</strong></div>
    </div>
    <div class="card">
      <div class="card-title">Fleet Snapshot Summary</div>
      <div>Total Fleet Vehicles: <strong>${fullReport.snapshot?.totalVehicles ?? 0}</strong></div>
      <div>Total Fleet Schedules: <strong>${fullReport.snapshot?.totalSchedules ?? 0}</strong></div>
      <div>Fleet Completion Rate: <strong>${fullReport.snapshot?.completionRate ?? 0}%</strong></div>
      <div>Fleet Maintenance Spend: <strong>$${(fullReport.snapshot?.totalMaintenanceCost ?? 0).toLocaleString()}</strong></div>
    </div>
  </div>

  <h2>Scheduled Maintenance Jobs Overview (${(fullReport.schedules ?? []).length})</h2>
  <table>
    <thead>
      <tr>
        <th>Work Order No.</th>
        <th>Plate Number</th>
        <th>Maintenance Title</th>
        <th>Mechanic</th>
        <th>Status</th>
        <th>Next Due</th>
      </tr>
    </thead>
    <tbody>
      ${schedulesRows || '<tr><td colspan="6" style="padding:12px;text-align:center;">No schedules available</td></tr>'}
    </tbody>
  </table>

  <h2>Vehicle Risk Assessment Matrix (${(fullReport.vehicles ?? []).length})</h2>
  <table>
    <thead>
      <tr>
        <th>Plate Number</th>
        <th>Vehicle Model</th>
        <th>Risk Level & Score</th>
        <th>Primary Risk Reason</th>
        <th>Current Odometer</th>
      </tr>
    </thead>
    <tbody>
      ${vehiclesRows || '<tr><td colspan="5" style="padding:12px;text-align:center;">No vehicle risk data available</td></tr>'}
    </tbody>
  </table>

  <h2>Active Fleet Diagnostic Alerts (${(fullReport.alerts ?? []).length})</h2>
  <table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Alert Title</th>
        <th>Plate</th>
        <th>Diagnostic Details</th>
        <th>Recommended Action</th>
      </tr>
    </thead>
    <tbody>
      ${alertsRows || '<tr><td colspan="5" style="padding:12px;text-align:center;">No active alerts</td></tr>'}
    </tbody>
  </table>

  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          icon={BrainCircuit}
          title="AI / ANALYTICS & FLEET INTELLIGENCE"
          subtitle="Real-time operational analytics, predictive maintenance forecasts, risk assessment, and DuckDB search"
        />

        {/* Manual Analytics Generation / Re-Generation Button */}
        {(hasGenerated || loading || error) && (
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleManualGenerate} disabled={loading}>
              <Sparkles className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Generating..." : "Re-Generate Analytics"}</span>
            </Button>
          </div>
        )}
      </div>

      {error && !loading ? (
        <Card className="p-10 text-center flex flex-col items-center justify-center space-y-4 my-8 border border-rose-500/30 bg-rose-500/5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm">
            <AlertTriangle size={36} />
          </div>
          <div className="max-w-xl space-y-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Analytics Generation Failed</h2>
            <p className="text-xs text-rose-500 font-medium leading-relaxed">
              {error}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Please check your backend service connections and try re-generating.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleManualGenerate}
            disabled={loading}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 text-sm font-semibold shadow-md"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Re-Generate Analytics</span>
          </Button>
        </Card>
      ) : !hasGenerated && !loading ? (
        <Card className="p-10 text-center flex flex-col items-center justify-center space-y-4 my-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/20 shadow-sm">
            <BrainCircuit size={36} />
          </div>
          <div className="max-w-xl space-y-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Fleet AI & Predictive Analytics</h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Click below to run real-time operational analytics, generate vehicle risk matrix scoring, process maintenance alerts, and aggregate datamart reports on demand.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleManualGenerate}
            disabled={loading}
            className="mt-4 flex items-center gap-2 px-6 py-2.5 text-sm font-semibold shadow-md"
          >
            <Sparkles className="h-4 w-4" />
            <span>Generate AI Analytics</span>
          </Button>
        </Card>
      ) : !hasGenerated && loading ? (
        <Card className="p-16 text-center flex flex-col items-center justify-center space-y-4 my-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/20 shadow-sm">
            <Sparkles className="h-8 w-8 animate-spin" />
          </div>
          <div className="max-w-xl space-y-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Generating AI Analytics...</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Fetching datamart reports, scoring vehicle risks, and processing fleet intelligence metrics.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                  : "bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Layers className="h-4 w-4" />
              Overview & Intelligence
            </button>
            <button
              onClick={() => setActiveTab("vehicles")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "vehicles"
                  ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                  : "bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Car className="h-4 w-4" />
              Vehicle Risk Matrix ({vehicles?.vehicles?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("alerts")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "alerts"
                  ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                  : "bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <AlertOctagon className="h-4 w-4" />
              Priority Alerts ({alerts?.alerts?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "report"
                  ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                  : "bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <FileText className="h-4 w-4" />
              Full Report & Export
            </button>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-center gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />
                <span>Generating analytics data...</span>
              </div>
            </Card>
          ) : null}

      {/* OVERVIEW & INTELLIGENCE TAB */}
      {!loading && activeTab === "overview" && (
        <div className="space-y-6">
          {/* AI Operational Report — full-width premium card */}
          <Card className="overflow-hidden border border-[var(--color-border)] p-0 shadow-sm">
            {/* Card header bar */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-card-bg)] to-[var(--color-input-bg)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">AI Operational Report</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">Automated fleet intelligence analysis.</p>
                </div>
              </div>
              <button
                onClick={() => void handleRefreshInsights()}
                disabled={refreshingInsights}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshingInsights ? "animate-spin" : ""}`} />
                {refreshingInsights ? "Generating…" : "Refresh"}
              </button>
            </div>

            {/* Report body */}
            <div className="px-6 py-5">
              {refreshingInsights ? (
                <div className="flex items-center gap-3 py-6 text-sm text-[var(--color-text-secondary)]">
                  <RefreshCw className="h-4 w-4 animate-spin text-[var(--color-brand-primary)]" />
                  Generating new AI analysis from fleet data…
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-[var(--color-text-secondary)]">
                  {renderAiSummary(typeof aiInsights === "string" ? aiInsights : aiInsights?.aiSummary)}
                </div>
              )}
            </div>
          </Card>

          {/* DuckDB Schedule Search — standalone card */}
          <Card className="border border-[var(--color-border)] p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                  <Search className="h-4 w-4 text-[var(--color-brand-primary)]" />
                  Schedule Search
                </h3>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Search maintenance schedules by title, vehicle plate, mechanic, or status.</p>
              </div>
              <div className="relative w-full max-w-sm flex-shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Try 'brake', 'oil', or plate number…"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-10 pr-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((res) => (
                  <div
                    key={res.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)]/50 p-3 text-xs transition-colors hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-input-bg)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold leading-snug text-[var(--color-text-primary)]">{res.title}</span>
                      <span className="shrink-0 rounded-md bg-[var(--color-brand-primary)]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-brand-primary)]">
                        {res.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-[var(--color-text-secondary)]">
                      <div className="flex items-center gap-1">
                        <Car className="h-3 w-3 shrink-0" />
                        {res.vehicleId}
                      </div>
                      <div className="flex items-center gap-1">
                        <Wrench className="h-3 w-3 shrink-0" />
                        {res.assignedMechanic ?? "Unassigned"}
                      </div>
                      {res.date && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          Due: {formatDate(res.date)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <p className="mt-4 text-xs text-[var(--color-text-secondary)]">No schedules found matching that query.</p>
            )}
          </Card>

          {/* Metric Tiles */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <MetricTile key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} icon={stat.icon} />
            ))}
          </div>

          {/* Predictive Forecast & Anomalies Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Predictive Forecast Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Predictive Maintenance Forecast
                </h3>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600">Upcoming Workload</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Projected maintenance due windows based on cycle intervals.</p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4">
                  <p className="text-2xl font-bold text-rose-500">{forecast?.dueIn7Days ?? 0}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">Next 7 Days</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4">
                  <p className="text-2xl font-bold text-amber-500">{forecast?.dueIn30Days ?? 0}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">Next 30 Days</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4">
                  <p className="text-2xl font-bold text-[var(--color-brand-primary)]">{forecast?.dueIn90Days ?? 0}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">Next 90 Days</p>
                </div>
              </div>
            </Card>

            {/* Anomalies Panel */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  Detected Fleet Anomalies
                </h3>
                <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-600">Data Integrity</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Automated detection of repeated vehicle component failures and missing due dates.</p>

              <div className="mt-4 space-y-2.5">
                {(anomalies?.repeatedFailures?.length ?? 0) === 0 && (anomalies?.missingDates?.length ?? 0) === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)]">No anomalies detected in current cycle.</p>
                ) : (
                  <>
                    {(anomalies?.repeatedFailures ?? []).slice(0, 2).map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                        <div>
                          <p className="font-semibold text-amber-600">Repeated Failure: {r.vehiclePlate}</p>
                          <p className="text-[var(--color-text-secondary)]">{r.incidentCount} instances of "{r.maintenanceTitle}"</p>
                        </div>
                        <Badge variant="warning">{r.incidentCount}x</Badge>
                      </div>
                    ))}
                    {(anomalies?.missingDates ?? []).slice(0, 2).map((m, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs">
                        <div>
                          <p className="font-semibold text-rose-600">Missing Next Due Date: {m.vehiclePlate}</p>
                          <p className="text-[var(--color-text-secondary)]">{formatWorkOrderNumber(String(m.scheduleId))} ({m.maintenanceTitle})</p>
                        </div>
                        <Badge variant="danger">Date Missing</Badge>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Monthly Maintenance Cycles</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">Comparison between scheduled work and completed maintenance cycles.</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-[var(--color-brand-primary)]"><span className="h-2 w-2 rounded-full bg-[var(--color-brand-primary)]" /> Scheduled</span>
                  <span className="flex items-center gap-1 text-emerald-500"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed</span>
                </div>
              </div>
              <TrendBars
                items={(overview?.monthlyTrend ?? []).map((item) => ({
                  monthKey: String(item.monthKey ?? "Unknown"),
                  scheduledCount: Number(item.scheduledCount ?? 0),
                  completedCount: Number(item.completedCount ?? 0),
                  activeCount: Number(item.activeCount ?? 0),
                  overdueCount: Number(item.overdueCount ?? 0),
                }))}
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Maintenance Status Distribution</h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Breakdown of current schedule statuses in DuckDB analytics mart.</p>
              <div className="mt-5">
                <StatusBars
                  items={(overview?.statusBreakdown ?? []).map((item) => ({
                    status: String(item.status ?? "Unknown"),
                    percentage: Number(item.percentage ?? item.scheduleCount ?? 0),
                    scheduleCount: Number(item.scheduleCount ?? 0),
                  }))}
                />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* VEHICLE RISK MATRIX TAB */}
      {!loading && activeTab === "vehicles" && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Vehicle Maintenance KPI & Risk Assessment Matrix</h3>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Dynamic risk scoring (0-100) based on overdue workloads, schedule gaps, and completion history.</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                  <input
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    placeholder="Search plate or model..."
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2 pl-9 pr-3 text-xs text-[var(--color-text-primary)] focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-1 text-xs font-medium">
                  <button
                    onClick={() => setVehicleRiskFilter("ALL")}
                    className={`rounded-lg px-2.5 py-1 ${vehicleRiskFilter === "ALL" ? "bg-[var(--color-brand-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVehicleRiskFilter("HIGH")}
                    className={`rounded-lg px-2.5 py-1 ${vehicleRiskFilter === "HIGH" ? "bg-rose-500 text-white" : "text-[var(--color-text-secondary)]"}`}
                  >
                    High Risk
                  </button>
                  <button
                    onClick={() => setVehicleRiskFilter("MEDIUM")}
                    className={`rounded-lg px-2.5 py-1 ${vehicleRiskFilter === "MEDIUM" ? "bg-amber-500 text-white" : "text-[var(--color-text-secondary)]"}`}
                  >
                    Medium Risk
                  </button>
                  <button
                    onClick={() => setVehicleRiskFilter("LOW")}
                    className={`rounded-lg px-2.5 py-1 ${vehicleRiskFilter === "LOW" ? "bg-emerald-500 text-white" : "text-[var(--color-text-secondary)]"}`}
                  >
                    Low Risk
                  </button>
                </div>
              </div>
            </div>

            {/* Vehicle Grid */}
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredVehicles.map((v) => {
                const riskLevel = String(v.riskLevel).toUpperCase();
                let borderClass = "border-[var(--color-border)]";
                let badgeVariant: "danger" | "warning" | "success" = "success";
                if (riskLevel === "HIGH") {
                  borderClass = "border-rose-500/40 bg-rose-500/5";
                  badgeVariant = "danger";
                } else if (riskLevel === "MEDIUM") {
                  borderClass = "border-amber-500/40 bg-amber-500/5";
                  badgeVariant = "warning";
                }

                return (
                  <div key={String(v.vehicleId ?? v.plateNumber)} className={`rounded-xl border p-4 shadow-sm transition-all ${borderClass}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-[var(--color-text-primary)]">{v.plateNumber}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{v.vehicleModel ?? "Standard Vehicle"}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={badgeVariant}>{riskLevel} RISK</Badge>
                        <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">Score: {v.riskScore ?? 0}/100</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-card-bg)] p-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      <span className="font-semibold text-[var(--color-text-primary)]">Reason: </span>
                      {v.riskReason ?? "No immediate maintenance risk recorded."}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-[var(--color-input-bg)] p-2">
                        <span className="text-[var(--color-text-secondary)]">Active Work:</span>
                        <p className="font-semibold text-[var(--color-text-primary)]">{formatValue(v.activeSchedules)}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--color-input-bg)] p-2">
                        <span className="text-[var(--color-text-secondary)]">Overdue:</span>
                        <p className="font-semibold text-rose-500">{formatValue(v.overdueSchedules)}</p>
                      </div>
                      <div className="rounded-lg bg-[var(--color-input-bg)] p-2">
                        <span className="text-[var(--color-text-secondary)]">Completion Rate:</span>
                        <p className="font-semibold text-[var(--color-brand-primary)]">{formatValue(v.completionRate)}%</p>
                      </div>
                      <div className="rounded-lg bg-[var(--color-input-bg)] p-2">
                        <span className="text-[var(--color-text-secondary)]">Next Due:</span>
                        <p className="font-semibold text-[var(--color-text-primary)]">{formatDate(v.nextDueDate)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredVehicles.length === 0 && (
              <p className="mt-6 text-center text-xs text-[var(--color-text-secondary)]">No vehicles found matching the filter criteria.</p>
            )}
          </Card>
        </div>
      )}

      {/* PRIORITY ALERTS TAB */}
      {!loading && activeTab === "alerts" && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Priority Maintenance Alerts</h3>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Actionable alerts generated automatically by the analytics datamart engine.</p>
              </div>

              {/* Severity Filter Pills */}
              <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-1 text-xs font-medium">
                <button
                  onClick={() => setAlertSeverityFilter("ALL")}
                  className={`rounded-lg px-3 py-1 ${alertSeverityFilter === "ALL" ? "bg-[var(--color-brand-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}
                >
                  All ({alerts?.alerts?.length ?? 0})
                </button>
                <button
                  onClick={() => setAlertSeverityFilter("HIGH")}
                  className={`rounded-lg px-3 py-1 ${alertSeverityFilter === "HIGH" ? "bg-rose-500 text-white" : "text-[var(--color-text-secondary)]"}`}
                >
                  High
                </button>
                <button
                  onClick={() => setAlertSeverityFilter("MEDIUM")}
                  className={`rounded-lg px-3 py-1 ${alertSeverityFilter === "MEDIUM" ? "bg-amber-500 text-white" : "text-[var(--color-text-secondary)]"}`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setAlertSeverityFilter("LOW")}
                  className={`rounded-lg px-3 py-1 ${alertSeverityFilter === "LOW" ? "bg-emerald-500 text-white" : "text-[var(--color-text-secondary)]"}`}
                >
                  Low
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {filteredAlerts.map((alert) => {
                const severity = String(alert.severity).toUpperCase();
                let badgeVariant: "danger" | "warning" | "success" = "success";
                if (severity === "HIGH") badgeVariant = "danger";
                if (severity === "MEDIUM") badgeVariant = "warning";

                return (
                  <div key={String(alert.alertId)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--color-text-primary)]">{alert.maintenanceTitle}</span>
                          <Badge variant={badgeVariant}>{severity}</Badge>
                          {alert.alertType && (
                            <span className="rounded bg-[var(--color-input-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                              {alert.alertType}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{alert.message}</p>
                      </div>

                      <div className="text-right text-xs text-[var(--color-text-secondary)]">
                        <p className="font-semibold text-[var(--color-text-primary)]">Plate: {alert.vehiclePlate}</p>
                        {alert.dueDate && <p className="mt-1">Due Date: {formatDate(alert.dueDate)}</p>}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--color-input-bg)] p-3 text-xs">
                      <span className="text-[var(--color-text-secondary)]">
                        <strong className="text-[var(--color-brand-primary)]">Recommended Action: </strong>
                        {alert.recommendedAction ?? "Inspect vehicle and update maintenance work order."}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredAlerts.length === 0 && (
                <p className="py-6 text-center text-xs text-[var(--color-text-secondary)]">No alerts matching selected severity filter.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* FULL REPORT & EXPORT TAB */}
      {!loading && activeTab === "report" && (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Full Aggregated Analytics Report</h3>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Complete datamart dump including snapshots, vehicles, alerts, monthly trends, and schedule summaries.</p>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" onClick={() => printCleanAnalyticsReport(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
                <Button variant="primary" size="sm" onClick={() => printCleanAnalyticsReport(false)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Print Summary
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 text-xs space-y-2">
                <p className="font-bold text-[var(--color-text-primary)]">Report Metadata</p>
                <p>Data Source Type: {fullReport?.dataSource?.type ?? "DUCKDB_DATAMART"}</p>
                <p>Generated At: {formatDate(fullReport?.dataSource?.generatedAt)}</p>
                <p>Total Tracked Vehicles: {fullReport?.vehicles?.length ?? 0}</p>
                <p>Total Active Alerts: {fullReport?.alerts?.length ?? 0}</p>
                <p>Total Maintenance Schedules: {fullReport?.schedules?.length ?? 0}</p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 text-xs space-y-2">
                <p className="font-bold text-[var(--color-text-primary)]">Fleet Snapshot Summary</p>
                <p>Total Fleet Vehicles: {formatValue(fullReport?.snapshot?.totalVehicles)}</p>
                <p>Total Fleet Schedules: {formatValue(fullReport?.snapshot?.totalSchedules)}</p>
                <p>Fleet Completion Rate: {formatValue(fullReport?.snapshot?.completionRate)}%</p>
                <p>Fleet Total Maintenance Spend: ${formatValue(fullReport?.snapshot?.totalMaintenanceCost)}</p>
              </div>
            </div>

            {/* Schedule Summary Table */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Scheduled Maintenance Jobs Overview</h4>
              <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-input-bg)] font-semibold text-[var(--color-text-primary)]">
                    <tr>
                      <th className="p-3">Work Order No.</th>
                      <th className="p-3">Plate</th>
                      <th className="p-3">Maintenance Title</th>
                      <th className="p-3">Mechanic</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Next Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {(fullReport?.schedules ?? []).slice(0, 10).map((s) => (
                      <tr key={String(s.scheduleId)} className="hover:bg-[var(--color-input-bg)]/40">
                        <td className="p-3 font-mono font-semibold">{formatWorkOrderNumber(String(s.scheduleId))}</td>
                        <td className="p-3 font-semibold">{s.vehiclePlate}</td>
                        <td className="p-3">{s.maintenanceTitle}</td>
                        <td className="p-3">{s.assignedMechanic ?? "Unassigned"}</td>
                        <td className="p-3">
                          <Badge variant={s.scheduleStatus === "COMPLETED" ? "success" : s.scheduleStatus === "OVERDUE" ? "danger" : "warning"}>
                            {s.scheduleStatus ?? "PENDING"}
                          </Badge>
                        </td>
                        <td className="p-3">{formatDate(s.nextDueDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      )}
        </>
      )}
    </div>
  );
}
