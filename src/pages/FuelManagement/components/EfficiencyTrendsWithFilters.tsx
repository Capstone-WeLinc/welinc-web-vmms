import { useState } from 'react';
import type { VehicleEfficiency } from '../types';
import { Search, Filter } from 'lucide-react';
import { DropdownSelect, LegendHelp, Pagination } from '../../../components/ui';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  className?: string;
}

function InputField({ label, id, className, ...props }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`${className ?? ''} h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 text-sm text-[var(--color-text-primary)]`}
        {...props}
      />
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
      <DropdownSelect
        value={String(props.value ?? "")}
        options={options}
        onChange={(value) =>
          props.onChange?.({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)
        }
        label={label || id}
        className={className}
      />
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
          <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
              className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all duration-200 ${showFilters
                ? 'active-filter'
                : 'border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]'
                }`}
          >
            <Filter size={16} strokeWidth={1.8} />
            Filter
          </button>
          <LegendHelp
            title="Efficiency Legend"
            items={[
              { label: "Above Average", description: "Vehicle efficiency is at or above the fleet average.", tone: "#059669" },
              { label: "Below Average", description: "Vehicle efficiency is below the fleet average.", tone: "#dc2626" },
              { label: "Fleet Avg", description: "Reference line used to compare each vehicle.", tone: "#f59e0b" },
            ]}
          />
          </div>
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

      <Pagination
        page={Math.min(currentPage, Math.max(1, totalPages))}
        totalPages={Math.max(1, totalPages)}
        totalItems={filtered.length}
        pageSize={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
