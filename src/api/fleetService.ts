import { fetchJSON, useBackend } from "./requestClient";
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
} from "./mockData";

const fallbackVehicleOptions = [
  { value: "ABC 1234", label: "ABC 1234 - Truck Alpha" },
  { value: "DEF 5678", label: "DEF 5678 - Truck Bravo" },
  { value: "GHI 9012", label: "GHI 9012 - Truck Charlie" },
  { value: "JKL 3456", label: "JKL 3456 - Truck Delta" },
  { value: "MNO 7890", label: "MNO 7890 - Truck Echo" },
  { value: "PQR 2345", label: "PQR 2345 - Truck Foxtrot" },
  { value: "STU 6789", label: "STU 6789 - Truck Golf" },
  { value: "VWX 0123", label: "VWX 0123 - Truck Hotel" },
  { value: "YZA 4567", label: "YZA 4567 - Truck India" },
  { value: "BCD 8901", label: "BCD 8901 - Truck Juliet" },
  { value: "EFG 2345", label: "EFG 2345 - Truck Kilo" },
  { value: "HU 6789", label: "HU 6789 - Truck Lima" },
];
import type { MaintenanceTask, MaintenanceStatus } from "../types/maintenance";
import type {
  WorkOrderTemplate,
  ChecklistItemTemplate,
} from "../data/ChecklistData";
import type {
  UserStatus,
  UserRecord,
  UserRole,
  UserCreateInput,
} from "./mockData";

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
    status:
      typeof userObj.status === "string"
        ? userObj.status
        : userObj.isActive === false
        ? "Inactive"
        : "Active",
  } as UserRecord;
}

export async function login(
  username: string,
  password: string,
  system = "VMMS",
): Promise<{ accessToken: string }> {
  if (!useBackend) {
    const matchingUser = mockUsers.find((user) => user.username === username);
    if (!matchingUser) {
      throw new Error("Invalid username or password.");
    }

    const now = new Date().toISOString();
    matchingUser.lastActive = now;
    window.localStorage.setItem("mockCurrentUserId", matchingUser.id);

    return { accessToken: `mock-${matchingUser.id}` };
  }

  return fetchJSON<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, system }),
  });
}

export function logout() {
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

  try {
    const [vehicles, schedules] = await Promise.all([
      getVehicles(),
      getMaintenanceSchedules(),
    ]);

    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    const totalVehicles = String(vehicles.length);
    const activeWorkOrders = String(
      schedules.filter((s) => (s.status ?? "") !== "Completed").length,
    );
    const overdueMaintenance = String(
      schedules.filter((s) => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d < now && (s.status ?? "") !== "Completed";
      }).length,
    );
    const completedThisWeek = String(
      schedules.filter((s) => {
        if ((s.status ?? "") !== "Completed") return false;
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
  } catch (err) {
    console.error("Failed to load dashboard stats from backend", err);
    return mockDashboardStats;
  }
}

export async function getRecentActivity() {
  return mockRecentActivity;
}

export async function getUpcomingMaintenance() {
  return mockUpcomingMaintenance;
}

export async function getWorkOrders() {
  return getMaintenanceSchedules();
}

export async function getUsers() {
  if (!useBackend) return mockUsers.map((user) => normalizeUserRecord(user));

  return fetchJSON<UserRecord[]>("/users").then((users) =>
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
    const createdUser: UserRecord = {
      id: `u${Date.now()}`,
      name: user.name,
      username: user.username,
      role: user.role ?? "OPERATIONS",
      status: "Active",
      lastActive: new Date().toISOString(),
    };
    mockUsers.unshift(createdUser);
    return createdUser;
  }

  return fetchJSON<UserRecord>("/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
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

  return fetchJSON<UserRecord>(`/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateUser(
  userId: string,
  data: { name?: string; username?: string; passwordHash?: string },
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

  return fetchJSON<UserRecord>(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
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

  return fetchJSON<UserRecord>(`/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
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
  if (!useBackend) {
    const index = mockWorkOrders.findIndex((current) => current.id === task.id);
    if (index >= 0) {
      mockWorkOrders[index] = task;
    }
    return task;
  }

  return updateMaintenanceSchedule(task);
}

export async function getChecklistTemplates() {
  if (!useBackend) {
    return getMockChecklistTemplates();
  }

  return fetchJSON<Record<WorkOrderTemplate, ChecklistItemTemplate[]>>(
    "/checklists",
  );
}

export async function saveChecklistTemplates(
  templates: Record<WorkOrderTemplate, ChecklistItemTemplate[]>,
) {
  if (!useBackend) {
    return saveMockChecklistTemplates(templates);
  }

  return fetchJSON<Record<WorkOrderTemplate, ChecklistItemTemplate[]>>(
    "/checklists/sync",
    {
      method: "POST",
      body: JSON.stringify(templates),
    },
  );
}

export type CreateMaintenanceScheduleInput = Omit<MaintenanceTask, "id">;

export async function getMaintenanceSchedules() {
  if (!useBackend) return mockWorkOrders;

  return fetchJSON<MaintenanceTask[]>("/maintenance-schedules");
}

export async function createMaintenanceSchedule(
  schedule: CreateMaintenanceScheduleInput,
) {
  if (!useBackend) {
    const createdTask: MaintenanceTask = {
      ...schedule,
      id: `task-${Date.now()}`,
    };
    mockWorkOrders.unshift(createdTask);
    return createdTask;
  }

  // Backend expects a narrower DTO — only send supported fields
  const payload = {
    vehicleId: schedule.vehicleId,
    title: schedule.title,
    date: schedule.date,
    assignedDriver: schedule.assignedDriver,
    notes: schedule.notes,
    status: schedule.status,
    garageId: schedule.garageId,
    accountType: schedule.accountType,
    odometerReading: schedule.odometerReading,
    systemAffected: schedule.systemAffected,
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
  });
}

export async function updateMaintenanceSchedule(schedule: MaintenanceTask) {
  if (!useBackend) {
    const index = mockWorkOrders.findIndex(
      (current) => current.id === schedule.id,
    );
    if (index >= 0) {
      mockWorkOrders[index] = schedule;
      return schedule;
    }
    throw new Error("Maintenance schedule not found");
  }

  const payload = {
    vehicleId: schedule.vehicleId,
    title: schedule.title,
    date: schedule.date,
    assignedDriver: schedule.assignedDriver,
    notes: schedule.notes,
    status: schedule.status,
    garageId: schedule.garageId,
    accountType: schedule.accountType,
    odometerReading: schedule.odometerReading,
    systemAffected: schedule.systemAffected,
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
  );
}

export async function deleteMaintenanceSchedule(id: string) {
  if (!useBackend) {
    const index = mockWorkOrders.findIndex((current) => current.id === id);
    if (index >= 0) {
      mockWorkOrders.splice(index, 1);
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

export async function getVehicles() {
  if (!useBackend) return fallbackVehicleOptions;

  const vehicles = await fetchJSON<
    Array<{
      id: string;
      plateNumber: string;
      model: string;
    }>
  >("/vehicles");

  return vehicles.map((vehicle) => ({
    value: vehicle.plateNumber,
    label: `${vehicle.plateNumber} - ${vehicle.model}`,
  }));
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
  workOrderTemplate: string;
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
  WorkOrderTemplate,
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
} from "./mockData";
