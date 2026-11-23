export const AccountType = {
  IN_HOUSE: "IN_HOUSE",
  OUTSOURCED: "OUTSOURCED",
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const MaintenanceStatus = {
  PENDING: "PENDING",
  DUE: "DUE",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  COMPLETED: "COMPLETED",
  OVERDUE: "OVERDUE",
  CANCELLED: "CANCELLED",
} as const;

export type MaintenanceStatus =
  (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus];

export const MaintenancePriority = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;

export type MaintenancePriority =
  (typeof MaintenancePriority)[keyof typeof MaintenancePriority];

export const maintenancePriorityLabels: Record<MaintenancePriority, string> = {
  [MaintenancePriority.HIGH]: "High",
  [MaintenancePriority.MEDIUM]: "Medium",
  [MaintenancePriority.LOW]: "Low",
};

export const MaintenanceTriggerType = {
  MANUAL: "MANUAL",
  ODOMETER: "ODOMETER",
  TIME: "TIME",
} as const;

export type MaintenanceTriggerType =
  (typeof MaintenanceTriggerType)[keyof typeof MaintenanceTriggerType];

export const MaintenanceIntervalType = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  SEMI_ANNUALLY: "SEMI_ANNUALLY",
  ANNUALLY: "ANNUALLY",
} as const;

export type MaintenanceIntervalType =
  (typeof MaintenanceIntervalType)[keyof typeof MaintenanceIntervalType];

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PENDING]: "Pending",
  [MaintenanceStatus.DUE]: "Due",
  [MaintenanceStatus.IN_PROGRESS]: "In Progress",
  [MaintenanceStatus.DONE]: "Awaiting Review",
  [MaintenanceStatus.COMPLETED]: "Completed",
  [MaintenanceStatus.OVERDUE]: "Overdue",
  [MaintenanceStatus.CANCELLED]: "Cancelled",
};

export const accountTypeLabels: Record<AccountType, string> = {
  [AccountType.IN_HOUSE]: "In-House",
  [AccountType.OUTSOURCED]: "Outsourced",
};

export const maintenanceTriggerTypeLabels: Record<MaintenanceTriggerType, string> = {
  [MaintenanceTriggerType.MANUAL]: "Manual",
  [MaintenanceTriggerType.ODOMETER]: "Odometer",
  [MaintenanceTriggerType.TIME]: "Time-Based",
};

export const maintenanceIntervalTypeLabels: Record<MaintenanceIntervalType, string> = {
  [MaintenanceIntervalType.DAILY]: "Daily",
  [MaintenanceIntervalType.WEEKLY]: "Weekly",
  [MaintenanceIntervalType.MONTHLY]: "Monthly",
  [MaintenanceIntervalType.QUARTERLY]: "Quarterly",
  [MaintenanceIntervalType.SEMI_ANNUALLY]: "Semi-Annually",
  [MaintenanceIntervalType.ANNUALLY]: "Annually",
};

export interface MaintenanceTask {
  timeIntervalValue?: number | null;
  timeIntervalUnit?: 'DAYS' | 'MONTHS' | null;
  startDate?: string | null;
  targetDueDate?: string | null;
  checklistTemplateId?: string | null;
  dueDate?: string | null;
  dueOdometer?: number | null;
  computedStatus?: MaintenanceStatus;
  cancellations?: {
    id: string;
    actorId: string;
    actorName: string;
    actorEmail: string;
    reason: string;
    previousStatus: string;
    reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEGACY';
    reviewedById?: string | null;
    reviewedByName?: string | null;
    reviewedByEmail?: string | null;
    reviewReason?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
  }[];
  maintenanceLogUnlockRequests?: {
    id: string;
    actorId: string;
    actorName: string;
    reason: string;
    reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEGACY';
    reviewedAt?: string | null;
    activatedAt?: string | null;
    consumedAt?: string | null;
  }[];
  id: string;
  workOrderNumber?: string;
  logNumber?: string | null;
  vehicleId: string;
  title: string;
  status: MaintenanceStatus;
  priority?: MaintenancePriority;
  date: string;
  assignedDriver: string;
  assignedMechanicId?: string;
  assignedMechanicEmail?: string;
  chiefMechanicId?: string;
  chiefMechanic?: string;
  notes: string;
  garageId?: string | null;
  accountType?: AccountType;
  outsourcedProvider?: string;
  odometerReading?: string;
  systemAffected?: string;
  triggerType?: MaintenanceTriggerType;
  intervalKm?: string;
  bufferDistanceKm?: string;
  useVehicleDefaults?: boolean;
  startingReferenceReadingKm?: string;
  intervalType?: MaintenanceIntervalType;
  startReferenceDate?: string;
  workOrderProgress?: unknown;
  partsCost?: number | string;
  laborCost?: number | string;
  totalCost?: number | string;
  materialCost?: number | string;
  deletedAt?: string | null;
}

export interface MaintenancePrediction {
  scheduleId: string;
  workOrderNumber: string;
  vehicleId: string;
  title: string;
  currentOdometer: number;
  status: MaintenanceStatus;
  dueOdometer: number;
  remainingKm: number;
  daysUntilDue: number;
  dailyRateKm: number;
  estimatedDueDate: string;
  historyCount: number;
  historyStartDate: string;
  historyEndDate: string;
}
