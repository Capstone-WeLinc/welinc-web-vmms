import type { VehicleEfficiency } from '../types';

interface EfficiencyTrendsProps {
  vehicles: VehicleEfficiency[];
  fleetAvg: number;
}

export default function EfficiencyTrends({ vehicles, fleetAvg }: EfficiencyTrendsProps) {
  const maxEfficiency = Math.max(...vehicles.map(v => v.avgEfficiency), fleetAvg) * 1.1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-2 w-4 rounded-full bg-[var(--color-brand-success)]" />
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Above average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-4 rounded-full bg-[var(--color-brand-danger)]" />
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">Below average</span>
        </div>
        <div className="ml-auto text-sm text-[var(--color-text-secondary)]">
          Fleet avg: <span className="font-bold text-[var(--color-text-primary)] font-mono">{fleetAvg.toFixed(1)} km/L</span>
        </div>
      </div>

      <div className="space-y-5">
        {vehicles.map((vehicle) => {
          const percentage = (vehicle.avgEfficiency / maxEfficiency) * 100;
          const isAbove = vehicle.avgEfficiency >= fleetAvg;

          return (
            <div key={vehicle.vehicleId} className="space-y-2">
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-bold text-[var(--color-text-primary)]">{vehicle.vehicleName}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] font-mono">{vehicle.vehicleId} · {vehicle.model}</div>
                </div>
                <div className="flex items-baseline gap-2 text-right">
                  <div className="text-sm font-bold text-[var(--color-text-primary)] font-mono">{vehicle.avgEfficiency.toFixed(1)} km/L</div>
                  <div className="text-xs text-[var(--color-text-secondary)] font-mono">({vehicle.fillUps} fill-up{vehicle.fillUps !== 1 ? 's' : ''})</div>
                </div>
              </div>

              <div className="relative h-4 overflow-hidden rounded-full bg-[var(--color-card-bg)]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isAbove ? 'bg-[var(--color-brand-success)]/60' : 'bg-[var(--color-brand-danger)]/60'
                    }`}
                  style={{ width: `${percentage}%` }}
                  />
                <div
                  className="absolute top-0 h-full w-0.5 bg-[var(--color-brand-warning)]/80"
                  style={{ left: `${(fleetAvg / maxEfficiency) * 100}%` }}
                  title={`Fleet average: ${fleetAvg.toFixed(1)} km/L`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-card">
        <p className="text-xs text-[var(--color-text-secondary)]">
          The chart shows vehicle fuel efficiency compared to fleet average. Bars extending beyond the vertical amber line indicate above-average performance.
        </p>
      </div>
    </div>
  );
}
