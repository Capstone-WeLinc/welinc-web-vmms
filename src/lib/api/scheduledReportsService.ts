import { fetchJSON } from "./httpClient";

export interface ScheduledFleetReport {
  id: string;
  reportType: "daily-operations" | "monthly-costs";
  periodKey: string;
  data: Record<string, unknown>;
  generatedAt: string;
}

export function getScheduledFleetReports(): Promise<ScheduledFleetReport[]> {
  return fetchJSON<ScheduledFleetReport[]>("/reports/scheduled");
}
