export type MaintenanceCostPeriodType = 'monthly' | 'bimonthly' | 'semiannual' | 'annual' | 'custom';
export type MaintenanceCostHalf = 'first' | 'second';
export type DateRange = { from: string; to: string };

const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

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
  twoMonthBlock = 1,
): DateRange | null {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) return null;
  if (type === 'monthly') {
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    return { from: dateKey(year, month, 1), to: dateKey(year, month, lastDayOfMonth(year, month)) };
  }
  if (type === 'bimonthly') {
    if (!Number.isInteger(twoMonthBlock) || twoMonthBlock < 1 || twoMonthBlock > 6) return null;
    const firstMonth = (twoMonthBlock - 1) * 2 + 1;
    const lastMonth = firstMonth + 1;
    return { from: dateKey(year, firstMonth, 1), to: dateKey(year, lastMonth, lastDayOfMonth(year, lastMonth)) };
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

export function getPreviousMaintenanceCostPeriod(
  type: MaintenanceCostPeriodType,
  period: DateRange,
): DateRange {
  const [year, month] = period.from.split('-').map(Number);
  if (type === 'monthly') {
    const previousMonth = new Date(Date.UTC(year, month - 2, 1));
    const previousYear = previousMonth.getUTCFullYear();
    const previousMonthNumber = previousMonth.getUTCMonth() + 1;
    return {
      from: dateKey(previousYear, previousMonthNumber, 1),
      to: dateKey(previousYear, previousMonthNumber, lastDayOfMonth(previousYear, previousMonthNumber)),
    };
  }
  if (type === 'bimonthly') {
    const previousStart = new Date(Date.UTC(year, month - 3, 1));
    const startYear = previousStart.getUTCFullYear();
    const startMonth = previousStart.getUTCMonth() + 1;
    const endMonth = startMonth + 1;
    return {
      from: dateKey(startYear, startMonth, 1),
      to: dateKey(startYear, endMonth, lastDayOfMonth(startYear, endMonth)),
    };
  }
  if (type === 'semiannual') {
    return month <= 6
      ? { from: dateKey(year - 1, 7, 1), to: dateKey(year - 1, 12, 31) }
      : { from: dateKey(year, 1, 1), to: dateKey(year, 6, 30) };
  }
  if (type === 'annual') {
    return { from: dateKey(year - 1, 1, 1), to: dateKey(year - 1, 12, 31) };
  }

  const periodStart = utcDate(period.from).getTime();
  const periodEnd = utcDate(period.to).getTime();
  const inclusiveDays = Math.floor((periodEnd - periodStart) / 86_400_000) + 1;
  const previousEnd = new Date(periodStart - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (inclusiveDays - 1) * 86_400_000);
  return {
    from: previousStart.toISOString().slice(0, 10),
    to: previousEnd.toISOString().slice(0, 10),
  };
}
