import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  PhilippinePeso,
  PieChart,
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
  StatusBadge,
  TableToolbar,
  getStatusTone,
} from "../../components/ui";
import { getVmmsDashboardData, type VmmsDashboardData } from "../../lib/api/dashboardService";
import { exportRowsToCsv, exportRowsToExcel, printRowsAsPdf } from "../../lib/utils/frontendExport";
import {
  isInTimeFilterRange,
  timeFilterOptions,
  type TimeFilterValue,
} from "../../lib/utils/timeFilters";
import { MaintenanceStatus, maintenanceStatusLabels, type MaintenanceTask } from "../../types/maintenance";

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
    <div className="enterprise-kpi-card">
      <div className="relative ml-2 flex items-start justify-between gap-4">
        <div>
          <p className="enterprise-kpi-label">{label}</p>
          <p className="enterprise-kpi-value">{value}</p>
        </div>
        <div className="enterprise-icon-box" style={{ backgroundColor: `${color}14`, color }}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
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

export default function MaintenanceReports() {
  const [data, setData] = useState<VmmsDashboardData>({ schedules: [], vehicles: [], garages: [] });
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

  useEffect(() => {
    getVmmsDashboardData()
      .then(setData)
      .catch((error) => console.error("Failed to load maintenance reports", error))
      .finally(() => setLoading(false));
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
    const estimatedFuelExpense = Math.round(data.vehicles.length * 3250);
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
      estimatedFuelExpense,
      downtimeVehicles,
      fleetPerformance,
      statusBreakdown,
      downtimeTrend,
    };
  }, [data.vehicles.length, filteredReportSchedules]);

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
    "Work Order",
    "Vehicle",
    "Status",
    "Schedule Date",
    "Mechanic",
    "Cost",
  ];
  const reportExportRows = filteredReportSchedules.map((task) => {
    const vehicle = vehicleById.get(task.vehicleId);
    return [
      task.title,
      vehicle?.plateNumber ?? vehicle?.value ?? task.vehicleId,
      maintenanceStatusLabels[task.status],
      task.startReferenceDate || task.date || "Not scheduled",
      task.assignedDriver || "Unassigned",
      getTaskCost(task),
    ];
  });
  const exportDate = new Date().toISOString().slice(0, 10);
  const exportReportsCsv = () =>
    exportRowsToCsv(
      `maintenance-reports-${exportDate}.csv`,
      reportExportHeaders,
      reportExportRows,
    );
  const exportReportsExcel = () =>
    exportRowsToExcel(
      `maintenance-reports-${exportDate}.xls`,
      reportExportHeaders,
      reportExportRows,
    );
  const exportReportsPdf = () =>
    printRowsAsPdf("Maintenance Reports", reportExportHeaders, reportExportRows);

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
              onChange={(value) => {
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Upcoming Maintenance" value={report.upcoming.length} icon={CalendarClock} color="#7c3aed" />
        <Metric label="Completed Services" value={report.completed.length} icon={CheckCircle2} color="#059669" />
        <Metric label="Fuel + Maintenance" value={formatCurrency(report.estimatedFuelExpense + report.maintenanceExpense)} icon={PhilippinePeso} color="#0f766e" />
        <Metric label="Vehicle Downtime" value={report.downtimeVehicles} icon={TimerReset} color="#dc2626" />
        <Metric label="Fleet Performance" value={`${report.fleetPerformance}%`} icon={Truck} color="#2563eb" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Due Within 7 Days" value={report.upcomingThisWeek.length} icon={CalendarClock} color="#2563eb" />
        <Metric label="Active Maintenance Load" value={`${report.active.length} work orders`} icon={TimerReset} color="#0f766e" />
        <Metric label="Estimated Fuel Expense" value={formatCurrency(report.estimatedFuelExpense)} icon={PhilippinePeso} color="#d97706" />
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
              color: getStatusTone(maintenanceStatusLabels[item.status]),
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
                onChange={(value) => {
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
                      onChange={(value) => {
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
                      onChange={(value) => {
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
                render: (task) => <StatusBadge status={maintenanceStatusLabels[task.status]} />,
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
    </div>
  );
}
