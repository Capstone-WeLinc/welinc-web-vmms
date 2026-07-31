import { useState } from 'react';
import type { FuelAnomaly } from '../types';
import FuelStatusBadge from './FuelStatusBadge';
import { AlertTriangle, Zap, Filter } from 'lucide-react';
import { DropdownSelect, LegendHelp } from '../../../components/ui';

interface AnomalyDetectionProps {
  anomalies: FuelAnomaly[];
}

export default function AnomalyDetection({ anomalies }: AnomalyDetectionProps) {
  // State for search query, dropdown visibility, and status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Filter the anomalies dynamically based on state
  const filteredAnomalies = anomalies.filter((anomaly) => {
    const matchesSearch =
      anomaly.vehicleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anomaly.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      anomaly.model.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' || anomaly.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Metrics are calculated based on the filtered results
  const anomalyCount = filteredAnomalies.filter(a => a.status === 'Anomaly').length;
  const belowAvgCount = filteredAnomalies.filter(a => a.status === 'Below Avg').length;

  // layout & style constants
  const containerClasses = 'space-y-6';
  const metricsGridClasses = 'grid gap-4 sm:grid-cols-2';
  const infoBannerClasses = 'rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4';
  const searchRowClasses = 'flex items-center gap-3 w-full';
  const searchInputClasses = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]';
  const filterButtonClasses = `flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition ${showFilters ? 'border-[var(--color-brand-warning)]/20 bg-[var(--color-brand-warning)]/10 text-[var(--color-brand-warning)]' : 'border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]'}`;
  const filterPanelClasses = 'flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4';
  const cardBaseClasses = 'rounded-xl p-5 border border-[var(--color-border)] bg-[var(--color-card-bg)] transition-all duration-200';
  const countCardClasses = 'rounded-xl p-5 border border-[var(--color-border)] bg-[var(--color-card-bg)]';

  return (
    <div className={containerClasses}>
      {/* Summary Metric Counters */}
      <div className={metricsGridClasses}>
        <div className={`${countCardClasses} border-[var(--color-brand-danger)]/20 bg-[var(--color-brand-danger)]/10`}>
          <div className="text-sm font-bold text-[var(--color-brand-danger)]">Anomaly Detections</div>
          <div className="mt-2 text-3xl font-black text-[var(--color-text-primary)] font-mono">{anomalyCount}</div>
        </div>
        <div className={`${countCardClasses} border-[var(--color-brand-warning)]/20 bg-[var(--color-brand-warning)]/10`}>
          <div className="text-sm font-bold text-[var(--color-brand-warning)]">Below Average</div>
          <div className="mt-2 text-3xl font-black text-[var(--color-text-primary)] font-mono">{belowAvgCount}</div>
        </div>
      </div>

      <div className={infoBannerClasses}>
        <div className="flex items-start gap-4">
          <AlertTriangle size={20} className="text-[var(--color-brand-warning)] mt-1" strokeWidth={1.8} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[var(--color-brand-warning)]">Anomaly Detection</h3>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Vehicles with fuel efficiency significantly below fleet average may indicate mechanical issues or potential fuel theft. Fleet average: 8.3 km/L
            </p>
          </div>
        </div>
      </div>

      <div className={searchRowClasses}>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, plate, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={searchInputClasses}
          />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={filterButtonClasses}>
            <Filter size={16} strokeWidth={1.8} />
            <span>Filter</span>
          </button>
          <LegendHelp
            title="Anomaly Legend"
            items={[
              { label: "Anomaly", description: "Efficiency is far from the fleet average and needs review.", tone: "#dc2626" },
              { label: "Below Avg", description: "Efficiency is lower than expected but less severe.", tone: "#f59e0b" },
              { label: "Normal", description: "Fuel usage is within the expected range.", tone: "#059669" },
            ]}
          />
        </div>
      </div>

      {showFilters && (
        <div className={filterPanelClasses}>
          <label htmlFor="status-filter" className="text-xs font-medium text-[var(--color-text-secondary)] whitespace-nowrap">Filter status</label>
          <DropdownSelect
            value={statusFilter}
            onChange={setStatusFilter}
            label="Filter status"
            className="w-44"
            options={[
              { value: "All", label: "All statuses" },
              { value: "Anomaly", label: "Anomaly" },
              { value: "Below Avg", label: "Below Avg" },
              { value: "Normal", label: "Normal" },
            ]}
          />
        </div>
      )}

      {filteredAnomalies.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAnomalies.map((anomaly) => {
            const diff = anomaly.efficiency - anomaly.fleetAvg;
            const diffPercent = ((diff / anomaly.fleetAvg) * 100).toFixed(1);
            const statusStyles = anomaly.status === 'Anomaly'
              ? 'border-[var(--color-brand-danger)]/30 bg-[var(--color-brand-danger)]/10'
              : anomaly.status === 'Below Avg'
                ? 'border-[var(--color-brand-warning)]/30 bg-[var(--color-brand-warning)]/10'
                : 'border-[var(--color-brand-success)]/30 bg-[var(--color-brand-success)]/10';
            const diffColor = diff >= 0 ? 'text-[var(--color-brand-success)]' : 'text-[var(--color-brand-danger)]';

            return (
              <div key={anomaly.vehicleId} className={`${cardBaseClasses} ${statusStyles}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)]">{anomaly.vehicleName}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)] font-mono">{anomaly.vehicleId} · {anomaly.model}</p>
                  </div>
                  <FuelStatusBadge status={anomaly.status} size="sm" />
                </div>

                <div className="mt-4 space-y-4">
                  <div className="flex items-baseline gap-3">
                    <div className="text-2xl font-bold text-[var(--color-text-primary)] font-mono">{anomaly.efficiency.toFixed(1)}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">km/L</div>
                    <div className={`ml-auto text-xs font-bold ${diffColor}`}>{diff >= 0 ? '+' : ''}{diffPercent}%</div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-2">
                    <Zap size={16} className="text-[var(--color-text-secondary)]" strokeWidth={1.8} />
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Fleet avg</div>
                      <div className="font-bold text-[var(--color-text-primary)] font-mono">{anomaly.fleetAvg.toFixed(1)} km/L</div>
                    </div>
                  </div>

                  {anomaly.recommendation && (
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3">
                      <p className="text-sm text-[var(--color-text-secondary)]">{anomaly.recommendation}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (

        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No vehicles match your search or filter configuration.</p>
        </div>
      )}
    </div>
  );
}
