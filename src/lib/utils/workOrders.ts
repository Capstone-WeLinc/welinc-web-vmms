import {
  MaintenanceIntervalType,
  MaintenanceStatus,
  MaintenanceTriggerType,
  type MaintenanceTask,
} from "../../types/maintenance.ts";
import { timeIntervalDueDate } from './timeInterval.ts';

export const normalizeMaintenanceStatus = (status?: string | null) =>
  (status ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");

export const isPendingStatus = (status?: string | null) =>
  normalizeMaintenanceStatus(status) === "pending";

export const isDueStatus = (status?: string | null) =>
  normalizeMaintenanceStatus(status) === "due";

export const isInProgressStatus = (status?: string | null) =>
  normalizeMaintenanceStatus(status) === "in-progress" ||
  normalizeMaintenanceStatus(status) === "in-progress";

export const isDoneStatus = (status?: string | null) =>
  normalizeMaintenanceStatus(status) === "done";

export const isOverdueStatus = (status?: string | null) =>
  normalizeMaintenanceStatus(status) === "overdue";

export const getNextWorkOrderId = (tasks: Pick<MaintenanceTask, "id">[]) => {
  const nextNumber =
    tasks.reduce((highest, task) => {
      const match = task.id.match(/^(?:task-)?(\d+)$/i);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0) + 1;

  return `task-${nextNumber}`;
};

export const formatLogNumber = (id: string) => {
  const numericSuffix = id.match(/^(?:task-)?(\d+)$/i)?.[1];

  if (numericSuffix) {
    return `LOG-${numericSuffix.slice(-6).padStart(6, "0")}`;
  }

  const normalizedId = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `LOG-${normalizedId.slice(0, 8).padEnd(8, "0")}`;
};

export const parseKm = (value?: string | null) => {
  if (!value?.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseLocalDate = (value?: string | null) => {
  if (!value?.trim()) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  parsed.setHours(0, 0, 0, 0);

  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }

  return parsed;
};

export const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addIntervalToDate = (
  date: Date,
  intervalType?: string | null,
) => {
  const dueDate = new Date(date);

  const addMonths = (months: number) => {
    const originalDay = dueDate.getDate();
    dueDate.setDate(1);
    dueDate.setMonth(dueDate.getMonth() + months);
    const lastDayOfTargetMonth = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth() + 1,
      0,
    ).getDate();
    dueDate.setDate(Math.min(originalDay, lastDayOfTargetMonth));
    return dueDate;
  };

  if (intervalType === MaintenanceIntervalType.DAILY) {
    dueDate.setDate(dueDate.getDate() + 1);
    return dueDate;
  }

  if (intervalType === MaintenanceIntervalType.WEEKLY) {
    dueDate.setDate(dueDate.getDate() + 7);
    return dueDate;
  }

  if (intervalType === MaintenanceIntervalType.MONTHLY) {
    return addMonths(1);
  }

  if (intervalType === MaintenanceIntervalType.QUARTERLY) {
    return addMonths(3);
  }

  if (intervalType === MaintenanceIntervalType.SEMI_ANNUALLY) {
    return addMonths(6);
  }

  if (intervalType === MaintenanceIntervalType.ANNUALLY) {
    return addMonths(12);
  }

  return null;
};

export const getOdometerActivationRange = (task: MaintenanceTask) => {
  const startingReference = parseKm(task.startingReferenceReadingKm);
  const interval = parseKm(task.intervalKm);
  const buffer = parseKm(task.bufferDistanceKm);

  if (
    startingReference === null ||
    interval === null ||
    buffer === null
  ) {
    return null;
  }

  const targetReading = startingReference + interval;
  const activationMileage = targetReading - buffer;

  return {
    minimum: activationMileage,
    maximum: targetReading,
    activationMileage,
    dueMileage: targetReading,
    startingReference,
    interval,
    buffer,
  };
};

export const getOdometerMilestones = getOdometerActivationRange;

export const getCalculatedMaintenanceStatus = (
  task: MaintenanceTask,
  currentDate = new Date(),
): MaintenanceTask["status"] => {
  const normalized = normalizeMaintenanceStatus(task.status);
  if (normalized === "completed") return MaintenanceStatus.COMPLETED;
  if (normalized === "cancelled") return MaintenanceStatus.CANCELLED;
  if (normalized === "done") return MaintenanceStatus.DONE;
  if (normalized === "in-progress") return MaintenanceStatus.IN_PROGRESS;

  const fallbackStatus =
    normalized === "overdue"
      ? MaintenanceStatus.OVERDUE
      : normalized === "due"
        ? MaintenanceStatus.DUE
        : MaintenanceStatus.PENDING;

  if (task.triggerType === MaintenanceTriggerType.ODOMETER) {
    const odometerReading = parseKm(task.odometerReading);
    const milestones = getOdometerMilestones(task);

    if (odometerReading === null || !milestones) return fallbackStatus;
    if (odometerReading < milestones.activationMileage) return MaintenanceStatus.PENDING;
    if (odometerReading <= milestones.dueMileage) return MaintenanceStatus.DUE;
    return MaintenanceStatus.OVERDUE;
  }

  if (task.triggerType === MaintenanceTriggerType.TIME) {
    const dueDate = parseLocalDate(task.targetDueDate) ?? parseLocalDate(task.dueDate) ?? getTimeBasedActivationDate(task);
    if (!dueDate) return fallbackStatus;

    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (today.getTime() < dueDate.getTime()) return MaintenanceStatus.PENDING;
    if (today.getTime() === dueDate.getTime()) return MaintenanceStatus.DUE;
    return MaintenanceStatus.OVERDUE;
  }

  return fallbackStatus;
};

export const isScheduleReadyForMechanic = (
  task: MaintenanceTask,
  currentDate = new Date(),
) => {
  const status = getCalculatedMaintenanceStatus(task, currentDate);
  return (
    status === MaintenanceStatus.DUE ||
    status === MaintenanceStatus.OVERDUE ||
    status === MaintenanceStatus.IN_PROGRESS
  );
};

export const isPendingOdometerScheduleReadyForMechanic = (
  task: MaintenanceTask,
) => {
  if (!isPendingStatus(task.status) || task.triggerType !== MaintenanceTriggerType.ODOMETER) {
    return true;
  }

  return isScheduleReadyForMechanic(task);
};

export const getTimeBasedActivationDate = (task: MaintenanceTask) => {
  const startReferenceDate = parseLocalDate(task.startReferenceDate);
  if (!startReferenceDate) return null;

  return timeIntervalDueDate(startReferenceDate, task);
};

export const isPendingTimeScheduleReadyForMechanic = (
  task: MaintenanceTask,
  currentDate = new Date(),
) => {
  if (!isPendingStatus(task.status) || task.triggerType !== MaintenanceTriggerType.TIME) {
    return true;
  }

  return isScheduleReadyForMechanic(task, currentDate);
};
