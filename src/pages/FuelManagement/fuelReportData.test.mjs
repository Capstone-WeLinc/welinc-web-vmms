import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFuelLogExportRows,
  excludeVoidedFuelFillUps,
  filterFuelFillUps,
  summarizeFuelFillUps,
} from './fuelReportData.ts';

const records = [
  { id: 'a1', vehicleId: 'truck-a', vehicleName: 'NDG 5821', vehicleModel: 'Truck A', date: '2026-11-01', liters: 100, pricePerLiter: 60, totalCost: 6000, odometer: 1000, station: 'Petron', filledBy: 'Driver A', efficiency: 10, isVoided: false },
  { id: 'a2', vehicleId: 'truck-a', vehicleName: 'NDG 5821', vehicleModel: 'Truck A', date: '2026-11-02', liters: 30, pricePerLiter: 60, totalCost: 1800, odometer: 1200, station: 'Shell', filledBy: 'Driver A', efficiency: null, isVoided: false },
  { id: 'a3-void', vehicleId: 'truck-a', vehicleName: 'NDG 5821', vehicleModel: 'Truck A', date: '2026-11-02', liters: 200, pricePerLiter: 60, totalCost: 12000, odometer: 1400, station: 'Shell', filledBy: 'Driver A', efficiency: 5, isVoided: true },
  { id: 'b1', vehicleId: 'truck-b', vehicleName: 'CAK 9043', vehicleModel: 'Truck B', date: '2026-11-01', liters: 80, pricePerLiter: 62, totalCost: 4960, odometer: 2000, station: 'Petron', filledBy: 'Driver B', efficiency: 8, isVoided: false },
];

test('combines vehicle, exact date, station, and search filters with AND semantics', () => {
  const filtered = filterFuelFillUps(records, {
    search: 'NDG', vehicleId: 'truck-a', date: '2026-11-02', station: 'shell',
  });
  assert.deepEqual(filtered.map((entry) => entry.id), ['a2', 'a3-void']);
});

test('excludes voided records from dashboard and report inputs', () => {
  const active = excludeVoidedFuelFillUps(records);
  assert.deepEqual(active.map((entry) => entry.id), ['a1', 'a2', 'b1']);
  assert.deepEqual(summarizeFuelFillUps(records).map((row) => [row.vehicleId, row.fillUpsCount, row.totalCost]), [
    ['truck-a', 2, 7800], ['truck-b', 1, 4960],
  ]);
});

test('averages efficiency only over entries with a computed value', () => {
  const [truckA] = summarizeFuelFillUps(records);
  assert.equal(truckA.fillUpsCount, 2);
  assert.equal(truckA.efficiencyCount, 1);
  assert.equal(truckA.averageEfficiency, 10);
});

test('fuel log export preserves filters and excludes voided entries', () => {
  const filtered = filterFuelFillUps(records, { vehicleId: 'truck-a', station: 'shell' });
  const rows = buildFuelLogExportRows(filtered);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'NDG 5821');
  assert.equal(rows[0][12], 'Shell');
  assert.equal(rows[0][8], 'N/A');
});
