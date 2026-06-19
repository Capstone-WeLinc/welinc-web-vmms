import { useEffect, useMemo, useState } from "react";
import { Eye, FileText } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import ViewModal from "./components/ViewModal";
import { getCurrentUser } from "../../lib/api/authService";
import type { UserRecord } from "../../lib/api/authService";
import { getMaintenanceSchedules } from "../../lib/api/maintenanceService";
import type { MaintenanceTask } from "../../lib/api/maintenanceService";
import { getGarages } from "../../lib/api/locationService";
import { isMechanicRole } from "../../lib/utils/permissions";
import { formatLogNumber } from "../../lib/utils/workOrders";
import {
  ActionButton,
  DataTable,
  ExportButton,
  FilterDropdown,
  Pagination,
  SearchInput,
  StatusBadge,
  ToastNotification,
} from "../../components/ui";

type MaintenanceClass = "Maintenance" | "Repair";
type MaintenanceStatus = "Completed" | "Flagged";

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
  laborCost: number;
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
  if (status === "Completed") return "Completed";
  if (status === "Flagged") return "Flagged";
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
      laborCost?: string;
      remarks?: string;
      technicianSignature?: string;
      items?: Array<{
        status?: string;
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

const mapScheduleToLog = (
  task: MaintenanceTask,
  garageNames: Record<string, string>,
): MaintenanceLog | null => {
  const status = normalizeStatus(task.status);
  if (!status) return null;
  const progress = readProgress(task);
  const checklist = progress?.checklist ?? [];
  const execution = progress?.execution;
  const executionItems = execution?.items ?? [];
  const materialCost = executionItems.reduce(
    (total, item) => total + parseCost(item.partsCost),
    0,
  );
  const laborCost = parseCost(execution?.laborCost);

  return {
    id: task.id,
    logNumber: buildLogNumber(task),
    plateNo: task.vehicleId || "Unassigned",
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
    laborCost,
    cost: laborCost + materialCost || readNumber(task, ["cost", "totalCost", "materialCost", "laborCost"]),
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewingLog, setViewingLog] = useState<MaintenanceLog | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const isMechanic = isMechanicRole(currentUser);

  const showToast = (nextToast: ToastState) => setToast(nextToast);

  useEffect(() => {
    let isMounted = true;

    Promise.allSettled([
      getCurrentUser(),
      getMaintenanceSchedules({ statuses: logStatusOptions }),
      getGarages(),
    ])
      .then(([userResult, logsResult, garagesResult]) => {
        if (!isMounted) return;

        setCurrentUser(userResult.status === "fulfilled" ? userResult.value : null);
        const garageNames =
          garagesResult.status === "fulfilled"
            ? Object.fromEntries(garagesResult.value.map((garage) => [garage.id, garage.name]))
            : {};

        if (logsResult.status === "fulfilled") {
          setLogs(
            logsResult.value
              .map((task) => mapScheduleToLog(task, garageNames))
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
      const matchesDateFrom = !dateFrom || log.date >= dateFrom;
      const matchesDateTo = !dateTo || log.date <= dateTo;

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [logs, searchQuery, selectedStatuses, dateFrom, dateTo, currentUser, isMechanic]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const handleExportExcel = () => {
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
      "Labor Cost",
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
      formatCurrency(log.laborCost),
      formatCurrency(log.cost),
      log.remarks,
      log.technicianSignature,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maintenance-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
        <td>${formatCurrency(log.laborCost)}</td>
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
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            className="w-full max-w-xl"
            placeholder="Search by log #, plate, work order, or class..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
          />

          <div className="flex items-center gap-4">
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
                setDateFrom("");
                setDateTo("");
                setCurrentPage(1);
              }}
            />

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
              onExcel={() => {
                setIsExportMenuOpen(false);
                handleExportExcel();
              }}
            />
          </div>
        </div>

        <DataTable
          data={paginatedLogs}
          getRowKey={(log) => log.id}
          minWidth="1000px"
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
            {
              key: "status",
              header: "Status",
              width: "9%",
              render: (log) => <StatusBadge status={log.status} />,
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
              header: "Actions",
              width: "8%",
              align: "center",
              render: (log) => (
                <ActionButton
                  variant="secondary"
                  className="h-9 px-3"
                  onClick={(event) => {
                    event.stopPropagation();
                    setViewingLog(log);
                  }}
                >
                  <Eye className="h-4 w-4" />
                  View
                </ActionButton>
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
