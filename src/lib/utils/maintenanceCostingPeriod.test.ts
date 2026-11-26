import { describe, expect, it } from 'vitest';
import { getPreviousMaintenanceCostPeriod } from './maintenanceCostingPeriod';

describe('getPreviousMaintenanceCostPeriod', () => {
  it('uses the preceding calendar month across a year boundary', () => {
    expect(
      getPreviousMaintenanceCostPeriod('monthly', {
        from: '2026-01-01',
        to: '2026-01-31',
      }),
    ).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('uses the preceding two-month block across a year boundary', () => {
    expect(
      getPreviousMaintenanceCostPeriod('bimonthly', {
        from: '2026-01-01',
        to: '2026-02-28',
      }),
    ).toEqual({ from: '2025-11-01', to: '2025-12-31' });
  });

  it('uses the prior half-year and year for standard periods', () => {
    expect(
      getPreviousMaintenanceCostPeriod('semiannual', {
        from: '2026-01-01',
        to: '2026-06-30',
      }),
    ).toEqual({ from: '2025-07-01', to: '2025-12-31' });
    expect(
      getPreviousMaintenanceCostPeriod('annual', {
        from: '2026-01-01',
        to: '2026-12-31',
      }),
    ).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('compares a custom range with the same inclusive number of days', () => {
    const previous = getPreviousMaintenanceCostPeriod('custom', {
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(previous).toEqual({ from: '2026-01-29', to: '2026-02-28' });
    const days =
      (Date.parse(`${previous.to}T00:00:00Z`) -
        Date.parse(`${previous.from}T00:00:00Z`)) /
        86_400_000 +
      1;
    expect(days).toBe(31);
  });
});
