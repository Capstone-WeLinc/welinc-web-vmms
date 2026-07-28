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

const fallbackOverview: AnalyticsOverviewResponse = {
  dataSource: {
    type: "LOCAL_FALLBACK",
    authoritativeFor: "PREPARED_ANALYTICS_AND_REPORTING",
    generatedAt: new Date().toISOString(),
    sourceMaxUpdatedAt: null,
    ageSeconds: 0,
    isStale: false,
    maxAgeMinutes: 1440,
  },
  snapshot: {
    totalVehicles: 14,
    totalSchedules: 28,
    pendingSchedules: 8,
    dueSchedules: 4,
    inProgressSchedules: 3,
    completedSchedules: 9,
    overdueSchedules: 4,
    totalMaintenanceCost: 125000,
  },
  statusBreakdown: [
    { status: "PENDING", scheduleCount: 8, percentage: 29 },
    { status: "DUE", scheduleCount: 4, percentage: 14 },
    { status: "IN_PROGRESS", scheduleCount: 3, percentage: 11 },
    { status: "COMPLETED", scheduleCount: 9, percentage: 32 },
    { status: "OVERDUE", scheduleCount: 4, percentage: 14 },
  ],
  monthlyTrend: [
    { monthKey: "2026-01", scheduledCount: 6, completedCount: 4, activeCount: 2, overdueCount: 1, maintenanceCost: 32000 },
    { monthKey: "2026-02", scheduledCount: 7, completedCount: 5, activeCount: 3, overdueCount: 1, maintenanceCost: 38000 },
    { monthKey: "2026-03", scheduledCount: 8, completedCount: 6, activeCount: 4, overdueCount: 2, maintenanceCost: 42000 },
  ],
};

const fallbackAlerts: AnalyticsAlertResponse = {
  dataSource: fallbackOverview.dataSource,
  alerts: [
    {
      alertId: "ALERT-001",
      severity: "HIGH",
      alertType: "OVERDUE",
      maintenanceTitle: "Brake inspection",
      message: "Brake inspection is overdue for Truck Alpha.",
      recommendedAction: "Assign a mechanic immediately.",
      dueDate: new Date().toISOString(),
    },
    {
      alertId: "ALERT-002",
      severity: "MEDIUM",
      alertType: "UPCOMING",
      maintenanceTitle: "Oil change",
      message: "Oil change is due in the next 7 days.",
      recommendedAction: "Schedule the service window.",
      dueDate: new Date().toISOString(),
    },
  ],
};

export async function getAnalyticsOverview(): Promise<AnalyticsOverviewResponse> {
  try {
    return await fetchJSON<AnalyticsOverviewResponse>("/vmms/analytics/overview");
  } catch (error) {
    console.warn("Analytics overview unavailable, using fallback data.", error);
    return fallbackOverview;
  }
}

export async function getAnalyticsVehicles(): Promise<AnalyticsVehicleResponse> {
  try {
    return await fetchJSON<AnalyticsVehicleResponse>("/vmms/analytics/vehicles");
  } catch (error) {
    console.warn("Analytics vehicle KPIs unavailable, using fallback data.", error);
    return {
      dataSource: fallbackOverview.dataSource,
      vehicles: [
        {
          vehicleId: "V-001",
          plateNumber: "ABC 1234",
          vehicleModel: "Isuzu FVZ",
          vehicleStatus: "AVAILABLE",
          currentOdometer: 126500,
          totalSchedules: 5,
          activeSchedules: 2,
          completedSchedules: 3,
          overdueSchedules: 0,
          dueWithin7Days: 1,
          maintenanceCost: 18000,
          completionRate: 60,
          latestMaintenanceDate: new Date().toISOString(),
          nextDueDate: new Date().toISOString(),
          riskLevel: "MEDIUM",
        },
      ],
    };
  }
}

export async function getAnalyticsAlerts(): Promise<AnalyticsAlertResponse> {
  try {
    return await fetchJSON<AnalyticsAlertResponse>("/vmms/analytics/alerts");
  } catch (error) {
    console.warn("Analytics alerts unavailable, using fallback data.", error);
    return fallbackAlerts;
  }
}

export async function getAnalyticsReport(): Promise<AnalyticsReportResponse> {
  try {
    return await fetchJSON<AnalyticsReportResponse>("/vmms/analytics/report");
  } catch (error) {
    console.warn("Analytics report unavailable, using fallback data.", error);
    return {
      ...fallbackOverview,
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
    const results = await fetchJSON<ScheduleSearchResult[]>(
      `/maintenance-schedules/search?q=${encodeURIComponent(trimmedQuery)}&limit=${limit}`,
    );
    return results;
  } catch (error) {
    console.warn("Schedule search endpoint unavailable, falling back to local search.", error);
    const schedules = await getMaintenanceSchedules();
    const normalizedQuery = trimmedQuery.toLowerCase();

    const fallbackResults = schedules
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
        score: 1,
      }));

    return fallbackResults;
  }
}
