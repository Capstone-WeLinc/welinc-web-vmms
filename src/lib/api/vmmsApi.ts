import { ApiError, fetchJSON, useBackend } from "./httpClient";
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

    const storedSchedules = parseStoredMaintenanceSchedules(saved) ?? [];
    const reconciledSchedules = reconcileMockMaintenanceSchedules(storedSchedules);
    if (reconciledSchedules.changed) {
      writeLocalMaintenanceSchedules(reconciledSchedules.schedules);
    }
    return reconciledSchedules.schedules;
  } catch {
    return [];
  }
}

function reconcileMockMaintenanceSchedules(schedules: MaintenanceTask[]) {
  const mockById = new Map(mockWorkOrders.map((workOrder) => [workOrder.id, workOrder]));
  let changed = false;
  const nextSchedules = schedules.map((schedule) => {
    const mockSchedule = mockById.get(schedule.id);
    if (!mockSchedule) return schedule;

    mockById.delete(schedule.id);

    const shouldRefreshDemoAssignment =
      !schedule.assignedMechanicId ||
      !schedule.assignedMechanicEmail ||
      schedule.assignedDriver === "J. Dela Cruz" ||
      schedule.assignedDriver === "David Miller" ||
      schedule.assignedDriver === "James Carter";

    if (!shouldRefreshDemoAssignment) return schedule;

    changed = true;
    return {
      ...mockSchedule,
      workOrderProgress: schedule.workOrderProgress,
      deletedAt: schedule.deletedAt,
    };
  });

  if (mockById.size > 0) {
    changed = true;
    nextSchedules.push(...mockById.values());
  }

  return { schedules: nextSchedules, changed };
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
    date,
    status: normalizeMaintenanceStatusValue(task.status),
    accountType: normalizeAccountTypeValue(task.accountType),
    triggerType: normalizeTriggerTypeValue(task.triggerType),
    intervalType: normalizeIntervalTypeValue(task.intervalType),
    assignedDriver:
      task.assignedDriver ??
      (task as MaintenanceTask & { assignedMechanic?: string }).assignedMechanic ??
      "",
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
    createdAt:
      typeof userObj.createdAt === "string"
        ? userObj.createdAt
        : typeof userObj.created_at === "string"
          ? userObj.created_at
          : undefined,
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

type TestLoginRoleLabel =
  | "Admin"
  | "Chief Mechanic"
  | "Operations"
  | "Mechanic";

export type TestLoginAccount = {
  userId: string;
  email: string;
  password: string;
  label: TestLoginRoleLabel;
};

export const testLoginAccounts: TestLoginAccount[] = [
  {
    userId: "u-admin-test",
    email: "admin@welinc.test",
    password: "admin123",
    label: "Admin",
  },
  {
    userId: "u-chief-mechanic-test",
    email: "chief.mechanic@welinc.test",
    password: "chief123",
    label: "Chief Mechanic",
  },
  {
    userId: "u-operations-test",
    email: "operations@welinc.test",
    password: "operations123",
    label: "Operations",
  },
  {
    userId: "u-mechanic-test",
    email: "mechanic@welinc.test",
    password: "mechanic123",
    label: "Mechanic",
  },
];

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const selectedAccount = testLoginAccounts.find(
    (account) => account.email.toLowerCase() === normalizedEmail,
  );

  if (selectedAccount) {
    if (password !== selectedAccount.password) {
      throw new Error("Invalid email or password.");
    }

    const matchingUser = mockUsers.find(
      (user) => user.id === selectedAccount.userId,
    );
    if (!matchingUser) {
      throw new Error("Configured test user was not found.");
    }

    const now = new Date().toISOString();
    matchingUser.lastActive = now;
    window.localStorage.setItem("mockCurrentUserId", matchingUser.id);

    return { accessToken: `mock-${matchingUser.id}` };
  }

  if (!useBackend) {
    throw new Error("Invalid email or password.");
  }

  return fetchJSON<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("mockCurrentUserId");
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
      createdAt: now,
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
      body: JSON.stringify({ requirePasswordReset: true }),
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
  const currentUserId = window.localStorage.getItem("mockCurrentUserId");
  if (currentUserId) {
    const currentUser = mockUsers.find((user) => user.id === currentUserId);
    if (currentUser) {
      return { ...currentUser };
    }
  }

  if (!useBackend) {
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

export async function getChecklistTemplates() {
  if (!useBackend) {
    return getMockChecklistTemplates();
  }

  return fetchJSON<Record<ChecklistTemplateName, ChecklistItemTemplate[]>>(
    "/checklists",
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
    vehicleId: schedule.vehicleId,
    title: schedule.title,
    assignedDriver: schedule.assignedDriver,
    status: schedule.status,
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
    vehicleId: schedule.vehicleId,
    title: schedule.title,
    assignedDriver: schedule.assignedDriver,
    status: schedule.status,
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
} from "../mocks/vmmsMocks";
