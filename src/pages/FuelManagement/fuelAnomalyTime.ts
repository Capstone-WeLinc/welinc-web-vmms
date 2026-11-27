const ELAPSED_DAY_MS = 24 * 60 * 60 * 1000;

export function getFuelAnomalyAgeDays(
  createdAt: string,
  nowMs = Date.now(),
): number | null {
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return null;
  return Math.max(0, Math.floor((nowMs - createdAtMs) / ELAPSED_DAY_MS));
}

export function formatFuelAnomalyDetectedAt(createdAt: string): string {
  const detectedAt = new Date(createdAt);
  if (!Number.isFinite(detectedAt.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(detectedAt);
}
