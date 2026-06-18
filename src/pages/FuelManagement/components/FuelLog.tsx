import type { FuelFillUp } from '../types';
import { Edit, Filter, Droplet, Eye, AlertTriangle } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { printToPDF } from "../../../lib/utils/fuelExport";
import ViewFuelLogModal from './ViewFuelLogModal';
import {
  ActionMenu,
  DataTable,
  ExportButton,
  Pagination,
  SearchInput,
  checkboxClasses,
} from "../../../components/ui";

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
const successActionButton = `${actionButtonBase} rounded-xl border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/25`;
const filtersPanelClasses = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card';

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
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  useEffect(() => {
    const closeActionMenu = () => {
      setOpenActionMenuId(null);
      setIsExportMenuOpen(false);
    };
    document.addEventListener('click', closeActionMenu);
    return () => document.removeEventListener('click', closeActionMenu);
  }, []);

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
          <SearchInput
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
          <ExportButton
            open={isExportMenuOpen}
            onToggle={(event) => {
                event.stopPropagation();
                setIsExportMenuOpen((current) => !current);
              }}
            onPdf={() => {
              setIsExportMenuOpen(false);
              handleExportPDF();
            }}
            onExcel={() => {
              setIsExportMenuOpen(false);
              handleExportXLSX();
            }}
          />
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

          {/* Filledâ€‘by Filter */}
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
      <div id="fuel-log-table">
        <DataTable
          data={paginatedFillUps}
          getRowKey={(fillUp) => fillUp.id}
          minWidth="1120px"
          emptyMessage="No records found matching your filters."
          columns={[
            {
              key: 'select',
              header: (
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={filteredFillUps.length > 0 && selectedIds.length === filteredFillUps.length}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedIds(filteredFillUps.map(f => f.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              ),
              width: '4%',
              render: (fillUp) => (
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={selectedIds.includes(fillUp.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedIds(prev => [...prev, fillUp.id]);
                    } else {
                      setSelectedIds(prev => prev.filter(id => id !== fillUp.id));
                    }
                  }}
                />
              ),
            },
            {
              key: 'vehicle',
              header: 'Vehicle',
              width: '17%',
              render: (fillUp) => (
                <div>
                  <div className="font-bold text-[var(--color-text-primary)]">{fillUp.vehicleName ?? 'N/A'}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] font-mono">{fillUp.vehicleId} Â· {fillUp.vehicleModel}</div>
                </div>
              ),
            },
            { key: 'date', header: 'Date', width: '10%', render: (fillUp) => fillUp.date },
            { key: 'liters', header: 'Liters', width: '8%', render: (fillUp) => <span className="font-mono">{fillUp.liters}L</span> },
            { key: 'price', header: 'Price/L', width: '8%', render: (fillUp) => <span className="font-mono">â‚±{fillUp.pricePerLiter?.toFixed(2)}</span> },
            { key: 'total', header: 'Total Cost', width: '10%', render: (fillUp) => <span className="font-bold font-mono">â‚±{fillUp.totalCost?.toLocaleString()}</span> },
            { key: 'odometer', header: 'Odometer', width: '10%', render: (fillUp) => <span className="font-mono">{fillUp.odometer?.toLocaleString()} km</span> },
            {
              key: 'efficiency',
              header: 'Efficiency',
              width: '10%',
              render: (fillUp) => (
                <span className={`font-bold font-mono ${fillUp.trend === 'above' ? 'text-[var(--color-brand-success)]' : 'text-[var(--color-brand-danger)]'}`}>
                  {fillUp.efficiency} km/L
                </span>
              ),
            },
            { key: 'station', header: 'Station', width: '10%', render: (fillUp) => fillUp.station ?? 'N/A' },
            { key: 'filledBy', header: 'Filled By', width: '10%', render: (fillUp) => fillUp.filledBy ?? 'N/A' },
            {
              key: 'actions',
              header: 'Actions',
              width: '7%',
              align: 'center',
              render: (fillUp) => (
                <ActionMenu
                  open={openActionMenuId === fillUp.id}
                  onToggle={(event) => {
                    event.stopPropagation();
                    setOpenActionMenuId((current) =>
                      current === fillUp.id ? null : fillUp.id,
                    );
                  }}
                  items={[
                    {
                      label: 'View',
                      icon: Eye,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        handleView(fillUp);
                      },
                    },
                    {
                      label: 'Edit',
                      icon: Edit,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        onEdit?.(fillUp);
                      },
                    },
                    {
                      label: 'Delete',
                      danger: true,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        onDelete?.(fillUp.id);
                      },
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>

      <div className="pl-1">
        <Pagination
          page={Math.min(currentPage, Math.max(1, totalPages))}
          totalPages={Math.max(1, totalPages)}
          totalItems={filteredFillUps.length}
          pageSize={itemsPerPage}
          onPageChange={setCurrentPage}
          onPageSizeChange={(pageSize) => {
            setItemsPerPage(pageSize);
            setCurrentPage(1);
          }}
        />
        <div className="text-xs text-[var(--color-text-secondary)]">
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
