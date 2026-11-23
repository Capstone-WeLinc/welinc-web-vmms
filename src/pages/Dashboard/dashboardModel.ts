import { type VmmsDashboardData } from "../../lib/api/dashboardService";
import type { FuelAnomalyRecord } from "../../lib/api/fuelService";
import {
  MaintenanceStatus,
  type MaintenanceTask,
} from "../../types/maintenance";
import { getTaskTotalCost } from "../../lib/utils/maintenanceCosts";

export type DashboardRange = "all" | "today" | "month" | "custom";

export type DashboardFilters = {
  range: DashboardRange;
  from: string;
  to: string;
};

export type DashboardPeriod = {
  range: DashboardRange;
  label: string;
  from: Date | null;
  to: Date | null;
  isBounded: boolean;
  isValid: boolean;
  attributionNote: string;
};

export type AttentionItem = {
  id: string;
  primary: string;
  secondary: string;
  status?: MaintenanceStatus | string;
  href: string;
  ctaLabel: string;
  meta?: string;
};

export type DashboardViewModel = {
  period: DashboardPeriod;
  visibleSchedules: MaintenanceTask[];
  current: {
    totalVehicles: number;
    vehiclesUnderMaintenance: number;
    activeWorkOrders: number;
    due: number;
    overdue: number;
    openFuelAnomalies: number;
    openFuelAnomalyVehicles: number;
    awaitingReview: number;
    completedAll: number;
  };
  periodActivity: {
    workOrdersInPeriod: number;
    completedInPeriodByDate: number;
    maintenanceCostInPeriod: number;
  };
  queues: {
    overdue: AttentionItem[];
    dueSoon: AttentionItem[];
    awaitingReview: AttentionItem[];
    openAnomalies: AttentionItem[];
  };
  statusBreakdown: Array<{ status: MaintenanceStatus; label: string; count: number }>;
  garageWorkload: Array<{ id: string; name: string; active: number }>;
  recentWorkOrders: AttentionItem[];
};

type RoleAwareUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null } | string | null> | null;
} | null;

const MANILA_TZ = "Asia/Manila";
const MS_PER_DAY = 86_400_000;

const ACTIVE_STATUSES = new Set<MaintenanceStatus>([
  MaintenanceStatus.DUE,
  MaintenanceStatus.IN_PROGRESS,
  MaintenanceStatus.OVERDUE,
]);

export const DEFAULT_FILTERS: DashboardFilters = {
  range: "all",
  from: "",
  to: "",
};

export function getManilaDateString(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function normalizeFilters(
  range: string | null,
  from: string | null,
  to: string | null,
): DashboardFilters {
  const normalizedRange: DashboardRange =
    range === "today" || range === "month" || range === "custom" || range === "all"
      ? range
      : "all";
  return {
    range: normalizedRange,
    from: from ?? "",
    to: to ?? "",
  };
}

export function resolvePeriod(filters: DashboardFilters, now = new Date()): DashboardPeriod {
  if (filters.range === "all") {
    return {
      range: "all",
      label: "All records",
      from: null,
      to: null,
      isBounded: false,
      isValid: true,
      attributionNote: "Current metrics show live operational state. Period totals are not bounded.",
    };
  }

  const todayManila = getManilaDateString(now);
  if (filters.range === "today") {
    const date = parseDateInput(todayManila)!;
    return {
      range: "today",
      label: "Today (Manila)",
      from: startOfDay(date),
      to: endOfDay(date),
      isBounded: true,
      isValid: true,
      attributionNote: "Period metrics include work orders whose recorded date falls within the selected day (Manila).",
    };
  }

  if (filters.range === "month") {
    const [year, month] = todayManila.split("-").map(Number);
    const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const to = new Date(year, month, 0, 23, 59, 59, 999);
    return {
      range: "month",
      label: "This month (Manila)",
      from,
      to,
      isBounded: true,
      isValid: true,
      attributionNote: "Period metrics include work orders whose recorded date falls within the current Manila month.",
    };
  }

  const from = filters.from ? parseDateInput(filters.from) : null;
  const to = filters.to ? parseDateInput(filters.to) : null;
  if (!from || !to || from.getTime() > to.getTime()) {
    return {
      range: "custom",
      label: "Custom range",
      from: null,
      to: null,
      isBounded: false,
      isValid: false,
      attributionNote: "Select a valid start and end date to apply period activity metrics.",
    };
  }

  return {
    range: "custom",
    label: `${filters.from} to ${filters.to}`,
    from: startOfDay(from),
    to: endOfDay(to),
    isBounded: true,
    isValid: true,
    attributionNote: "Period metrics include work orders whose recorded date falls within the selected range.",
  };
}

function getRecordedDate(task: MaintenanceTask): Date | null {
  const raw = task.date || task.startReferenceDate || "";
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDueCandidateDate(task: MaintenanceTask): Date | null {
  const raw =
    task.targetDueDate || task.dueDate || task.startDate || task.startReferenceDate || task.date || "";
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinPeriod(value: Date | null, period: DashboardPeriod): boolean {
  if (!period.isBounded || !period.from || !period.to || !value) return false;
  const time = value.getTime();
  return time >= period.from.getTime() && time <= period.to.getTime();
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function scopeSchedulesForUser(
  schedules: MaintenanceTask[],
  currentUser: RoleAwareUser,
  isMechanic: boolean,
): MaintenanceTask[] {
  if (!isMechanic || !currentUser) return schedules;
  const userId = normalizeText(currentUser.id);
  const name = normalizeText(currentUser.name);
  const email = normalizeText(currentUser.email);
  return schedules.filter((task) => {
    const assignedMechanicId = normalizeText(task.assignedMechanicId);
    const assignedMechanicEmail = normalizeText(task.assignedMechanicEmail);
    const assignedDriver = normalizeText(task.assignedDriver);
    return (
      (!!userId && assignedMechanicId === userId) ||
      (!!email && assignedMechanicEmail === email) ||
      (!!name && assignedDriver === name)
    );
  });
}

function vehicleLabel(task: MaintenanceTask, data: VmmsDashboardData) {
  const vehicle = data.vehicles.find((item) => item.id === task.vehicleId || item.value === task.vehicleId);
  return vehicle?.label || vehicle?.plateNumber || vehicle?.value || task.vehicleId || "Unknown vehicle";
}

function vehiclePlate(task: MaintenanceTask, data: VmmsDashboardData) {
  const vehicle = data.vehicles.find((item) => item.id === task.vehicleId || item.value === task.vehicleId);
  return vehicle?.plateNumber || vehicle?.value || task.vehicleId || "N/A";
}

function formatRecordedDate(task: MaintenanceTask) {
  const value = getRecordedDate(task);
  if (!value) return "No recorded date";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function daysFromNow(target: Date, now: Date) {
  return Math.ceil((startOfDay(target).getTime() - startOfDay(now).getTime()) / MS_PER_DAY);
}

export function buildModel(args: {
  data: VmmsDashboardData;
  schedules: MaintenanceTask[];
  fuelAnomalies: FuelAnomalyRecord[];
  filters: DashboardFilters;
  now?: Date;
}): DashboardViewModel {
  const now = args.now ?? new Date();
  const period = resolvePeriod(args.filters, now);
  const schedules = args.schedules;
  const data = args.data;

  const isPeriodMatch = (task: MaintenanceTask) =>
    !period.isBounded || (period.isValid && isWithinPeriod(getRecordedDate(task), period));

  const periodSchedules = schedules.filter(isPeriodMatch);

  const activeWorkOrders = schedules.filter((task) => ACTIVE_STATUSES.has(task.status));
  const vehiclesUnderMaintenance = new Set(activeWorkOrders.map((task) => task.vehicleId)).size;
  const due = schedules.filter((task) => task.status === MaintenanceStatus.DUE).length;
  const overdueTasks = schedules.filter((task) => task.status === MaintenanceStatus.OVERDUE);
  const awaitingReviewTasks = schedules.filter((task) => task.status === MaintenanceStatus.DONE);
  const completedAll = schedules.filter((task) => task.status === MaintenanceStatus.COMPLETED).length;

  const openAnomalies = args.fuelAnomalies.filter((anomaly) => String(anomaly.status).toUpperCase() === "OPEN");
  const openFuelAnomalyVehicles = new Set(
    openAnomalies.map((anomaly) => anomaly.vehicle?.plateNumber || anomaly.vehicle?.model || anomaly.id),
  ).size;

  const completedInPeriodByDate = periodSchedules.filter(
    (task) => task.status === MaintenanceStatus.COMPLETED,
  ).length;
  const maintenanceCostInPeriod = periodSchedules.reduce(
    (total, task) => total + getTaskTotalCost(task),
    0,
  );

  const dueSoon = schedules
    .filter((task) => {
      if (
        task.status === MaintenanceStatus.OVERDUE ||
        task.status === MaintenanceStatus.COMPLETED ||
        task.status === MaintenanceStatus.CANCELLED ||
        task.status === MaintenanceStatus.DONE ||
        task.status === MaintenanceStatus.DUE
      ) {
        return false;
      }
      const dueDate = getDueCandidateDate(task);
      if (!dueDate) return false;
      const diff = daysFromNow(dueDate, now);
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => (getDueCandidateDate(a)?.getTime() ?? 0) - (getDueCandidateDate(b)?.getTime() ?? 0))
    .slice(0, 5)
    .map((task) => {
      const dueDate = getDueCandidateDate(task)!;
      const diff = daysFromNow(dueDate, now);
      return {
        id: task.id,
        primary: vehicleLabel(task, data),
        secondary: task.assignedDriver || "Unassigned mechanic",
        status: task.status,
        href: `/maintenance-scheduling?search=${encodeURIComponent(task.workOrderNumber ?? task.title ?? "")}`,
        ctaLabel: "Open schedule",
        meta: diff === 0 ? "Due today (by date)" : `Due in ${diff} day${diff === 1 ? "" : "s"}`,
      } satisfies AttentionItem;
    });

  const overdueQueue = [...overdueTasks]
    .sort((a, b) => (getRecordedDate(a)?.getTime() ?? 0) - (getRecordedDate(b)?.getTime() ?? 0))
    .slice(0, 5)
    .map((task) => {
      const ref = getDueCandidateDate(task) || getRecordedDate(task);
      const days = ref ? Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(ref).getTime()) / MS_PER_DAY)) : null;
      return {
        id: task.id,
        primary: vehicleLabel(task, data),
        secondary: task.assignedDriver || "Unassigned mechanic",
        status: task.status,
        href: `/work-orders?search=${encodeURIComponent(task.workOrderNumber ?? task.title ?? "")}`,
        ctaLabel: "Open work order",
        meta: days == null ? "Overdue" : `${days} day${days === 1 ? "" : "s"} overdue`,
      } satisfies AttentionItem;
    });

  const awaitingReviewQueue = [...awaitingReviewTasks]
    .sort((a, b) => (getRecordedDate(b)?.getTime() ?? 0) - (getRecordedDate(a)?.getTime() ?? 0))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      primary: task.workOrderNumber ?? vehiclePlate(task, data),
      secondary: vehicleLabel(task, data),
      status: task.status,
      href: `/work-orders?search=${encodeURIComponent(task.workOrderNumber ?? task.title ?? "")}`,
      ctaLabel: "Review work order",
      meta: formatRecordedDate(task),
    }));

  const openAnomalyQueue = [...openAnomalies]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((anomaly) => ({
      id: anomaly.id,
      primary: anomaly.vehicle?.plateNumber || anomaly.vehicle?.model || "Unknown vehicle",
      secondary: anomaly.fillUp?.station?.name || "Fuel anomaly",
      status: String(anomaly.status),
      href: "/fuel-management",
      ctaLabel: "Open fuel management",
      meta: anomaly.severity ? `${anomaly.severity} severity` : "Open",
    }));

  const garageNameById = new Map(data.garages.map((garage) => [garage.id, garage.name]));
  const workloadMap = new Map<string, { id: string; name: string; active: number }>();
  for (const task of activeWorkOrders) {
    const garageId = task.garageId || "unassigned";
    const existing = workloadMap.get(garageId) || {
      id: garageId,
      name: garageNameById.get(garageId) || (garageId === "unassigned" ? "Unassigned garage" : garageId),
      active: 0,
    };
    existing.active += 1;
    workloadMap.set(garageId, existing);
  }
  const garageWorkload = [...workloadMap.values()].sort((a, b) => b.active - a.active).slice(0, 6);

  const statusBreakdown: DashboardViewModel["statusBreakdown"] = [
    MaintenanceStatus.PENDING,
    MaintenanceStatus.DUE,
    MaintenanceStatus.IN_PROGRESS,
    MaintenanceStatus.DONE,
    MaintenanceStatus.COMPLETED,
    MaintenanceStatus.OVERDUE,
  ].map((status) => ({
    status,
    label: status,
    count: schedules.filter((task) => task.status === status).length,
  }));

  const recentWorkOrders = [...schedules]
    .sort((a, b) => (getRecordedDate(b)?.getTime() ?? 0) - (getRecordedDate(a)?.getTime() ?? 0))
    .slice(0, 8)
    .map((task) => ({
      id: task.id,
      primary: task.workOrderNumber ?? vehiclePlate(task, data),
      secondary: `${vehicleLabel(task, data)} • ${task.assignedDriver || "Unassigned mechanic"}`,
      status: task.status,
      href: `/work-orders?search=${encodeURIComponent(task.workOrderNumber ?? task.title ?? "")}`,
      ctaLabel: "Open work order",
      meta: formatRecordedDate(task),
    }));

  return {
    period,
    visibleSchedules: schedules,
    current: {
      totalVehicles: data.vehicles.length,
      vehiclesUnderMaintenance,
      activeWorkOrders: activeWorkOrders.length,
      due,
      overdue: overdueTasks.length,
      openFuelAnomalies: openAnomalies.length,
      openFuelAnomalyVehicles,
      awaitingReview: awaitingReviewTasks.length,
      completedAll,
    },
    periodActivity: {
      workOrdersInPeriod: periodSchedules.length,
      completedInPeriodByDate,
      maintenanceCostInPeriod,
    },
    queues: {
      overdue: overdueQueue,
      dueSoon,
      awaitingReview: awaitingReviewQueue,
      openAnomalies: openAnomalyQueue,
    },
    statusBreakdown,
    garageWorkload,
    recentWorkOrders,
  };
}

export function formatPhp(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
