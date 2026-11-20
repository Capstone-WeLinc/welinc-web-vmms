import type { FuelFillUp } from './types';

export interface FuelLogFilters {
  search?: string;
  vehicleId?: string;
  date?: string;
  station?: string;
}

export interface FuelVehicleSummary {
  vehicleId: string;
  vehicleName: string;
  model: string;
  fillUpsCount: number;
  totalLiters: number;
  totalCost: number;
  efficiencyCount: number;
  averageEfficiency: number | null;
}

export function formatFuelExportDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function excludeVoidedFuelFillUps(fillUps: FuelFillUp[]): FuelFillUp[] {
  return fillUps.filter((fillUp) => !fillUp.isVoided);
}

export function filterFuelFillUps(fillUps: FuelFillUp[], filters: FuelLogFilters): FuelFillUp[] {
  const search = filters.search?.trim().toLowerCase() ?? '';
  const station = filters.station?.trim().toLowerCase() ?? '';
  return fillUps.filter((fillUp) => {
    const matchesSearch = !search || [fillUp.vehicleName, fillUp.vehicleId, fillUp.station]
      .some((value) => value?.toLowerCase().includes(search));
    const matchesVehicle = !filters.vehicleId || filters.vehicleId === 'All' || fillUp.vehicleId === filters.vehicleId;
    const matchesDate = !filters.date || fillUp.date === filters.date;
    const matchesStation = !station || (fillUp.station ?? '').toLowerCase().includes(station);
    return matchesSearch && matchesVehicle && matchesDate && matchesStation;
  });
}

export function summarizeFuelFillUps(fillUps: FuelFillUp[]): FuelVehicleSummary[] {
  const rows = new Map<string, FuelFillUp[]>();
  for (const entry of excludeVoidedFuelFillUps(fillUps)) {
    const group = rows.get(entry.vehicleId) ?? [];
    group.push(entry);
    rows.set(entry.vehicleId, group);
  }

  return [...rows.entries()].map(([vehicleId, entries]) => {
    const efficiencies = entries.map((entry) => entry.efficiency).filter((value): value is number => value != null && Number.isFinite(value));
    return {
      vehicleId,
      vehicleName: entries[0].vehicleName || vehicleId,
      model: entries[0].vehicleModel || '',
      fillUpsCount: entries.length,
      totalLiters: entries.reduce((sum, entry) => sum + (entry.liters || 0), 0),
      totalCost: entries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0),
      efficiencyCount: efficiencies.length,
      averageEfficiency: efficiencies.length ? efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length : null,
    };
  });
}

export const fuelLogExportHeaders = [
  'Vehicle', 'ID', 'Model', 'Date', 'Liters', 'Price/L', 'Total Cost', 'Odometer',
  'Efficiency', 'Classification', 'Anomaly Status', 'Resolution Note', 'Station', 'Filled By',
];

export function buildFuelLogExportRows(fillUps: FuelFillUp[]): Array<Array<string | number>> {
  return excludeVoidedFuelFillUps(fillUps).map((fillUp) => [
    fillUp.vehicleName, fillUp.vehicleId, fillUp.vehicleModel, fillUp.date, fillUp.liters,
    fillUp.pricePerLiter, fillUp.totalCost, fillUp.odometer, fillUp.efficiency ?? 'N/A',
    fillUp.fuelClassification ?? 'Insufficient Data', fillUp.anomaly?.status ?? '',
    fillUp.anomaly?.note ?? '', fillUp.station, fillUp.filledBy,
  ]);
}
