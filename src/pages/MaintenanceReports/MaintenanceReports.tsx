import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  PhilippinePeso,
  PieChart,
  RefreshCw,
  TimerReset,
  Truck,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  DataTable,
  DropdownSelect,
  ExportButton,
  FilterDropdown,
  Pagination,
  SearchInput,
  SortSelect,
  MaintenanceStatusBadge,
  TableToolbar,
} from "../../components/ui";
import FleetWideFuelReport from "../FuelManagement/components/FleetWideFuelReport";
import FuelCostSummary from "../FuelManagement/components/FuelCostSummary";
import { getVmmsDashboardData, type VmmsDashboardData } from "../../lib/api/dashboardService";
import {
  getFuelAnomalies,
  getFuelReport,
  recordFuelReportExport,
  type FuelAnomalyRecord,
  type FuelReport,
} from "../../lib/api/fuelService";
import { getScheduledFleetReports, type ScheduledFleetReport } from "../../lib/api/scheduledReportsService";
import { exportRowsToCsv, exportRowsToExcel, printRowsAsPdf } from "../../lib/utils/frontendExport";
import { excludeVoidedFuelFillUps } from "../FuelManagement/fuelReportData";
import {
  isInTimeFilterRange,
  timeFilterOptions,
  type TimeFilterValue,
} from "../../lib/utils/timeFilters";
import { MaintenanceStatus, maintenanceStatusLabels, type MaintenanceTask } from "../../types/maintenance";
import { maintenanceStatusColors } from "../../lib/utils/maintenanceStatusPresentation";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

const parseMoney = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const taskDate = (task: MaintenanceTask) => new Date(task.startReferenceDate || task.date || 0);

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
};

type UpcomingSort =
  | "date-desc"
  | "date-asc"
  | "vehicle-asc"
  | "vehicle-desc"
  | "status-asc"
  | "status-desc";

const getTaskCost = (task: MaintenanceTask) => {
  const progress = task.workOrderProgress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return 0;
  const execution = (progress as { execution?: unknown }).execution;
  if (!execution || typeof execution !== "object" || Array.isArray(execution)) return 0;
  const items = (execution as { items?: unknown }).items;
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return total;
    return total + parseMoney((item as { partsCost?: unknown }).partsCost);
  }, 0);
};

function Metric({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof BarChart3;
  color: string;
}) {
  return (
    <div className="flex h-full min-h-32 min-w-0 items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase leading-5 tracking-wide text-[var(--color-text-secondary)]">{label}</p>
        <p className="mt-2 break-words text-2xl font-bold leading-tight tabular-nums text-[var(--color-text-primary)]">{value}</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14`, color }} aria-hidden="true">
        <Icon size={22} strokeWidth={2.2} />
      </div>
    </div>
  );
}

function StatusDonut({ rows }: { rows: { label: string; count: number; color: string }[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  let offset = 0;
  const gradient = total
    ? rows
        .map((row) => {
          const start = offset;
          const end = offset + (row.count / total) * 100;
          offset = end;
          return `${row.color} ${start}% ${end}%`;
        })
        .join(", ")
    : "#e2e8f0 0% 100%";

  return (
    <div className="grid gap-5 p-5 md:grid-cols-[12rem_1fr] md:items-center">
      <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-3xl font-extrabold text-slate-950">{total}</span>
          <span className="text-xs font-bold uppercase text-slate-500">Orders</span>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
              {row.label}
            </span>
            <span className="font-bold text-slate-950">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactLineChart({ rows }: { rows: { label: string; value: number }[] }) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? 260 : (index / (rows.length - 1)) * 520;
    const y = 160 - (row.value / maxValue) * 120;
    return { ...row, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg viewBox="0 0 520 210" className="h-52 w-full" role="img" aria-label="Vehicle downtime trend">
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      <polyline points={linePoints} fill="none" stroke="#dc2626" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="5" fill="#ffffff" stroke="#dc2626" strokeWidth="3" />
          <text x={point.x} y="200" textAnchor="middle" className="fill-slate-500 text-[20px] font-bold">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

type FuelReportTab = "fleet-wide" | "per-vehicle" | "anomaly-log";

export default function MaintenanceReports() {
  const [data, setData] = useState<VmmsDashboardData>({ schedules: [], vehicles: [], garages: [] });
  const [fuelEntries, setFuelEntries] = useState<FuelReport["entries"]>([]);
  const [fuelAnomalies, setFuelAnomalies] = useState<FuelAnomalyRecord[]>([]);
  const [fuelReportTab, setFuelReportTab] = useState<FuelReportTab>("fleet-wide");
  const [loading, setLoading] = useState(true);
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [upcomingSort, setUpcomingSort] = useState<UpcomingSort>("date-desc");
  const [upcomingFilterOpen, setUpcomingFilterOpen] = useState(false);
  const [upcomingStatusFilters, setUpcomingStatusFilters] = useState<string[]>([]);
  const [upcomingVehicleFilter, setUpcomingVehicleFilter] = useState("All");
  const [upcomingMechanicFilter, setUpcomingMechanicFilter] = useState("All");
  const [upcomingDateFrom, setUpcomingDateFrom] = useState("");
  const [upcomingDateTo, setUpcomingDateTo] = useState("");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingPageSize, setUpcomingPageSize] = useState(8);
  const [timeFilter, setTimeFilter] = useState<TimeFilterValue>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [scheduledReports, setScheduledReports] = useState<ScheduledFleetReport[]>([]);
  const [scheduledReportsLoading, setScheduledReportsLoading] = useState(true);
  const [scheduledReportsError, setScheduledReportsError] = useState<string | null>(null);
  const [scheduledReportsReload, setScheduledReportsReload] = useState(0);
  const [scheduledReportsVisibleCount, setScheduledReportsVisibleCount] = useState(10);

  useEffect(() => {
    getVmmsDashboardData()
      .then(setData)
      .catch((error) => console.error("Failed to load maintenance reports", error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    // Refresh the loading and error state for each explicit scheduled-report reload.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScheduledReportsLoading(true);
    setScheduledReportsError(null);
    getScheduledFleetReports()
      .then((reports) => { if (active) setScheduledReports(reports); })
      .catch((error) => {
        if (active) setScheduledReportsError(error instanceof Error ? error.message : "Unable to load scheduled reports.");
      })
      .finally(() => { if (active) setScheduledReportsLoading(false); });
    return () => { active = false; };
  }, [scheduledReportsReload]);

  useEffect(() => {
    let active = true;
    getFuelReport()
      .then((result) => { if (active) setFuelEntries(result.entries); })
      .catch((error) => console.error("Failed to load fuel report totals", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getFuelAnomalies()
      .then((rows) => { if (active) setFuelAnomalies(rows); })
      .catch((error) => console.error("Failed to load fuel anomalies", error));
    return () => { active = false; };
  }, []);

  const vehicleById = useMemo(
    () =>
      new Map(
        data.vehicles.flatMap((vehicle) => [
          ...(vehicle.id ? [[vehicle.id, vehicle] as const] : []),
          [vehicle.value, vehicle] as const,
          ...(vehicle.plateNumber ? [[vehicle.plateNumber, vehicle] as const] : []),
        ]),
      ),
    [data.vehicles],
  );

  const filteredReportSchedules = useMemo(
    () =>
      data.schedules
        .filter((task) =>
          isInTimeFilterRange(taskDate(task), timeFilter, customDateFrom, customDateTo),
        )
        .sort((left, right) => taskDate(right).getTime() - taskDate(left).getTime()),
    [customDateFrom, customDateTo, data.schedules, timeFilter],
  );

  const report = useMemo(() => {
    const now = new Date();
    const upcomingStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.PENDING,
      MaintenanceStatus.DUE,
      MaintenanceStatus.OVERDUE,
    ];
    const activeStatuses: MaintenanceStatus[] = [
      MaintenanceStatus.DUE,
      MaintenanceStatus.IN_PROGRESS,
      MaintenanceStatus.OVERDUE,
    ];
    const upcoming = filteredReportSchedules
      .filter((task) => upcomingStatuses.includes(task.status))
      .sort((left, right) => taskDate(left).getTime() - taskDate(right).getTime());
    const completed = filteredReportSchedules.filter((task) => task.status === MaintenanceStatus.COMPLETED);
    const active = filteredReportSchedules.filter((task) => activeStatuses.includes(task.status));
    const maintenanceExpense = filteredReportSchedules.reduce((total, task) => total + getTaskCost(task), 0);
    const fuelExpense = fuelEntries
      .filter((entry) => isInTimeFilterRange(new Date(`${entry.date}T00:00:00`), timeFilter, customDateFrom, customDateTo))
      .reduce((total, entry) => total + entry.totalCost, 0);
    const downtimeVehicles = new Set(active.map((task) => task.vehicleId)).size;
    const fleetPerformance = data.vehicles.length
      ? Math.round(((data.vehicles.length - downtimeVehicles) / data.vehicles.length) * 100)
      : 0;
    const maxStatusCount = Math.max(
      ...Object.values(MaintenanceStatus).map(
        (status) => filteredReportSchedules.filter((task) => task.status === status).length,
      ),
      1,
    );
    const statusBreakdown = Object.values(MaintenanceStatus).map((status) => ({
      status,
      count: filteredReportSchedules.filter((task) => task.status === status).length,
      width: (filteredReportSchedules.filter((task) => task.status === status).length / maxStatusCount) * 100,
    }));
    const downtimeTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      const key = formatMonthKey(date);
      const activeForMonth = active.filter((task) => {
        const due = taskDate(task);
        return !Number.isNaN(due.getTime()) && formatMonthKey(due) === key;
      }).length;
      return {
        label: formatMonthLabel(key),
        value: activeForMonth * 8,
      };
    });
    const upcomingThisWeek = upcoming.filter((task) => {
      const due = taskDate(task);
      return !Number.isNaN(due.getTime()) && due.getTime() >= now.getTime() && due.getTime() <= now.getTime() + 7 * 86400000;
    });

    return {
      upcoming,
      upcomingThisWeek,
      completed,
      active,
      maintenanceExpense,
      fuelExpense,
      downtimeVehicles,
      fleetPerformance,
      statusBreakdown,
      downtimeTrend,
    };
  }, [data.vehicles.length, filteredReportSchedules, fuelEntries, timeFilter, customDateFrom, customDateTo]);

  const filteredUpcoming = useMemo(() => {
    const query = upcomingSearch.trim().toLowerCase();
    const rows = report.upcoming.filter((task) => {
      const vehicle = vehicleById.get(task.vehicleId);
      const displayVehicle = vehicle?.plateNumber ?? vehicle?.value ?? task.vehicleId;
      const date = task.startReferenceDate || task.date || "";
      const matchesSearch =
        !query ||
        displayVehicle.toLowerCase().includes(query) ||
        task.title.toLowerCase().includes(query) ||
        (task.assignedDriver || "").toLowerCase().includes(query);
      const matchesStatus =
        upcomingStatusFilters.length === 0 ||
        upcomingStatusFilters.includes(maintenanceStatusLabels[task.status]);
      const matchesVehicle =
        upcomingVehicleFilter === "All" || displayVehicle === upcomingVehicleFilter;
      const matchesMechanic =
        upcomingMechanicFilter === "All" ||
        (task.assignedDriver || "Unassigned") === upcomingMechanicFilter;
      const matchesDateFrom = !upcomingDateFrom || date >= upcomingDateFrom;
      const matchesDateTo = !upcomingDateTo || date <= upcomingDateTo;

      return matchesSearch && matchesStatus && matchesVehicle && matchesMechanic && matchesDateFrom && matchesDateTo;
    });

    return rows.sort((left, right) => {
      if (upcomingSort === "date-asc") return taskDate(left).getTime() - taskDate(right).getTime();
      if (upcomingSort === "vehicle-asc" || upcomingSort === "vehicle-desc") {
        const leftVehicle = vehicleById.get(left.vehicleId)?.plateNumber ?? left.vehicleId;
        const rightVehicle = vehicleById.get(right.vehicleId)?.plateNumber ?? right.vehicleId;
        return leftVehicle.localeCompare(rightVehicle) * (upcomingSort === "vehicle-asc" ? 1 : -1);
      }
      if (upcomingSort === "status-asc" || upcomingSort === "status-desc") {
        return maintenanceStatusLabels[left.status].localeCompare(maintenanceStatusLabels[right.status]) *
          (upcomingSort === "status-asc" ? 1 : -1);
      }
      return taskDate(right).getTime() - taskDate(left).getTime();
    });
  }, [report.upcoming, upcomingDateFrom, upcomingDateTo, upcomingMechanicFilter, upcomingSearch, upcomingSort, upcomingStatusFilters, upcomingVehicleFilter, vehicleById]);

  const upcomingVehicleOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          report.upcoming.map((task) => {
            const vehicle = vehicleById.get(task.vehicleId);
            return vehicle?.plateNumber ?? vehicle?.value ?? task.vehicleId;
          }),
        ),
      ).sort(),
    ],
    [report.upcoming, vehicleById],
  );
  const upcomingMechanicOptions = useMemo(
    () => ["All", ...Array.from(new Set(report.upcoming.map((task) => task.assignedDriver || "Unassigned"))).sort()],
    [report.upcoming],
  );

  const upcomingTotalPages = Math.max(1, Math.ceil(filteredUpcoming.length / upcomingPageSize));
  const paginatedUpcoming = filteredUpcoming.slice(
    (upcomingPage - 1) * upcomingPageSize,
    upcomingPage * upcomingPageSize,
  );

  const reportExportHeaders = [
    "Record Type",
    "Work Order",
    "Vehicle",
    "Status",
    "Schedule Date",
    "Mechanic",
    "Maintenance Cost",
    "Fuel Cost",
    "Liters",
    "Average Efficiency (km/L)",
    "Fuel Anomalies",
  ];
  const maintenanceExportRows = filteredReportSchedules.map((task) => {
    const vehicle = vehicleById.get(task.vehicleId);
    return [
      "Maintenance",
      task.title,
      vehicle?.plateNumber ?? vehicle?.value ?? task.vehicleId,
      maintenanceStatusLabels[task.status],
      task.startReferenceDate || task.date || "Not scheduled",
      task.assignedDriver || "Unassigned",
      getTaskCost(task),
      "", "", "", "",
    ];
  });
  const filteredFuelForExport = fuelEntries.filter((entry) => isInTimeFilterRange(new Date(`${entry.date}T00:00:00`), timeFilter, customDateFrom, customDateTo));
  const fuelExportRows = [...new Set(filteredFuelForExport.map((entry) => entry.vehicleId))].map((vehicleId) => {
    const rows = filteredFuelForExport.filter((entry) => entry.vehicleId === vehicleId);
    const efficiencies = rows.map((entry) => entry.efficiency).filter((value): value is number => value != null);
    return ["Fuel", "", rows[0].vehicleName, "", "", "", "", rows.reduce((sum, entry) => sum + entry.totalCost, 0), rows.reduce((sum, entry) => sum + entry.liters, 0), efficiencies.length ? (efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length).toFixed(1) : "Insufficient Data", rows.filter((entry) => entry.anomaly).length];
  });
  const reportExportRows = [...maintenanceExportRows, ...fuelExportRows];
  const exportDate = new Date().toISOString().slice(0, 10);
  const auditFuelExport = (format: string) => { void recordFuelReportExport(format, customDateFrom || undefined, customDateTo || undefined).catch((error) => console.error("Failed to audit report export", error)); };
  const exportReportsCsv = () =>
    (auditFuelExport("csv"), exportRowsToCsv(
      `maintenance-reports-${exportDate}.csv`,
      reportExportHeaders,
      reportExportRows,
    ));
  const exportReportsExcel = () =>
    (auditFuelExport("excel"), exportRowsToExcel(
      `maintenance-reports-${exportDate}.xls`,
      reportExportHeaders,
      reportExportRows,
    ));
  const exportReportsPdf = () =>
    (auditFuelExport("pdf"), printRowsAsPdf("Maintenance Reports", reportExportHeaders, reportExportRows));

  const filteredFuelFillUps = useMemo(
    () =>
      excludeVoidedFuelFillUps(
        fuelEntries.filter((entry) =>
          isInTimeFilterRange(new Date(`${entry.date}T00:00:00`), timeFilter, customDateFrom, customDateTo),
        ),
      ),
    [customDateFrom, customDateTo, fuelEntries, timeFilter],
  );

  const fuelReportPeriodLabel =
    timeFilter === "custom"
      ? `${customDateFrom || "..."} - ${customDateTo || "..."}`
      : timeFilterOptions.find((option) => option.value === timeFilter)?.label ?? "All Time";

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        icon={BarChart3}
        title="MAINTENANCE REPORTS"
        subtitle="Reports on upcoming maintenance, completed services, total fuel and maintenance expenses, downtime, and fleet performance"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SortSelect
              label="Time-Based Filters"
              value={timeFilter}
              onChange={(value: string) => {
                setTimeFilter(value as TimeFilterValue);
                setUpcomingPage(1);
              }}
              options={timeFilterOptions}
              className="w-44"
            />
            {timeFilter === "custom" ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Maintenance report custom date from"
                  value={customDateFrom}
                  onChange={(event) => {
                    setCustomDateFrom(event.target.value);
                    setUpcomingPage(1);
                  }}
                  className="h-10 rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-semibold text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                />
                <input
                  type="date"
                  aria-label="Maintenance report custom date to"
                  value={customDateTo}
                  onChange={(event) => {
                    setCustomDateTo(event.target.value);
                    setUpcomingPage(1);
                  }}
                  className="h-10 rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-semibold text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                />
              </div>
            ) : null}
            <ExportButton
              open={isExportMenuOpen}
              onToggle={(event) => {
                event.stopPropagation();
                setIsExportMenuOpen((current) => !current);
              }}
              onPdf={() => {
                setIsExportMenuOpen(false);
                exportReportsPdf();
              }}
              onCsv={() => {
                setIsExportMenuOpen(false);
                exportReportsCsv();
              }}
              onExcel={() => {
                setIsExportMenuOpen(false);
                exportReportsExcel();
              }}
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <Metric label="Upcoming Maintenance" value={report.upcoming.length} icon={CalendarClock} color="#7c3aed" />
        <Metric label="Completed Services" value={report.completed.length} icon={CheckCircle2} color="#059669" />
        <Metric label="Fuel + Maintenance" value={formatCurrency(report.fuelExpense + report.maintenanceExpense)} icon={PhilippinePeso} color="#0f766e" />
        <Metric label="Vehicle Downtime" value={report.downtimeVehicles} icon={TimerReset} color="#dc2626" />
        <Metric label="Fleet Performance" value={`${report.fleetPerformance}%`} icon={Truck} color="#2563eb" />
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]" aria-labelledby="scheduled-report-history-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-divider)] px-5 py-4">
          <div>
            <h2 id="scheduled-report-history-title" className="text-base font-bold text-[var(--color-text-primary)]">Scheduled report history</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Daily operations and monthly cost snapshots, generated at 7:00 AM Manila time.</p>
          </div>
          <button
            type="button"
            onClick={() => setScheduledReportsReload((value) => value + 1)}
            disabled={scheduledReportsLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)] disabled:opacity-50"
          >
            <RefreshCw size={15} className={scheduledReportsLoading ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className="space-y-3 p-5">
          {scheduledReportsLoading ? <p role="status" className="text-sm text-[var(--color-text-secondary)]">Loading scheduled reports...</p> : null}
          {scheduledReportsError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{scheduledReportsError}</p> : null}
          {!scheduledReportsLoading && !scheduledReportsError && scheduledReports.length === 0 ? (
                  <p className="py-4 text-sm text-[var(--color-text-secondary)]">No scheduled reports have been generated yet. New snapshots will appear here after the next scheduled run.</p>
          ) : null}
          {scheduledReports.slice(0, scheduledReportsVisibleCount).map((scheduledReport) => {
            const isDaily = scheduledReport.reportType === "daily-operations";
            const data = scheduledReport.data;
            return (
              <article key={scheduledReport.id} className="border-t border-[var(--color-divider)] py-4 first:border-t-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)]">{isDaily ? "Daily fleet operations" : "Monthly fleet costs"}</h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Period {scheduledReport.periodKey} | Generated {new Date(scheduledReport.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Scheduled</span>
                </div>
                {isDaily ? (
                  <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div><dt className="text-xs text-[var(--color-text-secondary)]">Overdue work orders</dt><dd className="mt-1 text-xl font-bold text-red-700">{Number(data.overdueWorkOrders ?? 0)}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-secondary)]">Vehicles under maintenance</dt><dd className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{Number(data.vehiclesUnderMaintenance ?? 0)}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-secondary)]">Open fuel anomalies</dt><dd className="mt-1 text-xl font-bold text-amber-700">{Number(data.openFuelAnomalies ?? 0)}</dd></div>
                  </dl>
                ) : (
                  <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div><dt className="text-xs text-[var(--color-text-secondary)]">Maintenance parts</dt><dd className="mt-1 font-bold">{formatCurrency(parseMoney(data.maintenancePartsCost))}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-secondary)]">Maintenance labor</dt><dd className="mt-1 font-bold">{formatCurrency(parseMoney(data.maintenanceLaborCost))}</dd></div>
                    <div><dt className="text-xs text-[var(--color-text-secondary)]">Fuel</dt><dd className="mt-1 font-bold">{formatCurrency(parseMoney(data.fuelTotalCost))}</dd></div>
                    <div className="md:col-span-2 xl:col-span-3"><p className="text-sm font-bold text-[var(--color-text-primary)]">Total maintenance: {formatCurrency(parseMoney(data.maintenanceTotalCost))}</p></div>
                  </dl>
                )}
              </article>
            );
          })}
          {scheduledReports.length > 10 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-divider)] pt-3">
              <p className="text-sm text-[var(--color-text-secondary)]">Showing {Math.min(scheduledReportsVisibleCount, scheduledReports.length)} of {scheduledReports.length} saved reports.</p>
              <div className="flex gap-2">
                {scheduledReportsVisibleCount > 10 ? (
                  <button type="button" onClick={() => setScheduledReportsVisibleCount(10)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)]">Show latest 10</button>
                ) : null}
                {scheduledReportsVisibleCount < scheduledReports.length ? (
                  <button type="button" onClick={() => setScheduledReportsVisibleCount((count) => Math.min(count + 10, scheduledReports.length))} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)]">Show 10 more</button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Due Within 7 Days" value={report.upcomingThisWeek.length} icon={CalendarClock} color="#2563eb" />
        <Metric label="Active Maintenance Load" value={`${report.active.length} work orders`} icon={TimerReset} color="#0f766e" />
        <Metric label="Fuel Expense" value={formatCurrency(report.fuelExpense)} icon={PhilippinePeso} color="#d97706" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
          <div className="border-b border-[var(--color-divider)] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">Work Order Status Summary</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Pending, in-progress, overdue, completed, and cancelled work</p>
              </div>
              <PieChart className="h-5 w-5 text-[#1a1f6e]" />
            </div>
          </div>
          <StatusDonut
            rows={report.statusBreakdown.map((item) => ({
              label: maintenanceStatusLabels[item.status],
              count: item.count,
              color: maintenanceStatusColors[item.status],
            }))}
          />
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
          <div className="border-b border-[var(--color-divider)] px-5 py-4">
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Vehicle Downtime Trend</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Estimated downtime hours from active work orders</p>
          </div>
          <div className="p-5">
            <CompactLineChart rows={report.downtimeTrend} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
        <div className="border-b border-[var(--color-divider)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Upcoming Maintenance</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Prioritized maintenance schedule</p>
        </div>
        <div className="px-5 pb-5 pt-4">
          <TableToolbar
            search={
              <SearchInput
                value={upcomingSearch}
                onChange={(event) => {
                  setUpcomingSearch(event.target.value);
                  setUpcomingPage(1);
                }}
                placeholder="Search vehicle, task, or mechanic..."
              />
            }
            sort={
              <SortSelect
                className="w-full sm:w-60"
                value={upcomingSort}
                onChange={(value: string) => {
                  setUpcomingSort(value as UpcomingSort);
                  setUpcomingPage(1);
                }}
                options={[
                  { value: "date-desc", label: "Date - Newest" },
                  { value: "date-asc", label: "Date - Oldest" },
                  { value: "vehicle-asc", label: "Vehicle - A to Z" },
                  { value: "vehicle-desc", label: "Vehicle - Z to A" },
                  { value: "status-asc", label: "Status - A to Z" },
                  { value: "status-desc", label: "Status - Z to A" },
                ]}
              />
            }
            actions={
              <FilterDropdown
                open={upcomingFilterOpen}
                onToggle={() => setUpcomingFilterOpen((current) => !current)}
                statuses={["Pending", "Due", "Overdue", "In Progress", "Completed", "Cancelled"]}
                selectedStatuses={upcomingStatusFilters}
                onStatusChange={(statuses) => {
                  setUpcomingStatusFilters(statuses);
                  setUpcomingPage(1);
                }}
                dateFrom={upcomingDateFrom}
                dateTo={upcomingDateTo}
                onDateFromChange={(value) => {
                  setUpcomingDateFrom(value);
                  setUpcomingPage(1);
                }}
                onDateToChange={(value) => {
                  setUpcomingDateTo(value);
                  setUpcomingPage(1);
                }}
                onApply={() => setUpcomingFilterOpen(false)}
                onClear={() => {
                  setUpcomingStatusFilters([]);
                  setUpcomingVehicleFilter("All");
                  setUpcomingMechanicFilter("All");
                  setUpcomingDateFrom("");
                  setUpcomingDateTo("");
                  setUpcomingPage(1);
                  setUpcomingFilterOpen(false);
                }}
                legendTitle="Upcoming Maintenance Legend"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Vehicle</span>
                    <DropdownSelect
                      className="mt-2"
                      value={upcomingVehicleFilter}
                      onChange={(value: string) => {
                        setUpcomingVehicleFilter(value);
                        setUpcomingPage(1);
                      }}
                      label="Vehicle"
                      options={upcomingVehicleOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All vehicles" : option,
                      }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Mechanic</span>
                    <DropdownSelect
                      className="mt-2"
                      value={upcomingMechanicFilter}
                      onChange={(value: string) => {
                        setUpcomingMechanicFilter(value);
                        setUpcomingPage(1);
                      }}
                      label="Mechanic"
                      options={upcomingMechanicOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All mechanics" : option,
                      }))}
                    />
                  </label>
                </div>
              </FilterDropdown>
            }
          />
          <DataTable
            data={paginatedUpcoming}
            getRowKey={(task) => task.id}
            minWidth="760px"
            emptyMessage={loading ? "Loading upcoming maintenance..." : "No upcoming maintenance found."}
            columns={[
              {
                key: "vehicle",
                header: "Vehicle",
                width: "18%",
                render: (task) => {
                  const vehicle = vehicleById.get(task.vehicleId);
                  return <span className="font-semibold">{vehicle?.plateNumber ?? vehicle?.value ?? task.vehicleId}</span>;
                },
              },
              { key: "service", header: "Service", width: "28%", render: (task) => task.title },
              {
                key: "status",
                header: "Status",
                width: "18%",
                render: (task) => <MaintenanceStatusBadge status={task.status} />,
              },
              {
                key: "date",
                header: "Date",
                width: "18%",
                render: (task) => task.startReferenceDate || task.date || "Not scheduled",
              },
              {
                key: "mechanic",
                header: "Mechanic",
                width: "18%",
                render: (task) => task.assignedDriver || "Unassigned",
              },
            ]}
          />
          <Pagination
            page={Math.min(upcomingPage, upcomingTotalPages)}
            totalPages={upcomingTotalPages}
            totalItems={filteredUpcoming.length}
            pageSize={upcomingPageSize}
            onPageChange={setUpcomingPage}
            onPageSizeChange={(pageSize) => {
              setUpcomingPageSize(pageSize);
              setUpcomingPage(1);
            }}
          />
        </div>
      </section>

      <section className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5" aria-labelledby="fuel-reports-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="fuel-reports-title" className="text-2xl font-bold text-[var(--color-text-primary)]">Fuel Reports</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Fuel cost and anomaly reporting for the selected period: {fuelReportPeriodLabel}.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-1" role="group" aria-label="Fuel reports">
            <button
              type="button"
              aria-pressed={fuelReportTab === "fleet-wide"}
              onClick={() => setFuelReportTab("fleet-wide")}
              className={`${fuelReportTab === "fleet-wide" ? "bg-[var(--color-brand-primary)] text-white" : "text-[var(--color-text-secondary)]"} whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium`}
            >
              Fleet-Wide Cost
            </button>
            <button
              type="button"
              aria-pressed={fuelReportTab === "per-vehicle"}
              onClick={() => setFuelReportTab("per-vehicle")}
              className={`${fuelReportTab === "per-vehicle" ? "bg-[var(--color-brand-primary)] text-white" : "text-[var(--color-text-secondary)]"} whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium`}
            >
              Per-Vehicle Summary
            </button>
            <button
              type="button"
              aria-pressed={fuelReportTab === "anomaly-log"}
              onClick={() => setFuelReportTab("anomaly-log")}
              className={`${fuelReportTab === "anomaly-log" ? "bg-[var(--color-brand-primary)] text-white" : "text-[var(--color-text-secondary)]"} whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium`}
            >
              Anomaly Logs
            </button>
          </div>
        </div>

        <div className="min-h-[15.625rem] pt-2">
          {fuelReportTab === "fleet-wide" && (
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Active View - Fleet-Wide Fuel Cost Report</div>
              <FleetWideFuelReport
                fillUps={filteredFuelFillUps}
                onExport={(format) => {
                  void recordFuelReportExport(format, customDateFrom || undefined, customDateTo || undefined).catch((error) =>
                    console.error("Failed to record fuel report export", error),
                  );
                }}
              />
            </div>
          )}

          {fuelReportTab === "per-vehicle" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Active View - Fuel Cost Summary - Per Vehicle</div>
                <div className="rounded bg-[var(--color-card-bg-hover)] px-2 py-0.5 font-mono text-xs text-[var(--color-text-secondary)]">
                  {fuelReportPeriodLabel}
                </div>
              </div>
              <FuelCostSummary
                fillUps={filteredFuelFillUps}
                onExport={(format) => {
                  void recordFuelReportExport(format, customDateFrom || undefined, customDateTo || undefined).catch((error) =>
                    console.error("Failed to record fuel report export", error),
                  );
                }}
              />
            </div>
          )}

          {fuelReportTab === "anomaly-log" && (
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Active View - Anomaly Detection Log</div>
              <div className="space-y-2">
                {fuelAnomalies.length ? (
                  fuelAnomalies.map((item) => (
                    <div key={item.id} className="rounded border border-[var(--color-border)] p-3 text-sm">
                      {item.vehicle.plateNumber} - {item.severity} - {item.status} - {item.note || "No note"}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)]">No anomaly history.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
