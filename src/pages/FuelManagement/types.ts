export interface FuelFillUp {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleModel: string;
  date: string;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  odometer: number;
  station: string;
  filledBy: string;
  efficiency: number | null;
  trend: 'above' | 'below' | 'normal';
  isFullTank?: boolean;
  isVoided?: boolean;
  voidReason?: string | null;
  stationId?: string;
  fuelClassification?: string;
  receipt?: { id: string; name: string; contentType: string; createdAt: string } | null;
  anomaly?: { id: string; status: string; severity?: string; note?: string | null; acknowledgedAt?: string | null } | null;
}

export interface VehicleEfficiency {
  vehicleId: string;
  vehicleName: string;
  model: string;
  avgEfficiency: number;
  fillUps: number;
  trend: 'above' | 'below' | 'normal';
}

export interface FuelAnomaly {
  vehicleId: string;
  vehicleName: string;
  model: string;
  efficiency: number;
  status: 'Normal' | 'Below Avg' | 'Anomaly';
  fleetAvg: number;
  recommendation: string;
}

export interface FuelMetrics {
  totalFillUps: number;
  totalLiters: number;
  totalCost: number;
  avgEfficiency: number;
}

export interface AnomalyLog {
  id: string;
  timestamp: string;
  vehicleId: string;
  vehicleName: string;
  model: string;
  vehicleEfficiency: number;
  fleetAverage: number;
  alertType: 'Anomaly' | 'Below Avg';
  detectedBy: string;
}

export interface FuelCostSummaryRow {
  vehicleId: string;
  vehicleName: string;
  model: string;
  totalFillUps: number;
  totalLiters: number;
  avgPricePerLiter: number;
  totalCost: number;
  avgEfficiency: number;
}

export interface FleetBranchReport {
  branch: string;
  vehicles: number;
  totalFillUps: number;
  totalLiters: number;
  totalCost: number;
  avgEfficiency: number;
}
