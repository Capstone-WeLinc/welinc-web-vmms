import type { MaintenanceCostTruck } from '../api/costingService';

export type MaintenanceCostBreakdownRow = {
  label: string;
  totalCost: number;
  completedRecords: number;
};

export function getMaintenanceCostBreakdown(
  trucks: MaintenanceCostTruck[],
  category: 'type' | 'garage',
): MaintenanceCostBreakdownRow[] {
  const totals = new Map<string, MaintenanceCostBreakdownRow>();
  for (const truck of trucks) {
    for (const record of truck.records) {
      const label = category === 'type'
        ? record.type.trim() || 'Unclassified'
        : truck.garageName?.trim() || 'Unclassified';
      const row = totals.get(label) ?? { label, totalCost: 0, completedRecords: 0 };
      row.totalCost += record.totalCost;
      row.completedRecords += 1;
      totals.set(label, row);
    }
  }
  return [...totals.values()]
    .map((row) => ({ ...row, totalCost: Math.round(row.totalCost * 100) / 100 }))
    .sort((left, right) => right.totalCost - left.totalCost || left.label.localeCompare(right.label));
}
