import type { FuelImportRow, FuelStation } from '../../lib/api/fuelService';

export type FuelImportReconciliationGroup = {
  sheetName: string;
  stationName: string;
  submitted: number;
  saved: number;
  failed: number;
  liters: number;
  totalCost: number;
};

export type FuelImportReconciliation = {
  submitted: number;
  saved: number;
  failed: number;
  liters: number;
  totalCost: number;
  groups: FuelImportReconciliationGroup[];
  failedRows: Array<{
    sheetName: string;
    worksheetRow: number;
    errors: string[];
  }>;
};

export function summarizeFuelImportRows(
  rows: FuelImportRow[],
  stations: FuelStation[],
): FuelImportReconciliation {
  const stationsById = new Map(stations.map((station) => [station.id, station]));
  const groups = new Map<string, FuelImportReconciliationGroup>();
  const savedRows = rows.filter((row) => row.status === 'SAVED');

  for (const row of rows) {
    const sheetName = row.sheetName || 'Worksheet not provided';
    const stationName =
      stationsById.get(row.stationId)?.name ??
      (row.stationId ? `Station ${row.stationId}` : 'Station not assigned');
    const groupKey = JSON.stringify([sheetName, row.stationId]);
    const group = groups.get(groupKey) ?? {
      sheetName,
      stationName,
      submitted: 0,
      saved: 0,
      failed: 0,
      liters: 0,
      totalCost: 0,
    };
    group.submitted += 1;

    if (row.status === 'SAVED') {
      group.saved += 1;
      group.liters +=
        typeof row.liters === 'number' && Number.isFinite(row.liters)
          ? row.liters
          : 0;
      group.totalCost +=
        typeof row.totalCost === 'number' && Number.isFinite(row.totalCost)
        ? row.totalCost ?? 0
        : 0;
    } else {
      group.failed += 1;
    }

    groups.set(groupKey, group);
  }

  return {
    submitted: rows.length,
    saved: savedRows.length,
    failed: rows.length - savedRows.length,
    liters: savedRows.reduce(
      (sum, row) =>
        sum +
        (typeof row.liters === 'number' && Number.isFinite(row.liters)
          ? row.liters
          : 0),
      0,
    ),
    totalCost: savedRows.reduce(
      (sum, row) =>
        sum +
        (typeof row.totalCost === 'number' && Number.isFinite(row.totalCost)
          ? row.totalCost
          : 0),
      0,
    ),
    groups: [...groups.values()],
    failedRows: rows
      .filter((row) => row.status !== 'SAVED')
      .map((row) => ({
        sheetName: row.sheetName || 'Worksheet not provided',
        worksheetRow: row.worksheetRow,
        errors: row.errors,
      })),
  };
}
