import { ApiError, apiRequest, fetchJSON, useBackend } from "./httpClient";
import {
  mockDashboardStats,
  mockRecentActivity,
  mockUpcomingMaintenance,
  mockTransactions,
  mockWorkOrders,
  defaultProfitabilitySummary,
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
  UserStatus,
  UserRecord,
  UserRole,
  UserCreateInput,
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
  const rawTask = task as MaintenanceTask & { createdAt?: string | null };
  const date =
    task.date ||
    (typeof rawTask.createdAt === "string" ? rawTask.createdAt.slice(0, 10) : "") ||
    formatLocalDateText();
  const normalizedTask = {
    ...task,
    workOrderNumber:
      task.workOrderNumber ??
      (task as MaintenanceTask & { work_order_number?: string }).work_order_number,
    date,
    status: normalizeMaintenanceStatusValue(task.status),
    priority: Object.values(MaintenancePriority).includes(task.priority as MaintenancePriority)
      ? task.priority
      : MaintenancePriority.MEDIUM,
    accountType: normalizeAccountTypeValue(task.accountType),
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
  const roleFromArray = Array.isArray(userObj.roles)
    ? userObj.roles
        .map((entry) => (isPlainObject(entry) ? entry.role : undefined))
        .find(
          (role): role is string => typeof role === "string" && role.trim().length > 0,
        )
    : undefined;

  const fallbackRole =
    roleFromArray ??
    (typeof userObj.role === "string" ? userObj.role : undefined);

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

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  if (!useBackend) {
    const matchingUser = mockUsers.find((user) => user.email === email);
    if (!matchingUser) {
      throw new Error("Invalid email or password.");
    }

    const now = new Date().toISOString();
    matchingUser.lastActive = now;
    window.localStorage.setItem("mockCurrentUserId", matchingUser.id);

    return { accessToken: `mock-${matchingUser.id}` };
  }

  return fetchJSON<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  void recordLogout();
  window.localStorage.removeItem("accessToken");
  if (!useBackend) {
    window.localStorage.removeItem("mockCurrentUserId");
  }
}

export async function updateUserLastActive(
  userId: string,
  lastActive = new Date().toISOString(),
) {
  if (!useBackend) {
    const index = mockUsers.findIndex((user) => user.id === userId);
    if (index >= 0) {
      mockUsers[index] = { ...mockUsers[index], lastActive };
      return mockUsers[index] as UserRecord;
    }
    throw new Error("User not found");
  }

  return fetchJSON<UserRecord>(
    `/users/${encodeURIComponent(userId)}/last-active`,
    {
      method: "PATCH",
    },
  );
}

export async function recordLoginActivity() {
  try {
    const me = await getCurrentUser();
    if (!me) return null;

    const updatedUser = await updateUserLastActive(
      me.id,
      new Date().toISOString(),
    );
    if (updatedUser) {
      window.dispatchEvent(
        new CustomEvent("user-login-activity-updated", { detail: updatedUser }),
      );
    }
    return updatedUser;
  } catch (error) {
    console.error("Failed to record login activity", error);
    return null;
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

export async function getUsers() {
  if (!useBackend) return mockUsers.map((user) => normalizeUserRecord(user));

  return fetchJSON<UserRecord[]>("/users").then((users) =>
    users.map((user) => normalizeUserRecord(user)),
  );
}

export async function getManagedUsers() {
  if (!useBackend) return mockUsers.map((user) => normalizeUserRecord(user));

  return fetchJSON<UserRecord[]>("/auth/users?system=VMMS").then((users) =>
    users.map((user) => normalizeUserRecord(user)),
  );
}

export async function getChiefMechanics(): Promise<UserRecord[]> {
  if (!useBackend) {
    return mockUsers
      .filter((u) => u.role === "CHIEF_MECHANIC")
      .map((user) => normalizeUserRecord(user));
  }

  return fetchJSON<UserRecord[]>("/users/chief-mechanics").then((users) =>
    users.map((user) => normalizeUserRecord(user)),
  );
}

export async function getGarages() {
  if (!useBackend) return mockGarages.map((g) => ({ ...g }));

  return fetchJSON<{ id: string; name: string }[]>("/garages");
}

export async function getSystems() {
  if (!useBackend) return mockSystems.map((s) => ({ ...s }));

  return fetchJSON<{ id: string; name: string }[]>("/systems");
}

export async function createUser(user: UserCreateInput) {
  if (!useBackend) {
    const now = new Date().toISOString();
    const createdUser: UserRecord = {
      id: `u${Date.now()}`,
      name: user.name,
      email: user.email,
      role: user.role ?? "OPERATIONS",
      status: user.isActive === false ? "Inactive" : "Active",
      lastActive: now,
      updatedAt: now,
    };
    mockUsers.unshift(createdUser);
    return createdUser;
  }

  return fetchJSON<UserRecord>("/auth/users", {
    method: "POST",
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
      isActive: user.isActive ?? true,
      roleAssignments: [
        {
          role: user.role ?? "OPERATIONS",
          system: "VMMS",
        },
      ],
    }),
  }).then((createdUser) => normalizeUserRecord(createdUser));
}

export async function updateUserRole(userId: string, role: UserRole) {
  if (!useBackend) {
    const me = await getCurrentUser();
    if (me && me.id === userId) {
      throw new Error("You cannot edit your own account.");
    }
    const index = mockUsers.findIndex(
      (currentUser) => currentUser.id === userId,
    );
    if (index >= 0) {
      mockUsers[index] = { ...mockUsers[index], role };
    }
    return mockUsers[index] as UserRecord;
  }

  return fetchJSON<UserRecord>(`/auth/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      roleAssignments: [{ role, system: "VMMS" }],
    }),
  }).then((updatedUser) => normalizeUserRecord(updatedUser));
}

export async function updateUser(
  userId: string,
  data: { name?: string; email?: string; username?: string; password?: string },
) {
  if (!useBackend) {
    const index = mockUsers.findIndex((u) => u.id === userId);
    if (index >= 0) {
      const updated = { ...mockUsers[index], ...data } as UserRecord;
      mockUsers[index] = updated;
      return updated;
    }
    throw new Error("User not found");
  }

  return fetchJSON<UserRecord>(`/auth/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }).then((updatedUser) => normalizeUserRecord(updatedUser));
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  if (!useBackend) {
    const me = await getCurrentUser();
    if (me && me.id === userId) {
      throw new Error("You cannot change your own account status.");
    }
    const index = mockUsers.findIndex(
      (currentUser) => currentUser.id === userId,
    );
    if (index >= 0) {
      mockUsers[index] = { ...mockUsers[index], status };
    }
    return mockUsers[index] as UserRecord;
  }

  return fetchJSON<UserRecord>(`/auth/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: status === "Active" }),
  }).then((updatedUser) => normalizeUserRecord(updatedUser));
}

export async function unlockUser(userId: string) {
  if (!useBackend) {
    const index = mockUsers.findIndex((user) => user.id === userId);
    if (index < 0) throw new Error("User not found");

    mockUsers[index] = {
      ...mockUsers[index],
      isLocked: false,
      lockedAt: null,
    };
    return normalizeUserRecord(mockUsers[index]);
  }

  return fetchJSON<UserRecord>(
    `/auth/users/${encodeURIComponent(userId)}/unlock`,
    { method: "PATCH" },
  ).then((user) => normalizeUserRecord(user));
}

export async function resetUserPassword(userId: string) {
  const password = "Password123!";

  if (!useBackend) {
    const index = mockUsers.findIndex((user) => user.id === userId);
    if (index < 0) throw new Error("User not found");
    mockUsers[index] = { ...mockUsers[index], updatedAt: new Date().toISOString() };
    return normalizeUserRecord(mockUsers[index]);
  }

  return fetchJSON<UserRecord>(
    `/auth/users/${encodeURIComponent(userId)}/password`,
    {
      method: "PATCH",
      body: JSON.stringify({ password }),
    },
  ).then((user) => normalizeUserRecord(user));
}

export async function deleteUser(userId: string) {
  if (!useBackend) {
    const me = await getCurrentUser();
    if (me && me.id === userId) {
      throw new Error("You cannot delete your own account.");
    }
    const index = mockUsers.findIndex(
      (currentUser) => currentUser.id === userId,
    );
    if (index >= 0) {
      mockUsers.splice(index, 1);
    }
    return;
  }

  return fetchJSON<void>(`/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

export async function getCurrentUser() {
  if (!useBackend) {
    const currentUserId = window.localStorage.getItem("mockCurrentUserId");
    if (currentUserId) {
      const currentUser = mockUsers.find((user) => user.id === currentUserId);
      if (currentUser) {
        return { ...currentUser };
      }
    }

    return { ...mockUsers[0] };
  }

  return fetchJSON<UserRecord>("/auth/me").then((user) =>
    normalizeUserRecord(user),
  );
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

export async function recordLogout() {
  if (!useBackend || !window.localStorage.getItem("accessToken")) return;
  try {
    await fetchJSON<{ message: string }>("/auth/logout", { method: "POST" });
  } catch (error) {
    console.warn("Unable to record logout activity", error);
  }
}

export type LoginActivityRecord = {
  id: string;
  event: "SUCCESSFUL_LOGIN" | "FAILED_LOGIN" | "ACCOUNT_LOCKOUT" | "LOGOUT" | "PLATFORM_ACCESS_DENIED";
  email: string;
  ipAddress: string | null;
  deviceType: string;
  createdAt: string;
};

export async function getLoginActivity(userId: string) {
  if (!useBackend) return [] as LoginActivityRecord[];
  return fetchJSON<LoginActivityRecord[]>(
    `/auth/users/${encodeURIComponent(userId)}/login-activity`,
  );
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
    odometerReading: schedule.odometerReading,
    triggerType: schedule.triggerType,
    intervalKm: schedule.intervalKm,
    bufferDistanceKm: schedule.bufferDistanceKm,
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
    odometerReading: schedule.odometerReading,
    triggerType: schedule.triggerType,
    intervalKm: schedule.intervalKm,
    bufferDistanceKm: schedule.bufferDistanceKm,
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

export async function getProfitabilitySummary() {
  return defaultProfitabilitySummary;
}

export async function getTransactions() {
  return mockTransactions;
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
  >("/vehicles");

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

export async function createExpense(expense: {
  vehicle: string;
  date: string;
  description: string;
  cost: string;
}) {
  console.log("Mock createExpense", expense);
  return expense;
}

export async function createIncome(income: {
  vehicle: string;
  bookingRef: string;
  checklistTemplate: string;
  tripDate: string;
  clientType: string;
  revenueAmount: string;
}) {
  console.log("Mock createIncome", income);
  return income;
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
  Transaction,
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

export type AuditLogSource = "all" | "login" | "vehicle" | "work-order" | "schedule";
export type AuditLogRecord = {
  id: string;
  source: Exclude<AuditLogSource, "all">;
  actor: string;
  action: string;
  entity: string;
  details: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
};

export async function getAuditLogs(source: AuditLogSource = "all"): Promise<AuditLogRecord[]> {
  if (!useBackend) return [];
  return fetchJSON<AuditLogRecord[]>(`/auth/audit-logs?source=${encodeURIComponent(source)}`);
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

export async function updateVehicleRecord(
  id: string,
  dto: Partial<Omit<VehicleRecord, "id" | "garageId" | "garageName">> & { garageId?: string },
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

