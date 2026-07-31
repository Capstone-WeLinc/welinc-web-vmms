import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  PhilippinePeso,
  PieChart,
  ReceiptText,
  TrendingUp,
  Truck,
  Wrench,
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
  StatusBadge,
  TableToolbar,
} from "../../components/ui";
import { getVmmsDashboardData, type VmmsDashboardData } from "../../lib/api/dashboardService";
import { exportRowsToCsv, exportRowsToExcel, printRowsAsPdf } from "../../lib/utils/frontendExport";
import {
  isInTimeFilterRange,
  timeFilterOptions,
  type TimeFilterValue,
} from "../../lib/utils/timeFilters";
import { AccountType, MaintenanceStatus, maintenanceStatusLabels, type MaintenanceTask } from "../../types/maintenance";

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

const getMaintenanceCost = (task: MaintenanceTask) => {
  const progress = task.workOrderProgress;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return 0;

  const execution = (progress as { execution?: unknown }).execution;
  if (!execution || typeof execution !== "object" || Array.isArray(execution)) return 0;

  const items = (execution as { items?: unknown }).items;
  if (!Array.isArray(items)) return 0;

  return items.reduce((total, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return total;
    const itemCost = parseMoney((item as { partsCost?: unknown; cost?: unknown }).partsCost) ||
      parseMoney((item as { partsCost?: unknown; cost?: unknown }).cost);
    return total + itemCost;
  }, 0);
};

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  });
};

const chartColors = ["#1a1f6e", "#0f766e", "#dc2626", "#f59e0b", "#7c3aed", "#2563eb"];

type ChartSlice = {
  label: string;
  value: number;
  color: string;
};
type ExpenseSort =
  | "date-desc"
  | "date-asc"
  | "cost-desc"
  | "cost-asc"
  | "vehicle-asc"
  | "vehicle-desc"
  | "status-asc"
  | "status-desc";

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm font-medium text-slate-500">
      {message}
    </div>
  );
}

function MiniAreaChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 300 : (index / (data.length - 1)) * 600;
    const y = 180 - (item.value / maxValue) * 150;
    return { ...item, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `0,190 ${linePoints} 600,190`;

  if (data.every((item) => item.value === 0)) {
    return <EmptyChart message="No monthly cost trend available yet." />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
      <svg viewBox="0 0 600 230" className="h-56 w-full" role="img" aria-label="Monthly maintenance cost trend">
        <defs>
          <linearGradient id="maintenanceTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1a1f6e" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#1a1f6e" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[30, 80, 130, 180].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        <polygon points={areaPoints} fill="url(#maintenanceTrendFill)" />
        <polyline points={linePoints} fill="none" stroke="#1a1f6e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#ffffff" stroke="#1a1f6e" strokeWidth="3" />
            <text x={point.x} y="218" textAnchor="middle" className="fill-slate-500 text-[22px] font-bold">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function DonutChart({ slices, centerLabel }: { slices: ChartSlice[]; centerLabel: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;
  const gradient = total
    ? slices
        .map((slice) => {
          const start = offset;
          const end = offset + (slice.value / total) * 100;
          offset = end;
          return `${slice.color} ${start}% ${end}%`;
        })
        .join(", ")
    : "#e2e8f0 0% 100%";

  return (
    <div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-[11rem_1fr] sm:items-center">
      <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white text-center">
          <span className="text-xs font-bold uppercase text-slate-500">Total</span>
          <span className="text-lg font-extrabold text-slate-950">{centerLabel}</span>
        </div>
      </div>
      <div className="space-y-3">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
              {slice.label}
            </span>
            <span className="font-bold text-slate-950">{formatCurrency(slice.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({
  rows,
  emptyMessage,
}: {
  rows: { label: string; helper?: string; value: number; tone?: string }[];
  emptyMessage: string;
}) {
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  if (rows.length === 0) {
    return <EmptyChart message={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">{row.label}</span>
              {row.helper ? <p className="text-xs text-[var(--color-text-secondary)]">{row.helper}</p> : null}
            </div>
            <span className="font-bold text-[var(--color-text-primary)]">{formatCurrency(row.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(row.value / maxValue) * 100}%`, backgroundColor: row.tone ?? "#1a1f6e" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseCategoryBarChart({
  rows,
}: {
  rows: { label: string; total: number; count: number }[];
}) {
  const maxValue = Math.max(...rows.map((row) => row.total), 1);

  if (rows.length === 0) {
    return <EmptyChart message="No expense categories available." />;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.label} className="grid gap-2 md:grid-cols-[13rem_1fr_7rem] md:items-center">
            <div>
              <p className="text-sm font-bold text-slate-950">{row.label}</p>
              <p className="text-xs text-slate-500">{row.count} work order{row.count === 1 ? "" : "s"}</p>
            </div>
            <div className="h-8 overflow-hidden rounded-lg bg-slate-100">
              <div
                className="flex h-full items-center justify-end rounded-lg px-3 text-xs font-bold text-white"
                style={{
                  width: `${Math.max((row.total / maxValue) * 100, row.total > 0 ? 7 : 0)}%`,
                  backgroundColor: chartColors[index % chartColors.length],
                }}
              >
                {row.total > 0 ? `${Math.round((row.total / maxValue) * 100)}%` : ""}
              </div>
            </div>
            <p className="text-right text-sm font-bold text-slate-950">{formatCurrency(row.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  helper,
}: {
  label: string;
  value: string | number;
  icon: typeof BarChart3;
  tone: string;
  helper?: string;
}) {
  return (
    <div className="enterprise-kpi-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="enterprise-kpi-label">{label}</p>
          <p className="enterprise-kpi-value">{value}</p>
          {helper ? (
            <p className="mt-2 text-xs font-medium text-slate-500">{helper}</p>
          ) : null}
        </div>
        <div className="enterprise-icon-box" style={{ backgroundColor: `${tone}14`, color: tone }}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

export default function MaintenanceExpenses() {
  const [data, setData] = useState<VmmsDashboardData>({ schedules: [], vehicles: [], garages: [] });
  const [loading, setLoading] = useState(true);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilterValue>("all");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerSort, setLedgerSort] = useState<ExpenseSort>("date-desc");
  const [ledgerFilterOpen, setLedgerFilterOpen] = useState(false);
  const [ledgerStatusFilters, setLedgerStatusFilters] = useState<string[]>([]);
  const [ledgerVehicleFilter, setLedgerVehicleFilter] = useState("All");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("All");
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(8);

  useEffect(() => {
    getVmmsDashboardData()
      .then(setData)
      .catch((error) => console.error("Failed to load maintenance expenses", error))
      .finally(() => setLoading(false));
  }, []);

  const vehicleById = useMemo(
    () =>
      new Map(
        data.vehicles.flatMap((vehicle) => [
          ...(vehicle.id ? [[vehicle.id, vehicle] as const] : []),
          [vehicle.value, vehicle] as const,
        ]),
      ),
    [data.vehicles],
  );

  const expenseRows = useMemo(() => {
    return data.schedules.map((task) => {
      const vehicle = vehicleById.get(task.vehicleId);
      const cost = getMaintenanceCost(task);
      return {
        id: task.id,
        vehicleId: task.vehicleId,
        vehicle: vehicle?.label ?? task.vehicleId,
        plate: vehicle?.plateNumber ?? vehicle?.value ?? task.vehicleId,
        workOrder: task.id,
        type: task.title,
        status: task.status,
        date: task.startReferenceDate || task.date,
        cost,
      };
    });
  }, [data.schedules, vehicleById]);

  const periodExpenseRows = useMemo(
    () =>
      expenseRows.filter((row) =>
        isInTimeFilterRange(new Date(row.date || 0), timeFilter, customDateFrom, customDateTo),
      ),
    [customDateFrom, customDateTo, expenseRows, timeFilter],
  );

  const expensesByVehicle = useMemo(() => {
    const rows = [...periodExpenseRows];
    const totals = rows.reduce<Record<string, { vehicle: string; plate: string; total: number; count: number }>>(
      (acc, row) => {
        acc[row.vehicleId] ??= { vehicle: row.vehicle, plate: row.plate, total: 0, count: 0 };
        acc[row.vehicleId].total += row.cost;
        acc[row.vehicleId].count += 1;
        return acc;
      },
      {},
    );

    return {
      rows: rows.sort((left, right) => right.cost - left.cost),
      totals: Object.values(totals).sort((left, right) => right.total - left.total),
    };
  }, [periodExpenseRows]);

  const totalCost = expensesByVehicle.rows.reduce((total, row) => total + row.cost, 0);
  const completedCost = expensesByVehicle.rows
    .filter((row) => row.status === MaintenanceStatus.COMPLETED)
    .reduce((total, row) => total + row.cost, 0);
  const averagePerVehicle = data.vehicles.length ? totalCost / data.vehicles.length : 0;
  const highestCostVehicle = expensesByVehicle.totals[0];
  const flaggedVehicles = expensesByVehicle.totals.filter(
    (row) => row.total > averagePerVehicle && row.total > 0,
  );
  const categoryTotals = Object.values(
    expensesByVehicle.rows.reduce<Record<string, { label: string; total: number; count: number }>>(
      (acc, row) => {
        acc[row.type] ??= { label: row.type, total: 0, count: 0 };
        acc[row.type].total += row.cost;
        acc[row.type].count += 1;
        return acc;
      },
      {},
    ),
  ).sort((left, right) => right.total - left.total);
  const statusTotals = Object.values(MaintenanceStatus)
    .map((status) => ({
      status,
      label: maintenanceStatusLabels[status],
      total: expensesByVehicle.rows
        .filter((row) => row.status === status)
        .reduce((sum, row) => sum + row.cost, 0),
    }))
    .filter((row) => row.total > 0);
  const totalStatusCost = Math.max(statusTotals.reduce((sum, row) => sum + row.total, 0), 1);
  const topVehicleShare = totalCost && highestCostVehicle
    ? Math.round((highestCostVehicle.total / totalCost) * 100)
    : 0;
  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      return {
        key: formatMonthKey(date),
        label: formatMonthLabel(formatMonthKey(date)),
        value: 0,
      };
    });

    expensesByVehicle.rows.forEach((row) => {
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) return;
      const month = months.find((item) => item.key === formatMonthKey(date));
      if (month) month.value += row.cost;
    });

    return months;
  }, [expensesByVehicle.rows]);
  const expenseBreakdown = useMemo(() => {
    const outsourced = expensesByVehicle.rows
      .filter((row) => {
        const sourceTask = data.schedules.find((task) => task.id === row.id);
        return sourceTask?.accountType === AccountType.OUTSOURCED || Boolean(sourceTask?.outsourcedProvider);
      })
      .reduce((sum, row) => sum + row.cost, 0);
    const inHouseCost = Math.max(totalCost - outsourced, 0);
    const parts = Math.round(inHouseCost * 0.62);
    const labor = Math.round(inHouseCost * 0.24);
    const maintenance = Math.max(totalCost - outsourced - parts - labor, 0);

    return [
      { label: "Parts", value: parts, color: "#1a1f6e" },
      { label: "Labor", value: labor, color: "#0f766e" },
      { label: "Outsourced Service", value: outsourced, color: "#dc2626" },
      { label: "Maintenance", value: maintenance, color: "#f59e0b" },
    ].filter((slice) => slice.value > 0);
  }, [data.schedules, expensesByVehicle.rows, totalCost]);
  const topVehicleRows = expensesByVehicle.totals
    .filter((row) => row.total > 0)
    .slice(0, 5)
    .map((row, index) => ({
      label: row.plate,
      helper: `${row.count} maintenance record${row.count === 1 ? "" : "s"}`,
      value: row.total,
      tone: chartColors[index % chartColors.length],
    }));
  const flaggedVehicleRows = flaggedVehicles.slice(0, 5).map((row) => ({
    label: row.plate,
    helper: `${Math.round((row.total / Math.max(averagePerVehicle, 1)) * 100)}% of fleet average spend`,
    value: row.total,
    tone: "#dc2626",
  }));
  const statusSlices = statusTotals.map((row, index) => ({
    label: row.label,
    value: row.total,
    color: chartColors[index % chartColors.length],
  }));
  const expenseExportHeaders = [
    "Vehicle",
    "Maintenance Type",
    "Status",
    "Date",
    "Cost",
  ];
  const expenseExportRows = expensesByVehicle.rows.map((row) => [
    row.plate,
    row.type,
    maintenanceStatusLabels[row.status],
    row.date || "Not scheduled",
    row.cost,
  ]);
  const exportDate = new Date().toISOString().slice(0, 10);
  const exportExpenseCsv = () =>
    exportRowsToCsv(
      `maintenance-expenses-${exportDate}.csv`,
      expenseExportHeaders,
      expenseExportRows,
    );
  const exportExpenseExcel = () =>
    exportRowsToExcel(
      `maintenance-expenses-${exportDate}.xls`,
      expenseExportHeaders,
      expenseExportRows,
    );
  const exportExpensePdf = () =>
    printRowsAsPdf("Maintenance Expenses", expenseExportHeaders, expenseExportRows);

  const filteredLedgerRows = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();
    const vehicleMatches = (plate: string) =>
      ledgerVehicleFilter === "All" || plate === ledgerVehicleFilter;
    const rows = expensesByVehicle.rows.filter((row) => {
      const date = row.date || "";
      const matchesSearch =
        !query ||
        row.plate.toLowerCase().includes(query) ||
        row.type.toLowerCase().includes(query) ||
        row.vehicle.toLowerCase().includes(query);
      const matchesStatus =
        ledgerStatusFilters.length === 0 ||
        ledgerStatusFilters.includes(maintenanceStatusLabels[row.status]);
      const matchesVehicle = vehicleMatches(row.plate);
      const matchesType = ledgerTypeFilter === "All" || row.type === ledgerTypeFilter;
      const matchesDateFrom = !ledgerDateFrom || date >= ledgerDateFrom;
      const matchesDateTo = !ledgerDateTo || date <= ledgerDateTo;

      return matchesSearch && matchesStatus && matchesVehicle && matchesType && matchesDateFrom && matchesDateTo;
    });

    return rows.sort((left, right) => {
      if (ledgerSort === "date-asc") return (left.date || "").localeCompare(right.date || "");
      if (ledgerSort === "cost-desc") return right.cost - left.cost;
      if (ledgerSort === "cost-asc") return left.cost - right.cost;
      if (ledgerSort === "vehicle-asc" || ledgerSort === "vehicle-desc") {
        return left.plate.localeCompare(right.plate) * (ledgerSort === "vehicle-asc" ? 1 : -1);
      }
      if (ledgerSort === "status-asc" || ledgerSort === "status-desc") {
        return maintenanceStatusLabels[left.status].localeCompare(maintenanceStatusLabels[right.status]) *
          (ledgerSort === "status-asc" ? 1 : -1);
      }
      return (right.date || "").localeCompare(left.date || "");
    });
  }, [expensesByVehicle.rows, ledgerDateFrom, ledgerDateTo, ledgerSearch, ledgerSort, ledgerStatusFilters, ledgerTypeFilter, ledgerVehicleFilter]);

  const ledgerVehicleOptions = useMemo(
    () => ["All", ...Array.from(new Set(expensesByVehicle.rows.map((row) => row.plate).filter(Boolean))).sort()],
    [expensesByVehicle.rows],
  );
  const ledgerTypeOptions = useMemo(
    () => ["All", ...Array.from(new Set(expensesByVehicle.rows.map((row) => row.type).filter(Boolean))).sort()],
    [expensesByVehicle.rows],
  );

  const ledgerTotalPages = Math.max(1, Math.ceil(filteredLedgerRows.length / ledgerPageSize));
  const paginatedLedgerRows = filteredLedgerRows.slice(
    (ledgerPage - 1) * ledgerPageSize,
    ledgerPage * ledgerPageSize,
  );

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        icon={ReceiptText}
        title="MAINTENANCE EXPENSES"
        subtitle="Track maintenance expenses per vehicle to help management review operating costs"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SortSelect
              label="Time-Based Filters"
              value={timeFilter}
              onChange={(value) => {
                setTimeFilter(value as TimeFilterValue);
                setLedgerPage(1);
              }}
              options={timeFilterOptions}
              className="w-44"
            />
            {timeFilter === "custom" ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Maintenance expense custom date from"
                  value={customDateFrom}
                  onChange={(event) => {
                    setCustomDateFrom(event.target.value);
                    setLedgerPage(1);
                  }}
                  className="h-10 rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-semibold text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                />
                <input
                  type="date"
                  aria-label="Maintenance expense custom date to"
                  value={customDateTo}
                  onChange={(event) => {
                    setCustomDateTo(event.target.value);
                    setLedgerPage(1);
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
                exportExpensePdf();
              }}
              onCsv={() => {
                setIsExportMenuOpen(false);
                exportExpenseCsv();
              }}
              onExcel={() => {
                setIsExportMenuOpen(false);
                exportExpenseExcel();
              }}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Fleet Maintenance Spend" value={formatCurrency(totalCost)} icon={PhilippinePeso} tone="#0f766e" helper="Parts and service costs from work orders" />
        <StatCard label="Approved Service Cost" value={formatCurrency(completedCost)} icon={Wrench} tone="#2563eb" helper={`${Math.round((completedCost / Math.max(totalCost, 1)) * 100)}% of recorded spend`} />
        <StatCard label="Vehicles With Costs" value={expensesByVehicle.totals.filter((row) => row.total > 0).length} icon={Truck} tone="#7c3aed" helper={`${data.vehicles.length} total tracked vehicles`} />
        <StatCard label="Flagged Vehicles" value={flaggedVehicles.length} icon={AlertTriangle} tone="#dc2626" helper="Above average maintenance spend" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="enterprise-panel">
          <div className="enterprise-panel-header">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">Maintenance Cost Trend</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Monthly spend movement from maintenance records</p>
              </div>
              <TrendingUp className="h-5 w-5 text-[#1a1f6e]" />
            </div>
          </div>
          <div className="p-5">
            {loading ? <p className="mb-3 text-sm text-[var(--color-text-secondary)]">Loading expense trend...</p> : null}
            <MiniAreaChart data={monthlyTrend} />
          </div>
        </section>

        <section className="enterprise-panel">
          <div className="enterprise-panel-header">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">Expense Breakdown</h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Parts, labor, outsourced service, and maintenance mix</p>
              </div>
              <PieChart className="h-5 w-5 text-[#1a1f6e]" />
            </div>
          </div>
          <div className="p-5">
            {expenseBreakdown.length > 0 ? (
              <DonutChart slices={expenseBreakdown} centerLabel={formatCurrency(totalCost)} />
            ) : (
              <EmptyChart message="No expense breakdown available yet." />
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="enterprise-panel">
        <div className="enterprise-panel-header">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Cost By Vehicle</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Ranked maintenance spend by fleet unit</p>
            </div>
            <TrendingUp className="h-5 w-5 text-[#1a1f6e]" />
          </div>
        </div>
        <div className="space-y-4 p-5">
          {loading ? <p className="text-sm text-[var(--color-text-secondary)]">Loading expenses...</p> : null}
          <HorizontalBars rows={topVehicleRows} emptyMessage="No maintenance expenses found." />
        </div>
      </section>

      <section className="enterprise-panel">
        <div className="enterprise-panel-header">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Expense Insights</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Breakdown and review signals</p>
            </div>
            <PieChart className="h-5 w-5 text-[#1a1f6e]" />
          </div>
        </div>
        <div className="grid gap-4 p-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Top spend concentration</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-950">{topVehicleShare}%</p>
            <p className="mt-1 text-sm text-slate-500">
              {highestCostVehicle ? `${highestCostVehicle.vehicle} carries the highest recorded maintenance cost.` : "No vehicle costs recorded yet."}
            </p>
          </div>

          {statusSlices.length > 0 ? (
            <DonutChart slices={statusSlices} centerLabel={formatCurrency(totalStatusCost)} />
          ) : (
            <EmptyChart message="No status-based expenses available." />
          )}

          {flaggedVehicles.length > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-700">Review Required</p>
              <p className="mt-1 text-sm text-red-600">
                {flaggedVehicles.slice(0, 3).map((vehicle) => vehicle.plate).join(", ")} exceed average maintenance spend.
              </p>
            </div>
          ) : null}
        </div>
      </section>
      </div>

      <section className="enterprise-panel">
        <div className="enterprise-panel-header">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Flagged Vehicles</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Units spending above the current fleet average</p>
            </div>
            <BarChart3 className="h-5 w-5 text-[#dc2626]" />
          </div>
        </div>
        <div className="p-5">
          <HorizontalBars rows={flaggedVehicleRows} emptyMessage="No vehicles are above average spend right now." />
        </div>
      </section>

      <section className="enterprise-panel">
        <div className="enterprise-panel-header">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Expense Breakdown</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Maintenance type distribution for planning and forecasting</p>
        </div>
        <div className="p-5">
          <ExpenseCategoryBarChart rows={categoryTotals} />
        </div>
      </section>

      <section className="enterprise-panel">
        <div className="enterprise-panel-header">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Expense Ledger</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Detailed records for audit and drill-down</p>
        </div>
        <div className="p-5">
          <TableToolbar
            search={
              <SearchInput
                value={ledgerSearch}
                onChange={(event) => {
                  setLedgerSearch(event.target.value);
                  setLedgerPage(1);
                }}
                placeholder="Search vehicle, task, or maintenance..."
              />
            }
            sort={
              <SortSelect
                className="w-full sm:w-60"
                value={ledgerSort}
                onChange={(value) => {
                  setLedgerSort(value as ExpenseSort);
                  setLedgerPage(1);
                }}
                options={[
                  { value: "date-desc", label: "Date - Newest" },
                  { value: "date-asc", label: "Date - Oldest" },
                  { value: "cost-desc", label: "Cost - Highest" },
                  { value: "cost-asc", label: "Cost - Lowest" },
                  { value: "vehicle-asc", label: "Vehicle - A to Z" },
                  { value: "vehicle-desc", label: "Vehicle - Z to A" },
                  { value: "status-asc", label: "Status - A to Z" },
                  { value: "status-desc", label: "Status - Z to A" },
                ]}
              />
            }
            actions={
              <FilterDropdown
                open={ledgerFilterOpen}
                onToggle={() => setLedgerFilterOpen((current) => !current)}
                statuses={["Pending", "Due", "Overdue", "In Progress", "Completed", "Cancelled"]}
                selectedStatuses={ledgerStatusFilters}
                onStatusChange={(statuses) => {
                  setLedgerStatusFilters(statuses);
                  setLedgerPage(1);
                }}
                dateFrom={ledgerDateFrom}
                dateTo={ledgerDateTo}
                onDateFromChange={(value) => {
                  setLedgerDateFrom(value);
                  setLedgerPage(1);
                }}
                onDateToChange={(value) => {
                  setLedgerDateTo(value);
                  setLedgerPage(1);
                }}
                onApply={() => setLedgerFilterOpen(false)}
                onClear={() => {
                  setLedgerStatusFilters([]);
                  setLedgerVehicleFilter("All");
                  setLedgerTypeFilter("All");
                  setLedgerDateFrom("");
                  setLedgerDateTo("");
                  setLedgerPage(1);
                  setLedgerFilterOpen(false);
                }}
                legendTitle="Expense Ledger Legend"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Vehicle</span>
                    <DropdownSelect
                      className="mt-2"
                      value={ledgerVehicleFilter}
                      onChange={(value) => {
                        setLedgerVehicleFilter(value);
                        setLedgerPage(1);
                      }}
                      label="Vehicle"
                      options={ledgerVehicleOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All vehicles" : option,
                      }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Maintenance type</span>
                    <DropdownSelect
                      className="mt-2"
                      value={ledgerTypeFilter}
                      onChange={(value) => {
                        setLedgerTypeFilter(value);
                        setLedgerPage(1);
                      }}
                      label="Maintenance type"
                      options={ledgerTypeOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All types" : option,
                      }))}
                    />
                  </label>
                </div>
              </FilterDropdown>
            }
          />
          <DataTable
            data={paginatedLedgerRows}
            getRowKey={(row) => row.id}
            minWidth="760px"
            emptyMessage={loading ? "Loading expenses..." : "No expenses available."}
            columns={[
              { key: "vehicle", header: "Vehicle", width: "18%", render: (row) => <span className="font-semibold">{row.plate}</span> },
              { key: "type", header: "Maintenance Type", width: "28%", render: (row) => row.type },
              {
                key: "status",
                header: "Status",
                width: "18%",
                render: (row) => <StatusBadge status={maintenanceStatusLabels[row.status]} />,
              },
              { key: "date", header: "Date", width: "18%", render: (row) => row.date || "Not scheduled" },
              { key: "cost", header: "Cost", width: "18%", align: "right", render: (row) => <span className="font-bold">{formatCurrency(row.cost)}</span> },
            ]}
          />
          <Pagination
            page={Math.min(ledgerPage, ledgerTotalPages)}
            totalPages={ledgerTotalPages}
            totalItems={filteredLedgerRows.length}
            pageSize={ledgerPageSize}
            onPageChange={setLedgerPage}
            onPageSizeChange={(pageSize) => {
              setLedgerPageSize(pageSize);
              setLedgerPage(1);
            }}
          />
        </div>
      </section>
    </div>
  );
}
