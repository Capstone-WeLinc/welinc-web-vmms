export type MaintenanceCostPeriodType = 'monthly' | 'semiannual' | 'annual' | 'custom';
export type MaintenanceCostHalf = 'first' | 'second';
export type DateRange = { from: string; to: string };

const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getMaintenanceCostPeriod(
  type: MaintenanceCostPeriodType,
  year: number,
  month: number,
  half: MaintenanceCostHalf,
  customFrom: string,
  customTo: string,
): DateRange | null {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return null;
  if (type === 'monthly') {
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    return { from: dateKey(year, month, 1), to: dateKey(year, month, lastDayOfMonth(year, month)) };
  }
  if (type === 'semiannual') {
    return half === 'first'
      ? { from: dateKey(year, 1, 1), to: dateKey(year, 6, 30) }
      : { from: dateKey(year, 7, 1), to: dateKey(year, 12, 31) };
  }
  if (type === 'annual') {
    return { from: dateKey(year, 1, 1), to: dateKey(year, 12, 31) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo)) return null;
  if (customFrom > customTo) return null;
  return { from: customFrom, to: customTo };
}
