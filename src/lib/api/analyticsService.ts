import { fetchJSON } from "./httpClient";
import { getMaintenanceSchedules } from "./maintenanceService";

export interface AnalyticsOverviewResponse {
  dataSource: {
    type: string;
    authoritativeFor: string;
    generatedAt: string;
    sourceMaxUpdatedAt: string | null;
    ageSeconds: number | null;
    isStale: boolean;
    maxAgeMinutes: number;
  };
  snapshot: Record<string, unknown>;
  statusBreakdown: Array<Record<string, unknown>>;
  monthlyTrend: Array<Record<string, unknown>>;
}

export interface AnalyticsVehicleResponse {
  dataSource: {
    type: string;
    authoritativeFor: string;
    generatedAt: string;
    sourceMaxUpdatedAt: string | null;
    ageSeconds: number | null;
    isStale: boolean;
    maxAgeMinutes: number;
  };
  vehicles: Array<Record<string, unknown>>;
}

export interface AnalyticsAlertResponse {
  dataSource: {
    type: string;
    authoritativeFor: string;
    generatedAt: string;
    sourceMaxUpdatedAt: string | null;
    ageSeconds: number | null;
    isStale: boolean;
    maxAgeMinutes: number;
  };
  alerts: Array<Record<string, unknown>>;
}

export interface AnalyticsReportResponse {
  dataSource: {
    type: string;
    authoritativeFor: string;
    generatedAt: string;
    sourceMaxUpdatedAt: string | null;
    ageSeconds: number | null;
    isStale: boolean;
    maxAgeMinutes: number;
  };
  snapshot: Record<string, unknown>;
  statusBreakdown: Array<Record<string, unknown>>;
  monthlyTrend: Array<Record<string, unknown>>;
  vehicles: Array<Record<string, unknown>>;
  alerts: Array<Record<string, unknown>>;
  schedules: Array<Record<string, unknown>>;
}

export interface ScheduleSearchResult {
  id: string;
  vehicleId: string;
  title: string;
  status: string;
  date: string;
  assignedMechanic: string | null;
  assignedDriver: string | null;
  accountType: string | null;
  checklistTemplateId: string | null;
  garageId: string | null;
  odometerReading: string | null;
  triggerType: string | null;
  intervalKm: string | null;
  bufferDistanceKm: string | null;
  startingReferenceReadingKm: string | null;
  intervalType: string | null;
  startReferenceDate: string | null;
  previousScheduleId: string | null;
  workOrderProgress: unknown;
  score?: number;
}

function calculateScheduleProgress(schedule: { status?: string; workOrderProgress?: unknown }): number {
  const progress = schedule.workOrderProgress;

  if (progress && typeof progress === "object" && !Array.isArray(progress)) {
    const progressData = progress as Record<string, unknown>;
    const checklist = Array.isArray(progressData.checklist)
      ? (progressData.checklist as Array<Record<string, unknown>>)
      : [];

    if (checklist.length > 0) {
      const completedItems = checklist.filter((item) => {
        const status = String(item.status ?? "").toLowerCase();
        return ["done", "completed", "complete", "pass", "passed", "checked", "finished", "success"].includes(status);
      }).length;

      return Math.round((completedItems / checklist.length) * 100);
    }

    const execution = progressData.execution;
    if (execution && typeof execution === "object" && !Array.isArray(execution)) {
      const executionData = execution as Record<string, unknown>;
      const items = Array.isArray(executionData.items)
        ? (executionData.items as Array<Record<string, unknown>>)
        : [];

      if (items.length > 0) {
        const completedItems = items.filter((item) => {
          const status = String(item.status ?? "").toLowerCase();
          return ["done", "completed", "complete", "pass", "passed", "checked", "finished", "success"].includes(status);
        }).length;

        return Math.round((completedItems / items.length) * 100);
      }

      if (executionData.done === true) {
        return 100;
      }
    }
  }

  switch (String(schedule.status ?? "").toUpperCase()) {
    case "COMPLETED":
      return 100;
    case "IN_PROGRESS":
      return 60;
    case "OVERDUE":
      return 35;
    case "DUE":
      return 20;
    default:
      return 0;
  }
}

const emptyOverview: AnalyticsOverviewResponse = {
  dataSource: {
    type: "UNAVAILABLE",
    authoritativeFor: "",
    generatedAt: "",
    sourceMaxUpdatedAt: null,
    ageSeconds: null,
    isStale: true,
    maxAgeMinutes: 0,
  },
  snapshot: {},
  statusBreakdown: [],
  monthlyTrend: [],
};

const emptyVehicles: AnalyticsVehicleResponse = {
  dataSource: emptyOverview.dataSource,
  vehicles: [],
};

const emptyAlerts: AnalyticsAlertResponse = {
  dataSource: emptyOverview.dataSource,
  alerts: [],
};

export async function getAnalyticsOverview(): Promise<AnalyticsOverviewResponse> {
  try {
    return await fetchJSON<AnalyticsOverviewResponse>("/vmms/analytics/overview");
  } catch (error) {
    console.warn("Analytics overview unavailable.", error);
    return emptyOverview;
  }
}

export async function getAnalyticsVehicles(): Promise<AnalyticsVehicleResponse> {
  try {
    return await fetchJSON<AnalyticsVehicleResponse>("/vmms/analytics/vehicles");
  } catch (error) {
    console.warn("Analytics vehicle KPIs unavailable.", error);
    return emptyVehicles;
  }
}

export async function getAnalyticsAlerts(): Promise<AnalyticsAlertResponse> {
  try {
    return await fetchJSON<AnalyticsAlertResponse>("/vmms/analytics/alerts");
  } catch (error) {
    console.warn("Analytics alerts unavailable.", error);
    return emptyAlerts;
  }
}

export async function getAnalyticsReport(): Promise<AnalyticsReportResponse> {
  try {
    return await fetchJSON<AnalyticsReportResponse>("/vmms/analytics/report");
  } catch (error) {
    console.warn("Analytics report unavailable.", error);
    return {
      ...emptyOverview,
      vehicles: [],
      alerts: [],
      schedules: [],
    } as AnalyticsReportResponse;
  }
}

export async function searchMaintenanceSchedules(query: string, limit = 8): Promise<ScheduleSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  try {
    const schedules = await getMaintenanceSchedules();
    const normalizedQuery = trimmedQuery.toLowerCase();

    return schedules
      .filter((schedule) => {
        const haystack = [
          schedule.title,
          schedule.vehicleId,
          schedule.assignedDriver,
          schedule.assignedMechanicId,
          schedule.status,
          schedule.date,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .slice(0, limit)
      .map((schedule) => ({
        id: schedule.id,
        vehicleId: schedule.vehicleId,
        title: schedule.title,
        status: schedule.status,
        date: schedule.date,
        assignedMechanic: schedule.assignedMechanicId ?? null,
        assignedDriver: schedule.assignedDriver ?? null,
        accountType: schedule.accountType ?? null,
        checklistTemplateId: null,
        garageId: schedule.garageId ?? null,
        odometerReading: schedule.odometerReading ?? null,
        triggerType: schedule.triggerType ?? null,
        intervalKm: schedule.intervalKm ?? null,
        bufferDistanceKm: schedule.bufferDistanceKm ?? null,
        startingReferenceReadingKm: schedule.startingReferenceReadingKm ?? null,
        intervalType: schedule.intervalType ?? null,
        startReferenceDate: schedule.startReferenceDate ?? null,
        previousScheduleId: null,
        workOrderProgress: schedule.workOrderProgress ?? null,
        score: calculateScheduleProgress(schedule),
      }));
  } catch (error) {
    console.warn("Schedule search is unavailable.", error);
    return [];
  }
}
