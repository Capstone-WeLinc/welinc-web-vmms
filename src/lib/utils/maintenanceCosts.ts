import type { MaintenanceTask } from "../../types/maintenance";

const parseCostValue = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.toNumber === "function") {
      const numeric = record.toNumber();
      return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : 0;
    }
    if (typeof record.value !== "undefined") {
      return parseCostValue(record.value);
    }
  }

  return 0;
};

const readExecutionItems = (task: MaintenanceTask) => {
  const progress = task.workOrderProgress as unknown;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return [];

  const execution = (progress as { execution?: unknown }).execution;
  if (!execution || typeof execution !== "object" || Array.isArray(execution)) return [];

  const items = (execution as { items?: unknown }).items;
  return Array.isArray(items) ? items : [];
};

export const getTaskExecutionCost = (task: MaintenanceTask) => {
  return readExecutionItems(task).reduce((total, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return total;
    return total + parseCostValue((item as Record<string, unknown>).partsCost);
  }, 0);
};

export const getTaskTotalCost = (task: MaintenanceTask) => {
  const taskCost =
    parseCostValue((task as unknown as Record<string, unknown>).totalCost) ||
    parseCostValue((task as unknown as Record<string, unknown>).partsCost) ||
    parseCostValue((task as unknown as Record<string, unknown>).laborCost) ||
    parseCostValue((task as unknown as Record<string, unknown>).materialCost);

  if (taskCost > 0) {
    return taskCost;
  }

  return getTaskExecutionCost(task);
};
