import { useEffect, useState, useRef } from "react";
import {
  Wrench,
  FileDown,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  Calendar as CalendarIcon,
  Truck,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { Card } from "../../components/ui";
import {
  type MaintenanceTask,
  type MaintenanceStatus,
} from "../../types/maintenance";
import {
  defaultChecklistTemplates,
  type WorkOrderTemplate,
} from "../../data/ChecklistData";
import {
  getWorkOrders,
  updateWorkOrder,
} from "../../lib/api/maintenanceService";
import { getCurrentUser, type UserRecord } from "../../lib/api/authService";
import { getGarages } from "../../lib/api/locationService";
import { isMechanicRole } from "../../lib/utils/permissions";
import { formatWorkOrderNumber } from "../../lib/utils/workOrders";

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

// Helper to get templates from local storage or default
const getTemplates = () => {
  const saved = localStorage.getItem("checklistTemplates");
  if (saved) return JSON.parse(saved);
  return defaultChecklistTemplates;
};

// Layout & interaction classes
const containerClasses = 'space-y-6';
const listViewClasses = 'overflow-hidden';
const headerSectionClasses = 'flex flex-col gap-4 border-b border-[var(--color-divider)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between';
const filtersGridClasses = 'grid gap-4 border-b border-[var(--color-divider)] px-6 py-5 md:grid-cols-5';
const searchInputClasses = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-hidden';
const selectInputClasses = 'w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-hidden';
const sortButtonClasses = 'flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-input-bg-hover)] hover:text-[var(--color-text-primary)] dark:hover:bg-slate-700 dark:hover:text-white';
const taskGridClasses = 'grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3';
const taskCardClasses = 'group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card transition-all hover:-translate-y-1 hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-card-bg-hover)] hover:shadow-[0_10px_28px_rgba(15,23,42,0.12)] dark:hover:border-[var(--color-brand-primary)] dark:hover:bg-[var(--color-card-bg-hover)] dark:hover:shadow-[0_14px_32px_rgba(26,31,110,0.18)]';
const emptyStateClasses = 'col-span-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-8 text-center shadow-card';
const detailViewClasses = 'rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-xl backdrop-blur-sm transition-all';
const backButtonClasses = 'mb-6 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-brand-primary)] dark:hover:text-[var(--color-brand-primary)]';
const executionTableClasses = 'mb-6 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)]';
const tableHeaderClasses = 'grid grid-cols-[1fr_80px_80px_100px_1.2fr_100px_100px_140px_100px] items-center gap-4 border-b border-[var(--color-divider)] bg-[var(--color-card-bg)] px-6 py-3 text-sm font-semibold text-[var(--color-text-secondary)]';
const checklistHeaderClasses = 'grid grid-cols-[1fr_80px_80px_1fr_1fr_100px] items-center gap-4 border-b border-[var(--color-divider)] bg-[var(--color-card-bg)] px-6 py-3 text-sm font-semibold text-[var(--color-text-secondary)]';
const warningBannerClasses = 'mt-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-5 py-4 shadow-[0_0_15px_rgba(244,63,94,0.06)]';
const actionButtonClasses = 'no-print flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)] dark:hover:bg-[var(--color-card-bg-hover)] dark:hover:text-[var(--color-text-primary)] dark:hover:border-[var(--color-brand-primary)]';
const completeButtonClasses = 'no-print flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition-all duration-300';

export default function WorkOrders() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [garages, setGarages] = useState<{ id: string; name: string }[]>([]);

  const initialProgress = loadWorkOrderProgress();
  const isMechanic = isMechanicRole(currentUser);

  useEffect(() => {
    const loadWorkOrders = () => {
      getWorkOrders()
        .then((loadedTasks) => {
          setTasks(loadedTasks);
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
    getGarages().then(setGarages).catch(() => setGarages([]));
    getCurrentUser().then(setCurrentUser).catch(() => setCurrentUser(null));

    window.addEventListener("focus", loadWorkOrders);
    return () => window.removeEventListener("focus", loadWorkOrders);
  }, []);

  // State for checklists could be a Map keyed by task ID to prevent prototype pollution.
  const [checklists, setChecklists] = useState<Map<string, ChecklistItem[]>>(
    () => new Map(Object.entries(initialProgress.checklists || {})),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortField, setSortField] = useState<"date" | "workOrderId">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const normalizeText = (value?: string | null) =>
    value?.trim().toLowerCase() ?? "";

  const isAssignedToCurrentMechanic = (task: MaintenanceTask) => {
    if (!isMechanic || !currentUser) return true;

    const currentNames = [currentUser.name, currentUser.username]
      .map(normalizeText)
      .filter(Boolean);

    const assignedNames = [task.assignedDriver]
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
    (task) => task.status !== "Completed" && isAssignedToCurrentMechanic(task),
  );

  if (statusFilter !== "All") {
    activeTasks = activeTasks.filter((t) => t.status === statusFilter);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    activeTasks = activeTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.vehicleId.toLowerCase().includes(query) ||
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

  const handleSelectTask = (task: MaintenanceTask) => {
    setSelectedTask(task);
    if (!checklists.has(task.id)) {
      setChecklists((prev) => {
        const next = new Map(prev);

        // Find the template based on task.title
        const allTemplates = getTemplates();
        const taskType = task.title as WorkOrderTemplate;
        const templateItems: ChecklistItemTemplate[] =
          allTemplates[taskType] || allTemplates["General Inspection"] || [];

        // Convert to WorkOrder ChecklistItems
        const checklistItems: ChecklistItem[] = templateItems.map((item) => ({
          id: item.id,
          text: item.text,
          status: "pending",
          note: "",
          partsUsed: "",
        }));

        next.set(task.id, checklistItems);
        return next;
      });
    }
    if (!executions.has(task.id)) {
      setExecutions((prev) => {
        const next = new Map(prev);
        const allTemplates = getTemplates();
        const taskType = task.title as WorkOrderTemplate;
        const templateItems: ChecklistItemTemplate[] =
          allTemplates[taskType] || allTemplates["General Inspection"] || [];

        const executionItems: ExecutionItem[] = templateItems.map((item) => ({
          id: item.id,
          text: item.text,
          status: "pending",
          note: "",
          attachments: [],
        }));

        next.set(task.id, {
          done: false,
          items: executionItems,
          attachments: [],
          remarks: "",
          technicianSignature: "",
        });
        return next;
      });
    }
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

  const deriveTaskStatus = (
    task: MaintenanceTask,
    checklist: ChecklistItem[],
    execution: ExecutionRecord,
  ): MaintenanceStatus => {
    if (task.status === "Completed") return "Completed";
    if (checklist.some((item) => item.status === "fail")) return "Flagged";
    if (task.status === "Overdue") return "Overdue";
    if (
      execution.items.some((item) => item.status !== "pending") ||
      checklist.some((item) => item.status !== "pending")
    ) {
      return "In-Progress";
    }
    return task.status === "In-Progress" ? "In-Progress" : "Pending";
  };

  const persistTaskStatus = (
    taskId: string,
    status: MaintenanceStatus,
  ) => {
    const task = tasks.find((task) => task.id === taskId);
    if (!task || task.status === status || task.status === "Completed") return;

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
    return triggerType === "ODOMETER"
      ? "Odometer"
      : triggerType === "TIME"
      ? "Time"
      : triggerType === "MANUAL"
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
      { label: "Vehicle", value: task.vehicleId },
      { label: "Work Order Template", value: task.title },
      { label: "Assigned Mechanic", value: task.assignedDriver },
      { label: "Scheduled Date", value: task.date },
      { label: "Garage / Cluster", value: getGarageName(task.garageId) },
      { label: "Account Type", value: task.accountType },
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
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
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
            ? `<span style="color:#166534;font-weight:700">Checked</span>`
            : it.status === "changed"
              ? `<span style="color:#075985;font-weight:700">Changed</span>`
              : it.status === "notChecked"
                ? `<span style="color:#92400e;font-weight:700">Not Checked</span>`
                : `<span style="color:#374151;font-weight:700">Pending</span>`;
        return `
          <tr>
            <td style="padding:8px;border:1px solid #e6e9ef">${it.text}</td>
            <td style="padding:8px;border:1px solid #e6e9ef">${statusLabel}</td>
            <td style="padding:8px;border:1px solid #e6e9ef">${(it.note || "").replace(/</g, "&lt;")}</td>
            <td style="padding:8px;border:1px solid #e6e9ef">${it.partsUsed || ""}</td>
            <td style="padding:8px;border:1px solid #e6e9ef;text-align:right">${it.partsCost || ""}</td>
          </tr>`;
      })
      .join("");

    const checklistRows = (currentChecklist || [])
      .map((it) => {
        const label =
          it.status === "pass"
            ? `<span style="background:#16a34a;color:#fff;padding:4px 8px;border-radius:999px;font-weight:700">Pass</span>`
            : it.status === "fail"
              ? `<span style="background:#ef4444;color:#fff;padding:4px 8px;border-radius:999px;font-weight:700">Fail</span>`
              : `<span style="background:#6b7280;color:#fff;padding:4px 8px;border-radius:999px;font-weight:700">Pending</span>`;
        return `
          <tr>
            <td style="padding:8px;border:1px solid #e6e9ef">${it.text}</td>
            <td style="padding:8px;border:1px solid #e6e9ef;text-align:center">${label}</td>
            <td style="padding:8px;border:1px solid #e6e9ef">${(it.note || "").replace(/</g, "&lt;")}</td>
          </tr>`;
      })
      .join("");

    const execStatus = currentExecution.done
      ? badge("Execution Completed", "#10b981")
      : badge("Execution Pending", "#ef4444");

    const scheduleRows = [
      { label: "Vehicle", value: selectedTask.vehicleId },
      { label: "Work Order Template", value: selectedTask.title },
      { label: "Assigned Mechanic", value: selectedTask.assignedDriver },
      { label: "Scheduled Date", value: selectedTask.date },
      {
        label: "Garage / Cluster",
        value: getGarageName(selectedTask.garageId),
      },
      { label: "Account Type", value: selectedTask.accountType },
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

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Work Order - ${selectedTask.title}</title>
          <style>
            body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:24px}
            h1,h2{margin:0 0 8px 0}
            .muted{color:#6b7280}
            table{border-collapse:collapse;width:100%;margin-top:12px}
            th{background:#f3f4f6;text-align:left;padding:8px;border:1px solid #e6e9ef}
            td{padding:8px;border:1px solid #e6e9ef}
            .section{margin-top:18px}
          </style>
        </head>
        <body>
          <h1>${selectedTask.vehicleId} — ${selectedTask.title}</h1>
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
                </tr>
              </thead>
              <tbody>
                ${execRows || `<tr><td colspan=5 style="padding:12px;text-align:center;color:#6b7280">No execution items</td></tr>`}
              </tbody>
            </table>
          </div>

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
                ${checklistRows || `<tr><td colspan=3 style="padding:12px;text-align:center;color:#6b7280">No checklist items</td></tr>`}
              </tbody>
            </table>
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

  const updateExecutionItemStatus = (
    taskId: string,
    itemId: string,
    status: ExecutionStatus,
  ) => {
    setExecutions((prev) => {
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
    });
  };

  const updateExecutionItemNote = (
    taskId: string,
    itemId: string,
    note: string,
  ) => {
    setExecutions((prev) => {
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
    });
  };

  const updateExecutionItemField = (
    taskId: string,
    itemId: string,
    field: keyof Pick<ExecutionItem, "partsUsed" | "partsCost">,
    value: string,
  ) => {
    setExecutions((prev) => {
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
    });
  };

  const updateExecutionItemAttachments = (
    taskId: string,
    itemId: string,
    files: FileList | null,
  ) => {
    const names = files ? Array.from(files).map((file) => file.name) : [];
    setExecutions((prev) => {
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
    });
  };

  const handleStatusChange = (id: string, newStatus: ItemStatus) => {
    if (!selectedTask || selectedTask.status === "Completed") return;
    setChecklists((prev) => {
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
    });
  };

  const handleNoteChange = (id: string, note: string) => {
    if (!selectedTask || selectedTask.status === "Completed") return;
    setChecklists((prev) => {
      const next = new Map(prev);
      const items = next.get(selectedTask.id);
      if (items) {
        next.set(
          selectedTask.id,
          items.map((item) => (item.id === id ? { ...item, note } : item)),
        );
      }
      return next;
    });
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
    currentChecklist.length > 0 &&
    pendingCount === 0 &&
    currentExecution.done;
  const showCannotCompleteWarning = pendingCount > 0 || !currentExecution.done;

  const handleMarkComplete = () => {
    if (!selectedTask) return;

    const completedTask = { ...selectedTask, status: "Completed" as const };
    setTasks((prev) =>
      prev.map((t) => (t.id === selectedTask.id ? completedTask : t)),
    );
    updateWorkOrder(completedTask).catch(() => {
      // ignore service failure, keep local state
    });
    // keep the task visible but update it to Completed
    setSelectedTask(completedTask);
  };

  const setExecutionDone = (taskId: string, done: boolean) => {
    setExecutions((prev) => {
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
    });

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

  const updateExecutionField = (
    taskId: string,
    field: keyof Omit<ExecutionRecord, "done" | "items">,
    value: string | string[],
  ) => {
    setExecutions((prev) => {
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
    });
  };

  return (
    <div className={containerClasses}>
      <PageHeader
        icon={Wrench}
        title="Work Orders"
        subtitle="Complete your assigned tasks and vehicle checklists"
      />

      {!selectedTask ? (
        <Card padding="none" className={listViewClasses}>
          <div className={headerSectionClasses}>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {"Assigned Work Orders"}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {"Select a maintenance task to begin the inspection checklist."}
              </p>
            </div>
          </div>

          <div className={filtersGridClasses}>
            <div className="relative col-span-2 md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <input
                type="text"
                placeholder="Search vehicle, task, or mechanic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={searchInputClasses}
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectInputClasses}
              >
                <option value="All" className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
                  {"All Statuses"}
                </option>
                <option value="Pending" className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
                  {"Pending"}
                </option>
                <option
                  value="In-Progress"
                  className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                >
                  {"In-Progress"}
                </option>
                <option value="Flagged" className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
                  {"Flagged"}
                </option>
                <option value="Overdue" className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
                  {"Overdue"}
                </option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as "date" | "workOrderId")}
                className={selectInputClasses}
              >
                <option value="date" className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
                  {"Sort by Date"}
                </option>
                <option value="workOrderId" className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
                  {"Sort by Work Order ID"}
                </option>
              </select>
            </div>

            <button
              onClick={() =>
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
              }
              className={sortButtonClasses}
            >
              {sortDirection === "asc" ? (
                <ArrowUp size={16} />
              ) : (
                <ArrowDown size={16} />
              )}
              {sortField === "workOrderId" ? "Work Order ID" : "Date"} {sortDirection === "asc" ? "Ascending" : "Descending"}
            </button>
          </div>

          <div className={taskGridClasses}>
            {activeTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className={taskCardClasses}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {formatWorkOrderNumber(task.id)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      <Truck size={14} />
                      {task.vehicleId}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      task.status === "Overdue"
                        ? "bg-rose-500/10 text-rose-700 border border-rose-500/30 dark:text-rose-200"
                        : task.status === "Flagged"
                          ? "bg-amber-500/10 text-amber-800 border border-amber-500/30 dark:text-amber-200"
                          : task.status === "In-Progress"
                            ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 dark:text-emerald-200"
                            : "bg-sky-500/10 text-sky-700 border border-sky-500/30 dark:text-sky-200"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>

                <h3 className="mb-2 text-lg font-bold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-brand-primary)] dark:group-hover:text-[var(--color-brand-primary)]">
                  {task.title}
                </h3>
                {task.triggerType && (
                  <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
                    Trigger: {formatTriggerType(task.triggerType)}
                  </p>
                )}
                <p className="mb-4 text-sm text-[var(--color-text-secondary)] line-clamp-2">
                  {task.notes}
                </p>

                <div className="flex items-center justify-between border-t border-[var(--color-divider)] pt-4 text-xs text-[var(--color-text-secondary)]">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon size={14} />
                    {task.date}
                  </div>
                  <div>
                    {"Mechanic"}:{" "}
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {task.assignedDriver}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {activeTasks.length === 0 && (
              <div className={emptyStateClasses}>
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-[var(--color-brand-primary)]/50" />
                <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                  {"No active work orders"}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {"You're all caught up!"}
                </p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div
          ref={detailRef}
          className={detailViewClasses}
        >
          {/* Back Button */}
          <button
            onClick={() => setSelectedTask(null)}
            className={backButtonClasses}
          >
            <ChevronLeft size={16} />
            Back to Assigned Orders
          </button>

          {renderScheduleDetails(selectedTask)}

          {/* Execution Checklist - same format as inspection checklist */}
          {selectedTask && (
            <>
              <div
                className={`mb-4 overflow-hidden rounded-xl px-6 py-4 ${
                  !currentExecution.done
                    ? "border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/10 shadow-card"
                    : "border border-emerald-500/30 bg-emerald-500/10 shadow-card"
                }`}
              >
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  <div className="flex items-center">
                    <span>Execution Checklist</span>
                    <span
                      className={`ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        !currentExecution.done
                          ? "border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] dark:text-sky-100"
                          : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                      }`}
                    >
                      {!currentExecution.done ? "Enabled" : "Completed"}
                    </span>
                  </div>
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Mechanics must select Checked, Changed, or Not Checked for
                  each execution item before completing execution.
                </p>
              </div>

                  <div className={executionTableClasses}>
                    <div className={tableHeaderClasses}>
                      <div>Execution Item</div>
                      <div className="text-center">Checked</div>
                      <div className="text-center">Changed</div>
                      <div className="text-center">Not Checked</div>
                      <div>Note</div>
                      <div>Parts Used</div>
                      <div>Cost</div>
                      <div>Photos</div>
                      <div className="text-center">Status</div>
                    </div>
                    <div className="divide-y divide-[var(--color-divider)]">
                      {currentExecution.items.map((item) => (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[1fr_80px_80px_100px_1.2fr_100px_100px_140px_100px] items-center gap-4 px-6 py-4 transition-colors duration-200 ${
                            item.status === "notChecked"
                              ? "bg-amber-500/10"
                              : item.status === "changed"
                                ? "bg-sky-500/10"
                                : item.status === "checked"
                                  ? "bg-emerald-500/10"
                                  : "hover:bg-[var(--color-card-bg-hover)] dark:hover:bg-slate-800/90"
                          }`}
                        >
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">
                            {item.text}
                          </div>

                          <div className="flex justify-center">
                            <button
                              disabled={currentExecution.done}
                              onClick={() =>
                                updateExecutionItemStatus(
                                  selectedTask.id,
                                  item.id,
                                  "checked",
                                )
                              }
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                                item.status === "checked"
                                  ? "border-emerald-400 bg-emerald-400/20"
                                  : "border-[var(--color-border)] hover:border-emerald-500/60"
                              } ${currentExecution.done ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              {item.status === "checked" && (
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                              )}
                            </button>
                          </div>

                          <div className="flex justify-center">
                            <button
                              disabled={currentExecution.done}
                              onClick={() =>
                                updateExecutionItemStatus(
                                  selectedTask.id,
                                  item.id,
                                  "changed",
                                )
                              }
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                                item.status === "changed"
                                  ? "border-sky-400 bg-sky-400/20"
                                  : "border-[var(--color-border)] hover:border-sky-500/60"
                              } ${currentExecution.done ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              {item.status === "changed" && (
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                              )}
                            </button>
                          </div>

                          <div className="flex justify-center">
                            <button
                              disabled={currentExecution.done}
                              onClick={() =>
                                updateExecutionItemStatus(
                                  selectedTask.id,
                                  item.id,
                                  "notChecked",
                                )
                              }
                              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                                item.status === "notChecked"
                                  ? "border-amber-400 bg-amber-400/20"
                                  : "border-[var(--color-border)] hover:border-amber-500/60"
                              } ${currentExecution.done ? "cursor-not-allowed opacity-60" : ""}`}
                            >
                              {item.status === "notChecked" && (
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                              )}
                            </button>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={item.note}
                              disabled={currentExecution.done}
                              onChange={(e) =>
                                updateExecutionItemNote(
                                  selectedTask.id,
                                  item.id,
                                  e.target.value,
                                )
                              }
                              placeholder="Add note"
                              className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:bg-[var(--color-input-bg-hover)] text-[var(--color-text-primary)] ${currentExecution.done ? "opacity-70" : ""}`}
                            />
                          </div>

                          <div>
                            {item.status === "changed" ? (
                              <input
                                type="text"
                                value={item.partsUsed || ""}
                                disabled={currentExecution.done}
                                onChange={(e) =>
                                  updateExecutionItemField(
                                    selectedTask.id,
                                    item.id,
                                    "partsUsed",
                                    e.target.value,
                                  )
                                }
                                placeholder="Part(s) used"
                                className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:bg-[var(--color-input-bg-hover)] text-[var(--color-text-primary)] ${currentExecution.done ? "opacity-70" : ""}`}
                              />
                            ) : (
                              <span className="text-[var(--color-text-secondary)]">-</span>
                            )}
                          </div>

                          <div>
                            {item.status === "changed" ? (
                              <input
                                type="text"
                                value={item.partsCost || ""}
                                disabled={currentExecution.done}
                                onChange={(e) =>
                                  updateExecutionItemField(
                                    selectedTask.id,
                                    item.id,
                                    "partsCost",
                                    e.target.value,
                                  )
                                }
                                placeholder="Cost"
                                className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:bg-[var(--color-input-bg-hover)] text-[var(--color-text-primary)] ${currentExecution.done ? "opacity-70" : ""}`}
                              />
                            ) : (
                              <span className="text-[var(--color-text-secondary)]">-</span>
                            )}
                          </div>

                          <div>
                            {item.status === "changed" ? (
                              <div className="space-y-2">
                                <label className="sr-only">
                                  Upload images for {item.text}
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  disabled={currentExecution.done}
                                  onChange={(e) =>
                                    updateExecutionItemAttachments(
                                      selectedTask.id,
                                      item.id,
                                      e.target.files,
                                    )
                                  }
                                  className={`w-full text-xs text-[var(--color-text-secondary)] ${currentExecution.done ? "opacity-60 cursor-not-allowed" : ""}`}
                                />
                                {item.attachments &&
                                  item.attachments.length > 0 && (
                                    <div className="text-xs text-[var(--color-text-secondary)]">
                                      {item.attachments.join(", ")}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <span className="text-[var(--color-text-secondary)]">-</span>
                            )}
                          </div>

                          <div className="flex justify-center">
                            {item.status === "checked" && (
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">
                                Checked
                              </span>
                            )}
                            {item.status === "changed" && (
                              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-200">
                                Changed
                              </span>
                            )}
                            {item.status === "notChecked" && (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-200">
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
                          disabled={currentExecution.done}
                          onChange={(e) =>
                            updateExecutionField(
                              selectedTask.id,
                              "technicianSignature",
                              e.target.value,
                            )
                          }
                          className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] ${currentExecution.done ? "opacity-70" : ""}`}
                          placeholder="Chief Mechanic name"
                        />
                      </div>
                    </div>

                    {!canCompleteExecution && !currentExecution.done && (
                      <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-5 py-4 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                        <AlertTriangle
                          className="mt-0.5 text-rose-400"
                          size={20}
                        />
                        <div>
                          <h3 className="font-semibold text-rose-700 dark:text-rose-200">
                            {"Cannot complete execution"}
                          </h3>
                          <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-200/80">
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
                  {!currentExecution.done ? (
                    <div className="mt-4 border-t border-[var(--color-divider)] px-6 py-4">
                      <button
                        className={`no-print w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${
                          canCompleteExecution
                            ? "bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-dark)]"
                            : "bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed"
                        }`}
                        disabled={!canCompleteExecution}
                        onClick={() => setExecutionDone(selectedTask.id, true)}
                      >
                        Mark Execution Complete
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 border-t border-[var(--color-divider)] px-6 py-4">
                      <p className="text-sm text-emerald-700 dark:text-emerald-200">
                        Execution checklist completed. The section remains visible for review until the work order is fully closed.
                      </p>
                    </div>
                  )}
            </>
          )}

          {/* Checklist Table - gated by execution */}
          <div
            className={`mb-4 rounded-xl px-6 py-4 ${
              currentExecution.done
                ? "border border-emerald-500/30 bg-emerald-500/10 shadow-card"
                : "border border-amber-500/30 bg-amber-500/10 shadow-card"
            }`}
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              <div className="flex items-center">
                <span>Inspection Checklist</span>
                <span
                  className={`ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    currentExecution.done
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                      : "border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                  }`}
                >
                  {currentExecution.done ? "Enabled" : "Disabled"}
                </span>
              </div>
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Complete the inspection for each item after execution is finished.
            </p>
          </div>
          <div
            className={`overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] ${!currentExecution.done ? "opacity-60 pointer-events-none" : ""}`}
          >
            <div className={checklistHeaderClasses}>
              <div>{"Checklist Item"}</div>
              <div className="text-center">{"Pass"}</div>
              <div className="text-center">{"Fail"}</div>
              <div>{"Note"}</div>
              <div>{"Parts Used"}</div>
              <div className="text-center">{"Status"}</div>
            </div>

            <div className="divide-y divide-[var(--color-divider)]">
              {currentChecklist.map((item) => {
                const executionData = getExecutionItemData(item.id);
                const displayNote = item.note || (currentExecution.done ? executionData?.note || "" : "");
                const displayPartsUsed = item.partsUsed || (currentExecution.done && executionData?.status === "changed" ? executionData?.partsUsed || "" : "");
                
                return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[1fr_80px_80px_1fr_1fr_100px] items-center gap-4 px-6 py-4 transition-colors duration-200 ${
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
                      disabled={selectedTask?.status === "Completed"}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        item.status === "pass"
                          ? "border-emerald-400 bg-emerald-400/20"
                          : "border-[var(--color-border)] hover:border-emerald-500/60"
                      } ${selectedTask?.status === "Completed" ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {item.status === "pass" && (
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      )}
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => handleStatusChange(item.id, "fail")}
                      disabled={selectedTask?.status === "Completed"}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                        item.status === "fail"
                          ? "border-rose-400 bg-rose-400/20"
                          : "border-[var(--color-border)] hover:border-rose-500/60"
                      } ${selectedTask?.status === "Completed" ? "cursor-not-allowed opacity-50" : ""}`}
                    >
                      {item.status === "fail" && (
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={displayNote}
                      disabled={selectedTask?.status === "Completed"}
                      onChange={(e) =>
                        handleNoteChange(item.id, e.target.value)
                      }
                      placeholder={displayPartsUsed ? `Parts used: ${displayPartsUsed} | Add inspection note` : "Add note"}
                      className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-1.5 text-sm outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:bg-[var(--color-input-bg-hover)] ${
                        item.status === "fail"
                          ? "text-rose-700 placeholder:text-rose-500/60 dark:text-rose-200 dark:placeholder:text-rose-300/50"
                          : "text-[var(--color-text-primary)]"
                      } ${selectedTask?.status === "Completed" ? "cursor-not-allowed opacity-50" : ""}`}
                    />
                    {item.status === "fail" && (
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                        ⚠️ Recommended for repair
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {displayPartsUsed || "-"}
                  </div>

                  <div className="flex justify-center">
                    {item.status === "pass" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-200">
                        {"Pass"}
                      </span>
                    )}
                    {item.status === "fail" && (
                      <span className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-200">
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

          {/* Warning Banner */}
          {showCannotCompleteWarning && (
            <div className={warningBannerClasses}>
              <AlertTriangle className="mt-0.5 text-rose-400" size={20} />
              <div>
                <h3 className="font-semibold text-rose-700 dark:text-rose-200">
                  {"Cannot mark as Complete"}
                </h3>
                <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-200/80">
                  {pendingCount > 0 ? `${pendingCount} item(s) pending. ` : ""}
                  {!currentExecution.done ? "Execution not completed. " : ""}
                  Resolve all before closing.
                </p>
              </div>
            </div>
          )}

          {failedCount > 0 && canComplete && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-700 shadow-card dark:text-amber-200">
              {`${failedCount} item(s) failed. You can still mark the inspection complete.`}
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between border-t border-[var(--color-divider)] pt-6">
            <button
              onClick={exportPdf}
              className={actionButtonClasses}
            >
              <FileDown size={18} />
              Export as PDF
            </button>

            {selectedTask?.status === "Completed" ? (
              <div className="flex items-center gap-3">
                <button
                  className="no-print flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-[0_0_10px_rgba(52,211,153,0.12)]"
                  disabled
                >
                  Completed
                </button>
              </div>
            ) : (
              <button
                className={`${completeButtonClasses} ${
                  canComplete
                    ? "bg-[var(--color-brand-primary)] text-white shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:bg-[var(--color-brand-primary)]/90 hover:shadow-[0_0_25px_rgba(14,165,233,0.6)]"
                    : "cursor-not-allowed bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]"
                }`}
                disabled={!canComplete}
                onClick={handleMarkComplete}
              >
                {"Mark Inspection Complete"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
