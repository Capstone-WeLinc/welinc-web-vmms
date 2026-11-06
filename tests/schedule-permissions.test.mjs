import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageSchedules } from '../src/lib/utils/permissions.ts';

test('schedule creation and editing require Operations; loading users have no write controls', () => {
  assert.equal(canManageSchedules({ role: 'OPERATIONS' }), true);
  for (const role of ['ADMIN', 'CHIEF_MECHANIC', 'MECHANIC']) {
    assert.equal(canManageSchedules({ role }), false);
  }
  assert.equal(canManageSchedules(null), false);
});

test('only the VMMS Operations assignment grants scheduling controls', () => {
  assert.equal(canManageSchedules({ role: 'OPERATIONS', roles: [
    { role: 'OPERATIONS', system: 'BMS' }, { role: 'ADMIN', system: 'VMMS' },
  ] }), false);
  assert.equal(canManageSchedules({ role: 'ADMIN', roles: [
    { role: 'ADMIN', system: 'VRMS' }, { role: 'OPERATIONS', system: 'VMMS' },
  ] }), true);
  assert.equal(canManageSchedules({ role: 'OPERATIONS', roles: [] }), false);
});
