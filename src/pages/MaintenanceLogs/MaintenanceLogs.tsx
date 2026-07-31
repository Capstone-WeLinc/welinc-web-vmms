import { useEffect, useMemo, useState } from "react";
import { Eye, FileText } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import ViewModal from "./components/ViewModal";
import { getCurrentUser } from "../../lib/api/authService";
import type { UserRecord } from "../../lib/api/authService";
import { getMaintenanceSchedules } from "../../lib/api/maintenanceService";
import type { MaintenanceTask } from "../../lib/api/maintenanceService";
import { getVehicles, type VehicleOption } from "../../lib/api/vehicleService";
import { getGarages } from "../../lib/api/locationService";
import { isMechanicRole } from "../../lib/utils/permissions";
import { exportRowsToCsv, exportRowsToExcel } from "../../lib/utils/frontendExport";
import { formatLogNumber } from "../../lib/utils/workOrders";
import { MaintenanceStatus as MaintenanceStatusEnum } from "../../types/maintenance";
import {
  ActionMenu,
  DataTable,
  DropdownSelect,
  ExportButton,
  FilterDropdown,
  Pagination,
  SearchInput,
  SortSelect,
  TableToolbar,
  ToastNotification,
} from "../../components/ui";

type MaintenanceClass = "Maintenance" | "Repair";
type MaintenanceStatus = "Completed" | "Flagged";
type MaintenanceLogSortField = "date" | "logNumber" | "plateNo" | "class" | "status" | "mechanic";
type SortDirection = "asc" | "desc";

interface MaintenanceLog {
  id: string;
  logNumber: string;
  plateNo: string;
  workOrder: string;
  class: MaintenanceClass;
  date: string;
  garage: string;
  accountType: string;
  triggerType: string;
  intervalKm: string;
  bufferDistanceKm: string;
  startReferenceDate: string;
  odometerReading: number;
  status: MaintenanceStatus;
  mechanic: string;
  checklistCompleted: number;
  checklistTotal: number;
  executionCompleted: number;
  executionTotal: number;
  changedParts: number;
  materialCost: number;
  costBreakdown: Array<{
    item: string;
    partsUsed: string;
    cost: number;
  }>;
  cost: number;
  remarks: string;
  technicianSignature: string;
}

interface ToastState {
  type: "success" | "error" | "warning" | "info";
  message: string;
}

const logStatusOptions: MaintenanceStatus[] = ["Completed", "Flagged"];
const statusOptions = [...logStatusOptions];

const formatCurrency = (value: number) => `₱${value.toLocaleString()}`;
const formatOdometer = (value: number) => `${value.toLocaleString()} km`;

const normalizeStatus = (status?: string): MaintenanceStatus | null => {
  const normalized = status?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === MaintenanceStatusEnum.COMPLETED) return "Completed";
  if (normalized === "FLAGGED") return "Flagged";
  return null;
};

const classifyMaintenance = (status: MaintenanceStatus): MaintenanceClass => {
  return status === "Flagged" ? "Repair" : "Maintenance";
};

const readNumber = (task: MaintenanceTask, keys: string[]) => {
  const source = task as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

const readProgress = (task: MaintenanceTask) => {
  const progress = task.workOrderProgress;
  if (!progress || typeof progress !== "object") return null;
  return progress as {
    checklist?: Array<{ status?: string }>;
    execution?: {
      done?: boolean;
      remarks?: string;
      technicianSignature?: string;
      items?: Array<{
        text?: string;
        status?: string;
        partsUsed?: string;
        partsCost?: string;
      }>;
    };
  };
};

const parseCost = (value?: string) => {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildLogNumber = (task: MaintenanceTask) => {
  return formatLogNumber(task.id);
};

const getVehiclePlateNumber = (
  vehicleId: string | undefined,
  vehicles: VehicleOption[],
) => {
  if (!vehicleId) return "Unassigned";
  const vehicle = vehicles.find(
    (item) =>
      item.id === vehicleId ||
      item.value === vehicleId ||
      item.plateNumber === vehicleId,
  );
  return vehicle?.plateNumber ?? vehicle?.value ?? vehicleId;
};

const mapScheduleToLog = (
  task: MaintenanceTask,
  garageNames: Record<string, string>,
  vehicles: VehicleOption[],
): MaintenanceLog | null => {
  const status = normalizeStatus(task.status);
  if (!status) return null;
  const relatedPlateNumber = (
    task as MaintenanceTask & { vehicle?: { plateNumber?: string } }
  ).vehicle?.plateNumber;
  const progress = readProgress(task);
  const checklist = progress?.checklist ?? [];
  const execution = progress?.execution;
  const executionItems = execution?.items ?? [];
  const materialCost = executionItems.reduce(
    (total, item) => total + parseCost(item.partsCost),
    0,
  );
  const costBreakdown = executionItems
    .filter(
      (item) =>
        item.status === "changed" ||
        Boolean(item.partsUsed?.trim()) ||
        parseCost(item.partsCost) > 0,
    )
    .map((item) => ({
      item: item.text?.trim() || "Checklist item",
      partsUsed: item.partsUsed?.trim() || "Not specified",
      cost: parseCost(item.partsCost),
    }));

  return {
    id: task.id,
    logNumber: buildLogNumber(task),
    plateNo:
      relatedPlateNumber || getVehiclePlateNumber(task.vehicleId, vehicles),
    workOrder: task.title || "Untitled work order",
    class: classifyMaintenance(status),
    date: task.date || "",
    garage: task.garageId ? garageNames[task.garageId] ?? task.garageId : "Unassigned",
    accountType: task.accountType || "N/A",
    triggerType: task.triggerType || "MANUAL",
    intervalKm: task.intervalKm || "N/A",
    bufferDistanceKm: task.bufferDistanceKm || "N/A",
    startReferenceDate: task.startReferenceDate || "N/A",
    odometerReading: readNumber(task, ["odometerReading", "startingReferenceReadingKm"]),
    status,
    mechanic: task.assignedDriver || "Unassigned",
    checklistCompleted: checklist.filter((item) => item.status && item.status !== "pending").length,
    checklistTotal: checklist.length,
    executionCompleted: executionItems.filter((item) => item.status && item.status !== "pending").length,
    executionTotal: executionItems.length,
    changedParts: executionItems.filter((item) => item.status === "changed").length,
    materialCost,
    costBreakdown,
    cost: materialCost || readNumber(task, ["materialCost"]),
    remarks: execution?.remarks || "N/A",
    technicianSignature: execution?.technicianSignature || "N/A",
  };
};

const ClassBadge = ({ value }: { value: MaintenanceClass }) => {
  const classes =
    value === "Repair"
      ? "border-[#b50000] bg-[#ff8f94] text-[#8f1212]"
      : "border-[#313a9f] bg-[#a9b5ff] text-[#111957]";

  return (
    <span className={`inline-flex min-w-[112px] justify-center rounded-full border-2 px-4 py-1 text-xs font-bold uppercase ${classes}`}>
      {value}
    </span>
  );
};

export default function MaintenanceLogs() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<MaintenanceClass[]>([]);
  const [mechanicFilter, setMechanicFilter] = useState("All");
  const [garageFilter, setGarageFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<MaintenanceLogSortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewingLog, setViewingLog] = useState<MaintenanceLog | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const isMechanic = isMechanicRole(currentUser);

  const mechanicOptions = useMemo(
    () => ["All", ...Array.from(new Set(logs.map((log) => log.mechanic).filter(Boolean))).sort()],
    [logs],
  );
  const garageOptions = useMemo(
    () => ["All", ...Array.from(new Set(logs.map((log) => log.garage).filter(Boolean))).sort()],
    [logs],
  );

  const toggleClassFilter = (value: MaintenanceClass) => {
    setSelectedClasses((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
    setCurrentPage(1);
  };

  const showToast = (nextToast: ToastState) => setToast(nextToast);

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([
      getCurrentUser(),
      getMaintenanceSchedules({ includeDeleted: true }),
      getGarages(),
      getVehicles(),
    ])
      .then(([userResult, logsResult, garagesResult, vehiclesResult]) => {
        if (!isMounted) return;

        setCurrentUser(userResult.status === "fulfilled" ? userResult.value : null);
        const garageNames =
          garagesResult.status === "fulfilled"
            ? Object.fromEntries(garagesResult.value.map((garage) => [garage.id, garage.name]))
            : {};
        const vehicles =
          vehiclesResult.status === "fulfilled" ? vehiclesResult.value : [];

        if (logsResult.status === "fulfilled") {
          setLogs(
            logsResult.value
              .map((task) => mapScheduleToLog(task, garageNames, vehicles))
              .filter((log): log is MaintenanceLog => Boolean(log)),
          );
        } else {
          setLogs([]);
          showToast({
            type: "error",
            message: "Unable to load maintenance logs from the backend.",
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const closeMenus = () => {
      setOpenActionMenuId(null);
      setIsExportMenuOpen(false);
      setShowFilters(false);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const normalizeText = (value?: string | null) =>
    value?.trim().toLowerCase() ?? "";

  const isAssignedToCurrentMechanic = (log: MaintenanceLog) => {
    if (!isMechanic || !currentUser) return true;

    const currentNames = [currentUser.name, currentUser.email]
      .map(normalizeText)
      .filter(Boolean);
    const mechanic = normalizeText(log.mechanic);

    return currentNames.some(
      (name) =>
        mechanic === name || mechanic.includes(name) || name.includes(mechanic),
    );
  };

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      if (!isAssignedToCurrentMechanic(log)) return false;

      const matchesSearch =
        !query ||
        log.logNumber.toLowerCase().includes(query) ||
        log.plateNo.toLowerCase().includes(query) ||
        log.workOrder.toLowerCase().includes(query) ||
        log.class.toLowerCase().includes(query) ||
        log.mechanic.toLowerCase().includes(query) ||
        log.garage.toLowerCase().includes(query) ||
        log.accountType.toLowerCase().includes(query);
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(log.status);
      const matchesClass =
        selectedClasses.length === 0 || selectedClasses.includes(log.class);
      const matchesMechanic = mechanicFilter === "All" || log.mechanic === mechanicFilter;
      const matchesGarage = garageFilter === "All" || log.garage === garageFilter;
      const matchesDateFrom = !dateFrom || log.date >= dateFrom;
      const matchesDateTo = !dateTo || log.date <= dateTo;

      return matchesSearch && matchesStatus && matchesClass && matchesMechanic && matchesGarage && matchesDateFrom && matchesDateTo;
    }).sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortField === "date") return left.date.localeCompare(right.date) * direction;
      if (sortField === "logNumber") return left.logNumber.localeCompare(right.logNumber) * direction;
      if (sortField === "plateNo") return left.plateNo.localeCompare(right.plateNo) * direction;
      if (sortField === "class") return left.class.localeCompare(right.class) * direction;
      if (sortField === "status") return left.status.localeCompare(right.status) * direction;
      return left.mechanic.localeCompare(right.mechanic) * direction;
    });
  }, [logs, searchQuery, selectedStatuses, selectedClasses, mechanicFilter, garageFilter, dateFrom, dateTo, currentUser, isMechanic, sortDirection, sortField]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const getExportData = () => {
    const headers = [
      "Log No.",
      "Plate No.",
      "Work Order",
      "Class",
      "Date",
      "Odometer Reading (km)",
      "Status",
      "Mechanic",
      "Garage",
      "Account Type",
      "Trigger",
      "Checklist Progress",
      "Execution Progress",
      "Changed Parts",
      "Material Cost",
      "Cost",
      "Remarks",
      "Technician Signature",
    ];
    const rows = filteredLogs.map((log) => [
      log.logNumber,
      log.plateNo,
      log.workOrder,
      log.class,
      log.date,
      formatOdometer(log.odometerReading),
      log.status,
      log.mechanic,
      log.garage,
      log.accountType,
      log.triggerType,
      `${log.checklistCompleted}/${log.checklistTotal}`,
      `${log.executionCompleted}/${log.executionTotal}`,
      String(log.changedParts),
      formatCurrency(log.materialCost),
      formatCurrency(log.cost),
      log.remarks,
      log.technicianSignature,
    ]);

    return { headers, rows };
  };

  const handleExportCsv = () => {
    const { headers, rows } = getExportData();
    exportRowsToCsv(
      `maintenance-logs-${new Date().toISOString().split("T")[0]}.csv`,
      headers,
      rows,
    );
    showToast({ type: "success", message: "Record exported successfully." });
  };

  const handleExportExcel = () => {
    const { headers, rows } = getExportData();
    exportRowsToExcel(
      `maintenance-logs-${new Date().toISOString().split("T")[0]}.xls`,
      headers,
      rows,
    );
    showToast({ type: "success", message: "Record exported successfully." });
  };

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast({ type: "warning", message: "Please allow pop-ups to export." });
      return;
    }

    const rows = filteredLogs
      .map(
        (log) => `
      <tr>
        <td>${log.logNumber}</td>
        <td>${log.plateNo}</td>
        <td>${log.workOrder}</td>
        <td>${log.class}</td>
        <td>${log.date}</td>
        <td>${formatOdometer(log.odometerReading)}</td>
        <td>${log.status}</td>
        <td>${log.mechanic}</td>
        <td>${log.garage}</td>
        <td>${log.accountType}</td>
        <td>${log.triggerType}</td>
        <td>${log.checklistCompleted}/${log.checklistTotal}</td>
        <td>${log.executionCompleted}/${log.executionTotal}</td>
        <td>${log.changedParts}</td>
        <td>${formatCurrency(log.materialCost)}</td>
        <td>${formatCurrency(log.cost)}</td>
        <td>${log.remarks}</td>
      </tr>
    `,
      )
      .join("");

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Maintenance Logs</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { margin: 0 0 18px; letter-spacing: .04em; }
            table { border-collapse: collapse; width: 100%; }
            th { background: #070b45; color: white; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; }
            td { border-bottom: 1px solid #dde4ef; padding: 10px; }
          </style>
        </head>
        <body>
          <h1>Maintenance Logs</h1>
          <table>
            <thead>
              <tr>
                <th>Log No.</th><th>Plate No.</th><th>Work Order</th><th>Class</th><th>Date</th><th>Odometer Reading (km)</th><th>Status</th><th>Mechanic</th><th>Garage</th><th>Trigger</th><th>Checklist</th><th>Execution</th><th>Cost</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="14">No logs to export</td></tr>'}</tbody>
          </table>
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    showToast({ type: "success", message: "Record exported successfully." });
  };

  return (
    <div className="space-y-6">
      <div className="fixed right-6 top-6 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>

      <PageHeader
        icon={FileText}
        title="MAINTENANCE LOGS"
        subtitle="Search, filter, and view maintenance history records"
      />

      <section className="overflow-visible">
        <TableToolbar
          search={
            <SearchInput
              className="w-full sm:w-96"
              placeholder="Search by log #, plate, work order, or class..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
            />
          }
          sort={
            <SortSelect
              className="w-full sm:w-60"
              value={`${sortField}-${sortDirection}`}
              onChange={(value) => {
                const [field, direction] = value.split("-") as [MaintenanceLogSortField, SortDirection];
                setSortField(field);
                setSortDirection(direction);
                setCurrentPage(1);
              }}
              options={[
                { value: "date-desc", label: "Date - Newest" },
                { value: "date-asc", label: "Date - Oldest" },
                { value: "logNumber-asc", label: "Log No. - Asc" },
                { value: "logNumber-desc", label: "Log No. - Desc" },
                { value: "plateNo-asc", label: "Plate No. - A to Z" },
                { value: "plateNo-desc", label: "Plate No. - Z to A" },
                { value: "class-asc", label: "Class - A to Z" },
                { value: "class-desc", label: "Class - Z to A" },
                { value: "status-asc", label: "Status - A to Z" },
                { value: "status-desc", label: "Status - Z to A" },
                { value: "mechanic-asc", label: "Mechanic - A to Z" },
                { value: "mechanic-desc", label: "Mechanic - Z to A" },
              ]}
            />
          }
          filters={
            <FilterDropdown
              open={showFilters}
              onToggle={() => setShowFilters((current) => !current)}
              statuses={statusOptions}
              selectedStatuses={selectedStatuses}
              onStatusChange={(statuses) => {
                setSelectedStatuses(statuses);
                setCurrentPage(1);
              }}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={(value) => {
                setDateFrom(value);
                setCurrentPage(1);
              }}
              onDateToChange={(value) => {
                setDateTo(value);
                setCurrentPage(1);
              }}
              onApply={() => setShowFilters(false)}
              onClear={() => {
                setSelectedStatuses([]);
                setSelectedClasses([]);
                setMechanicFilter("All");
                setGarageFilter("All");
                setDateFrom("");
                setDateTo("");
                setCurrentPage(1);
              }}
              legendTitle="Maintenance Log Legend"
              legendItems={[
                { label: "Completed", description: "Maintenance was finished and recorded in the log.", tone: "#059669" },
                { label: "Flagged", description: "Record needs attention because an issue was found during work.", tone: "#dc2626" },
                { label: "Maintenance Class", description: "Regular preventive service record.", tone: "#2563eb" },
                { label: "Repair Class", description: "Corrective service record created from a flagged issue.", tone: "#c2410c" },
              ]}
            >
              <div className="grid gap-4">
                <div>
                  <p className="text-sm font-semibold text-black">Class</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {(["Maintenance", "Repair"] as MaintenanceClass[]).map((item) => (
                      <label key={item} className="flex cursor-pointer items-center gap-2 text-sm text-[#141827]">
                        <input
                          type="checkbox"
                          checked={selectedClasses.includes(item)}
                          onChange={() => toggleClassFilter(item)}
                          className="h-4 w-4 rounded border-[#cbd3df] accent-[#070b45]"
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Mechanic</span>
                    <DropdownSelect
                      className="mt-2"
                      value={mechanicFilter}
                      onChange={(value) => {
                        setMechanicFilter(value);
                        setCurrentPage(1);
                      }}
                      label="Mechanic"
                      options={mechanicOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All mechanics" : option,
                      }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#141827]">Garage</span>
                    <DropdownSelect
                      className="mt-2"
                      value={garageFilter}
                      onChange={(value) => {
                        setGarageFilter(value);
                        setCurrentPage(1);
                      }}
                      label="Garage"
                      options={garageOptions.map((option) => ({
                        value: option,
                        label: option === "All" ? "All garages" : option,
                      }))}
                    />
                  </label>
                </div>
              </div>
            </FilterDropdown>
          }
          exportActions={
            <ExportButton
              open={isExportMenuOpen}
              onToggle={(event) => {
                event.stopPropagation();
                setIsExportMenuOpen((current) => !current);
              }}
              onPdf={() => {
                setIsExportMenuOpen(false);
                handleExportPdf();
              }}
              onCsv={() => {
                setIsExportMenuOpen(false);
                handleExportCsv();
              }}
              onExcel={() => {
                setIsExportMenuOpen(false);
                handleExportExcel();
              }}
            />
          }
        />

        <DataTable
          data={paginatedLogs}
          getRowKey={(log) => log.id}
          minWidth="900px"
          maxHeight="min(36rem, calc(100vh - 18rem))"
          emptyMessage={
            <div>
              <FileText className="mx-auto mb-3 h-10 w-10 text-[#9aa3b2]" />
              <p className="font-bold text-[#171b3a]">
                {isLoading ? "Loading maintenance logs..." : "No maintenance logs found"}
              </p>
              <p className="mt-1 text-sm text-[#8a92b3]">
                {isLoading
                  ? "Fetching records from the backend."
                  : "Try adjusting the current search or filters."}
              </p>
            </div>
          }
          columns={[
            {
              key: "logNumber",
              header: "Log No.",
              width: "11%",
              render: (log) => <span className="font-medium text-[#2f3b52]">{log.logNumber}</span>,
            },
            {
              key: "plateNo",
              header: "Plate No.",
              width: "9%",
              render: (log) => <span className="font-medium">{log.plateNo}</span>,
            },
            {
              key: "workOrder",
              header: "Work Order",
              width: "14%",
              render: (log) => log.workOrder,
            },
            {
              key: "class",
              header: "Class",
              width: "10%",
              render: (log) => <ClassBadge value={log.class} />,
            },
            { key: "date", header: "Date", width: "8%", render: (log) => log.date },
            {
              key: "odometerReading",
              header: "Odometer Reading (km)",
              width: "13%",
              render: (log) => formatOdometer(log.odometerReading),
            },
            { key: "mechanic", header: "Mechanic", width: "13%", render: (log) => log.mechanic },
            {
              key: "cost",
              header: "Cost",
              width: "7%",
              render: (log) => <span className="font-bold">{formatCurrency(log.cost)}</span>,
            },
            {
              key: "actions",
              header: "",
              width: "8%",
              align: "center",
              render: (log) => (
                <ActionMenu
                  open={openActionMenuId === log.id}
                  onToggle={(event) => {
                    event.stopPropagation();
                    setOpenActionMenuId((current) =>
                      current === log.id ? null : log.id,
                    );
                  }}
                  items={[
                    {
                      label: "View",
                      icon: Eye,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        setViewingLog(log);
                      },
                    },
                  ]}
                />
              ),
            },
          ]}
        />

        <Pagination
          page={activePage}
          totalPages={totalPages}
          totalItems={filteredLogs.length}
          pageSize={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(pageSize) => {
            setItemsPerPage(pageSize);
            setCurrentPage(1);
          }}
        />
      </section>

      <ViewModal
        isOpen={!!viewingLog}
        log={viewingLog}
        onClose={() => setViewingLog(null)}
      />
    </div>
  );
}
