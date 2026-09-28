import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManageVehicles } from '../src/lib/utils/permissions.ts';

test('only Operations can manage vehicles for single-role users', () => {
  assert.equal(canManageVehicles({ role: 'OPERATIONS' }), true);
  for (const role of ['ADMIN', 'CHIEF_MECHANIC', 'MECHANIC', '']) {
    assert.equal(canManageVehicles({ role }), false);
  }
  assert.equal(canManageVehicles(null), false);
  assert.equal(canManageVehicles(undefined), false);
});

test('VMMS assignment takes precedence over the normalized first subsystem role', () => {
  assert.equal(canManageVehicles({ role: 'OPERATIONS', roles: [
    { role: 'OPERATIONS', system: 'BMS' }, { role: 'ADMIN', system: 'VMMS' },
  ] }), false);
  assert.equal(canManageVehicles({ role: 'ADMIN', roles: [
    { role: 'ADMIN', system: 'VRMS' }, { role: 'OPERATIONS', system: 'VMMS' },
  ] }), true);
});

test('missing and ambiguous VMMS assignments do not reveal mutation controls', () => {
  assert.equal(canManageVehicles({ role: 'OPERATIONS', roles: [] }), false);
  assert.equal(canManageVehicles({ roles: [{ role: 'OPERATIONS', system: 'VRMS' }] }), false);
  assert.equal(canManageVehicles({ roles: [
    { role: 'OPERATIONS', system: 'VMMS' }, { role: 'ADMIN', system: 'VMMS' },
  ] }), false);
});
