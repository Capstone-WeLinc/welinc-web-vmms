import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canSeeVmmsNavigationPath,
  canSeeVmmsWebNavigation,
} from '../src/lib/utils/permissions.ts';

test('only Admin and Operations VMMS roles see web module navigation', () => {
  for (const role of ['ADMIN', 'OPERATIONS']) {
    assert.equal(canSeeVmmsWebNavigation({ role }), true);
    assert.equal(canSeeVmmsWebNavigation({ roles: [{ role, system: 'VMMS' }] }), true);
  }

  for (const role of ['MECHANIC', 'CHIEF_MECHANIC']) {
    assert.equal(canSeeVmmsWebNavigation({ role }), false);
    assert.equal(canSeeVmmsWebNavigation({ roles: [{ role, system: 'VMMS' }] }), false);
  }
});

test('other-system roles do not expose VMMS web navigation', () => {
  assert.equal(
    canSeeVmmsWebNavigation({ role: 'ADMIN', roles: [{ role: 'ADMIN', system: 'VRMS' }] }),
    false,
  );
  assert.equal(canSeeVmmsWebNavigation({ roles: [] }), false);
  assert.equal(canSeeVmmsWebNavigation(null), false);
});

test('Operations cannot see User Management in the web navigation', () => {
  const user = { role: 'OPERATIONS' };
  assert.equal(canSeeVmmsNavigationPath('/users', user), false);
  assert.equal(canSeeVmmsNavigationPath('/fuel-management', user), true);
});

test('multi-system Operations navigation follows the VMMS assignment', () => {
  const user = {
    role: 'ADMIN',
    roles: [
      { role: 'ADMIN', system: 'VRMS' },
      { role: 'OPERATIONS', system: 'VMMS' },
    ],
  };
  assert.equal(canSeeVmmsNavigationPath('/users', user), false);
  assert.equal(canSeeVmmsNavigationPath('/fuel-management', user), true);
});
