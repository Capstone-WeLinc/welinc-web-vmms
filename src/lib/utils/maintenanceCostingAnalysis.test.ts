import { describe, expect, it } from 'vitest';
import type { MaintenanceCostTruck } from '../api/costingService';
import { getMaintenanceCostBreakdown } from './maintenanceCostingAnalysis';

const trucks: MaintenanceCostTruck[] = [
  {
    vehicleId: 'truck-1',
    plateNumber: 'ABC123',
    make: 'Hino',
    model: '500',
    garageName: 'Marikina',
    isActive: true,
    totalCost: 15,
    flagged: false,
    recurringHighCost: false,
    records: [
      {
        id: 'record-1',
        workOrderNumber: 'WO-1',
        title: 'Oil Change',
        type: 'Oil Change',
        completedAt: '2026-06-01T00:00:00.000Z',
        mechanicName: 'Mechanic One',
        partsCost: 10,
        laborCost: 5,
        totalCost: 15,
      },
      {
        id: 'record-2',
        workOrderNumber: 'WO-2',
        title: '',
        type: '',
        completedAt: '2026-06-02T00:00:00.000Z',
        mechanicName: 'Mechanic One',
        partsCost: 0,
        laborCost: 5,
        totalCost: 5,
      },
    ],
  },
  {
    vehicleId: 'truck-2',
    plateNumber: 'DEF456',
    make: null,
    model: 'Canter',
    garageName: null,
    isActive: true,
    totalCost: 25,
    flagged: false,
    recurringHighCost: false,
    records: [
      {
        id: 'record-3',
        workOrderNumber: 'WO-3',
        title: 'Oil Change',
        type: 'Oil Change',
        completedAt: '2026-06-03T00:00:00.000Z',
        mechanicName: 'Mechanic Two',
        partsCost: 20,
        laborCost: 5,
        totalCost: 25,
      },
    ],
  },
];

describe('getMaintenanceCostBreakdown', () => {
  it('groups type and current garage costs while retaining unclassified records', () => {
    expect(getMaintenanceCostBreakdown(trucks, 'type')).toEqual([
      { label: 'Oil Change', totalCost: 40, completedRecords: 2 },
      { label: 'Unclassified', totalCost: 5, completedRecords: 1 },
    ]);
    expect(getMaintenanceCostBreakdown(trucks, 'garage')).toEqual([
      { label: 'Unclassified', totalCost: 25, completedRecords: 1 },
      { label: 'Marikina', totalCost: 20, completedRecords: 2 },
    ]);
  });
});
