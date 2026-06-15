import type { FuelFillUp } from '../types';
import { Edit, Trash2, Filter, Download, Droplet, Eye, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import { printToPDF } from "../../../lib/utils/fuelExport";
import ViewFuelLogModal from './ViewFuelLogModal';

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
        className={`${className ?? ''} w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]`}
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

// Semantic className constants and inline style objects
const containerClasses = 'space-y-4';
const searchRowClasses = 'flex flex-col gap-4 md:flex-row md:items-end md:justify-between';
const actionsGroupClasses = 'flex flex-wrap gap-2 shrink-0';
const actionButtonBase = 'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer';
const actionButtonFilter = `${actionButtonBase} rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]`;
const actionButtonActiveFilter = `${actionButtonFilter} active-filter hover:bg-[var(--color-brand-primary)]/20`;
const secondaryActionButton = `${actionButtonBase} rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]`;
const successActionButton = `${actionButtonBase} rounded-xl border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/25`;
const filtersPanelClasses = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card';
const tableWrapperClasses = 'overflow-auto overscroll-contain rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card lg:max-h-[min(40rem,calc(100vh-12rem))]';
const tableClasses = 'w-full text-left text-sm';
const tableHeadRowClasses = 'sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]';
const tableCellBase = 'px-4 py-3';

interface FuelLogProps {
  fillUps: FuelFillUp[];
  onEdit?: (fillUp: FuelFillUp) => void;
  onDelete?: (id: string) => void;
  onLogFillUp?: () => void;
}

export default function FuelLog({ fillUps = [], onEdit, onDelete, onLogFillUp }: FuelLogProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [filledByFilter, setFilledByFilter] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedViewRecord, setSelectedViewRecord] = useState<FuelFillUp | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const resetPagination = () => {
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const vehiclesOptions = useMemo(() => {
    const uniqueIds = Array.from(new Set(fillUps.map(f => f.vehicleId).filter(Boolean)));
    return [
      { value: 'All', label: 'All Vehicles' },
      ...uniqueIds.map(v => ({ value: v, label: v }))
    ];
  }, [fillUps]);

  const filteredFillUps = useMemo(() => {
    return fillUps.filter(fillUp => {
      const searchLower = search.toLowerCase().trim();

      const matchesSearch = !searchLower ||
        (fillUp.vehicleName ?? '').toLowerCase().includes(searchLower) ||
        (fillUp.vehicleId ?? '').toLowerCase().includes(searchLower) ||
        (fillUp.station ?? '').toLowerCase().includes(searchLower);

      const matchesVehicle = vehicleFilter === 'All' || fillUp.vehicleId === vehicleFilter;
      const matchesDate = !dateFilter || fillUp.date === dateFilter;

      const matchesStation = !stationFilter ||
        (fillUp.station ?? '').toLowerCase().includes(stationFilter.toLowerCase().trim());

      const matchesFilledBy = !filledByFilter ||
        (fillUp.filledBy ?? '').toLowerCase().includes(filledByFilter.toLowerCase().trim());

      return matchesSearch && matchesVehicle && matchesDate && matchesStation && matchesFilledBy;
    });
  }, [fillUps, search, vehicleFilter, dateFilter, stationFilter, filledByFilter]);

  const totalPages = Math.ceil(filteredFillUps.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFillUps = filteredFillUps.slice(startIndex, startIndex + itemsPerPage);

  const confirmDelete = () => {
    if (selectedIds.length > 0) {
      selectedIds.forEach(id => onDelete?.(id));
      setSelectedIds([]);
    }
  };

  const handleView = (fillUp: FuelFillUp) => {
    setSelectedViewRecord(fillUp);
    setIsViewOpen(true);
  };

  const handleExportXLSX = () => {
    if (filteredFillUps.length === 0) return;
    const headers = ['Vehicle', 'ID', 'Model', 'Date', 'Liters', 'Price/L', 'Total Cost', 'Odometer', 'Station', 'Filled By'];
    const rows = filteredFillUps.map(f => [
      f.vehicleName, f.vehicleId, f.vehicleModel, f.date, f.liters, f.pricePerLiter, f.totalCost, f.odometer, f.station, f.filledBy
    ]);
    const csvContent = [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fuel_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    printToPDF('fuel-log-table', 'fuel-log');
  };

  return (
    <div className={containerClasses}>
      {/* Search + Actions Row */}
      <div className={searchRowClasses}>
        <div className="flex-1">
          <InputField
            id="fuelLogSearch"
            label=""
            placeholder="Search by vehicle name, plate, or station..."
            value={search}
            onChange={(e) => {
              resetPagination();
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className={actionsGroupClasses}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? actionButtonActiveFilter : actionButtonFilter}
          >
            <Filter size={16} strokeWidth={1.8} />
            Filters
          </button>
          <button
            onClick={handleExportXLSX}
            className={secondaryActionButton}
          >
            <Download size={16} strokeWidth={1.8} />
            Export .xlsx
          </button>
          <button
            onClick={handleExportPDF}
            className={secondaryActionButton}
          >
            <Download size={16} strokeWidth={1.8} />
            Export PDF
          </button>
          <button
            onClick={onLogFillUp}
            className={successActionButton}
          >
            <Droplet size={16} strokeWidth={1.8} />
            Log Fill-up
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className={filtersPanelClasses}>
          {/* Vehicle Filter */}
          <SelectField
            label="Vehicle"
            id="fuelVehicleFilter"
            value={vehicleFilter}
            options={vehiclesOptions}
            onChange={(e) => {
              resetPagination();
              setVehicleFilter(e.target.value);
            }}
          />

          {/* Date Filter */}
          <InputField
            id="fuelDateFilter"
            label="Date"
            type="date"
            value={dateFilter}
            onChange={(e) => {
              resetPagination();
              setDateFilter(e.target.value);
            }}
          />

          {/* Station Filter */}
          <InputField
            id="fuelStationFilter"
            label="Station"
            placeholder="e.g. Petron"
            value={stationFilter}
            onChange={(e) => {
              resetPagination();
              setStationFilter(e.target.value);
            }}
          />

          {/* Filled‑by Filter */}
          <InputField
            id="fuelFilledByFilter"
            label="Filled By"
            placeholder="e.g. Juan"
            value={filledByFilter}
            onChange={(e) => {
              resetPagination();
              setFilledByFilter(e.target.value);
            }}
          />
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-xl border border-[var(--color-brand-danger)]/30 bg-[var(--color-brand-danger)]/10 p-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-brand-danger)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-[var(--color-brand-danger)]">
                Delete {selectedIds.length} selected record{selectedIds.length > 1 ? 's' : ''}? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={confirmDelete}
                className="font-medium rounded-lg transition-all duration-200 active:scale-95 focus:outline-none bg-[var(--color-brand-danger)] hover:bg-[var(--color-brand-danger)]/90 text-white border border-[var(--color-brand-danger)] px-3 py-1.5 text-xs cursor-pointer"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="font-medium rounded-lg transition-all duration-200 active:scale-95 focus:outline-none bg-[var(--color-card-bg)] hover:bg-[var(--color-card-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] px-3 py-1.5 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Structure */}
      <div id="fuel-log-table" className={tableWrapperClasses}>
        <table className={tableClasses}>
          <thead>
            <tr className={tableHeadRowClasses}>
              {/* Master Checkbox Header column */}
                  <th className="px-4 py-3.5 w-8">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-input-bg)] cursor-pointer accent-[var(--color-brand-primary)]"
                    checked={filteredFillUps.length > 0 && selectedIds.length === filteredFillUps.length}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedIds(filteredFillUps.map(f => f.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
              </th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Vehicle</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Date</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Liters</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Price/L</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Total Cost</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Odometer</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Efficiency</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Station</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Filled By</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-divider)]">
            {paginatedFillUps.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                  No records found matching your filters.
                </td>
              </tr>
            ) : (
              paginatedFillUps.map((fillUp) => (
                <tr key={fillUp.id} className="hover:bg-[var(--color-card-bg-hover)] transition-colors group">
                  <td className={tableCellBase}>
                    <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-input-bg)] cursor-pointer accent-[var(--color-brand-primary)]"
                      checked={selectedIds.includes(fillUp.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, fillUp.id]);
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== fillUp.id));
                        }
                      }}
                    />
                  </td>
                    <td className={tableCellBase}>
                      <div className="font-bold text-[var(--color-text-primary)]">{fillUp.vehicleName ?? 'N/A'}</div>
                      <div className="text-xs text-[var(--color-text-secondary)] font-mono">{fillUp.vehicleId} · {fillUp.vehicleModel}</div>
                    </td>
                    <td className={`${tableCellBase} text-[var(--color-text-secondary)]`}>{fillUp.date}</td>
                    <td className={`${tableCellBase} text-[var(--color-text-secondary)] font-medium font-mono`}>{fillUp.liters}L</td>
                    <td className={`${tableCellBase} text-[var(--color-text-secondary)] font-mono`}>₱{fillUp.pricePerLiter?.toFixed(2)}</td>
                    <td className={`${tableCellBase} text-[var(--color-text-primary)] font-bold font-mono`}>₱{fillUp.totalCost?.toLocaleString()}</td>
                    <td className={`${tableCellBase} text-[var(--color-text-secondary)] font-mono`}>{fillUp.odometer?.toLocaleString()} km</td>
                  <td className={`${tableCellBase} font-bold font-mono ${fillUp.trend === 'above' ? 'text-[var(--color-brand-success)]' : 'text-[var(--color-brand-danger)]'}`}>
                    {fillUp.efficiency} km/L
                  </td>
                    <td className={`${tableCellBase} text-[var(--color-text-secondary)]`}>{fillUp.station ?? 'N/A'}</td>
                    <td className={`${tableCellBase} text-[var(--color-text-secondary)]`}>{fillUp.filledBy ?? 'N/A'}</td>
                  <td className={tableCellBase}>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => handleView(fillUp)}
                        title="View record"
                          className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] transition cursor-pointer"
                      >
                        <Eye size={15} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => onEdit?.(fillUp)}
                        title="Edit record"
                          className="p-1.5 rounded-lg text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]/70 hover:bg-[var(--color-brand-primary)]/10 transition cursor-pointer"
                      >
                        <Edit size={15} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => onDelete?.(fillUp.id)}
                        title="Delete record"
                        className="table-delete-button !p-1.5"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-1">
        <div className="text-xs text-[var(--color-text-secondary)] flex flex-col gap-1">
          <span>
            Showing <span className="text-[var(--color-text-primary)] font-medium">{paginatedFillUps.length}</span> of{' '}
            <span className="text-[var(--color-text-primary)] font-medium">{filteredFillUps.length}</span> matching entries
          </span>
          {filteredFillUps.length !== fillUps.length && (
            <div>
              <button
                onClick={() => {
                  resetPagination();
                  setSearch('');
                  setVehicleFilter('All');
                  setDateFilter('');
                  setStationFilter('');
                  setFilledByFilter('');
                }}
                className="text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-dark)] transition text-left cursor-pointer font-medium"
              >
                Clear all active filters (total: {fillUps.length})
              </button>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] disabled:opacity-20 disabled:hover:bg-[var(--color-input-bg)] cursor-pointer disabled:cursor-not-allowed transition"
              aria-label="Previous Page"
            >
              &lt;
            </button>

            <span className="text-xs text-[var(--color-text-secondary)] select-none font-medium px-1">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] disabled:opacity-20 disabled:hover:bg-[var(--color-input-bg)] cursor-pointer disabled:cursor-not-allowed transition"
              aria-label="Next Page"
            >
              &gt;
            </button>
          </div>
        )}
      </div>

      {isViewOpen && selectedViewRecord && (
        <ViewFuelLogModal
          isOpen={isViewOpen}
          onClose={() => {
            setIsViewOpen(false);
            setSelectedViewRecord(null);
          }}
          fillUp={selectedViewRecord}
        />
      )}
    </div>
  );
}
