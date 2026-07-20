import type { MaintenanceTask } from "../../types/maintenance";
import {
  getGarages,
  getMaintenanceSchedules,
  getVehicles,
  type VehicleOption,
} from "./vmmsApi";

export type GarageOption = { id: string; name: string };

export type VmmsDashboardData = {
  schedules: MaintenanceTask[];
  vehicles: VehicleOption[];
  garages: GarageOption[];
};

/** Loads each dashboard resource once and in parallel. */
export async function getVmmsDashboardData(): Promise<VmmsDashboardData> {
  const [schedules, vehicles, garages] = await Promise.all([
    getMaintenanceSchedules(),
    getVehicles(),
    getGarages(),
  ]);

  return { schedules, vehicles, garages };
}
