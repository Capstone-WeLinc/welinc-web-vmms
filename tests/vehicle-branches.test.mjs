import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortVehiclesByBranch } from '../src/lib/utils/vehicleBranches.ts';

const vehicles = [
  { id: '1', garageId: 'g2', garageName: 'Sta. Rosa', plateNumber: 'DEF 2' },
  { id: '2', garageId: 'g1', garageName: 'Marikina', plateNumber: 'ABC 1' },
  { id: '3', garageId: null, garageName: null, plateNumber: 'OLD 3' },
];

test('filters vehicle records by assigned garage branch', () => {
  assert.deepEqual(filterAndSortVehiclesByBranch(vehicles, 'g1', 'none').map((v) => v.id), ['2']);
  assert.deepEqual(filterAndSortVehiclesByBranch(vehicles, 'all', 'none').map((v) => v.id), ['1', '2', '3']);
});

test('sorts vehicle records by garage branch name', () => {
  assert.deepEqual(filterAndSortVehiclesByBranch(vehicles, 'all', 'asc').map((v) => v.id), ['2', '1', '3']);
  assert.deepEqual(filterAndSortVehiclesByBranch(vehicles, 'all', 'desc').map((v) => v.id), ['3', '1', '2']);
});
