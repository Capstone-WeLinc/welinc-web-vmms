import { useEffect, useMemo, useState } from "react";
import { Ban, Eye, FileText, KeyRound, Pencil, Trash2 } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import ViewModal from "./components/ViewModal";
import EditModal from "./components/EditModal";
import { getCurrentUser } from "../../lib/api/authService";
import type { UserRecord } from "../../lib/api/authService";
import {
  getMaintenanceSchedules,
  reviewMaintenanceScheduleCancellation,
  reviewMaintenanceLogUnlock,
  unlockMaintenanceLog,
  updateMaintenanceLog,
  voidMaintenanceLog,
  deleteMaintenanceSchedule,
  type MaintenanceLogEditValues,
} from "../../lib/api/maintenanceService";
import type { MaintenanceTask } from "../../lib/api/maintenanceService";
import { getVehicles, type VehicleOption } from "../../lib/api/vehicleService";
import { getGarages } from "../../lib/api/locationService";
import { getTaskTotalCost } from "../../lib/utils/maintenanceCosts";
import { isMechanicRole } from "../../lib/utils/permissions";
import {
  MaintenanceStatus as MaintenanceStatusEnum,
  maintenanceStatusLabels,
} from "../../types/maintenance";
import {
  ActionMenu,
  ConfirmationModal,
  DataTable,
  ExportButton,
  FilterDropdown,
  Pagination,
  SearchInput,
  StatusBadge,
  ToastNotification,
} from "../../components/ui";

type MaintenanceClass = "Preventive" | "Repair";
type MaintenanceStatus = "Completed" | "Cancelled" | "Flagged";

interface MaintenanceLog {
  id: string;
  isFormalLog: boolean;
  logNumber: string;
  cancellations: NonNullable<MaintenanceTask["cancellations"]>;
  maintenanceLogUnlockRequests: NonNullable<MaintenanceTask["maintenanceLogUnlockRequests"]>;
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
  laborCost: number;
  partsCost: number;
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
    quantity: string;
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

type LogConfirmation = {
  action: "unlock" | "delete" | "void" | "approve-void" | "reject-void" | "approve-unlock" | "reject-unlock";
  log: MaintenanceLog;
  requestId?: string;
};

const logStatusOptions: MaintenanceStatus[] = ["Completed", "Cancelled", "Flagged"];
const statusOptions = [...logStatusOptions];

const formatCurrency = (value: number) => `₱${value.toLocaleString()}`;
const formatOdometer = (value: number) => `${value.toLocaleString()} km`;

const getPendingVoidRequest = (log: MaintenanceLog) =>
  log.cancellations.find((entry) => entry.reviewStatus === "PENDING");

const normalizeStatus = (status?: string): MaintenanceStatus | null => {
  const normalized = status?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === MaintenanceStatusEnum.COMPLETED) return "Completed";
  if (normalized === MaintenanceStatusEnum.CANCELLED) return "Cancelled";
  if (normalized === "FLAGGED") return "Flagged";
  return null;
};

const classifyMaintenance = (maintenanceClass?: string): MaintenanceClass => {
  return maintenanceClass === "REPAIR" ? "Repair" : "Preventive";
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
    maintenanceClass?: string;
    checklist?: Array<{ status?: string }>;
    maintenanceRemarks?: string;
    executionItems?: Array<{
      id?: string;
      label?: string;
      text?: string;
      status?: string;
      partsUsed?: string;
      partsCost?: string;
    }>;
    partDetails?: Record<string, {
      partsUsed?: string;
      quantity?: string | number;
      materialCost?: string | number;
    }>;
    execution?: {
      done?: boolean;
      remarks?: string;
      maintenanceRemarks?: string;
      technicianSignature?: string;
      items?: Array<{
        id?: string;
        label?: string;
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
  if (!status || (!task.logNumber?.trim() && status !== "Cancelled")) return null;
  const isFormalLog = Boolean(task.logNumber?.trim());
  const relatedPlateNumber = (
    task as MaintenanceTask & { vehicle?: { plateNumber?: string } }
  ).vehicle?.plateNumber;
  const progress = readProgress(task);
  const checklist = progress?.checklist ?? [];
  const execution = progress?.execution;
  const executionItems = progress?.executionItems ?? execution?.items ?? [];
  const materialCost = getTaskTotalCost(task);
  const costBreakdown = progress?.partDetails
    ? executionItems.flatMap((item) => {
        const details = item.id ? progress.partDetails?.[item.id] : undefined;
        if (!details?.partsUsed?.trim()) return [];
        return [{
          item: item.label?.trim() || item.text?.trim() || "Checklist item",
          partsUsed: details.partsUsed.trim(),
          quantity: String(details.quantity ?? "N/A"),
          cost: parseCost(String(details.materialCost ?? "0")),
        }];
      })
    : executionItems
        .filter(
          (item) =>
            item.status === "changed" ||
            Boolean(item.partsUsed?.trim()) ||
            parseCost(item.partsCost) > 0,
        )
        .map((item) => ({
          item: item.text?.trim() || "Checklist item",
          partsUsed: item.partsUsed?.trim() || "Not specified",
          quantity: "N/A",
          cost: parseCost(item.partsCost),
        }));

  return {
    id: task.id,
    isFormalLog,
    maintenanceLogUnlockRequests: task.maintenanceLogUnlockRequests ?? [],
    logNumber: task.logNumber?.trim() || task.workOrderNumber || "Cancelled Schedule",
    cancellations: task.cancellations ?? [],
    plateNo:
      relatedPlateNumber || getVehiclePlateNumber(task.vehicleId, vehicles),
    workOrder: task.title || "Untitled work order",
    class: classifyMaintenance(progress?.maintenanceClass),
    date: task.date || "",
    garage: task.garageId ? garageNames[task.garageId] ?? task.garageId : "Unassigned",
    accountType: task.accountType || "N/A",
    triggerType: task.triggerType || "MANUAL",
    intervalKm: task.intervalKm || "N/A",
    bufferDistanceKm: task.bufferDistanceKm || "N/A",
    startReferenceDate: task.startReferenceDate || "N/A",
    odometerReading: readNumber(task, ["odometerReading", "startingReferenceReadingKm"]),
    laborCost: readNumber(task, ["laborCost"]),
    partsCost: readNumber(task, ["partsCost"]),
    status,
    mechanic: task.assignedDriver || "Unassigned",
    checklistCompleted: checklist.filter((item) => item.status && item.status !== "pending").length,
    checklistTotal: checklist.length,
    executionCompleted: executionItems.filter((item) => item.status && item.status !== "pending").length,
    executionTotal: executionItems.length,
    changedParts: executionItems.filter((item) => item.status === "changed").length,
    materialCost,
    costBreakdown,
    cost: materialCost,
    remarks: progress?.maintenanceRemarks || execution?.maintenanceRemarks || execution?.remarks || "N/A",
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
  const [editingLog, setEditingLog] = useState<MaintenanceLog | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [pendingLogConfirmation, setPendingLogConfirmation] = useState<LogConfirmation | null>(null);
  const [logActionReason, setLogActionReason] = useState("");
  const [logActionError, setLogActionError] = useState("");
  const [isSavingLogAction, setIsSavingLogAction] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const isMechanic = isMechanicRole(currentUser);
  const isAdmin = currentUser?.role === "ADMIN";
  const isOperations = currentUser?.role === "OPERATIONS";

  useEffect(() => {
    setLogActionReason("");
    setLogActionError("");
  }, [pendingLogConfirmation]);

  const showToast = (nextToast: ToastState) => setToast(nextToast);

  const handleUnlock = async (log: MaintenanceLog, reason: string) => {
    const unlock = await unlockMaintenanceLog(log.id, reason);
    const updatedLog = { ...log, maintenanceLogUnlockRequests: [...log.maintenanceLogUnlockRequests, unlock] };
    setLogs((current) => current.map((entry) => entry.id === log.id ? updatedLog : entry));
    setPendingLogConfirmation(null);
    showToast({ type: "success", message: "Unlock request sent to Admin for approval." });
  };

  const handleReviewUnlock = async (log: MaintenanceLog, requestId: string, decision: "APPROVE" | "REJECT", reason?: string) => {
    await reviewMaintenanceLogUnlock(log.id, requestId, decision, reason);
    setLogs((current) => current.map((entry) => entry.id === log.id ? {
      ...entry,
      maintenanceLogUnlockRequests: entry.maintenanceLogUnlockRequests?.map((request) => request.id === requestId
        ? { ...request, reviewStatus: decision === "APPROVE" ? "APPROVED" : "REJECTED" } : request),
    } : entry));
    setPendingLogConfirmation(null);
    showToast({ type: "success", message: decision === "APPROVE" ? "Unlock approved. Operations has 15 minutes to make the audited correction." : "Unlock request rejected." });
  };

  const handleSaveEdit = async (changes: MaintenanceLogEditValues) => {
    if (!editingLog) return;
    setIsSavingEdit(true);
    try {
      const updated = await updateMaintenanceLog(editingLog.id, changes);
      const updatedLog: MaintenanceLog = {
        ...editingLog,
        class: changes.maintenanceClass === "REPAIR" ? "Repair" : changes.maintenanceClass === "PREVENTIVE" ? "Preventive" : editingLog.class,
        remarks: changes.maintenanceRemarks ?? editingLog.remarks,
        odometerReading: changes.serviceOdometerReading ?? editingLog.odometerReading,
        laborCost: updated.laborCost,
        partsCost: updated.partsCost,
        cost: updated.totalCost,
      };
      setLogs((current) => current.map((log) => log.id === updatedLog.id ? updatedLog : log));
      setEditingLog(null);
      showToast({ type: "success", message: "Maintenance log saved, audited, and relocked." });
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "Could not save maintenance-log changes." });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleVoidLog = async (log: MaintenanceLog, reason: string) => {
    const requested = await voidMaintenanceLog(log.id, reason);
    const updatedLog = { ...log, status: normalizeStatus(requested.status) ?? log.status, cancellations: requested.cancellations ?? log.cancellations };
    setLogs((current) => current.map((entry) => entry.id === log.id ? updatedLog : entry));
    setViewingLog((current) => current?.id === log.id ? updatedLog : current);
    setPendingLogConfirmation(null);
    showToast({ type: "success", message: "Void request sent. The log remains Completed until an Admin approves it." });
  };

  const handleDeleteLog = async (log: MaintenanceLog) => {
    await deleteMaintenanceSchedule(log.id);
    setLogs((current) => current.filter((entry) => entry.id !== log.id));
    setViewingLog((current) => current?.id === log.id ? null : current);
    setPendingLogConfirmation(null);
    showToast({ type: "success", message: "Maintenance log deleted." });
  };

  const handleReviewVoidRequest = async (
    log: MaintenanceLog,
    requestId: string,
    decision: "APPROVE" | "REJECT",
    reason?: string,
  ) => {
    const reviewed = await reviewMaintenanceScheduleCancellation(log.id, requestId, decision, reason);
    const updatedLog = {
      ...log,
      status: normalizeStatus(reviewed.status) ?? log.status,
      cancellations: reviewed.cancellations ?? log.cancellations,
    };
    setLogs((current) => current.map((entry) => entry.id === log.id ? updatedLog : entry));
    setViewingLog((current) => current?.id === log.id ? updatedLog : current);
    setPendingLogConfirmation(null);
    showToast({
      type: "success",
      message: decision === "APPROVE"
        ? "Void approved. The log is now Cancelled and excluded from completed cost totals."
        : "Void request rejected. The log remains Completed.",
    });
  };

  const confirmLogAction = () => {
    if (!pendingLogConfirmation || isSavingLogAction) return;
    const { action, log, requestId } = pendingLogConfirmation;
    const needsReason = ["unlock", "void", "reject-void", "reject-unlock"].includes(action);
    if (needsReason && !logActionReason.trim()) {
      setLogActionError("A reason is required.");
      return;
    }
    if ((action === "approve-void" || action === "reject-void") && !requestId) return;

    setIsSavingLogAction(true);
    setLogActionError("");
    const operation = action === "unlock"
      ? handleUnlock(log, logActionReason)
      : action === "void"
        ? handleVoidLog(log, logActionReason)
        : action === "delete"
          ? handleDeleteLog(log)
          : action === "approve-unlock" || action === "reject-unlock"
            ? handleReviewUnlock(log, requestId!, action === "approve-unlock" ? "APPROVE" : "REJECT", action === "reject-unlock" ? logActionReason : undefined)
            : handleReviewVoidRequest(
              log,
              requestId!,
              action === "approve-void" ? "APPROVE" : "REJECT",
              action === "reject-void" ? logActionReason : undefined,
            );
    void operation.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "The log action could not be completed.";
      setLogActionError(message);
      showToast({ type: "error", message });
    }).finally(() => setIsSavingLogAction(false));
  };

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
  const hasActiveApprovedUnlock = (log: MaintenanceLog) => log.maintenanceLogUnlockRequests.some((request) =>
    request.reviewStatus === "APPROVED" && !request.consumedAt && Boolean(request.activatedAt) &&
    new Date(request.activatedAt!).getTime() > Date.now() - 15 * 60 * 1000,
  );

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
              render: (log) => (
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge
                    status={
                      log.status === "Completed"
                        ? maintenanceStatusLabels[MaintenanceStatusEnum.COMPLETED]
                        : log.status
                    }
                  />
                  {getPendingVoidRequest(log) && (
                    <span className="text-xs font-medium text-amber-700">Void awaiting Admin approval</span>
                  )}
                </div>
              ),
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
                <ActionMenu
                  open={openActionMenuId === log.id}
                  onToggle={(event) => {
                    event.stopPropagation();
                    setOpenActionMenuId((current) => current === log.id ? null : log.id);
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
                    ...(log.isFormalLog && isOperations && !getPendingVoidRequest(log) && !log.maintenanceLogUnlockRequests.some((request) => request.reviewStatus === "PENDING") && !hasActiveApprovedUnlock(log) && (log.status === "Completed" || log.status === "Cancelled")
                      ? [{
                          label: "Request Unlock",
                          icon: KeyRound,
                          onClick: () => {
                            setOpenActionMenuId(null);
                            setPendingLogConfirmation({ action: "unlock", log });
                          },
                        }]
                      : []),
                    ...(log.isFormalLog && isOperations && !getPendingVoidRequest(log) && (log.status === "Completed" || log.status === "Cancelled")
                      ? [
                          ...(log.status !== "Cancelled" && !log.maintenanceLogUnlockRequests.some((request) => request.reviewStatus === "PENDING")
                            ? [{
                                label: "Void",
                                icon: Ban,
                                danger: true,
                                onClick: () => {
                                  setOpenActionMenuId(null);
                                  setPendingLogConfirmation({ action: "void", log });
                                },
                              }]
                            : []),
                          ...(hasActiveApprovedUnlock(log) ? [{
                            label: "Edit",
                            icon: Pencil,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              setEditingLog(log);
                            },
                          }] : []),
                        ]
                      : []),
                    ...(log.isFormalLog && isAdmin && log.maintenanceLogUnlockRequests?.some((request) => request.reviewStatus === "PENDING")
                      ? [
                          { label: "Approve Unlock Request", icon: KeyRound, onClick: () => { setOpenActionMenuId(null); const request = log.maintenanceLogUnlockRequests?.find((item) => item.reviewStatus === "PENDING"); if (request) setPendingLogConfirmation({ action: "approve-unlock", log, requestId: request.id }); } },
                          { label: "Reject Unlock Request", icon: Ban, danger: true, onClick: () => { setOpenActionMenuId(null); const request = log.maintenanceLogUnlockRequests?.find((item) => item.reviewStatus === "PENDING"); if (request) setPendingLogConfirmation({ action: "reject-unlock", log, requestId: request.id }); } },
                        ] : []),
                    ...(log.isFormalLog && isAdmin && getPendingVoidRequest(log)
                      ? [
                          {
                            label: "Approve Void Request",
                            icon: KeyRound,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              setPendingLogConfirmation({
                                action: "approve-void",
                                log,
                                requestId: getPendingVoidRequest(log)?.id,
                              });
                            },
                          },
                          {
                            label: "Reject Void Request",
                            icon: Ban,
                            danger: true,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              setPendingLogConfirmation({
                                action: "reject-void",
                                log,
                                requestId: getPendingVoidRequest(log)?.id,
                              });
                            },
                          },
                        ]
                      : []),
                    ...(log.isFormalLog && isAdmin && !getPendingVoidRequest(log)
                      ? [{
                          label: "Delete",
                          icon: Trash2,
                          danger: true,
                          onClick: () => {
                            setOpenActionMenuId(null);
                            setPendingLogConfirmation({ action: "delete", log });
                          },
                        }]
                      : []),
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

      <ConfirmationModal
        isOpen={Boolean(pendingLogConfirmation)}
        busy={isSavingLogAction}
        title={
          pendingLogConfirmation?.action === "unlock" ? "Request Maintenance Log Unlock"
            : pendingLogConfirmation?.action === "delete" ? "Delete Maintenance Log"
              : pendingLogConfirmation?.action === "void" ? "Request Log Void"
              : pendingLogConfirmation?.action === "approve-void" ? "Approve Log Void"
                : pendingLogConfirmation?.action === "approve-unlock" ? "Approve Log Unlock"
                  : pendingLogConfirmation?.action === "reject-unlock" ? "Reject Log Unlock Request"
                    : "Reject Log Void Request"
        }
        variant={pendingLogConfirmation?.action === "unlock" || pendingLogConfirmation?.action === "approve-void" || pendingLogConfirmation?.action === "approve-unlock" ? "primary" : "danger"}
        confirmDisabled={
          (pendingLogConfirmation?.action === "unlock" || pendingLogConfirmation?.action === "void" || pendingLogConfirmation?.action === "reject-void" || pendingLogConfirmation?.action === "reject-unlock") &&
          !logActionReason.trim()
        }
        confirmLabel={
          pendingLogConfirmation?.action === "unlock" ? "Request Unlock"
            : pendingLogConfirmation?.action === "delete" ? "Delete Log"
              : pendingLogConfirmation?.action === "void" ? "Submit Void Request"
              : pendingLogConfirmation?.action === "approve-void" ? "Approve Void"
                : pendingLogConfirmation?.action === "approve-unlock" ? "Approve Unlock"
                  : "Reject Request"
        }
        message={pendingLogConfirmation ? (
          <div className="space-y-3 text-left">
            <p>
              {pendingLogConfirmation.action === "unlock"
                ? "Request Admin approval to unlock this log for an audited correction? The edit window starts only after approval."
                : pendingLogConfirmation.action === "delete"
                  ? "Remove this log from active maintenance history? The record will be soft-deleted, not physically erased."
                  : pendingLogConfirmation.action === "void"
                    ? "Submit this completed log for Admin void approval? It remains Completed and included in completed cost totals until approved."
                    : pendingLogConfirmation.action === "approve-void"
                      ? "Approve voiding this log? It will be retained as Cancelled and excluded from completed maintenance cost totals."
                      : pendingLogConfirmation.action === "approve-unlock"
                        ? "Approve this Operations request? It will create a 15-minute edit window after approval."
                        : pendingLogConfirmation.action === "reject-unlock"
                          ? "Reject this unlock request? The maintenance log will remain locked."
                          : "Reject this void request? The log will remain Completed."}
            </p>
            <p className="font-semibold">{pendingLogConfirmation.log.logNumber} — {pendingLogConfirmation.log.plateNo}</p>
            {(pendingLogConfirmation.action === "unlock" || pendingLogConfirmation.action === "void" || pendingLogConfirmation.action === "reject-void" || pendingLogConfirmation.action === "reject-unlock") && (
              <label className="block text-sm font-medium">
                {pendingLogConfirmation.action === "unlock" ? "Operations unlock request reason"
                  : pendingLogConfirmation.action === "void" ? "Operations void reason"
                    : "Admin rejection reason"} (required)
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={logActionReason}
                  disabled={isSavingLogAction}
                  onChange={(event) => setLogActionReason(event.target.value)}
                  className="mt-2 block w-full rounded-lg border border-[#c8ced8] bg-white p-3 text-sm outline-none focus:border-[#070b45]"
                />
              </label>
            )}
            {logActionError && <p role="alert" className="text-sm text-red-700">{logActionError}</p>}
          </div>
        ) : ""}
        onConfirm={confirmLogAction}
        onCancel={() => { if (!isSavingLogAction) setPendingLogConfirmation(null); }}
      />

      <ViewModal
        isOpen={!!viewingLog}
        log={viewingLog}
        onClose={() => setViewingLog(null)}
      />
      <EditModal
        key={editingLog?.id ?? "closed"}
        log={editingLog}
        isSaving={isSavingEdit}
        onClose={() => { if (!isSavingEdit) setEditingLog(null); }}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
