import { ApiError, apiRequest, fetchJSON, useBackend } from "./httpClient";
import {
  mockDashboardStats,
  mockRecentActivity,
  mockUpcomingMaintenance,
  mockWorkOrders,
  mockUsers,
  mockGarages,
  mockSystems,
  getMockChecklistTemplates,
  saveMockChecklistTemplates,
} from "../mocks/vmmsMocks";

export interface VehicleOption {
  id?: string;
  value: string;
  label: string;
  plateNumber?: string;
  status?: string;
  odometer?: number;
}

export interface MaintenanceLogEditValues {
  maintenanceClass?: 'REPAIR' | 'PREVENTIVE';
  maintenanceRemarks?: string;
  serviceOdometerReading?: number;
  laborCost?: number;
}

const fallbackVehicleOptions: VehicleOption[] = [
  { value: "ABC 1234", label: "ABC 1234 - Truck Alpha", status: "AVAILABLE" },
  { value: "DEF 5678", label: "DEF 5678 - Truck Bravo", status: "AVAILABLE" },
  { value: "GHI 9012", label: "GHI 9012 - Truck Charlie", status: "AVAILABLE" },
  { value: "JKL 3456", label: "JKL 3456 - Truck Delta", status: "AVAILABLE" },
  { value: "MNO 7890", label: "MNO 7890 - Truck Echo", status: "AVAILABLE" },
  { value: "PQR 2345", label: "PQR 2345 - Truck Foxtrot", status: "AVAILABLE" },
  { value: "STU 6789", label: "STU 6789 - Truck Golf", status: "AVAILABLE" },
  { value: "VWX 0123", label: "VWX 0123 - Truck Hotel", status: "AVAILABLE" },
  { value: "YZA 4567", label: "YZA 4567 - Truck India", status: "AVAILABLE" },
  { value: "BCD 8901", label: "BCD 8901 - Truck Juliet", status: "AVAILABLE" },
  { value: "EFG 2345", label: "EFG 2345 - Truck Kilo", status: "AVAILABLE" },
  { value: "HU 6789", label: "HU 6789 - Truck Lima", status: "AVAILABLE" },
];
import {
  AccountType,
  MaintenanceIntervalType,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceTriggerType,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  getCalculatedMaintenanceStatus,
  getNextWorkOrderId,
  isInProgressStatus,
} from "../utils/workOrders";
import type {
  ChecklistTemplateName,
  ChecklistItemTemplate,
} from "../../data/ChecklistData";
import type {
  UserRecord,
  UserRole,
} from "../mocks/vmmsMocks";

const useMaintenanceScheduleBackend =
  useBackend && import.meta.env.VITE_USE_BACKEND_MAINTENANCE_SCHEDULES !== "false";
const localMaintenanceSchedulesKey = "vmmsMaintenanceSchedules:v2";
const legacyLocalMaintenanceSchedulesKey = "vmmsMaintenanceSchedules";

function parseStoredMaintenanceSchedules(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as MaintenanceTask[]) : null;
  } catch {
    return null;
  }
}

function readLocalMaintenanceSchedules() {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(localMaintenanceSchedulesKey);
    if (!saved) {
      const legacySchedules = parseStoredMaintenanceSchedules(
        window.localStorage.getItem(legacyLocalMaintenanceSchedulesKey),
      );

      if (legacySchedules) {
        writeLocalMaintenanceSchedules(legacySchedules);
        return legacySchedules;
      }

      const initialSchedules = mockWorkOrders.map((workOrder) => ({
        ...workOrder,
      }));
      writeLocalMaintenanceSchedules(initialSchedules);
      return initialSchedules;
    }

    return parseStoredMaintenanceSchedules(saved) ?? [];
  } catch {
    return [];
  }
}

function writeLocalMaintenanceSchedules(schedules: MaintenanceTask[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      localMaintenanceSchedulesKey,
      JSON.stringify(schedules),
    );
  } catch {
    // ignore local storage failures
  }
}

function getNextLocalMaintenanceScheduleId(schedules: MaintenanceTask[]) {
  return getNextWorkOrderId(schedules);
}

function normalizeMaintenanceStatusValue(status?: string | null): MaintenanceStatus {
  const normalized = (status ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

  if (normalized === "in-progress") return MaintenanceStatus.IN_PROGRESS;
  if (normalized === "completed") return MaintenanceStatus.COMPLETED;
  if (normalized === "due") return MaintenanceStatus.DUE;
  if (normalized === "overdue") return MaintenanceStatus.OVERDUE;
  if (normalized === "cancelled") return MaintenanceStatus.CANCELLED;
  return MaintenanceStatus.PENDING;
}

function normalizeAccountTypeValue(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return undefined;
  if (normalized === "outsourced") return AccountType.OUTSOURCED;
  return AccountType.IN_HOUSE;
}

function normalizeTriggerTypeValue(value?: string | null) {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === MaintenanceTriggerType.TIME) return MaintenanceTriggerType.TIME;
  if (normalized === MaintenanceTriggerType.MANUAL) return MaintenanceTriggerType.MANUAL;
  if (normalized === MaintenanceTriggerType.ODOMETER) return MaintenanceTriggerType.ODOMETER;
  return undefined;
}

function normalizeIntervalTypeValue(value?: string | null) {
  const normalized = (value ?? "").trim().toUpperCase().replace(/-/g, "_");
  if (normalized === MaintenanceIntervalType.DAILY) return MaintenanceIntervalType.DAILY;
  if (normalized === MaintenanceIntervalType.WEEKLY) return MaintenanceIntervalType.WEEKLY;
  if (normalized === MaintenanceIntervalType.MONTHLY) return MaintenanceIntervalType.MONTHLY;
  if (normalized === MaintenanceIntervalType.QUARTERLY) return MaintenanceIntervalType.QUARTERLY;
  if (normalized === MaintenanceIntervalType.SEMI_ANNUALLY) return MaintenanceIntervalType.SEMI_ANNUALLY;
  if (normalized === "YEARLY" || normalized === MaintenanceIntervalType.ANNUALLY) {
    return MaintenanceIntervalType.ANNUALLY;
  }
  return undefined;
}

function formatLocalDateText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeMaintenanceTask(task: MaintenanceTask): MaintenanceTask {
  const rawTask = task as MaintenanceTask & {
    createdAt?: string | null;
    log_number?: string | null;
    target_due_date?: string | null;
  };
  const date =
    task.date ||
    (typeof rawTask.createdAt === "string" ? rawTask.createdAt.slice(0, 10) : "") ||
    formatLocalDateText();
  const normalizedTask = {
    ...task,
    workOrderNumber:
      task.workOrderNumber ??
      (task as MaintenanceTask & { work_order_number?: string }).work_order_number,
    logNumber: task.logNumber ?? rawTask.log_number ?? null,
    targetDueDate: task.targetDueDate ?? rawTask.target_due_date ?? null,
    date,
    status: normalizeMaintenanceStatusValue(task.status),
    priority: Object.values(MaintenancePriority).includes(task.priority as MaintenancePriority)
      ? task.priority
      : MaintenancePriority.MEDIUM,
    accountType: normalizeAccountTypeValue(task.accountType),
    outsourcedProvider: task.outsourcedProvider,
    triggerType: normalizeTriggerTypeValue(task.triggerType),
    intervalType: normalizeIntervalTypeValue(task.intervalType),
    assignedDriver:
      task.assignedDriver ??
      (task as MaintenanceTask & { assignedMechanic?: string }).assignedMechanic ??
      "",
    chiefMechanicId: task.chiefMechanicId,
    chiefMechanic: task.chiefMechanic,
  };

  return {
    ...normalizedTask,
    status: getCalculatedMaintenanceStatus(normalizedTask),
  };
}

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toUpperCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUserRecord(user: unknown): UserRecord {
  const userObj = isPlainObject(user) ? user : {};
  const roleAssignments = Array.isArray(userObj.roles)
    ? userObj.roles.filter(isPlainObject)
    : [];
  const roleFromVmmsAssignment = roleAssignments.find(
    (entry) =>
      typeof entry.system === "string" &&
      entry.system.trim().toUpperCase() === "VMMS" &&
      typeof entry.role === "string" &&
      entry.role.trim().length > 0,
  )?.role;
  const fallbackRole = typeof roleFromVmmsAssignment === "string"
    ? roleFromVmmsAssignment
    : roleAssignments.length === 0 && typeof userObj.role === "string"
      ? userObj.role
      : undefined;

  return {
    ...userObj,
    role: normalizeRole(fallbackRole) as UserRole,
    updatedAt:
      typeof userObj.updatedAt === "string"
        ? userObj.updatedAt
        : typeof userObj.lastActive === "string"
          ? userObj.lastActive
          : undefined,
    status:
      typeof userObj.status === "string"
        ? userObj.status
        : userObj.isActive === false
        ? "Inactive"
        : "Active",
  } as UserRecord;
}

const vehicleMaintenanceStatus = "UNDER MAINTENANCE";

function saveMockVehicleStatus(vehicleId: string, status: string) {
  try {
    const storageKey = "mockVehicleStatuses";
    const savedStatuses = window.localStorage.getItem(storageKey);
    const statuses = savedStatuses
      ? (JSON.parse(savedStatuses) as Record<string, string>)
      : {};

    statuses[vehicleId] = status;
    window.localStorage.setItem(storageKey, JSON.stringify(statuses));
  } catch {
    // ignore mock storage failures
  }
}

function loadMockVehicleStatuses() {
  try {
    const savedStatuses = window.localStorage.getItem("mockVehicleStatuses");
    return savedStatuses
      ? (JSON.parse(savedStatuses) as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export async function getDashboardStats() {
  if (!useBackend) return mockDashboardStats;

  const [vehicles, schedules] = await Promise.all([
    getVehicles(),
    getMaintenanceSchedules(),
  ]);

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);

  const totalVehicles = String(vehicles.length);
  const activeWorkOrders = String(
    schedules.filter((s) => (s.status ?? "") !== MaintenanceStatus.COMPLETED).length,
  );
  const overdueMaintenance = String(
    schedules.filter((s) => {
      if (!s.date) return false;
      const d = new Date(s.date);
      return d < now && (s.status ?? "") !== MaintenanceStatus.COMPLETED;
    }).length,
  );
  const completedThisWeek = String(
    schedules.filter((s) => {
      if ((s.status ?? "") !== MaintenanceStatus.COMPLETED) return false;
      if (!s.date) return false;
      const d = new Date(s.date);
      return d >= oneWeekAgo && d <= now;
    }).length,
  );

  return [
    {
      label: "Total Vehicles",
      value: totalVehicles,
      change: "",
      icon: "Truck",
      color: "#3b82f6",
      bgColor: "rgba(59, 130, 246, 0.12)",
    },
    {
      label: "Active Work Orders",
      value: activeWorkOrders,
      change: "",
      icon: "Wrench",
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.12)",
    },
    {
      label: "Overdue Maintenance",
      value: overdueMaintenance,
      change: "",
      icon: "AlertTriangle",
      color: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.12)",
    },
    {
      label: "Completed This Week",
      value: completedThisWeek,
      change: "",
      icon: "CheckCircle2",
      color: "#22c55e",
      bgColor: "rgba(34, 197, 94, 0.12)",
    },
  ];
}

export async function getRecentActivity() {
  return mockRecentActivity;
}

export async function getUpcomingMaintenance() {
  return mockUpcomingMaintenance;
}

export async function getWorkOrders() {
  return getMaintenanceSchedules({ includeDeleted: true });
}

export async function getUsers(): Promise<UserRecord[]> {
  if (!useBackend) return mockUsers.map((user) => normalizeUserRecord(user));
  const people = await fetchJSON<Array<{
    id: string;
    userId?: string;
    name: string;
    email: string;
    role: UserRecord["role"];
    temporaryRoles?: string[];
  }>>('/mechanics');
  return people
    .filter((person) => !person.temporaryRoles?.includes(person.role))
    .map((person) => normalizeUserRecord({
      id: person.userId ?? person.id,
      name: person.name,
      email: person.email,
      role: person.role,
      status: 'Active',
      lastActive: '',
    }));
}
export async function getGarages() {
  if (!useBackend) return mockGarages.map((g) => ({ ...g }));

  return fetchJSON<{ id: string; name: string }[]>("/garages");
}

export async function getSystems() {
  if (!useBackend) return mockSystems.map((s) => ({ ...s }));

  return fetchJSON<{ id: string; name: string }[]>("/systems");
}

export interface OutsourcedProviderRecord {
  id: string;
  name: string;
  isActive: boolean;
}

export async function getOutsourcedProviders() {
  if (!useBackend) return [] as OutsourcedProviderRecord[];
  return fetchJSON<OutsourcedProviderRecord[]>("/config/outsourced-providers");
}

export async function createOutsourcedProvider(name: string) {
  return fetchJSON<OutsourcedProviderRecord>("/config/outsourced-providers", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateOutsourcedProvider(id: string, values: { name?: string; isActive?: boolean }) {
  return fetchJSON<OutsourcedProviderRecord>(`/config/outsourced-providers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(values),
  });
}

export async function updateWorkOrder(task: MaintenanceTask) {
  if (!useMaintenanceScheduleBackend) {
    const schedules = readLocalMaintenanceSchedules().map(normalizeMaintenanceTask);
    const index = schedules.findIndex((current) => current.id === task.id);
    const updatedTask = normalizeMaintenanceTask(task);
    if (index >= 0) {
      schedules[index] = updatedTask;
      writeLocalMaintenanceSchedules(schedules);
    }
    if (isInProgressStatus(updatedTask.status)) {
      saveMockVehicleStatus(updatedTask.vehicleId, vehicleMaintenanceStatus);
    }
    return updatedTask;
  }

  const updatedTask = await updateMaintenanceSchedule(task);
  if (isInProgressStatus(updatedTask.status)) {
    updateVehicleStatus(updatedTask.vehicleId, vehicleMaintenanceStatus).catch(
      (error) => {
        console.error("Failed to update vehicle status", error);
      },
    );
  }

  return updatedTask;
}

export async function updateWorkOrderProgress(
  taskId: string,
  progress: unknown,
) {
  if (!useMaintenanceScheduleBackend) {
    const schedules = readLocalMaintenanceSchedules().map(normalizeMaintenanceTask);
    const index = schedules.findIndex((current) => current.id === taskId);
    if (index >= 0) {
      schedules[index] = {
        ...schedules[index],
        workOrderProgress: progress,
      };
      writeLocalMaintenanceSchedules(schedules);
    }
    return { id: taskId, workOrderProgress: progress };
  }

  return fetchJSON<{ id: string; workOrderProgress: unknown }>(
    `/maintenance-schedules/${encodeURIComponent(taskId)}/progress`,
    {
      method: "PATCH",
      body: JSON.stringify(progress),
    },
  );
}

export type WorkOrderAttachment = {
  id: string;
  name: string;
  sizeMb: number;
  contentType?: string;
  storageName?: string;
};

export async function uploadWorkOrderAttachment(taskId: string, itemId: string, file: File): Promise<WorkOrderAttachment> {
  const body = new FormData();
  body.append("itemId", itemId);
  body.append("file", file);
  return apiRequest<WorkOrderAttachment>(`/maintenance-schedules/${encodeURIComponent(taskId)}/attachments`, {
    method: "POST",
    body,
  });
}

export async function deleteWorkOrderAttachment(taskId: string, attachmentId: string): Promise<void> {
  await apiRequest<void>(`/maintenance-schedules/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`, {
    method: "DELETE",
  });
}

export async function openWorkOrderAttachment(taskId: string, attachment: WorkOrderAttachment): Promise<void> {
  const preview = window.open("about:blank", "_blank");
  if (!preview) throw new Error("Allow pop-ups to open this attachment.");
  try {
    const blob = await apiRequest<Blob>(`/maintenance-schedules/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachment.id)}`);
    const objectUrl = URL.createObjectURL(blob);
    preview.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    preview.close();
    throw error;
  }
}

export async function getChecklistTemplates() {
  if (!useBackend) {
    return getMockChecklistTemplates();
  }

  return fetchJSON<Record<ChecklistTemplateName, ChecklistItemTemplate[]>>(
    "/checklists",
  );
}

export async function getChecklistTemplateId(type: string): Promise<string | undefined> {
  if (!useBackend) return undefined;
  const template = await fetchJSON<{ id: string; items: ChecklistItemTemplate[] } | null>(
    `/checklists/type/${encodeURIComponent(type)}`,
  );
  if (!template?.id || !template.items?.length) throw new Error('The selected checklist is unavailable or empty. Refresh the templates and try again.');
  return template.id;
}

export async function saveChecklistTemplates(
  templates: Record<ChecklistTemplateName, ChecklistItemTemplate[]>,
) {
  if (!useBackend) {
    return saveMockChecklistTemplates(templates);
  }

  return fetchJSON<Record<ChecklistTemplateName, ChecklistItemTemplate[]>>(
    "/checklists/sync",
    {
      method: "POST",
      body: JSON.stringify(templates),
    },
  );
}

export type CreateMaintenanceScheduleInput = Omit<MaintenanceTask, "id">;

export async function getMaintenanceSchedules(options?: {
  statuses?: string[];
  includeDeleted?: boolean;
}) {
  const allowedStatuses = options?.statuses?.map((status) => status.trim()).filter(Boolean);
  const includeDeleted = options?.includeDeleted === true;

  if (!useMaintenanceScheduleBackend) {
    const schedules = readLocalMaintenanceSchedules().map(normalizeMaintenanceTask);
    return schedules.filter(
      (schedule) =>
        (includeDeleted || !schedule.deletedAt) &&
        (!allowedStatuses?.length || allowedStatuses.includes(schedule.status)),
    );
  }

  const queryParams = new URLSearchParams();
  allowedStatuses?.forEach((status) => queryParams.append("status", status));
  if (includeDeleted) queryParams.set("includeDeleted", "true");
  const query = queryParams.size ? `?${queryParams.toString()}` : "";

  let schedules: MaintenanceTask[];
  try {
      schedules = (await fetchJSON<MaintenanceTask[]>(
        `/maintenance-schedules${query}`,
      )).map(normalizeMaintenanceTask);
  } catch (error) {
    if (error instanceof ApiError && error.status >= 500) {
      console.warn(
        "Backend maintenance schedule list failed; using local fallback schedules.",
        error,
      );
      schedules = mockWorkOrders.map(normalizeMaintenanceTask);
    } else {
      throw error;
    }
  }

  return allowedStatuses?.length
    ? schedules.filter((schedule) => allowedStatuses.includes(schedule.status))
    : schedules;
}

export async function createMaintenanceSchedule(
  schedule: CreateMaintenanceScheduleInput,
) {
  if (!useMaintenanceScheduleBackend) {
    const schedules = readLocalMaintenanceSchedules();
    const id = getNextLocalMaintenanceScheduleId(schedules);
    const createdTask: MaintenanceTask = {
      ...schedule,
      date: schedule.date || formatLocalDateText(),
      status: getCalculatedMaintenanceStatus({
        ...schedule,
        date: schedule.date || formatLocalDateText(),
        status: normalizeMaintenanceStatusValue(schedule.status),
        id,
      }),
      id,
    };
    writeLocalMaintenanceSchedules([createdTask, ...schedules]);
    return createdTask;
  }

  // Backend expects a narrower DTO — only send supported fields
  const payload = {
    timeIntervalValue: schedule.timeIntervalValue,
    timeIntervalUnit: schedule.timeIntervalUnit,
    startDate: schedule.startDate,
    targetDueDate: schedule.targetDueDate,
    checklistTemplateId: schedule.checklistTemplateId,
    vehicleId: schedule.vehicleId,
    title: schedule.title,
    assignedDriver: schedule.assignedDriver,
    chiefMechanicId: schedule.chiefMechanicId,
    chiefMechanic: schedule.chiefMechanic,
    status: schedule.status,
    priority: schedule.priority ?? MaintenancePriority.MEDIUM,
    garageId: schedule.garageId,
    accountType: schedule.accountType,
    outsourcedProvider: schedule.outsourcedProvider,
    odometerReading: schedule.odometerReading,
    triggerType: schedule.triggerType,
    intervalKm: schedule.intervalKm,
    bufferDistanceKm: schedule.bufferDistanceKm,
    useVehicleDefaults: schedule.useVehicleDefaults,
    startingReferenceReadingKm: schedule.startingReferenceReadingKm,
    intervalType: schedule.intervalType,
    startReferenceDate: schedule.startReferenceDate,
  };

  return fetchJSON<MaintenanceTask>("/maintenance-schedules", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then(normalizeMaintenanceTask);
}

export async function updateMaintenanceSchedule(schedule: MaintenanceTask) {
  if (!useMaintenanceScheduleBackend) {
    const schedules = readLocalMaintenanceSchedules();
    const index = schedules.findIndex(
      (current) => current.id === schedule.id,
    );
    if (index >= 0) {
      const updatedSchedule = normalizeMaintenanceTask(schedule);
      schedules[index] = updatedSchedule;
      writeLocalMaintenanceSchedules(schedules);
      return updatedSchedule;
    }
    throw new Error("Maintenance schedule not found");
  }

  const payload = {
    timeIntervalValue: schedule.timeIntervalValue,
    timeIntervalUnit: schedule.timeIntervalUnit,
    startDate: schedule.startDate,
    targetDueDate: schedule.targetDueDate,
    checklistTemplateId: schedule.checklistTemplateId,
    vehicleId: schedule.vehicleId,
    title: schedule.title,
    assignedDriver: schedule.assignedDriver,
    chiefMechanicId: schedule.chiefMechanicId,
    chiefMechanic: schedule.chiefMechanic,
    status: schedule.status,
    priority: schedule.priority ?? MaintenancePriority.MEDIUM,
    garageId: schedule.garageId,
    accountType: schedule.accountType,
    outsourcedProvider: schedule.outsourcedProvider,
    odometerReading: schedule.odometerReading,
    triggerType: schedule.triggerType,
    intervalKm: schedule.intervalKm,
    bufferDistanceKm: schedule.bufferDistanceKm,
    useVehicleDefaults: schedule.useVehicleDefaults,
    startingReferenceReadingKm: schedule.startingReferenceReadingKm,
    intervalType: schedule.intervalType,
    startReferenceDate: schedule.startReferenceDate,
  };

  return fetchJSON<MaintenanceTask>(
    `/maintenance-schedules/${encodeURIComponent(schedule.id)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  ).then(normalizeMaintenanceTask);
}

export async function updateWorkOrderPriority(
  id: string,
  priority: MaintenancePriority,
): Promise<Pick<MaintenanceTask, "id" | "priority">> {
  if (!useMaintenanceScheduleBackend) {
    const schedules = readLocalMaintenanceSchedules();
    const current = schedules.find((schedule) => schedule.id === id);
    if (!current) throw new Error("Work order not found.");
    const updated = normalizeMaintenanceTask({ ...current, priority });
    writeLocalMaintenanceSchedules(
      schedules.map((schedule) => schedule.id === id ? updated : schedule),
    );
    return { id: updated.id, priority: updated.priority };
  }

  const result = await fetchJSON<{ id: string; priority: MaintenancePriority }>(
    `/maintenance-schedules/${encodeURIComponent(id)}/priority`,
    { method: "PATCH", body: JSON.stringify({ priority }) },
  );
  return result;
}

export async function cancelMaintenanceSchedule(schedule: MaintenanceTask, reason: string): Promise<MaintenanceTask> {
  if (!useMaintenanceScheduleBackend) throw new Error('Cancellation requires a connected backend to record the Operations audit trail.');
  const result = await fetchJSON<Pick<MaintenanceTask, 'id' | 'status' | 'cancellations'>>(
    `/maintenance-schedules/${encodeURIComponent(schedule.id)}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
  );
  return { ...schedule, ...result };
}

export async function reviewMaintenanceScheduleCancellation(
  scheduleId: string,
  requestId: string,
  decision: 'APPROVE' | 'REJECT',
  reason?: string,
): Promise<Pick<MaintenanceTask, 'id' | 'status' | 'cancellations'>> {
  if (!useMaintenanceScheduleBackend) throw new Error('Cancellation review requires the connected backend.');
  const result = await fetchJSON<Pick<MaintenanceTask, 'id' | 'status' | 'cancellations'>>(
    `/maintenance-schedules/${encodeURIComponent(scheduleId)}/cancellation-requests/${encodeURIComponent(requestId)}/review`,
    { method: 'POST', body: JSON.stringify({ decision, reason: reason?.trim() }) },
  );
  return result;
}

export async function cancelMaintenanceLog(schedule: MaintenanceTask, reason: string): Promise<MaintenanceTask> {
  if (!useMaintenanceScheduleBackend) throw new Error('Maintenance log cancellation requires the backend audit trail.');
  const result = await fetchJSON<Pick<MaintenanceTask, 'id' | 'status' | 'cancellations'>>(
    `/maintenance-schedules/${encodeURIComponent(schedule.id)}/cancel-log`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
  );
  return { ...schedule, ...result };
}

export async function unlockMaintenanceLog(id: string, reason: string) {
  if (!useMaintenanceScheduleBackend) throw new Error('Maintenance-log unlock requires the backend audit trail.');
  return fetchJSON<{ id: string; scheduleId: string; createdAt: string; reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEGACY'; actorId: string; actorName: string; reason: string; reviewedAt: string | null; activatedAt: string | null; consumedAt: string | null }>(
    `/maintenance-schedules/${encodeURIComponent(id)}/unlock-log`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
  );
}

export async function reviewMaintenanceLogUnlock(
  scheduleId: string, requestId: string, decision: 'APPROVE' | 'REJECT', reason?: string,
) {
  return fetchJSON<{ id: string; scheduleId: string; reviewStatus: string; activatedAt: string | null }>(
    `/maintenance-schedules/${encodeURIComponent(scheduleId)}/unlock-requests/${encodeURIComponent(requestId)}/review`,
    { method: 'POST', body: JSON.stringify({ decision, reason: reason?.trim() }) },
  );
}

export async function updateMaintenanceLog(id: string, changes: MaintenanceLogEditValues) {
  if (!useMaintenanceScheduleBackend) throw new Error('Maintenance-log editing requires the backend audit trail.');
  return fetchJSON<{
    id: string;
    status: MaintenanceStatus;
    workOrderProgress: Record<string, unknown>;
    partsCost: number;
    laborCost: number;
    totalCost: number;
    relocked: true;
  }>(`/maintenance-schedules/${encodeURIComponent(id)}/log-edit`, {
    method: 'PATCH', body: JSON.stringify(changes),
  });
}

export async function voidMaintenanceLog(id: string, reason: string) {
  if (!useMaintenanceScheduleBackend) throw new Error('Maintenance-log voiding requires the backend audit trail.');
  return fetchJSON<Pick<MaintenanceTask, 'id' | 'status' | 'cancellations'>>(
    `/maintenance-schedules/${encodeURIComponent(id)}/void-log`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) },
  );
}

export async function deleteMaintenanceSchedule(id: string) {
  if (!useMaintenanceScheduleBackend) {
    const schedules = readLocalMaintenanceSchedules();
    const index = schedules.findIndex((current) => current.id === id);
    if (index >= 0) {
      schedules[index] = {
        ...schedules[index],
        deletedAt: new Date().toISOString(),
      };
      writeLocalMaintenanceSchedules(schedules);
      return;
    }
    throw new Error("Maintenance schedule not found");
  }

  return fetchJSON<void>(`/maintenance-schedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getVehicles(): Promise<VehicleOption[]> {
  if (!useBackend) {
    const statuses = loadMockVehicleStatuses();
    return fallbackVehicleOptions.map((vehicle) => ({
      ...vehicle,
      status: statuses[vehicle.value] ?? vehicle.status,
    }));
  }

  const vehicles = await fetchJSON<
    Array<{
      id: string;
      plateNumber: string;
      model: string;
      status?: string;
      odometer?: number;
    }>
  >("/vehicles?activeOnly=true");

  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    value: vehicle.plateNumber,
    label: `${vehicle.plateNumber} - ${vehicle.model}`,
    plateNumber: vehicle.plateNumber,
    status: vehicle.status,
    odometer: vehicle.odometer,
  }));
}

export async function updateVehicleStatus(vehicleId: string, status: string) {
  if (!useBackend) {
    saveMockVehicleStatus(vehicleId, status);
    return { vehicleId, status };
  }

  return fetchJSON<{ vehicleId: string; status: string }>(
    `/vehicles/${encodeURIComponent(vehicleId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}

export type {
  MaintenanceTask,
  MaintenanceStatus,
  ChecklistTemplateName,
  ChecklistItemTemplate,
};

// Re-export only the TypeScript types that other modules rely on. We avoid
// re-exporting runtime mock data values, but keep type aliases so imports
// across the app continue to work.
export type {
  DashboardStat,
  ActivityItem,
  MaintenanceItem,
  UserStatus,
  UserRecord,
  UserRole,
  UserCreateInput,
  VehicleRecord,
  VehicleRecordInput,
  GarageFullRecord,
} from "../mocks/vmmsMocks";

// ─── Vehicle Management CRUD ───────────────────────────────────────────────

import type { VehicleRecord, VehicleRecordInput, GarageFullRecord } from "../mocks/vmmsMocks";
import { mockVehicleRecords, mockGarageRecords } from "../mocks/vmmsMocks";

export type VehicleAuditEntry = {
  id: string;
  email: string;
  action: string;
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
};

export type VehicleMaintenanceCategoryDefault = {
  checklistTemplateId: string;
  type: string;
  intervalKm: number | null;
  bufferDistanceKm: number | null;
};

export type VehicleMaintenanceDefaults = {
  vehicleId: string;
  plateNumber: string;
  baseIntervalKm: number | null;
  baseBufferDistanceKm: number | null;
  categories: VehicleMaintenanceCategoryDefault[];
};

export type UpdateVehicleMaintenanceDefaultsInput = {
  baseIntervalKm: string;
  baseBufferDistanceKm: string;
  categoryOverrides: Array<{
    checklistTemplateId: string;
    intervalKm: string;
    bufferDistanceKm: string;
  }>;
};

const mockVehicleMaintenanceDefaults = new Map<
  string,
  VehicleMaintenanceDefaults
>();

export type AuditLogRecord = {
  id: string;
  source: "business";
  actor: string;
  action: string;
  entity: string;
  details: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
};

export async function getAuditLogs(): Promise<AuditLogRecord[]> {
  if (!useBackend) return [];
  const result = await fetchJSON<{ records?: Omit<AuditLogRecord, "source">[] }>("/audit-logs/business");
  return (result.records ?? []).map((record) => ({ ...record, source: "business" }));
}
export async function getVehicleRecords(): Promise<VehicleRecord[]> {
  if (!useBackend) return [...mockVehicleRecords];
  const data = await fetchJSON<VehicleRecord[]>("/vehicles");
  return data;
}

export async function getVehicleAuditHistory(vehicleId: string): Promise<VehicleAuditEntry[]> {
  if (!useBackend) return [];
  return fetchJSON<VehicleAuditEntry[]>(`/vehicles/${encodeURIComponent(vehicleId)}/audit`);
}

export async function getVehicleMaintenanceDefaults(
  vehicleId: string,
): Promise<VehicleMaintenanceDefaults> {
  if (!useBackend) {
    return (
      mockVehicleMaintenanceDefaults.get(vehicleId) ?? {
        vehicleId,
        plateNumber: "",
        baseIntervalKm: null,
        baseBufferDistanceKm: null,
        categories: [],
      }
    );
  }
  return fetchJSON<VehicleMaintenanceDefaults>(
    `/vehicles/${encodeURIComponent(vehicleId)}/maintenance-defaults`,
  );
}

export async function updateVehicleMaintenanceDefaults(
  vehicleId: string,
  input: UpdateVehicleMaintenanceDefaultsInput,
): Promise<VehicleMaintenanceDefaults> {
  if (!useBackend) {
    const existing = await getVehicleMaintenanceDefaults(vehicleId);
    const updated = {
      ...existing,
      baseIntervalKm: input.baseIntervalKm
        ? Number(input.baseIntervalKm)
        : null,
      baseBufferDistanceKm: input.baseBufferDistanceKm
        ? Number(input.baseBufferDistanceKm)
        : null,
      categories: existing.categories.map((category) => {
        const override = input.categoryOverrides.find(
          (item) => item.checklistTemplateId === category.checklistTemplateId,
        );
        return override
          ? {
              ...category,
              intervalKm: Number(override.intervalKm),
              bufferDistanceKm: Number(override.bufferDistanceKm),
            }
          : {
              ...category,
              intervalKm: null,
              bufferDistanceKm: null,
            };
      }),
    };
    mockVehicleMaintenanceDefaults.set(vehicleId, updated);
    return updated;
  }
  return fetchJSON<VehicleMaintenanceDefaults>(
    `/vehicles/${encodeURIComponent(vehicleId)}/maintenance-defaults`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export async function createVehicleRecord(
  dto: VehicleRecordInput,
): Promise<VehicleRecord> {
  if (!useBackend) {
    const created: VehicleRecord = {
      ...dto,
      id: `vr${Date.now()}`,
      lastMaintenanceDate: null,
      status: "AVAILABLE",
      isActive: true,
    };
    mockVehicleRecords.unshift(created);
    return created;
  }
  return fetchJSON<VehicleRecord>("/vehicles", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export type VehicleImportResult = {
  imported: number;
  rows: VehicleImportRow[];
};

export type VehicleImportRow = {
  row: number;
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  engineType: string;
  truckSizeCategory: string;
  garageBranch: string;
  odometerBaseline: string;
  errors: string[];
};

export async function previewVehicleImport(file: File): Promise<VehicleImportResult> {
  if (!useBackend) throw new Error("Vehicle import requires the VMMS backend.");
  const body = new FormData();
  body.append("file", file);
  return apiRequest<VehicleImportResult>("/vehicles/import/preview", { method: "POST", body });
}

export async function saveVehicleImport(rows: VehicleImportRow[]): Promise<VehicleImportResult> {
  if (!useBackend) throw new Error("Vehicle import requires the VMMS backend.");
  return fetchJSON<VehicleImportResult>("/vehicles/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export type OdometerImportStatus = "READY" | "UPDATED" | "UNCHANGED" | "ERROR";

export type OdometerImportRow = {
  row: number;
  plateNumber: string;
  odometerReading: string;
  currentOdometer: number | null;
  status: OdometerImportStatus;
  errors: string[];
};

export type OdometerImportInput = Pick<
  OdometerImportRow,
  "row" | "plateNumber" | "odometerReading"
>;

export type OdometerImportResult = {
  updated: number;
  unchanged: number;
  rows: OdometerImportRow[];
};

export async function previewOdometerImport(file: File): Promise<OdometerImportResult> {
  if (!useBackend) throw new Error("Odometer import requires the VMMS backend.");
  const body = new FormData();
  body.append("file", file);
  return apiRequest<OdometerImportResult>("/vehicles/odometer/import/preview", {
    method: "POST",
    body,
  });
}

export async function saveOdometerImport(
  rows: OdometerImportInput[],
): Promise<OdometerImportResult> {
  if (!useBackend) throw new Error("Odometer import requires the VMMS backend.");
  return fetchJSON<OdometerImportResult>("/vehicles/odometer/import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export async function updateVehicleRecord(
  id: string,
  dto: Partial<Omit<VehicleRecord, "id" | "garageId" | "garageName" | "odometer">> & { garageId?: string },
): Promise<VehicleRecord> {
  if (!useBackend) {
    const idx = mockVehicleRecords.findIndex((v) => v.id === id);
    if (idx < 0) throw new Error("Vehicle not found");
    mockVehicleRecords[idx] = { ...mockVehicleRecords[idx], ...dto };
    return { ...mockVehicleRecords[idx] };
  }
  return fetchJSON<VehicleRecord>(`/vehicles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export async function updateVehicleOdometerRecord(
  id: string,
  odometer: number,
): Promise<VehicleRecord> {
  if (!Number.isSafeInteger(odometer) || odometer < 1 || odometer > 2147483647) {
    throw new Error("Enter a positive whole-number odometer reading.");
  }
  if (!useBackend) {
    const idx = mockVehicleRecords.findIndex((vehicle) => vehicle.id === id);
    if (idx < 0) throw new Error("Vehicle not found.");
    const current = mockVehicleRecords[idx];
    if (!current.isActive) throw new Error("Odometer updates are only allowed for active vehicles.");
    if (odometer < current.odometer) {
      throw new Error(`Odometer cannot be lower than the current reading (${current.odometer}).`);
    }
    mockVehicleRecords[idx] = { ...current, odometer };
    return { ...mockVehicleRecords[idx] };
  }
  return fetchJSON<VehicleRecord>(`/vehicles/${encodeURIComponent(id)}/odometer`, {
    method: "PATCH",
    body: JSON.stringify({ odometer }),
  });
}

export async function deleteVehicleRecord(id: string): Promise<void> {
  if (!useBackend) {
    const idx = mockVehicleRecords.findIndex((v) => v.id === id);
    if (idx >= 0) mockVehicleRecords.splice(idx, 1);
    return;
  }
  return fetchJSON<void>(`/vehicles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ─── Garage Management CRUD ────────────────────────────────────────────────

export async function getGarageRecords(): Promise<GarageFullRecord[]> {
  if (!useBackend) return [...mockGarageRecords];
  return fetchJSON<GarageFullRecord[]>("/garages");
}

export async function createGarageRecord(
  dto: Omit<GarageFullRecord, "id">,
): Promise<GarageFullRecord> {
  if (!useBackend) {
    const created: GarageFullRecord = { ...dto, id: `g${Date.now()}` };
    mockGarageRecords.unshift(created);
    return created;
  }
  return fetchJSON<GarageFullRecord>("/garages", {
    method: "POST",
    body: JSON.stringify(dto),
  });
}

export async function updateGarageRecord(
  id: string,
  dto: Partial<Omit<GarageFullRecord, "id">>,
): Promise<GarageFullRecord> {
  if (!useBackend) {
    const idx = mockGarageRecords.findIndex((g) => g.id === id);
    if (idx < 0) throw new Error("Garage not found");
    mockGarageRecords[idx] = { ...mockGarageRecords[idx], ...dto };
    return { ...mockGarageRecords[idx] };
  }
  return fetchJSON<GarageFullRecord>(`/garages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(dto),
  });
}

export async function deleteGarageRecord(id: string): Promise<void> {
  if (!useBackend) {
    const idx = mockGarageRecords.findIndex((g) => g.id === id);
    if (idx >= 0) mockGarageRecords.splice(idx, 1);
    return;
  }
  return fetchJSON<void>(`/garages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
