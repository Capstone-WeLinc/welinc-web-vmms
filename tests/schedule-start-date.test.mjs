import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleStartDateError, philippineToday } from '../src/lib/utils/scheduleStartDate.ts';
const now = new Date('2026-09-28T16:00:00Z');
test('uses Philippine dates at midnight', () => {
  assert.equal(philippineToday(now), '2026-09-29');
  assert.equal(scheduleStartDateError('2026-09-28', null, now), 'Schedule date cannot be in the past.');
  assert.equal(scheduleStartDateError('2026-09-29', null, now), '');
});
test('requires a real date and rejects timestamps and invalid leap days', () => {
  for (const value of ['', ' ', '2026-02-29', '2026-09-31', '2026-09-29T00:00:00Z']) assert.ok(scheduleStartDateError(value, null, now));
  assert.equal(scheduleStartDateError('2028-02-29', null, now), '');
});
test('ordinary edits retain an unchanged historical date without permitting another past date', () => {
  assert.equal(scheduleStartDateError('2026-06-01', '2026-06-01', now), '');
  assert.equal(scheduleStartDateError('2026-06-02', '2026-06-01', now), 'Schedule date cannot be in the past.');
});
