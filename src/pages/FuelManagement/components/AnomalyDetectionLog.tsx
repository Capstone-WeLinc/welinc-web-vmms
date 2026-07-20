import type { AnomalyLog } from '../types';
import FuelStatusBadge from './FuelStatusBadge';
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  className?: string;
}

function InputField({ label, id, className, ...props }: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${className || ''}`}
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
        <label
          htmlFor={id}
          className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <select
        id={id}
        className={`w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 appearance-none cursor-pointer ${className || ''}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface AnomalyDetectionLogProps {
  logs: AnomalyLog[];
}

export default function AnomalyDetectionLog({ logs = [] }: AnomalyDetectionLogProps) {
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [alertFilter, setAlertFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleVehicleFilterChange = (value: string) => {
    setVehicleFilter(value);
    setCurrentPage(1);
  };

  const handleAlertFilterChange = (value: string) => {
    setAlertFilter(value);
    setCurrentPage(1);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch =
        (log.vehicleName?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
        (log.vehicleId?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
        (log.model?.toLowerCase() ?? '').includes(search.toLowerCase());

      const matchesVehicle = vehicleFilter === 'All' || log.vehicleId === vehicleFilter;
      const matchesAlert = alertFilter === 'All' || log.alertType === alertFilter;

      return matchesSearch && matchesVehicle && matchesAlert;
    });
  }, [logs, search, vehicleFilter, alertFilter]);

  // Pagination Computations
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, startIndex]);

  const vehicles = useMemo(() => {
    return Array.from(new Set(logs.map(l => l.vehicleId).filter(Boolean)));
  }, [logs]);

  const vehicleOptions = useMemo(() => [
    { value: 'All', label: 'All Vehicles' },
    ...vehicles.map(v => ({ value: v, label: v }))
  ], [vehicles]);

  const alertOptions = [
    { value: 'All', label: 'All Alert Types' },
    { value: 'Anomaly', label: 'Anomaly' },
    { value: 'Below Avg', label: 'Below Avg' }
  ];

  // layout & style constants - using Tailwind classes with CSS variables
  const rootClasses = 'space-y-4';
  const headerRowClasses = 'flex flex-col gap-3';
  const headerContentClasses = 'flex gap-3 items-end justify-between flex-wrap';
  const searchContainerClasses = 'flex-1';
  const headerRightClasses = 'flex gap-3 items-center';
  const filterButtonClasses = (active: boolean) => `flex items-center gap-2 px-3 py-2 rounded-lg border transition ${active ? 'active-filter' : 'border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]'} cursor-pointer`;
  const filtersPanelClasses = 'grid gap-3 grid-cols-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4';
  const tableWrapClasses = 'overflow-auto overscroll-contain rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card lg:max-h-[min(40rem,calc(100vh-12rem))]';
  const tableClasses = 'w-full text-left text-sm';
  const tableHeaderRowClasses = 'border-b border-[var(--color-divider)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]';
  const tableHeaderCellClasses = 'px-4 py-3.5 font-medium text-xs uppercase tracking-wider';
  const emptyStateClasses = 'px-4 py-12 text-center text-[var(--color-text-secondary)]';
  const tableRowClasses = 'hover:bg-[var(--color-input-bg-hover)] transition-colors border-b border-[var(--color-divider)]';
  const tableCellClasses = 'px-4 py-3';
  const pagerClasses = 'pt-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]';
  const pagerCountClasses = 'text-[var(--color-text-primary)] font-medium';
  const pagerButtonsClasses = 'flex items-center gap-4';
  const pageButtonClasses = (disabled: boolean) => `flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition ${disabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`;
  const pageNumberClasses = 'text-xs text-[var(--color-text-secondary)] select-none font-medium';

  return (
    <div className={rootClasses}>
      <div className={headerRowClasses}>
        <div className={headerContentClasses}>
          <div className={searchContainerClasses}>
            <InputField
              label=""
              id="anomalySearch"
              placeholder="Search by vehicle name, plate, or model..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className={headerRightClasses}>
            <button onClick={() => setShowFilters(!showFilters)} className={filterButtonClasses(showFilters)}>
              <Filter size={16} strokeWidth={1.8} />
              <span>Filters</span>
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className={filtersPanelClasses}>
          <SelectField label="Vehicle" id="anomalyVehicleFilter" value={vehicleFilter} options={vehicleOptions} onChange={(e) => handleVehicleFilterChange(e.target.value)} />
          <SelectField label="Alert Type" id="anomalyAlertFilter" value={alertFilter} options={alertOptions} onChange={(e) => handleAlertFilterChange(e.target.value)} />
        </div>
      )}

      <div className={tableWrapClasses}>
        <table className={tableClasses}>
          <thead>
            <tr className={tableHeaderRowClasses}>
              <th className={tableHeaderCellClasses}>Timestamp</th>
              <th className={tableHeaderCellClasses}>Vehicle</th>
              <th className={tableHeaderCellClasses}>Alert Type</th>
              <th className={`${tableHeaderCellClasses} text-right`}>Vehicle km/L</th>
              <th className={`${tableHeaderCellClasses} text-right`}>Fleet Avg km/L</th>
              <th className={tableHeaderCellClasses}>Detected By</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className={emptyStateClasses}>
                  No anomaly notifications logs flagged during this operational session.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr key={log.id} className={tableRowClasses}>
                  <td className={`${tableCellClasses} text-[var(--color-text-secondary)] font-mono text-xs`}>{log.timestamp}</td>
                  <td className={tableCellClasses}>
                    <div className="font-bold text-[var(--color-text-primary)]">{log.vehicleName}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] font-mono">{log.vehicleId} · {log.model}</div>
                  </td>
                  <td className={tableCellClasses}>
                    <FuelStatusBadge status={log.alertType === 'Anomaly' ? 'Anomaly' : 'Below Avg'} size="sm" />
                  </td>
                  <td className={`${tableCellClasses} text-right font-bold text-[var(--color-text-primary)] font-mono`}>{log.vehicleEfficiency} km/L</td>
                  <td className={`${tableCellClasses} text-right text-[var(--color-text-secondary)] font-mono`}>{log.fleetAverage} km/L</td>
                  <td className={`${tableCellClasses} text-[var(--color-text-secondary)] text-xs`}>{log.detectedBy}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={pagerClasses}>
        <div>
          Showing <span className={pagerCountClasses}>{paginatedLogs.length}</span> of <span className={pagerCountClasses}>{filteredLogs.length}</span> matching entries
        </div>

        <div className={pagerButtonsClasses}>
          <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className={pageButtonClasses(currentPage === 1)} aria-label="Previous Page">
            <ChevronLeft size={16} />
          </button>

          <span className={pageNumberClasses}>Page {currentPage} of {totalPages || 1}</span>

          <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className={pageButtonClasses(currentPage === totalPages || totalPages === 0)} aria-label="Next Page">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
