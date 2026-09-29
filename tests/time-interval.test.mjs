import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeIntervalFields, timeIntervalError, timeIntervalDueDate } from '../src/lib/utils/timeInterval.ts';
test('new time schedules default to three months and legacy presets retain their cadence', () => {
  assert.deepEqual(timeIntervalFields({}), { value: 3, unit: 'MONTHS' });
  assert.deepEqual(timeIntervalFields({ intervalType: 'WEEKLY' }), { value: 7, unit: 'DAYS' });
});
test('validates a positive numeric value and explicit days/months unit', () => {
  for (const value of ['', '0', '-1', '1.5', '1e3', 'abc', '2147483648']) assert.ok(timeIntervalError(value, 'DAYS'));
  assert.ok(timeIntervalError('3', 'YEARS'));
  assert.equal(timeIntervalError('45', 'DAYS'), '');
});
test('custom intervals take precedence and month ends are clamped', () => {
  const reference = new Date(2026, 0, 31);
  const due = timeIntervalDueDate(reference, { timeIntervalValue: 2, timeIntervalUnit: 'MONTHS', intervalType: 'MONTHLY' });
  assert.equal(due.getMonth(), 2);
  assert.equal(due.getDate(), 31);
  assert.equal(timeIntervalDueDate(reference, { timeIntervalValue: 1, timeIntervalUnit: 'MONTHS' }).getDate(), 28);
  assert.equal(timeIntervalDueDate(reference, { timeIntervalValue: 10, timeIntervalUnit: 'DAYS' }).getDate(), 10);
});
