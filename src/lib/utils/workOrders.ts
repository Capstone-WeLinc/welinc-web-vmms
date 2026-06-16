import type { MaintenanceTask } from "../../types/maintenance";

export const formatWorkOrderNumber = (id: string) => {
  const numericSuffix = id.match(/^(?:task-)?(\d+)$/i)?.[1];

  if (numericSuffix) {
    return `WO-${numericSuffix.slice(-6).padStart(6, "0")}`;
  }

  const normalizedId = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `WO-${normalizedId.slice(0, 8).padEnd(8, "0")}`;
};

const parseKm = (value?: string | null) => {
  if (!value?.trim()) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseLocalDate = (value?: string | null) => {
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

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addIntervalToDate = (
  date: Date,
  intervalType?: string | null,
) => {
  const dueDate = new Date(date);

  if (intervalType === "DAILY") {
    dueDate.setDate(dueDate.getDate() + 1);
    return dueDate;
  }

  if (intervalType === "WEEKLY") {
    dueDate.setDate(dueDate.getDate() + 7);
    return dueDate;
  }

  if (intervalType === "MONTHLY") {
    dueDate.setMonth(dueDate.getMonth() + 1);
    return dueDate;
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

  return {
    minimum: targetReading - buffer,
    maximum: targetReading + buffer,
  };
};

export const isPendingOdometerScheduleReadyForMechanic = (
  task: MaintenanceTask,
) => {
  if (task.status !== "Pending" || task.triggerType !== "ODOMETER") {
    return true;
  }

  const odometerReading = parseKm(task.odometerReading);
  const activationRange = getOdometerActivationRange(task);

  if (odometerReading === null || !activationRange) {
    return false;
  }

  return (
    odometerReading >= activationRange.minimum &&
    odometerReading <= activationRange.maximum
  );
};

export const getTimeBasedActivationDate = (task: MaintenanceTask) => {
  const startReferenceDate = parseLocalDate(task.startReferenceDate);
  if (!startReferenceDate) return null;

  return addIntervalToDate(startReferenceDate, task.intervalType);
};

export const isPendingTimeScheduleReadyForMechanic = (
  task: MaintenanceTask,
  currentDate = new Date(),
) => {
  if (task.status !== "Pending" || task.triggerType !== "TIME") {
    return true;
  }

  const activationDate = getTimeBasedActivationDate(task);
  const scheduledDate = parseLocalDate(task.date);
  if (!activationDate || !scheduledDate) return false;

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  return (
    formatLocalDate(scheduledDate) === formatLocalDate(activationDate) &&
    today.getTime() >= activationDate.getTime()
  );
};
