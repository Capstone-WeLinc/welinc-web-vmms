import { useEffect, useState, useRef } from "react";
import {
  Wrench,
  FileDown,
  AlertTriangle,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  ActionButton,
  ActionMenu,
  ConfirmationModal,
  DataTable,
  FilterDropdown,
  Pagination,
  SearchInput,
  StatusBadge,
  ToastNotification,
} from "../../components/ui";
import {
  MaintenanceIntervalType,
  MaintenanceStatus,
  MaintenanceTriggerType,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  defaultChecklistTemplates,
  type ChecklistTemplateName,
} from "../../data/ChecklistData";
import {
  createMaintenanceSchedule,
  getChecklistTemplates,
  getWorkOrders,
  updateWorkOrder,
  updateWorkOrderProgress,
} from "../../lib/api/maintenanceService";
import { getVehicles, type VehicleOption } from "../../lib/api/vehicleService";
import { getCurrentUser, type UserRecord } from "../../lib/api/authService";
import { getGarages } from "../../lib/api/locationService";
import { isMechanicRole } from "../../lib/utils/permissions";
import {
  formatWorkOrderNumber,
  getCalculatedMaintenanceStatus,
  getOdometerActivationRange,
  getTimeBasedActivationDate,
  isDueStatus,
  isInProgressStatus,
  isOverdueStatus,
  isPendingStatus,
  isPendingOdometerScheduleReadyForMechanic,
  isPendingTimeScheduleReadyForMechanic,
} from "../../lib/utils/workOrders";

type ItemStatus = "pass" | "fail" | "pending";

type ExecutionStatus = "checked" | "changed" | "notChecked" | "pending";

interface ChecklistItemTemplate {
  id: string;
  text: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  status: ItemStatus;
  note: string;
  partsUsed?: string;
}

interface ExecutionItem {
  id: string;
  text: string;
  status: ExecutionStatus;
  note: string;
  partsUsed?: string;
  partsCost?: string;
  attachments?: string[];
}

interface ExecutionRecord {
  done: boolean;
  items: ExecutionItem[];
  attachments?: string[];
  remarks?: string;
  technicianSignature?: string;
}

interface WorkOrderProgress {
  checklists: Record<string, ChecklistItem[]>;
  executions: Record<string, ExecutionRecord>;
}

type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};

type PendingWorkOrderAction = "executionComplete" | "inspectionComplete" | null;

const progressStorageKey = "workOrderProgress";

const loadWorkOrderProgress = (): WorkOrderProgress => {
  try {
    const saved = window.localStorage.getItem(progressStorageKey);
    if (!saved) return { checklists: {}, executions: {} };
    return JSON.parse(saved) as WorkOrderProgress;
  } catch {
    return { checklists: {}, executions: {} };
  }
};

const saveWorkOrderProgress = (progress: WorkOrderProgress) => {
  try {
    window.localStorage.setItem(
      progressStorageKey,
      JSON.stringify(progress),
    );
  } catch {
    // ignore storage failure
  }
};

const isBackendWorkOrderProgress = (
  value: unknown,
): value is { checklist?: ChecklistItem[]; execution?: ExecutionRecord } => {
  return typeof value === "object" && value !== null;
};

const normalizeTemplateName = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

const findTemplateItems = (
  templates: Record<ChecklistTemplateName, ChecklistItemTemplate[]>,
  templateName: string,
) => {
  const exactItems = templates[templateName];
  if (exactItems) return exactItems;

  const normalizedName = normalizeTemplateName(templateName);
  const matchedTemplateName = Object.keys(templates).find(
    (name) => normalizeTemplateName(name) === normalizedName,
  );

  return matchedTemplateName
    ? templates[matchedTemplateName]
    : templates["General Inspection"] || [];
};

const syncChecklistWithTemplate = (
  templateItems: ChecklistItemTemplate[],
  currentItems: ChecklistItem[] = [],
) =>
  templateItems.map((item) => {
    const existing = currentItems.find(
      (current) =>
        current.id === item.id ||
        normalizeTemplateName(current.text) === normalizeTemplateName(item.text),
    );

    return {
      id: item.id,
      text: item.text,
      status: existing?.status ?? "pending",
      note: existing?.note ?? "",
      partsUsed: existing?.partsUsed ?? "",
    };
  });

const syncExecutionWithTemplate = (
  templateItems: ChecklistItemTemplate[],
  currentItems: ExecutionItem[] = [],
) =>
  templateItems.map((item) => {
    const existing = currentItems.find(
      (current) =>
        current.id === item.id ||
        normalizeTemplateName(current.text) === normalizeTemplateName(item.text),
    );

    return {
      id: item.id,
      text: item.text,
      status: existing?.status ?? "pending",
      note: existing?.note ?? "",
      partsUsed: existing?.partsUsed ?? "",
      partsCost: existing?.partsCost ?? "",
      attachments: existing?.attachments ?? [],
    };
  });

// Layout & interaction classes
const containerClasses = 'space-y-6';
const headerSectionClasses = 'flex flex-col gap-4 border-b border-[var(--color-divider)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between';
const detailViewClasses = 'rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-xl backdrop-blur-sm transition-all';
const backButtonClasses = 'mb-6 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-brand-primary)]';
const executionTableClasses = 'mb-6 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)]';
const tableHeaderClasses = 'grid grid-cols-[minmax(12rem,1fr)_64px_64px_88px_minmax(10rem,1.1fr)_88px] items-center gap-2 border-b border-[var(--color-divider)] bg-[var(--color-card-bg)] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]';
const checklistHeaderClasses = 'grid grid-cols-[minmax(12rem,1fr)_64px_64px_minmax(10rem,1fr)_88px] items-center gap-2 border-b border-[var(--color-divider)] bg-[var(--color-card-bg)] px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]';
const warningBannerClasses = 'mt-6 flex items-start gap-3 rounded-lg border border-[var(--color-status-error)]/20 bg-[var(--color-status-error)]/10 px-5 py-4 shadow-[0_0_15px_rgba(239,68,68,0.06)]';

export default function WorkOrders() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [garages, setGarages] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [templates, setTemplates] =
    useState<Record<ChecklistTemplateName, ChecklistItemTemplate[]>>(
      defaultChecklistTemplates,
    );

  const initialProgress = loadWorkOrderProgress();
  const isMechanic = isMechanicRole(currentUser);

  useEffect(() => {
    const loadWorkOrders = () => {
      getWorkOrders()
        .then((loadedTasks) => {
          setTasks(loadedTasks);
          setChecklists((current) => {
            const next = new Map(current);
            loadedTasks.forEach((task) => {
              const progress = task.workOrderProgress;
              if (
                isBackendWorkOrderProgress(progress) &&
                Array.isArray(progress.checklist)
              ) {
                next.set(task.id, progress.checklist);
              }
            });
            return next;
          });
          setExecutions((current) => {
            const next = new Map(current);
            loadedTasks.forEach((task) => {
              const progress = task.workOrderProgress;
              if (
                isBackendWorkOrderProgress(progress) &&
                progress.execution
              ) {
                next.set(task.id, progress.execution);
              }
            });
            return next;
          });
          setSelectedTask((current) =>
            current
              ? loadedTasks.find((task) => task.id === current.id) ?? null
              : null,
          );
        })
        .catch(() => {
          // Keep the last successfully loaded work orders.
        });
    };

    loadWorkOrders();
    getChecklistTemplates()
      .then(setTemplates)
      .catch(() => setTemplates(defaultChecklistTemplates));
    getGarages().then(setGarages).catch(() => setGarages([]));
    getVehicles().then(setVehicles).catch(() => setVehicles([]));
    getCurrentUser().then(setCurrentUser).catch(() => setCurrentUser(null));

    window.addEventListener("focus", loadWorkOrders);
    return () => window.removeEventListener("focus", loadWorkOrders);
  }, []);

  // State for checklists could be a Map keyed by task ID to prevent prototype pollution.
  const [checklists, setChecklists] = useState<Map<string, ChecklistItem[]>>(
    () => new Map(Object.entries(initialProgress.checklists || {})),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [sortField, setSortField] = useState<"date" | "workOrderId">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [workOrdersPerPage, setWorkOrdersPerPage] = useState(8);
  const [workOrderStep, setWorkOrderStep] = useState(1);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingWorkOrderAction, setPendingWorkOrderAction] =
    useState<PendingWorkOrderAction>(null);
  const [pendingStartChange, setPendingStartChange] = useState<(() => void) | null>(null);

  useEffect(() => {
    const closeActionMenu = () => setOpenActionMenuId(null);
    document.addEventListener("click", closeActionMenu);
    return () => document.removeEventListener("click", closeActionMenu);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const normalizeText = (value?: string | null) =>
    value?.trim().toLowerCase() ?? "";

  const getVehiclePlateNumber = (vehicleId?: string) => {
    if (!vehicleId) return "";
    const vehicle = vehicles.find(
      (item) =>
        item.value === vehicleId ||
        item.id === vehicleId ||
        item.plateNumber === vehicleId,
    );
    return vehicle?.plateNumber ?? vehicle?.value ?? vehicleId;
  };

  const isAssignedToCurrentMechanic = (task: MaintenanceTask) => {
    if (!isMechanic || !currentUser) return true;

    const currentNames = [currentUser.id, currentUser.name, currentUser.email]
      .map(normalizeText)
      .filter(Boolean);

    const assignedNames = [
      task.assignedMechanicId,
      task.assignedMechanicEmail,
      task.assignedDriver,
    ]
      .map(normalizeText)
      .filter(Boolean);

    return currentNames.some((name) =>
      assignedNames.some(
        (assigned) =>
          assigned === name ||
          assigned.includes(name) ||
          name.includes(assigned),
      ),
    );
  };

  let activeTasks = tasks.filter(
    (task) =>
      (isPendingStatus(task.status) ||
        isDueStatus(task.status) ||
        isInProgressStatus(task.status) ||
        isOverdueStatus(task.status)) &&
      isAssignedToCurrentMechanic(task),
  );

  if (selectedStatusFilters.length > 0) {
    activeTasks = activeTasks.filter((t) =>
      selectedStatusFilters.some(
        (status) =>
          status === t.status ||
          (status === MaintenanceStatus.PENDING && isPendingStatus(t.status)) ||
          (status === MaintenanceStatus.DUE && isDueStatus(t.status)) ||
          (status === MaintenanceStatus.IN_PROGRESS && isInProgressStatus(t.status)) ||
          (status === MaintenanceStatus.OVERDUE && isOverdueStatus(t.status)),
      ),
    );
  }

  if (dateFromFilter) {
    activeTasks = activeTasks.filter((task) => task.date >= dateFromFilter);
  }

  if (dateToFilter) {
    activeTasks = activeTasks.filter((task) => task.date <= dateToFilter);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    activeTasks = activeTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.vehicleId.toLowerCase().includes(query) ||
        getVehiclePlateNumber(t.vehicleId).toLowerCase().includes(query) ||
        t.assignedDriver.toLowerCase().includes(query),
    );
  }

  activeTasks = activeTasks.sort((a, b) => {
    if (sortField === "workOrderId") {
      const getIdNumber = (id: string) => {
        const match = id.match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      };
      const idA = getIdNumber(a.id);
      const idB = getIdNumber(b.id);
      return sortDirection === "asc" ? idA - idB : idB - idA;
    }

    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
  });
  const totalPages = Math.max(
    1,
    Math.ceil(activeTasks.length / workOrdersPerPage),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTasks = activeTasks.slice(
    (activePage - 1) * workOrdersPerPage,
    activePage * workOrdersPerPage,
  );

  const handleSelectTask = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setWorkOrderStep(1);
    const templateItems = findTemplateItems(templates, task.title);

    setChecklists((prev) => {
      const next = new Map(prev);
      next.set(
        task.id,
        syncChecklistWithTemplate(templateItems, next.get(task.id)),
      );
      return next;
    });

    setExecutions((prev) => {
      const next = new Map(prev);
      const current = next.get(task.id);
      next.set(task.id, {
        done: current?.done ?? false,
        items: syncExecutionWithTemplate(templateItems, current?.items),
        attachments: current?.attachments ?? [],
        remarks: current?.remarks ?? "",
        technicianSignature: current?.technicianSignature ?? "",
      });
      return next;
    });
  };

  const currentChecklist = selectedTask
    ? checklists.get(selectedTask.id) || []
    : [];

  const [executions, setExecutions] = useState<Map<string, ExecutionRecord>>(
    () => new Map(Object.entries(initialProgress.executions || {})),
  );

  useEffect(() => {
    saveWorkOrderProgress({
      checklists: Object.fromEntries([...checklists.entries()]),
      executions: Object.fromEntries([...executions.entries()]),
    });
  }, [checklists, executions]);

  const currentExecution = selectedTask
    ? executions.get(selectedTask.id) || {
        done: false,
        items: [],
        attachments: [],
        remarks: "",
        technicianSignature: "",
      }
    : { done: false, items: [] };

  useEffect(() => {
    if (!selectedTask) return;

    const checklist = checklists.get(selectedTask.id);
    const execution = executions.get(selectedTask.id);
    if (!checklist && !execution) return;

    const timeout = window.setTimeout(() => {
      updateWorkOrderProgress(selectedTask.id, {
        checklist: checklist ?? [],
        execution: execution ?? {
          done: false,
          items: [],
          attachments: [],
          remarks: "",
          technicianSignature: "",
        },
      }).catch((error) => {
        console.error("Failed to save work order progress", error);
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [selectedTask, checklists, executions]);

  const canMechanicStartTask =
    !selectedTask ||
    !isMechanic ||
    (isPendingOdometerScheduleReadyForMechanic(selectedTask) &&
      isPendingTimeScheduleReadyForMechanic(selectedTask));
  const canModifySelectedTask =
    isMechanic &&
    Boolean(selectedTask) &&
    selectedTask?.status !== MaintenanceStatus.COMPLETED &&
    canMechanicStartTask;

  const formatDateForDisplay = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);

  const getStartLockMessage = (task: MaintenanceTask) => {
    if (task.triggerType === MaintenanceTriggerType.TIME) {
      const activationDate = getTimeBasedActivationDate(task);

      if (!activationDate) {
        return "This time-based work order is available to view, but it cannot be started until its interval and start reference date are configured.";
      }

      return `This time-based work order becomes due on ${formatDateForDisplay(activationDate)}. Before that date it stays Pending; after that date it becomes Overdue if it has not started.`;
    }

    const activationRange = getOdometerActivationRange(task);
    const currentReading = task.odometerReading?.trim();

    if (!activationRange) {
      return "This odometer-based work order is available to view, but it cannot be started until its active odometer stage is configured.";
    }

    const readingText = currentReading ? `${currentReading} km` : "not recorded";
    return `Current odometer reading is ${readingText}. Activation starts at ${activationRange.activationMileage.toLocaleString()} km and due mileage is ${activationRange.dueMileage.toLocaleString()} km.`;
  };

  const deriveTaskStatus = (
    task: MaintenanceTask,
    checklist: ChecklistItem[],
    execution: ExecutionRecord,
  ): MaintenanceStatus => {
    if (task.status === MaintenanceStatus.COMPLETED) return MaintenanceStatus.COMPLETED;
    if (checklist.some((item) => item.status === "fail")) return MaintenanceStatus.IN_PROGRESS;
    if (
      execution.items.some((item) => item.status !== "pending") ||
      checklist.some((item) => item.status !== "pending")
    ) {
      return MaintenanceStatus.IN_PROGRESS;
    }
    if (isInProgressStatus(task.status)) return MaintenanceStatus.IN_PROGRESS;
    return getCalculatedMaintenanceStatus(task);
  };

  const persistTaskStatus = (
    taskId: string,
    status: MaintenanceStatus,
  ) => {
    const task = tasks.find((task) => task.id === taskId);
    if (!task || task.status === status || task.status === MaintenanceStatus.COMPLETED) return;

    const updatedTask = { ...task, status };
    setTasks((prev) => prev.map((current) => (current.id === taskId ? updatedTask : current)));
    if (selectedTask?.id === taskId) {
      setSelectedTask(updatedTask);
    }
    updateWorkOrder(updatedTask).catch(() => {
      // ignore service failure, keep local state
    });
  };

  const detailRef = useRef<HTMLDivElement | null>(null);

  const formatTriggerType = (triggerType?: string) => {
    if (!triggerType) return "";
    return triggerType === MaintenanceTriggerType.ODOMETER
      ? "Odometer"
      : triggerType === MaintenanceTriggerType.TIME
      ? "Time"
      : triggerType === MaintenanceTriggerType.MANUAL
      ? "Manual"
      : triggerType;
  };

  const getGarageName = (garageId?: string) => {
    if (!garageId) return "";
    return garages.find((garage) => garage.id === garageId)?.name ?? garageId;
  };

  const renderScheduleDetails = (task: MaintenanceTask) => {
    const details = [
      { label: "Work Order No.", value: formatWorkOrderNumber(task.id) },
      { label: "Vehicle", value: getVehiclePlateNumber(task.vehicleId) },
      { label: "Checklist Template", value: task.title },
      { label: "Assigned Mechanic", value: task.assignedDriver },
      { label: "Date Created", value: task.date },
      { label: "Garage / Cluster", value: getGarageName(task.garageId) },
      { label: "Account Type", value: task.accountType },
      { label: "Provider", value: task.outsourcedProvider },
      { label: "System Affected", value: task.systemAffected },
      { label: "Odometer Reading (km)", value: task.odometerReading },
      { label: "Schedule Trigger", value: formatTriggerType(task.triggerType) },
      { label: "Interval Type", value: task.intervalType },
      { label: "Interval (km)", value: task.intervalKm },
      { label: "Buffer Distance (km)", value: task.bufferDistanceKm },
      { label: "Starting Reference Reading (km)", value: task.startingReferenceReadingKm },
      { label: "Start Reference Date", value: task.startReferenceDate },
      { label: "Notes", value: task.notes },
    ].filter((item) => item.value && item.value !== "");

    if (details.length === 0) return null;

    const half = Math.ceil(details.length / 2);
    const leftDetails = details.slice(0, half);
    const rightDetails = details.slice(half);

    return (
      <div className="mb-6 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-[0_25px_50px_rgba(0,0,0,0.08)]">
        <div className="px-6 py-4 border-b border-[var(--color-divider)] bg-[var(--color-card-bg)]">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            Maintenance Schedule Details
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Details from the maintenance schedule.
          </p>
        </div>
        <div className="grid gap-1.5 lg:grid-cols-2">
          {[leftDetails, rightDetails].map((columnDetails, columnIndex) => (
            <table
              key={columnIndex}
              className="min-w-full border-collapse text-sm text-[var(--color-text-primary)]"
            >
              <tbody>
                {columnDetails.map((detail, index) => (
                  <tr
                    key={detail.label}
                    className={index % 2 === 0 ? "bg-[var(--color-card-bg)]" : "bg-[var(--color-card-bg-hover)]"}
                  >
                    <th className="w-1/3 px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                      {detail.label}
                    </th>
                    <td className="px-6 py-4 text-sm text-[var(--color-text-primary)]">
                      {detail.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>
    );
  };

  const exportPdf = () => {
    if (!selectedTask) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export to PDF');
      return;
    }

    const badge = (text: string, color: string) =>
      `<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${color};color:#fff;font-size:12px;font-weight:600;margin-left:8px">${text}</span>`;

    const execRows = (currentExecution.items || [])
      .map((it) => {
        const statusLabel =
          it.status === "checked"
            ? `<span style="color:#10b981;font-weight:700">Checked</span>`
            : it.status === "changed"
              ? `<span style="color:#3b82f6;font-weight:700">Changed</span>`
              : it.status === "notChecked"
                ? `<span style="color:#f59e0b;font-weight:700">Not Checked</span>`
                : `<span style="color:#64748b;font-weight:700">Pending</span>`;
        return `
          <tr>
            <td style="padding:8px;border:1px solid #e2e8f0">${it.text}</td>
            <td style="padding:8px;border:1px solid #e2e8f0">${statusLabel}</td>
            <td style="padding:8px;border:1px solid #e2e8f0">${(it.note || "").replace(/</g, "&lt;")}</td>
            <td style="padding:8px;border:1px solid #e2e8f0">${it.partsUsed || ""}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${it.partsCost || ""}</td>
            <td style="padding:8px;border:1px solid #e2e8f0">${it.attachments?.join(", ") || ""}</td>
          </tr>`;
      })
      .join("");

    const checklistRows = (currentChecklist || [])
      .map((it) => {
        const label =
          it.status === "pass"
            ? `<span style="background:#10b981;color:#fff;padding:4px 8px;border-radius:999px;font-weight:700">Pass</span>`
            : it.status === "fail"
              ? `<span style="background:#ef4444;color:#fff;padding:4px 8px;border-radius:999px;font-weight:700">Fail</span>`
              : `<span style="background:#64748b;color:#fff;padding:4px 8px;border-radius:999px;font-weight:700">Pending</span>`;
        return `
          <tr>
            <td style="padding:8px;border:1px solid #e2e8f0">${it.text}</td>
            <td style="padding:8px;border:1px solid #e2e8f0;text-align:center">${label}</td>
            <td style="padding:8px;border:1px solid #e2e8f0">${(it.note || "").replace(/</g, "&lt;")}</td>
          </tr>`;
      })
      .join("");

    const execStatus = currentExecution.done
      ? badge("Execution Completed", "#10b981")
      : badge("Execution Pending", "#ef4444");

    const scheduleRows = [
      {
        label: "Vehicle",
        value: getVehiclePlateNumber(selectedTask.vehicleId),
      },
      { label: "Checklist Template", value: selectedTask.title },
      { label: "Assigned Mechanic", value: selectedTask.assignedDriver },
      { label: "Date Created", value: selectedTask.date },
      {
        label: "Garage / Cluster",
        value: getGarageName(selectedTask.garageId),
      },
      { label: "Account Type", value: selectedTask.accountType },
      { label: "Provider", value: selectedTask.outsourcedProvider },
      { label: "System Affected", value: selectedTask.systemAffected },
      { label: "Odometer Reading (km)", value: selectedTask.odometerReading },
      { label: "Schedule Trigger", value: formatTriggerType(selectedTask.triggerType) },
      { label: "Interval Type", value: selectedTask.intervalType },
      { label: "Interval (km)", value: selectedTask.intervalKm },
      { label: "Buffer Distance (km)", value: selectedTask.bufferDistanceKm },
      { label: "Starting Reference Reading (km)", value: selectedTask.startingReferenceReadingKm },
      { label: "Start Reference Date", value: selectedTask.startReferenceDate },
      { label: "Notes", value: selectedTask.notes },
    ].filter((item) => item.value && item.value !== "");

    const signatureHtml = currentExecution.technicianSignature?.trim()
      ? `
          <div class="section">
            <h2>Chief Mechanic</h2>
            <p>${currentExecution.technicianSignature}</p>
          </div>
        `
      : "";

    const scheduleDetailsHtml = scheduleRows.length
      ? `
          <div class="section">
            <h2>Schedule Details</h2>
            <table>
              <tbody>
                ${scheduleRows
                  .map(
                    (row) =>
                      `<tr><td style="padding:8px;border:1px solid #e6e9ef;width:180px;font-weight:700">${row.label}</td><td style="padding:8px;border:1px solid #e6e9ef">${row.value}</td></tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
      : "";
    const costSummaryHtml = `
      <div class="section">
        <h2>Cost Summary</h2>
        <table>
          <tbody>
            <tr><td style="font-weight:700">Material Cost</td><td style="text-align:right">${formatCurrency(materialCostTotal)}</td></tr>
            <tr><td style="font-weight:700">Total Cost</td><td style="text-align:right;font-weight:700">${formatCurrency(workOrderCostTotal)}</td></tr>
          </tbody>
        </table>
      </div>
    `;

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Work Order - ${selectedTask.title}</title>
          <style>
            body{font-family:Arial,Helvetica,sans-serif;color:#0d0d0d;background:#ffffff;padding:24px}
            h1,h2{margin:0 0 8px 0}
            .muted{color:#64748b}
            table{border-collapse:collapse;width:100%;margin-top:12px}
            th{background:#f1f5f9;text-align:left;padding:8px;border:1px solid #e2e8f0}
            td{padding:8px;border:1px solid #e2e8f0}
            .section{margin-top:18px}
          </style>
        </head>
        <body>
          <h1>${getVehiclePlateNumber(selectedTask.vehicleId)} — ${selectedTask.title}</h1>
          <div class="muted">Date: ${selectedTask.date} &nbsp; • &nbsp; Mechanic: ${selectedTask.assignedDriver}</div>
          ${scheduleDetailsHtml}
          ${signatureHtml}
          <div class="section">
            <h2>Execution ${execStatus}</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Parts Used</th>
                  <th style="text-align:right">Cost</th>
                  <th>Photos / Attachments</th>
                </tr>
              </thead>
              <tbody>
                ${execRows || `<tr><td colspan=6 style="padding:12px;text-align:center;color:#64748b">No execution items</td></tr>`}
              </tbody>
            </table>
          </div>
          ${costSummaryHtml}

          <div class="section">
            <h2>Inspection Checklist</h2>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:center">Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                ${checklistRows || `<tr><td colspan=3 style="padding:12px;text-align:center;color:#64748b">No checklist items</td></tr>`}
              </tbody>
            </table>
            <p><strong>Inspector Remarks:</strong> ${currentExecution.remarks || ""}</p>
            <p><strong>Approval / Verification:</strong> ${selectedTask.status}</p>
          </div>
        </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    const printAndClose = () => {
      printWindow.focus();
      printWindow.print();
    };

    if (printWindow.document.readyState === 'complete') {
      printAndClose();
    } else {
      printWindow.onload = printAndClose;
      const interval = setInterval(() => {
        if (printWindow.document.readyState === 'complete') {
          clearInterval(interval);
          printAndClose();
        }
      }, 100);
    }
  };

  const executionPendingCount = currentExecution.items.filter(
    (item) => item.status === "pending",
  ).length;
  const canCompleteExecution =
    currentExecution.items.length > 0 &&
    executionPendingCount === 0 &&
    !!currentExecution.technicianSignature?.trim();
  const parseCostValue = (value?: string) => {
    if (!value) return 0;
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const materialCostTotal = currentExecution.items.reduce(
    (total, item) => total + parseCostValue(item.partsCost),
    0,
  );
  const workOrderCostTotal = materialCostTotal;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 2,
    }).format(value);
  const workOrderStatusOptions = [
    MaintenanceStatus.PENDING,
    MaintenanceStatus.DUE,
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.OVERDUE,
  ];

  const applyChangeOrConfirmStart = (change: () => void) => {
    if (isMechanic && selectedTask && isPendingStatus(selectedTask.status)) {
      setPendingStartChange(() => change);
      return;
    }
    change();
  };

  const confirmStartWorkOrder = () => {
    if (!selectedTask || !pendingStartChange) return;

    persistTaskStatus(selectedTask.id, MaintenanceStatus.IN_PROGRESS);
    pendingStartChange();
    setPendingStartChange(null);
    setToast({ type: "success", message: "Work order started successfully." });
  };

  const updateExecutionItemStatus = (
    taskId: string,
    itemId: string,
    status: ExecutionStatus,
  ) => {
    if (!canModifySelectedTask) return;

    applyChangeOrConfirmStart(() => setExecutions((prev) => {
      const next = new Map(prev);
      const cur = next.get(taskId) || {
        done: false,
        items: [] as ExecutionItem[],
      };
      const items = cur.items.map((item) =>
        item.id === itemId ? { ...item, status } : item,
      );
      const updatedExecution = { ...cur, items };
      next.set(taskId, updatedExecution);

      const checklistItems = selectedTask ? checklists.get(taskId) || [] : [];
      if (selectedTask) {
        persistTaskStatus(
          taskId,
          deriveTaskStatus(selectedTask, checklistItems, updatedExecution),
        );
      }

      return next;
    }));
  };

  const updateExecutionItemNote = (
    taskId: string,
    itemId: string,
    note: string,
  ) => {
    if (!canModifySelectedTask) return;

    applyChangeOrConfirmStart(() => setExecutions((prev) => {
      const next = new Map(prev);
      const cur = next.get(taskId) || {
        done: false,
        items: [] as ExecutionItem[],
      };
      const items = cur.items.map((item) =>
        item.id === itemId ? { ...item, note } : item,
      );
      next.set(taskId, { ...cur, items });
      return next;
    }));
  };

  const updateExecutionItemField = (
    taskId: string,
    itemId: string,
    field: keyof Pick<ExecutionItem, "partsUsed" | "partsCost">,
    value: string,
  ) => {
    if (!canModifySelectedTask) return;

    applyChangeOrConfirmStart(() => setExecutions((prev) => {
      const next = new Map(prev);
      const cur = next.get(taskId) || {
        done: false,
        items: [] as ExecutionItem[],
      };
      const items = cur.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      );
      next.set(taskId, { ...cur, items });
      return next;
    }));
  };

  const updateExecutionItemAttachments = (
    taskId: string,
    itemId: string,
    files: FileList | null,
  ) => {
    if (!canModifySelectedTask) return;

    const names = files ? Array.from(files).map((file) => file.name) : [];
    applyChangeOrConfirmStart(() => setExecutions((prev) => {
      const next = new Map(prev);
      const cur = next.get(taskId) || {
        done: false,
        items: [] as ExecutionItem[],
      };
      const items = cur.items.map((item) =>
        item.id === itemId ? { ...item, attachments: names } : item,
      );
      next.set(taskId, { ...cur, items });
      return next;
    }));
  };

  const handleStatusChange = (id: string, newStatus: ItemStatus) => {
    if (!selectedTask || !canModifySelectedTask) return;
    applyChangeOrConfirmStart(() => setChecklists((prev) => {
      const next = new Map(prev);
      const items = next.get(selectedTask.id);
      if (items) {
        const updatedItems = items.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item,
        );
        next.set(selectedTask.id, updatedItems);
        persistTaskStatus(
          selectedTask.id,
          deriveTaskStatus(selectedTask, updatedItems, currentExecution),
        );
      }
      return next;
    }));
  };

  const handleNoteChange = (id: string, note: string) => {
    if (!selectedTask || !canModifySelectedTask) return;
    applyChangeOrConfirmStart(() => setChecklists((prev) => {
      const next = new Map(prev);
      const items = next.get(selectedTask.id);
      if (items) {
        next.set(
          selectedTask.id,
          items.map((item) => (item.id === id ? { ...item, note } : item)),
        );
      }
      return next;
    }));
  };

  const getExecutionItemData = (itemId: string) => {
    if (!selectedTask) return null;
    const executionRecord = executions.get(selectedTask.id);
    if (!executionRecord) return null;
    return executionRecord.items.find((item) => item.id === itemId);
  };

  const failedCount = currentChecklist.filter(
    (item) => item.status === "fail",
  ).length;
  const pendingCount = currentChecklist.filter(
    (item) => item.status === "pending",
  ).length;
  const canComplete =
    canModifySelectedTask &&
    currentChecklist.length > 0 &&
    pendingCount === 0 &&
    currentExecution.done;
  const showCannotCompleteWarning =
    canMechanicStartTask && (pendingCount > 0 || !currentExecution.done);

  const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getNextRecurringDate = (completedAt: Date, intervalType?: MaintenanceIntervalType) => {
    const nextDate = new Date(completedAt);
    if (intervalType === MaintenanceIntervalType.DAILY) nextDate.setDate(nextDate.getDate() + 1);
    else if (intervalType === MaintenanceIntervalType.WEEKLY) nextDate.setDate(nextDate.getDate() + 7);
    else if (intervalType === MaintenanceIntervalType.MONTHLY) nextDate.setMonth(nextDate.getMonth() + 1);
    else if (intervalType === MaintenanceIntervalType.QUARTERLY) nextDate.setMonth(nextDate.getMonth() + 3);
    else if (intervalType === MaintenanceIntervalType.SEMI_ANNUALLY) nextDate.setMonth(nextDate.getMonth() + 6);
    else if (intervalType === MaintenanceIntervalType.ANNUALLY) nextDate.setFullYear(nextDate.getFullYear() + 1);
    else return null;
    return formatDateInput(nextDate);
  };

  const getLatestVehicleOdometer = async (task: MaintenanceTask) => {
    const vehicles = await getVehicles().catch(() => []);
    const vehicle = vehicles.find((item) => item.value === task.vehicleId);
    return vehicle?.odometer !== undefined
      ? String(vehicle.odometer)
      : task.odometerReading?.trim();
  };

  const createNextRecurringSchedule = async (completedTask: MaintenanceTask) => {
    if (completedTask.deletedAt) {
      return null;
    }

    if (completedTask.triggerType === MaintenanceTriggerType.MANUAL || !completedTask.triggerType) {
      return null;
    }

    const completedDate = new Date();
    const completedDateText = formatDateInput(completedDate);
    let nextSchedule: Omit<MaintenanceTask, "id">;

    if (completedTask.triggerType === MaintenanceTriggerType.ODOMETER) {
      const interval = Number(completedTask.intervalKm);
      if (!Number.isFinite(interval) || interval <= 0) return null;

      const latestOdometer = await getLatestVehicleOdometer(completedTask);
      if (!latestOdometer) return null;

      const duplicateExists = tasks.some(
        (task) =>
          task.id !== completedTask.id &&
          task.status !== MaintenanceStatus.COMPLETED &&
          task.vehicleId === completedTask.vehicleId &&
          task.title === completedTask.title &&
          task.triggerType === MaintenanceTriggerType.ODOMETER &&
          task.startingReferenceReadingKm === latestOdometer,
      );
      if (duplicateExists) return null;

      nextSchedule = {
        ...completedTask,
        status: MaintenanceStatus.PENDING,
        date: completedDateText,
        odometerReading: latestOdometer,
        startingReferenceReadingKm: latestOdometer,
      };
    } else {
      const nextDate = getNextRecurringDate(completedDate, completedTask.intervalType);
      if (!nextDate) return null;
      const latestOdometer = await getLatestVehicleOdometer(completedTask);

      const duplicateExists = tasks.some(
        (task) =>
          task.id !== completedTask.id &&
          task.status !== MaintenanceStatus.COMPLETED &&
          task.vehicleId === completedTask.vehicleId &&
          task.title === completedTask.title &&
          task.triggerType === MaintenanceTriggerType.TIME &&
          task.startReferenceDate === nextDate,
      );
      if (duplicateExists) return null;

      nextSchedule = {
        ...completedTask,
        status: MaintenanceStatus.PENDING,
        date: completedDateText,
        odometerReading: latestOdometer,
        startReferenceDate: nextDate,
      };
    }

    const created = await createMaintenanceSchedule(nextSchedule);
    setTasks((current) => [created, ...current]);
    return created;
  };

  const handleMarkComplete = async () => {
    if (!selectedTask || !canModifySelectedTask) return;

    const latestOdometer =
      selectedTask.triggerType === MaintenanceTriggerType.TIME
        ? await getLatestVehicleOdometer(selectedTask)
        : selectedTask.odometerReading;
    const completedTask = {
      ...selectedTask,
      status: MaintenanceStatus.COMPLETED,
      odometerReading: latestOdometer ?? selectedTask.odometerReading,
    };
    setTasks((prev) =>
      prev.map((t) => (t.id === selectedTask.id ? completedTask : t)),
    );
    // keep the task visible but update it to Completed
    setSelectedTask(completedTask);
    await updateWorkOrder(completedTask);
    return createNextRecurringSchedule(completedTask);
  };

  const setExecutionDone = (taskId: string, done: boolean) => {
    if (!canModifySelectedTask) return;

    applyChangeOrConfirmStart(() => setExecutions((prev) => {
      const next = new Map(prev);
      const cur = next.get(taskId) || { done: false, items: [] };
      const updatedExecution = { ...cur, done };
      next.set(taskId, updatedExecution);

      if (done && selectedTask) {
        const checklistItems = checklists.get(taskId) || [];
        persistTaskStatus(
          taskId,
          deriveTaskStatus(selectedTask, checklistItems, updatedExecution),
        );
      }

      return next;
    }));

    if (done) {
      setChecklists((prev) => {
        const next = new Map(prev);
        const checklistItems = next.get(taskId);
        const executionRecord = executions.get(taskId);
        if (checklistItems && executionRecord) {
          next.set(
            taskId,
            checklistItems.map((item) => {
              const execItem = executionRecord.items.find(
                (exec) => exec.id === item.id,
              );
              return execItem
                ? {
                    ...item,
                    partsUsed:
                      execItem.status === "changed"
                        ? execItem.partsUsed || item.partsUsed
                        : item.partsUsed,
                    note: item.note || execItem.note || "",
                  }
                : item;
            }),
          );
        }
        return next;
      });
    }
  };

  const confirmWorkOrderAction = async () => {
    if (!selectedTask) return;

    if (pendingWorkOrderAction === "executionComplete") {
      setExecutionDone(selectedTask.id, true);
      setToast({
        type: "success",
        message: "Execution checklist completed successfully.",
      });
    }

    if (pendingWorkOrderAction === "inspectionComplete") {
      try {
        const nextSchedule = await handleMarkComplete();
        setToast({
          type: "success",
          message: nextSchedule
            ? "Work order completed and the next recurring schedule was created."
            : "Work order completed successfully.",
        });
      } catch (error) {
        console.error("Failed to complete recurring work order", error);
        setToast({
          type: "warning",
          message: "Work order was completed, but the next recurring schedule could not be created.",
        });
      }
    }

    setPendingWorkOrderAction(null);
  };

  const updateExecutionField = (
    taskId: string,
    field: keyof Omit<ExecutionRecord, "done" | "items">,
    value: string | string[],
  ) => {
    if (!canModifySelectedTask) return;

    applyChangeOrConfirmStart(() => setExecutions((prev) => {
      const next = new Map(prev);
      const cur = next.get(taskId) || {
        done: false,
        items: [],
        attachments: [],
        remarks: "",
        technicianSignature: "",
      };
      // assign explicitly to avoid unsafe any usage
      if (field === "attachments") {
        (cur as ExecutionRecord).attachments = value as string[];
      } else if (field === "remarks") {
        (cur as ExecutionRecord).remarks = value as string;
      } else if (field === "technicianSignature") {
        (cur as ExecutionRecord).technicianSignature = value as string;
      }
      next.set(taskId, cur);
      return next;
    }));
  };

  return (
    <div className={containerClasses}>
      <div className="fixed right-6 top-6 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>

      <PageHeader
        icon={Wrench}
        title="WORK ORDERS"
        subtitle="Complete your assigned tasks and vehicle checklists"
      />

      {!selectedTask ? (
        <section className="overflow-visible">
          <div className={headerSectionClasses}>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {"Assigned Work Orders"}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {"Select a maintenance task to begin the inspection checklist."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-b border-[var(--color-divider)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput
              className="w-full max-w-xl"
                placeholder="Search vehicle, task, or mechanic..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            <div className="flex flex-wrap items-center gap-3">
              <FilterDropdown
                open={showFilters}
                onToggle={() => setShowFilters((current) => !current)}
                statuses={workOrderStatusOptions}
                selectedStatuses={selectedStatusFilters}
                onStatusChange={(statuses) => {
                  setSelectedStatusFilters(statuses);
                  setCurrentPage(1);
                }}
                dateFrom={dateFromFilter}
                dateTo={dateToFilter}
                onDateFromChange={(value) => {
                  setDateFromFilter(value);
                  setCurrentPage(1);
                }}
                onDateToChange={(value) => {
                  setDateToFilter(value);
                  setCurrentPage(1);
                }}
                onApply={() => setShowFilters(false)}
                onClear={() => {
                  setSelectedStatusFilters([]);
                  setDateFromFilter("");
                  setDateToFilter("");
                  setSortField("date");
                  setSortDirection("desc");
                  setCurrentPage(1);
                }}
              >
                <label className="block">
                  <span className="text-sm font-semibold uppercase text-black">
                    Sort By
                  </span>
                  <select
                    value={`${sortField}-${sortDirection}`}
                    onChange={(e) => {
                      const [field, direction] = e.target.value.split("-") as [
                        "date" | "workOrderId",
                        "asc" | "desc",
                      ];
                      setSortField(field);
                      setSortDirection(direction);
                      setCurrentPage(1);
                    }}
                    className="mt-2 h-10 w-full rounded-lg border border-[#cbd3df] bg-white px-3 text-sm font-semibold text-[#141827] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                  >
                    <option value="date-asc">
                      {"Date - Ascending"}
                    </option>
                    <option value="date-desc">
                      {"Date - Descending"}
                    </option>
                    <option value="workOrderId-asc">
                      {"Work Order ID - Ascending"}
                    </option>
                    <option value="workOrderId-desc">
                      {"Work Order ID - Descending"}
                    </option>
                  </select>
                </label>
              </FilterDropdown>
            </div>
          </div>

          <DataTable
            data={paginatedTasks}
            getRowKey={(task) => task.id}
            minWidth="900px"
            density="compact"
            emptyMessage="No active work orders found."
            onRowClick={handleSelectTask}
            columns={[
              {
                key: "workOrder",
                header: "Work Order NO.",
                width: "11%",
                render: (task) => formatWorkOrderNumber(task.id),
              },
              {
                key: "plate no",
                header: "Plate No.",
                width: "9%",
                render: (task) => getVehiclePlateNumber(task.vehicleId),
              },
              {
                key: "type",
                header: "Maintenance Type",
                width: "18%",
                render: (task) => task.title,
              },
              {
                key: "mechanic",
                header: "Mechanic",
                width: "13%",
                render: (task) => task.assignedDriver,
              },
              {
                key: "created",
                header: "Date Created",
                width: "11%",
                render: (task) => task.date,
              },
              {
                key: "status",
                header: "Status",
                width: "17%",
                render: (task) => <StatusBadge status={task.status} />,
              },
              {
                key: "actions",
                header: "Actions",
                width: "9%",
                align: "center",
                render: (task) => (
                  <ActionMenu
                    open={openActionMenuId === task.id}
                    onToggle={(event) => {
                      event.stopPropagation();
                      setOpenActionMenuId((current) =>
                        current === task.id ? null : task.id,
                      );
                    }}
                    onView={() => {
                      setOpenActionMenuId(null);
                      handleSelectTask(task);
                    }}
                  />
                ),
              },
            ]}
          />
          {activeTasks.length > 0 ? (
            <div className="px-6">
              <Pagination
                page={activePage}
                totalPages={totalPages}
                totalItems={activeTasks.length}
                pageSize={workOrdersPerPage}
                pageSizeOptions={[5, 8, 10, 15, 20]}
                onPageChange={setCurrentPage}
                onPageSizeChange={(pageSize) => {
                  setWorkOrdersPerPage(pageSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <div
          ref={detailRef}
          className={detailViewClasses}
        >
          {/* Back Button */}
          <button
            onClick={() => {
              setSelectedTask(null);
              setWorkOrderStep(1);
            }}
            className={backButtonClasses}
          >
            <ChevronLeft size={16} />
            Back to Assigned Orders
          </button>

          {!isMechanic && (
            <div className="mb-6 flex justify-end">
              <ActionButton
                onClick={exportPdf}
                variant="primary"
              >
                <FileDown size={18} />
                Export to PDF
              </ActionButton>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#070b45] bg-[#eef2ff] px-4 py-3 text-[#070b45]">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-bold uppercase tracking-wide">
              Using Template
            </span>
            <span className="text-sm font-semibold">{selectedTask.title}</span>
          </div>

          {isMechanic && (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-1">
              {[
                { step: 1, label: "Details + Execution" },
                { step: 2, label: "Parts, Cost + Photos" },
                { step: 3, label: "Inspection" },
              ].map((item) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setWorkOrderStep(item.step)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    workOrderStep === item.step
                      ? "bg-[var(--color-brand-primary)] text-white shadow-card"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {(!isMechanic || workOrderStep === 1) && renderScheduleDetails(selectedTask)}

          {!canMechanicStartTask && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 shadow-card">
              <AlertTriangle
                className="mt-0.5 text-amber-500"
                size={20}
              />
              <div>
                <h3 className="font-semibold text-amber-700">
                  {"Work order cannot be started yet"}
                </h3>
                <p className="mt-1 text-sm text-amber-700/80">
                  {getStartLockMessage(selectedTask)}
                </p>
              </div>
            </div>
          )}

          {/* Execution Checklist - same format as inspection checklist */}
          {selectedTask && (!isMechanic || workOrderStep === 1) && (
            <>
              <div
                className={`mb-4 overflow-hidden rounded-xl px-6 py-4 ${
                  !canMechanicStartTask
                    ? "border border-amber-500/30 bg-amber-500/10 shadow-card"
                    : !currentExecution.done
                    ? "border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/10 shadow-card"
                    : "border border-[var(--color-status-success)]/30 bg-[var(--color-status-success)]/10 shadow-card"
                }`}
              >
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  <div className="flex items-center">
                    <span>Execution Checklist</span>
                    <span
                      className={`ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        !canMechanicStartTask
                          ? "border border-amber-500/30 bg-amber-500/10 text-amber-700"
                          : !currentExecution.done
                          ? "border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]"
                          : "border border-[var(--color-status-success)]/30 bg-[var(--color-status-success)]/10 text-[#047857]"
                      }`}
                    >
                      {!canMechanicStartTask
                        ? "Locked"
                        : !currentExecution.done
                          ? "Enabled"
                          : "Completed"}
                    </span>
                  </div>
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {canMechanicStartTask
                    ? "Mechanics must select Checked, Changed, or Not Checked for each execution item before completing execution."
                    : "This checklist is read-only until the schedule reaches its active stage."}
                </p>
              </div>

                  <div className={executionTableClasses}>
                    <div className={tableHeaderClasses}>
                      <div>Execution Item</div>
                      <div className="text-center">Checked</div>
                      <div className="text-center">Changed</div>
                      <div className="text-center">Not Checked</div>
                      <div>Note</div>
                      <div className="text-center">Status</div>
                    </div>
                    <div className="divide-y divide-[var(--color-divider)]">
                      {currentExecution.items.map((item) => (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[minmax(12rem,1fr)_64px_64px_88px_minmax(10rem,1.1fr)_88px] items-center gap-2 px-3 py-2.5 transition-colors duration-200 ${
                            item.status === "notChecked"
                              ? "bg-amber-500/10"
                              : item.status === "changed"
                                ? "bg-sky-500/10"
                                : item.status === "checked"
                                  ? "bg-emerald-500/10"
                                  : "hover:bg-[var(--color-card-bg-hover)]"
                          }`}
                        >
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">
                            {item.text}
                          </div>

                          <div className="flex justify-center">
                            <button
                              disabled={!canModifySelectedTask || currentExecution.done || !canMechanicStartTask}
                              onClick={() =>
                                updateExecutionItemStatus(
                                  selectedTask.id,
                                  item.id,
                                  "checked",
                                )
                              }
                              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all duration-200 ${
                                item.status === "checked"
                                  ? "border-emerald-400 bg-emerald-400/20"
                                  : "border-[var(--color-border)] hover:border-emerald-500/60"
                              } ${!canModifySelectedTask || currentExecution.done || !canMechanicStartTask ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              {item.status === "checked" && (
                                <span className="h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.16)]" />
                              )}
                            </button>
                          </div>

                          <div className="flex justify-center">
                            <button
                              disabled={!canModifySelectedTask || currentExecution.done || !canMechanicStartTask}
                              onClick={() =>
                                updateExecutionItemStatus(
                                  selectedTask.id,
                                  item.id,
                                  "changed",
                                )
                              }
                              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all duration-200 ${
                                item.status === "changed"
                                  ? "border-sky-400 bg-sky-400/20"
                                  : "border-[var(--color-border)] hover:border-sky-500/60"
                              } ${!canModifySelectedTask || currentExecution.done || !canMechanicStartTask ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              {item.status === "changed" && (
                                <span className="h-3.5 w-3.5 rounded-full bg-sky-400 shadow-[0_0_0_4px_rgba(56,189,248,0.16)]" />
                              )}
                            </button>
                          </div>

                          <div className="flex justify-center">
                            <button
                              disabled={!canModifySelectedTask || currentExecution.done || !canMechanicStartTask}
                              onClick={() =>
                                updateExecutionItemStatus(
                                  selectedTask.id,
                                  item.id,
                                  "notChecked",
                                )
                              }
                              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all duration-200 ${
                                item.status === "notChecked"
                                  ? "border-amber-400 bg-amber-400/20"
                                  : "border-[var(--color-border)] hover:border-amber-500/60"
                              } ${!canModifySelectedTask || currentExecution.done || !canMechanicStartTask ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              {item.status === "notChecked" && (
                                <span className="h-3.5 w-3.5 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]" />
                              )}
                            </button>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={item.note}
                              disabled={!canModifySelectedTask || currentExecution.done || !canMechanicStartTask}
                              onChange={(e) =>
                                updateExecutionItemNote(
                                  selectedTask.id,
                                  item.id,
                                  e.target.value,
                                )
                              }
                              placeholder="Add note"
                              className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:bg-[var(--color-input-bg-hover)] text-[var(--color-text-primary)] ${!canModifySelectedTask || currentExecution.done || !canMechanicStartTask ? "opacity-70" : ""}`}
                            />
                          </div>

                          <div className="flex justify-center">
                            {item.status === "checked" && (
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                                Checked
                              </span>
                            )}
                            {item.status === "changed" && (
                              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700">
                                Changed
                              </span>
                            )}
                            {item.status === "notChecked" && (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
                                Not Checked
                              </span>
                            )}
                            {item.status === "pending" && (
                              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 px-6 pb-6">
                      <div>
                        <label className="block text-xs text-[var(--color-text-secondary)]">
                          Chief Mechanic
                        </label>
                        <input
                          type="text"
                          value={currentExecution.technicianSignature || ""}
                          disabled={!canModifySelectedTask || currentExecution.done || !canMechanicStartTask}
                          onChange={(e) =>
                            updateExecutionField(
                              selectedTask.id,
                              "technicianSignature",
                              e.target.value,
                            )
                          }
                          className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] ${!canModifySelectedTask || currentExecution.done || !canMechanicStartTask ? "opacity-70" : ""}`}
                          placeholder="Chief Mechanic name"
                        />
                      </div>
                    </div>

                    {isMechanic && canMechanicStartTask && !canCompleteExecution && !currentExecution.done && (
                      <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-5 py-4 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                        <AlertTriangle
                          className="mt-0.5 text-rose-400"
                          size={20}
                        />
                        <div>
                          <h3 className="font-semibold text-rose-700">
                            {"Cannot complete execution"}
                          </h3>
                          <p className="mt-1 text-sm text-rose-700/80">
                            {executionPendingCount > 0
                              ? `${executionPendingCount} item(s) still need proof of check/change. `
                              : ""}
                            {!currentExecution.technicianSignature?.trim()
                              ? "Chief Mechanic name is required before execution can be completed."
                              : ""}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Execution actions moved below the table to match inspection checklist */}
                  </div>
                  {/* Execution actions */}
                  {isMechanic && !currentExecution.done ? (
                    <div className="mt-4 border-t border-[var(--color-divider)] px-6 py-4">
                      <ActionButton
                        className="w-full"
                        variant="primary"
                        disabled={!canCompleteExecution || !canMechanicStartTask}
                        onClick={() => setPendingWorkOrderAction("executionComplete")}
                      >
                        Mark Execution Complete
                      </ActionButton>
                    </div>
                  ) : isMechanic ? (
                    <div className="mt-4 border-t border-[var(--color-divider)] px-6 py-4">
                      <p className="text-sm text-emerald-700">
                        Execution checklist completed. The section remains visible for review until the work order is fully closed.
                      </p>
                    </div>
                  ) : null}
            </>
          )}

          {selectedTask && (!isMechanic || workOrderStep === 2) && (
            <div className="mb-6 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card">
              <div className="border-b border-[var(--color-divider)] px-6 py-4">
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  Parts Used, Cost, and Photos
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Labor, materials, uploads, and supporting documentation for this work order.
                </p>
              </div>

              <div className="divide-y divide-[var(--color-divider)]">
                {currentExecution.items.map((item) => (
                  <div key={item.id} className="grid gap-4 px-6 py-4 lg:grid-cols-[1.2fr_1fr_160px_1.2fr]">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {item.text}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                        {item.status === "changed" ? "Changed item" : "No part change recorded"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
                        Parts Used
                      </label>
                      <input
                        type="text"
                        value={item.partsUsed || ""}
                        disabled={!canModifySelectedTask || item.status !== "changed"}
                        onChange={(event) =>
                          updateExecutionItemField(
                            selectedTask.id,
                            item.id,
                            "partsUsed",
                            event.target.value,
                          )
                        }
                        placeholder={item.status === "changed" ? "Part(s) used" : "Not applicable"}
                        className={`mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] ${!canModifySelectedTask || item.status !== "changed" ? "cursor-not-allowed opacity-70" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
                        Material Cost
                      </label>
                      <input
                        type="text"
                        value={item.partsCost || ""}
                        disabled={!canModifySelectedTask || item.status !== "changed"}
                        onChange={(event) =>
                          updateExecutionItemField(
                            selectedTask.id,
                            item.id,
                            "partsCost",
                            event.target.value,
                          )
                        }
                        placeholder="0.00"
                        className={`mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] ${!canModifySelectedTask || item.status !== "changed" ? "cursor-not-allowed opacity-70" : ""}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
                        Photos / Attachments
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={!canModifySelectedTask || item.status !== "changed"}
                        onChange={(event) =>
                          updateExecutionItemAttachments(
                            selectedTask.id,
                            item.id,
                            event.target.files,
                          )
                        }
                        className={`mt-1 w-full text-xs text-[var(--color-text-secondary)] ${!canModifySelectedTask || item.status !== "changed" ? "cursor-not-allowed opacity-60" : ""}`}
                      />
                      {item.attachments && item.attachments.length > 0 ? (
                        <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                          {item.attachments.join(", ")}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                          No supporting documentation uploaded.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 border-t border-[var(--color-divider)] bg-[var(--color-input-bg)] px-6 py-4 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Material Cost
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
                    {formatCurrency(materialCostTotal)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Total Cost
                  </p>
                  <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
                    {formatCurrency(workOrderCostTotal)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Checklist Table - gated by execution */}
          {(!isMechanic || workOrderStep === 3) && (
            <>
          <div
            className={`mb-4 rounded-xl px-6 py-4 ${
              currentExecution.done
                ? "border border-emerald-500/30 bg-emerald-500/10 shadow-card"
                : "border border-amber-500/30 bg-amber-500/10 shadow-card"
            }`}
          >
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              <div className="flex items-center">
                <span>Inspection Checklist</span>
                <span
                  className={`ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    !canMechanicStartTask
                      ? "border border-amber-500/30 bg-amber-500/10 text-amber-700"
                      : currentExecution.done
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                      : "border border-amber-500/30 bg-amber-500/10 text-amber-700"
                  }`}
                >
                  {!canMechanicStartTask
                    ? "Locked"
                    : !isMechanic
                      ? "Review"
                      : currentExecution.done
                      ? "Enabled"
                      : "Disabled"}
                </span>
              </div>
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {!isMechanic
                ? "Review inspection results and remarks in read-only mode."
                : canMechanicStartTask
                ? "Complete the inspection for each item after execution is finished."
                : "This checklist is read-only until the schedule reaches its active stage."}
            </p>
          </div>
          <div
            className={`overflow-auto overscroll-contain rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] lg:max-h-[min(40rem,calc(100vh-12rem))] ${isMechanic && (!currentExecution.done || !canMechanicStartTask) ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className={checklistHeaderClasses}>
              <div>{"Checklist Item"}</div>
              <div className="text-center">{"Pass"}</div>
              <div className="text-center">{"Fail"}</div>
              <div>{"Note"}</div>
              <div className="text-center">{"Status"}</div>
            </div>

            <div className="divide-y divide-[var(--color-divider)]">
              {currentChecklist.map((item) => {
                const executionData = getExecutionItemData(item.id);
                const displayNote = item.note || (currentExecution.done ? executionData?.note || "" : "");
                
                return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[minmax(12rem,1fr)_64px_64px_minmax(10rem,1fr)_88px] items-center gap-2 px-3 py-2.5 transition-colors duration-200 ${
                    item.status === "fail"
                      ? "bg-rose-500/10"
                      : "hover:bg-[var(--color-card-bg)]/80"
                  }`}
                >
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">
                    {item.text}
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => handleStatusChange(item.id, "pass")}
                      disabled={!canModifySelectedTask}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all duration-200 ${
                        item.status === "pass"
                          ? "border-emerald-400 bg-emerald-400/20"
                          : "border-[var(--color-border)] hover:border-emerald-500/60"
                      } ${!canModifySelectedTask ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {item.status === "pass" && (
                        <span className="h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.16)]" />
                      )}
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => handleStatusChange(item.id, "fail")}
                      disabled={!canModifySelectedTask}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-sm transition-all duration-200 ${
                        item.status === "fail"
                          ? "border-rose-400 bg-rose-400/20"
                          : "border-[var(--color-border)] hover:border-rose-500/60"
                      } ${!canModifySelectedTask ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {item.status === "fail" && (
                        <span className="h-3.5 w-3.5 rounded-full bg-rose-400 shadow-[0_0_0_4px_rgba(251,113,133,0.18)]" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={displayNote}
                      disabled={!canModifySelectedTask}
                      onChange={(e) =>
                        handleNoteChange(item.id, e.target.value)
                      }
                      placeholder="Add inspection note"
                      className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:bg-[var(--color-input-bg-hover)] ${
                        item.status === "fail"
                          ? "text-rose-700 placeholder:text-rose-500/60"
                          : "text-[var(--color-text-primary)]"
                      } ${!canModifySelectedTask ? "cursor-not-allowed opacity-50" : ""}`}
                    />
                    {item.status === "fail" && (
                      <span className="text-xs font-semibold text-rose-700">
                        ⚠️ Recommended for repair
                      </span>
                    )}
                  </div>

                  <div className="flex justify-center">
                    {item.status === "pass" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                        {"Pass"}
                      </span>
                    )}
                    {item.status === "fail" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-700">
                        {"Fail"}
                      </span>
                    )}
                    {item.status === "pending" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        {"Pending"}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Inspector Remarks
              </label>
              <textarea
                value={currentExecution.remarks || ""}
                disabled={!canModifySelectedTask}
                onChange={(event) =>
                  updateExecutionField(
                    selectedTask.id,
                    "remarks",
                    event.target.value,
                  )
                }
                placeholder="Add inspection remarks"
                className={`mt-2 min-h-24 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] ${!canModifySelectedTask ? "cursor-not-allowed opacity-70" : ""}`}
              />
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Inspection Results
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                  {failedCount > 0
                    ? `${failedCount} item(s) flagged for verification`
                    : pendingCount > 0
                      ? `${pendingCount} item(s) pending`
                      : "Inspection passed"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Approval / Verification
                </p>
                <p className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">
                  {selectedTask.status === MaintenanceStatus.COMPLETED
                    ? "Verified and completed"
                    : canComplete
                      ? "Ready for completion"
                      : "Pending verification"}
                </p>
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          {isMechanic && workOrderStep === 3 && showCannotCompleteWarning && (
            <div className={warningBannerClasses}>
              <AlertTriangle className="mt-0.5 text-rose-400" size={20} />
              <div>
                <h3 className="font-semibold text-rose-700">
                  {"Cannot mark as Complete"}
                </h3>
                <p className="mt-1 text-sm text-rose-700/80">
                  {pendingCount > 0 ? `${pendingCount} item(s) pending. ` : ""}
                  {!currentExecution.done ? "Execution not completed. " : ""}
                  Resolve all before closing.
                </p>
              </div>
            </div>
          )}

          {isMechanic && workOrderStep === 3 && failedCount > 0 && canComplete && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-700 shadow-card">
              {`${failedCount} item(s) failed. You can still mark the inspection complete.`}
            </div>
          )}
            </>
          )}

          {isMechanic && (
            <div className="mt-8 flex flex-col gap-3 border-t border-[var(--color-divider)] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <ActionButton
                type="button"
                onClick={() => setWorkOrderStep((step) => Math.max(1, step - 1))}
                disabled={workOrderStep === 1}
                variant="secondary"
              >
                Previous
              </ActionButton>

              <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                Page {workOrderStep} of 3
              </span>

              {workOrderStep < 3 ? (
                <ActionButton
                  type="button"
                  onClick={() => setWorkOrderStep((step) => Math.min(3, step + 1))}
                  variant="primary"
                >
                  Next
                </ActionButton>
              ) : selectedTask?.status === MaintenanceStatus.COMPLETED ? (
                <button
                  className="no-print flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-[0_0_10px_rgba(52,211,153,0.12)]"
                  disabled
                >
                  Completed
                </button>
              ) : (
                <ActionButton
                  variant="primary"
                  disabled={!canComplete}
                  onClick={() => setPendingWorkOrderAction("inspectionComplete")}
                >
                  {"Mark Inspection Complete"}
                </ActionButton>
              )}
            </div>
          )}
        </div>
      )}
      <ConfirmationModal
        isOpen={Boolean(pendingStartChange)}
        title="Start Work Order"
        variant="primary"
        message="Making this change will start the work order and set its status to In Progress. Do you want to continue?"
        confirmLabel="Start Work Order"
        onConfirm={confirmStartWorkOrder}
        onCancel={() => setPendingStartChange(null)}
      />
      <ConfirmationModal
        isOpen={Boolean(pendingWorkOrderAction)}
        variant="primary"
        message={
          pendingWorkOrderAction === "executionComplete"
            ? "Are you sure you want to mark this execution checklist complete?"
            : "Are you sure you want to mark this inspection complete?"
        }
        confirmLabel="Yes"
        onConfirm={confirmWorkOrderAction}
        onCancel={() => setPendingWorkOrderAction(null)}
      />
    </div>
  );
}

