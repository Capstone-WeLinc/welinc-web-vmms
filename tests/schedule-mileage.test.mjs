import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleMileageError } from '../src/lib/utils/scheduleMileage.ts';
const input = { vehicleId: 'ABC123', title: 'PMS', triggerType: 'ODOMETER', odometerReading: '12000', intervalKm: '5000', startingReferenceReadingKm: '10000', bufferDistanceKm: '500' };
test('threshold must exceed both the vehicle reading and supplied reading', () => {
  assert.equal(scheduleMileageError(input, 14000), '');
  assert.match(scheduleMileageError(input, 15000), /must be greater/);
  assert.match(scheduleMileageError({ ...input, odometerReading: '16000' }, 12000), /must be greater/);
});
test('does not silently truncate or clean invalid mileage values', () => {
  for (const value of ['-1', '1.5', '12abc', '1e4', '2147483648']) {
    assert.ok(scheduleMileageError({ ...input, intervalKm: value }, 12000));
  }
  assert.ok(scheduleMileageError({ ...input, intervalKm: '0' }, 12000));
  assert.ok(scheduleMileageError({ ...input, startingReferenceReadingKm: '2147483640' }, 12000));
});
test('updates can record a reached threshold but cannot configure another past threshold', () => {
  assert.equal(scheduleMileageError({ ...input, odometerReading: '16000' }, 16000, input), '');
  assert.match(scheduleMileageError({ ...input, intervalKm: '4000' }, 16000, input), /must be greater/);
});
test('allows zero reading and buffer, and requires a known vehicle reading', () => {
  assert.equal(scheduleMileageError({ ...input, odometerReading: '0', startingReferenceReadingKm: '0', bufferDistanceKm: '0' }, 0), '');
  assert.match(scheduleMileageError(input), /active truck/);
});
