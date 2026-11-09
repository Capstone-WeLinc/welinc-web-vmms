import { fetchJSON } from './httpClient';

export type MaintenanceCostRecord = {
  id: string;
  workOrderNumber: string;
  title: string;
  type: string;
  completedAt: string;
  mechanicName: string;
  partsCost: number | null;
  laborCost: number | null;
  totalCost: number;
};

export type MaintenanceCostTruck = {
  vehicleId: string;
  plateNumber: string;
  make: string | null;
  model: string;
  garageName: string | null;
  isActive: boolean;
  totalCost: number;
  flagged: boolean;
  recurringHighCost: boolean;
  records: MaintenanceCostRecord[];
};

export type MaintenanceCostingDashboard = {
  period: { from: string; to: string };
  threshold: number | null;
  totalMaintenanceCosts: number;
  mostCostlyTruck: { vehicleId: string; plateNumber: string; totalCost: number } | null;
  averageCostPerTruck: number;
  totalActiveTrucks: number;
  trucksWithCosts: number;
  trucks: MaintenanceCostTruck[];
};

export async function getMaintenanceCostingDashboard(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return fetchJSON<MaintenanceCostingDashboard>(`/maintenance-costing?${query.toString()}`);
}

export async function updateMaintenanceCostThreshold(threshold: number) {
  return fetchJSON<{ threshold: number; updatedAt: string }>('/maintenance-costing/threshold', {
    method: 'PATCH',
    body: JSON.stringify({ threshold }),
  });
}
