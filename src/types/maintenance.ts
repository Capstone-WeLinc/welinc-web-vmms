export type MaintenanceStatus =
  | "Overdue"
  | "Pending"
  | "Flagged"
  | "In Progress"
  | "In-Progress"
  | "Completed";

export interface MaintenanceTask {
  id: string;
  vehicleId: string;
  title: string;
  status: MaintenanceStatus;
  date: string;
  assignedDriver: string;
  notes: string;
  garageId?: string;
  accountType?: string;
  outsourcedProvider?: string;
  odometerReading?: string;
  systemAffected?: string;
  triggerType?: "ODOMETER" | "TIME" | "MANUAL";
  intervalKm?: string;
  bufferDistanceKm?: string;
  startingReferenceReadingKm?: string;
  intervalType?: "DAILY" | "WEEKLY" | "MONTHLY" | string;
  startReferenceDate?: string;
}
