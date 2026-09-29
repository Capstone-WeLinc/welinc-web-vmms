type IntervalSource = { timeIntervalValue?: number | null; timeIntervalUnit?: string | null; intervalType?: string | null };
export function timeIntervalFields(task: IntervalSource) {
  if (task.timeIntervalValue != null && ['DAYS', 'MONTHS'].includes(task.timeIntervalUnit ?? '')) return { value: task.timeIntervalValue, unit: task.timeIntervalUnit as 'DAYS' | 'MONTHS' };
  const values: Record<string, { value: number; unit: 'DAYS' | 'MONTHS' }> = {
    DAILY: { value: 1, unit: 'DAYS' }, WEEKLY: { value: 7, unit: 'DAYS' }, MONTHLY: { value: 1, unit: 'MONTHS' },
    QUARTERLY: { value: 3, unit: 'MONTHS' }, SEMI_ANNUALLY: { value: 6, unit: 'MONTHS' }, ANNUALLY: { value: 12, unit: 'MONTHS' },
  };
  return values[task.intervalType ?? ''] ?? values.QUARTERLY;
}
export function timeIntervalError(value: string, unit: string) {
  return !/^\d+$/.test(value) || !Number.isInteger(Number(value)) || Number(value) <= 0 || Number(value) > 2147483647 || !['DAYS', 'MONTHS'].includes(unit)
    ? 'Time interval must be a positive whole number of days or months.' : '';
}
export function timeIntervalDueDate(reference: Date, source: IntervalSource): Date | null {
  const { value, unit } = timeIntervalFields(source);
  if (timeIntervalError(String(value), unit)) return null;
  const result = new Date(reference);
  if (unit === 'DAYS') result.setDate(result.getDate() + value);
  else {
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + value);
    result.setDate(Math.min(day, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  }
  return Number.isFinite(result.getTime()) && result.getFullYear() <= 9999 ? result : null;
}
