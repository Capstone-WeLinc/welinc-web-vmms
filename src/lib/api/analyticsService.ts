import { fetchJSON } from "./httpClient";
import { getMaintenanceSchedules } from "./maintenanceService";

export interface AnalyticsHealthResponse {
  status: string;
  service: string;
  mode: string;
  port: number | string;
}

export interface AnalyticsSnapshot {
  totalVehicles?: number;
  totalSchedules?: number;
  pendingSchedules?: number;
  inProgressSchedules?: number;
  overdueSchedules?: number;
  completedSchedules?: number;
  dueWithin7Days?: number;
  activeMaintenanceVehicles?: number;
  totalMaintenanceCost?: number;
  averageOdometer?: number;
  completionRate?: number;
  fleetPerformance?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

export interface SummaryMetrics {
  overdueRate: number;
  dueSoonRate: number;
  pendingRate: number;
  activeFleetRate: number;
  avgCostPerSchedule: number;
  avgCostPerVehicle: number;
}

export interface PredictiveForecast {
  dueIn7Days: number;
  dueIn30Days: number;
  dueIn90Days: number;
}

export interface RepeatedFailureAnomaly {
  vehiclePlate: string;
  maintenanceTitle: string;
  incidentCount: number;
}

export interface MissingDateAnomaly {
  vehiclePlate: string;
  maintenanceTitle: string;
  scheduleId: string | number;
}

export interface AnomaliesResponse {
  repeatedFailures: RepeatedFailureAnomaly[];
  missingDates: MissingDateAnomaly[];
}

export interface TopMaintenanceType {
  maintenanceTitle: string;
  count: number;
}

export interface ExpandedTrendsResponse {
  topTypes: TopMaintenanceType[];
}

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
  snapshot: AnalyticsSnapshot;
  summaryMetrics?: SummaryMetrics;
  statusBreakdown: Array<{ status: string; scheduleCount: number; percentage: number; [key: string]: unknown }>;
  monthlyTrend: Array<{ monthKey: string; scheduledCount: number; completedCount: number; activeCount: number; overdueCount: number; maintenanceCost: number; [key: string]: unknown }>;
  forecast?: PredictiveForecast;
  anomalies?: AnomaliesResponse;
  trends?: ExpandedTrendsResponse;
}

export interface AnalyticsDataHealthResponse {
  state: "current" | "stale" | "unavailable";
  reason?: string;
  generatedAt: string | null;
  sourceMaxUpdatedAt: string | null;
  ageSeconds: number | null;
  maxAgeMinutes: number;
  sourceCoverage: {
    state: "verified" | "mismatch" | "unavailable";
    vehicles: { source: number | null; mart: number | null };
    schedules: { source: number | null; mart: number | null };
    statusesMatch: boolean | null;
    maintenanceCostMatches: boolean | null;
  };
  semanticIndex: {
    state: "verified" | "empty" | "incomplete" | "unavailable";
    eligibleRecords: number | null;
    indexedRecords: number | null;
    coveragePercentage: number | null;
    unmatchedRecords: number | null;
  };
}

export interface AnalyticsInsightMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

export interface AnalyticsInsightsEvidence {
  snapshotKey: string;
  generatedAt: string;
  sourceMaxUpdatedAt: string | null;
  ageSeconds: number | null;
  isStale: boolean;
  reportingPeriod: { start: string | null; end: string | null };
  metrics: AnalyticsInsightMetric[];
  observations: Array<{ label: string; value: string }>;
  limitations: string[];
}

export interface StructuredAnalyticsInsights {
  aiSummary: string;
  evidence: AnalyticsInsightsEvidence;
}

export interface AnalyticsVehicle {
  vehicleId: string | number;
  plateNumber: string;
  vehicleModel?: string;
  vehicleStatus?: string;
  currentOdometer?: number;
  totalSchedules?: number;
  activeSchedules?: number;
  completedSchedules?: number;
  overdueSchedules?: number;
  dueWithin7Days?: number;
  maintenanceCost?: number;
  completionRate?: number;
  latestMaintenanceDate?: string;
  nextDueDate?: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW" | string;
  riskScore: number;
  riskReason?: string;
  [key: string]: unknown;
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
  vehicles: AnalyticsVehicle[];
}

export interface AnalyticsAlert {
  alertId: string | number;
  scheduleId?: string | number;
  vehiclePlate: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | string;
  alertType?: string;
  maintenanceTitle: string;
  message: string;
  recommendedAction?: string;
  dueDate?: string;
  generatedAt?: string;
  vehicleStatus?: string;
  completionRate?: number;
  overdueSchedules?: number;
  [key: string]: unknown;
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
  alerts: AnalyticsAlert[];
}

export type AnalyticsInsightsResponse = StructuredAnalyticsInsights | string;

export interface BackendScheduleItem {
  scheduleId: string | number;
  vehiclePlate: string;
  maintenanceTitle: string;
  triggerType?: string;
  intervalType?: string;
  assignedMechanic?: string;
  scheduleStatus?: string;
  odometerReading?: string | number;
  nextDueDate?: string;
  [key: string]: unknown;
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
  snapshot: AnalyticsSnapshot;
  statusBreakdown: Array<Record<string, unknown>>;
  monthlyTrend: Array<Record<string, unknown>>;
  vehicles: AnalyticsVehicle[];
  alerts: AnalyticsAlert[];
  schedules: BackendScheduleItem[];
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

export async function getAnalyticsHealth(): Promise<AnalyticsHealthResponse> {
  try {
    return await fetchJSON<AnalyticsHealthResponse>("/analytics/health");
  } catch (error) {
    console.warn("Analytics health check unavailable.", error);
    return {
      status: "offline",
      service: "welinc-backend-vmms-analytics-ai",
      mode: "unavailable",
      port: 3001,
    };
  }
}

export async function getAnalyticsDataHealth(): Promise<AnalyticsDataHealthResponse> {
  try {
    return await fetchJSON<AnalyticsDataHealthResponse>("/analytics/data-health");
  } catch (error) {
    console.warn("Analytics data-health status unavailable.", error);
    return {
      state: "unavailable",
      reason: "data_health_request_failed",
      generatedAt: null,
      sourceMaxUpdatedAt: null,
      ageSeconds: null,
      maxAgeMinutes: 0,
      sourceCoverage: {
        state: "unavailable",
        vehicles: { source: null, mart: null },
        schedules: { source: null, mart: null },
        statusesMatch: null,
        maintenanceCostMatches: null,
      },
      semanticIndex: {
        state: "unavailable",
        eligibleRecords: null,
        indexedRecords: null,
        coveragePercentage: null,
        unmatchedRecords: null,
      },
    };
  }
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverviewResponse> {
  return fetchJSON<AnalyticsOverviewResponse>("/analytics/overview");
}

export async function getAnalyticsVehicles(): Promise<AnalyticsVehicleResponse> {
  return fetchJSON<AnalyticsVehicleResponse>("/analytics/vehicles");
}

export async function getAnalyticsAlerts(): Promise<AnalyticsAlertResponse> {
  return fetchJSON<AnalyticsAlertResponse>("/analytics/alerts");
}

export async function getAnalyticsInsights(): Promise<AnalyticsInsightsResponse> {
  return fetchJSON<AnalyticsInsightsResponse>("/analytics/insights");
}

export async function getAnalyticsReport(): Promise<AnalyticsReportResponse> {
  return fetchJSON<AnalyticsReportResponse>("/analytics/report");
}

export async function searchMaintenanceSchedules(query: string, limit = 8): Promise<ScheduleSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  // First attempt: call microservice backend DuckDB search endpoint directly
  try {
    const backendRes = await fetchJSON<{
      dataSource?: unknown;
      schedules?: Array<{
        scheduleId?: string | number;
        vehiclePlate?: string;
        maintenanceTitle?: string;
        triggerType?: string;
        intervalType?: string;
        assignedMechanic?: string;
        scheduleStatus?: string;
        odometerReading?: string | number;
        nextDueDate?: string;
      }>;
    }>(`/maintenance-schedules/search?q=${encodeURIComponent(trimmedQuery)}&limit=${limit}`);

    if (backendRes?.schedules && Array.isArray(backendRes.schedules)) {
      return backendRes.schedules.map((item) => {
        const statusStr = String(item.scheduleStatus ?? "DUE");
        return {
          id: String(item.scheduleId ?? ""),
          vehicleId: String(item.vehiclePlate ?? ""),
          title: String(item.maintenanceTitle ?? ""),
          status: statusStr,
          date: item.nextDueDate ? String(item.nextDueDate) : "",
          assignedMechanic: item.assignedMechanic ? String(item.assignedMechanic) : null,
          assignedDriver: null,
          accountType: null,
          checklistTemplateId: null,
          garageId: null,
          odometerReading: item.odometerReading ? String(item.odometerReading) : null,
          triggerType: item.triggerType ? String(item.triggerType) : null,
          intervalKm: null,
          bufferDistanceKm: null,
          startingReferenceReadingKm: null,
          intervalType: item.intervalType ? String(item.intervalType) : null,
          startReferenceDate: null,
          previousScheduleId: null,
          workOrderProgress: null,
          score: calculateScheduleProgress({ status: statusStr }),
        };
      });
    }
  } catch (backendError) {
    console.warn("Backend schedule search endpoint unavailable, falling back to local search.", backendError);
  }

  // Fallback: local schedule search
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

export interface WorkOrderAiRecommendation {

  scheduleId: string;
  vehiclePlate: string;
  maintenanceTitle: string;
  assignedMechanic: string;
  status: string;
  priority: string;
  daysOverdue?: number;
  totalCost?: number;
  aiRecommendations: string;
  checklist: Array<{
    stepNumber: number;
    title: string;
    description: string;
    priority: string;
  }>;
  generatedAt: string;
}

export interface WorkOrderTaskDetails {
  title?: string;
  vehiclePlate?: string;
  assignedMechanic?: string | null;
  status?: string;
  odometerReading?: string | number | null;
  triggerType?: string | null;
  intervalType?: string | null;
  notes?: string | null;
  checklistItems?: Array<{ text: string; status?: string }>;
}

export async function getWorkOrderRecommendations(
  scheduleId: string,
  taskDetails?: WorkOrderTaskDetails
): Promise<WorkOrderAiRecommendation | null> {
  const title = taskDetails?.title || "";
  const vehicle = taskDetails?.vehiclePlate || "";
  const itemsParam = (taskDetails?.checklistItems || [])
    .map((it) => it.text)
    .filter(Boolean)
    .join("|");

  try {
    const params: Record<string, string> = { title, vehicle };
    if (itemsParam) params.items = itemsParam;

    const queryParams = new URLSearchParams(params).toString();
    const data = await fetchJSON<WorkOrderAiRecommendation>(
      `/analytics/workorders/recommendations/${scheduleId}?${queryParams}`
    );
    if (data && data.aiRecommendations) return data;
  } catch (error) {
    console.warn(`AI recommendation API fetch failed for schedule ${scheduleId}:`, error);
  }

  return null;
}
