export const philippineToday = (now = new Date()) =>
  new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

export function scheduleStartDateError(value: string, previous?: string | null, now = new Date()): string {
  if (!value.trim()) return 'Schedule start date is required.';
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-') ||
    !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return 'Enter a valid schedule start date (YYYY-MM-DD).';
  }
  return value !== previous && value < philippineToday(now) ? 'Schedule date cannot be in the past.' : '';
}
