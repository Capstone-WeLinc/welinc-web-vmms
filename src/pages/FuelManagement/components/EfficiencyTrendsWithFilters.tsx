import { useState } from 'react';
import type { VehicleEfficiency } from '../types';
import { Search, Filter, X } from 'lucide-react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  className?: string;
  onClear?: () => void;
}

function InputField({ label, id, className, onClear, value, onChange, ...props }: InputFieldProps) {
  const hasValue = value !== undefined && String(value).length > 0;
  const clearable = hasValue && Boolean(onClear || onChange);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    if (onChange) {
      (onChange as (event: { target: { value: string }; currentTarget: { value: string } }) => void)({
        target: { value: '' },
        currentTarget: { value: '' },
      });
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative w-full">
        <input
          id={id}
          value={value}
          onChange={onChange}
          className={`${className ?? ''} w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 ${clearable ? 'pr-9' : 'pr-3'} py-2 text-sm text-[var(--color-text-primary)]`}
          {...props}
        />
        {clearable ? (
          <button
            type="button"
            aria-label="Clear field"
            title="Clear"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-page-bg)] hover:text-[var(--color-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  id: string;
  options: SelectOption[];
  className?: string;
}

function SelectField({ label, id, options, className, ...props }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`${className ?? ''} w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] appearance-none cursor-pointer`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface EfficiencyTrendsWithFiltersProps {
  vehicles: VehicleEfficiency[];
  fleetAvg: number;
}

export default function EfficiencyTrendsWithFilters({
  vehicles,
  fleetAvg
}: EfficiencyTrendsWithFiltersProps) {
  const [search, setSearch] = useState('');
  const [trendFilter, setTrendFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleTrendFilterChange = (value: string) => {
    setTrendFilter(value);
    setCurrentPage(1);
  };

  const filtered = vehicles.filter(v => {
    const matchesSearch =
      v.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
      v.vehicleId.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase());

    const matchesTrend =
      trendFilter === 'All' ||
      (trendFilter === 'above' && v.avgEfficiency >= fleetAvg) ||
      (trendFilter === 'below' && v.avgEfficiency < fleetAvg);

    return matchesSearch && matchesTrend;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleVehicles = filtered.slice(startIndex, startIndex + itemsPerPage);

  const maxEfficiency = Math.max(...filtered.map(v => v.avgEfficiency), fleetAvg) * 1.1;

  const trendOptions = [
    { value: 'All', label: 'All Vehicles' },
    { value: 'above', label: 'Above Average' },
    { value: 'below', label: 'Below Average' }
  ];

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <InputField
            label=""
            id="efficiencySearch"
            placeholder="Search by name, plate, or model..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <button
            onClick={() => setShowFilters(!showFilters)}
              className={`flex h-10.5 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${showFilters
                ? 'active-filter'
                : 'border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]'
                }`}
          >
            <Filter size={16} strokeWidth={1.8} />
            Filter
          </button>
        </div>
      </div>

      {showFilters && (
        <SelectField
          label="Trend Filter"
          id="efficiencyTrendFilter"
          value={trendFilter}
          options={trendOptions}
          onChange={(e) => handleTrendFilterChange(e.target.value)}
        />
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
        <p className="text-xs text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
          The chart shows vehicle fuel efficiency compared to fleet average. Bars extending beyond the vertical amber line indicate above-average performance.
        </p>
      </div>

      <div className="space-y-5">
        {visibleVehicles.length > 0 ? (
          visibleVehicles.map((vehicle) => {
            const percentage = (vehicle.avgEfficiency / maxEfficiency) * 100;
            const isAbove = vehicle.avgEfficiency >= fleetAvg;

            return (
              <div key={vehicle.vehicleId} className="space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                        <div className="font-bold text-[var(--color-text-primary)]">{vehicle.vehicleName}</div>
                        <div className="text-xs text-[var(--color-text-secondary)] font-mono">{vehicle.vehicleId} • {vehicle.model}</div>
                  </div>
                  <div className="flex items-baseline gap-2 text-right">
                        <div className="text-sm font-bold text-[var(--color-text-primary)] font-mono">{vehicle.avgEfficiency.toFixed(1)} km/L</div>
                        <div className="text-xs text-[var(--color-text-secondary)] font-mono">({vehicle.fillUps} fill-up{vehicle.fillUps !== 1 ? 's' : ''})</div>
                  </div>
                </div>

                    <div className="relative h-4 overflow-hidden rounded-full bg-[var(--color-card-bg)]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isAbove ? 'bg-[var(--color-brand-success)]/80' : 'bg-[var(--color-brand-danger)]/60'
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
          })
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] p-8 text-center">
            <Search size={32} className="mx-auto mb-3 text-[var(--color-text-secondary)]" strokeWidth={1.8} />
            <p className="text-[var(--color-text-secondary)]">No vehicles match your search criteria</p>
          </div>
        )}
      </div>

      {/* Pagination control overlay & standard footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">

        {/* Results Count Summary */}
        <div className="text-sm text-[var(--color-text-secondary)]">
          Showing <span className="font-bold text-[var(--color-text-primary)]">{visibleVehicles.length}</span> of{' '}
          <span className="font-bold text-[var(--color-text-primary)]">{filtered.length}</span> matching vehicles
          {filtered.length !== vehicles.length && ` (filtered from ${vehicles.length} total)`}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-card-bg-hover)] disabled:opacity-40 disabled:hover:bg-[var(--color-input-bg)]"
            aria-label="Previous page"
          >
            &lt;
          </button>
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-card-bg-hover)] disabled:opacity-40 disabled:hover:bg-[var(--color-input-bg)]"
            aria-label="Next page"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
