type MileageSchedule = {
  vehicleId: string; title: string; triggerType?: string; status?: string;
  odometerReading?: string; intervalKm?: string; bufferDistanceKm?: string; startingReferenceReadingKm?: string;
};
const MAX_KM = 2147483647;
export function scheduleMileageError(data: MileageSchedule, vehicleReading?: number, previous?: MileageSchedule): string {
  const labels = { odometerReading: 'Odometer reading', intervalKm: 'Maintenance interval', bufferDistanceKm: 'Buffer distance', startingReferenceReadingKm: 'Starting reference reading' };
  for (const field of Object.keys(labels) as (keyof typeof labels)[]) {
    const value = data[field];
    if (value === undefined || value === '') continue;
    if (!/^\d+$/.test(value.trim())) return `${labels[field]} must be a non-negative whole number of kilometres.`;
    if (!Number.isSafeInteger(Number(value)) || Number(value) > MAX_KM) return `${labels[field]} exceeds the supported mileage range.`;
  }
  if (data.triggerType !== 'ODOMETER') return '';
  const interval = Number(data.intervalKm);
  if (!interval || interval <= 0) return 'Maintenance interval must be greater than zero.';
  if (!data.startingReferenceReadingKm?.trim()) return 'A non-negative starting reference reading is required for odometer scheduling.';
  if (vehicleReading == null || !Number.isInteger(vehicleReading) || vehicleReading < 0) return 'Select an active truck with a recorded odometer reading.';
  const reference = Number(data.startingReferenceReadingKm);
  const threshold = reference + interval;
  if (!Number.isSafeInteger(threshold) || threshold <= 0 || threshold > MAX_KM) return 'Odometer threshold must be positive and within the supported mileage range.';
  const sameTruck = previous?.vehicleId.trim().toLowerCase() === data.vehicleId.trim().toLowerCase();
  const changed = !previous || !sameTruck || previous.triggerType !== 'ODOMETER' || previous.status === 'CANCELLED' ||
    previous.title.trim().toLowerCase() !== data.title.trim().toLowerCase() ||
    Number(previous.intervalKm) !== interval || Number(previous.startingReferenceReadingKm) !== reference;
  const current = Math.max(vehicleReading, Number(data.odometerReading || 0), sameTruck ? Number(previous?.odometerReading || 0) : 0);
  return changed && threshold <= current
    ? "Odometer threshold must be greater than the truck's current odometer reading. It is the next future service trigger; if service is due now, use the existing due work order instead."
    : '';
}
