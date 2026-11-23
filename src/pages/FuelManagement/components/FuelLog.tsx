import type { FuelFillUp } from '../types';
import { Filter, Droplet, Eye, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { exportRowsToPDF } from "../../../lib/utils/fuelExport";
import { exportRowsAsXlsx } from '../../../lib/utils/excelExport';
import ViewFuelLogModal from './ViewFuelLogModal';
import ImportFuelStatement from './ImportFuelStatement';
import type { FuelStation, FuelVehicle } from '../../../lib/api/fuelService';
import { buildFuelLogExportRows, filterFuelFillUps, formatFuelExportDate, fuelLogExportHeaders } from '../fuelReportData';
import {
  ActionMenu,
  ConfirmationModal,
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
const filtersPanelClasses = 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5';

interface FuelLogProps {
  fillUps: FuelFillUp[];
  onDelete?: (id: string, reason: string) => Promise<void> | void;
  onDownloadReceipt?: (fillUpId: string, name: string) => void;
  onLogFillUp?: () => void;
  stations?: FuelStation[];
  vehicles?: FuelVehicle[];
  onImportComplete?: () => Promise<void>;
  onExport?: (format: string) => void;
  onFilteredFillUpsChange?: (fillUps: FuelFillUp[]) => void;
}

export default function FuelLog({ fillUps = [], onDelete, onDownloadReceipt, onLogFillUp, stations = [], vehicles = [], onImportComplete, onExport, onFilteredFillUpsChange }: FuelLogProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedViewRecord, setSelectedViewRecord] = useState<FuelFillUp | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [voidTargetIds, setVoidTargetIds] = useState<string[]>([]);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const resetPagination = () => {
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const vehiclesOptions = useMemo(() => {
    const labels = new Map(fillUps.filter((fillUp) => fillUp.vehicleId).map((fillUp) => [fillUp.vehicleId, fillUp.vehicleName || fillUp.vehicleId]));
    return [{ value: 'All', label: 'All Vehicles' }, ...Array.from(labels, ([value, label]) => ({ value, label }))];
  }, [fillUps]);

  const filteredFillUps = useMemo(() => {
    return filterFuelFillUps(fillUps, { search, vehicleId: vehicleFilter, date: dateFilter, station: stationFilter });
  }, [fillUps, search, vehicleFilter, dateFilter, stationFilter]);
  const selectableFillUps = useMemo(() => filteredFillUps.filter((fillUp) => !fillUp.isVoided), [filteredFillUps]);

  useEffect(() => {
    onFilteredFillUpsChange?.(filteredFillUps);
  }, [filteredFillUps, onFilteredFillUpsChange]);

  useEffect(() => {
    const selectableIds = new Set(selectableFillUps.map((fillUp) => fillUp.id));
    // Keep bulk selection limited to the currently visible non-voided fuel records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds((current) => current.filter((id) => selectableIds.has(id)));
  }, [selectableFillUps]);

  const totalPages = Math.ceil(filteredFillUps.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFillUps = filteredFillUps.slice(startIndex, startIndex + itemsPerPage);

  const openVoidConfirmation = (ids: string[]) => {
    setVoidTargetIds(ids);
    setVoidReason('');
    setVoidError('');
  };

  const confirmVoid = async () => {
    const reason = voidReason.trim();
    if (!reason) { setVoidError('A reason is required to void fuel entries.'); return; }
    if (!onDelete || !voidTargetIds.length || isVoiding) return;
    setIsVoiding(true);
    setVoidError('');
    try {
      for (const id of voidTargetIds) {
        await onDelete(id, reason);
        setVoidTargetIds((current) => current.filter((targetId) => targetId !== id));
        setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
      }
      setSelectedIds((current) => current.filter((id) => !voidTargetIds.includes(id)));
      setVoidTargetIds([]);
    } catch (error) {
      setVoidError(error instanceof Error ? error.message : 'Unable to void the selected fuel entries.');
    } finally {
      setIsVoiding(false);
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
    onExport?.('excel');
    const rows = buildFuelLogExportRows(filteredFillUps);
    if (rows.length === 0) return;
    exportRowsAsXlsx(`fuel_log_${formatFuelExportDate(new Date())}.xlsx`, 'Fuel Log', [fuelLogExportHeaders, ...rows]);
  };

  const handleExportPDF = () => {
    onExport?.('pdf');
    const rows = buildFuelLogExportRows(filteredFillUps);
    if (rows.length === 0) return;
    exportRowsToPDF('fuel-log', 'Fuel Log', fuelLogExportHeaders, rows);
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
          {onLogFillUp && (
            <button type="button" onClick={onLogFillUp} className={successActionButton}>
              <Droplet size={16} strokeWidth={1.8} />
              Log Fill-up
            </button>
          )}
          {onImportComplete && (
            <button type="button" onClick={() => setShowImport(true)} className={actionButtonFilter}>
              <FileSpreadsheet size={16} strokeWidth={1.8} />
              Import Statement
            </button>
          )}
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

        </div>
      )}

      {onDelete && selectedIds.length > 0 && (
        <div className="mb-4 rounded-xl border border-[var(--color-brand-danger)]/30 bg-[var(--color-brand-danger)]/10 p-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-brand-danger)] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-[var(--color-brand-danger)]">
                Void {selectedIds.length} selected record{selectedIds.length > 1 ? 's' : ''}? A reason is required and the entries will remain in the audit history.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => openVoidConfirmation(selectedIds)}
                className="font-medium rounded-lg transition-all duration-200 active:scale-95 focus:outline-none bg-[var(--color-brand-danger)] hover:bg-[var(--color-brand-danger)]/90 text-white border border-[var(--color-brand-danger)] px-3 py-1.5 text-xs cursor-pointer"
              >
                Void selected
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
            ...(onDelete ? [{
              key: 'select',
              header: (
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  disabled={selectableFillUps.length === 0}
                  checked={selectableFillUps.length > 0 && selectableFillUps.every((fillUp) => selectedIds.includes(fillUp.id))}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedIds(selectableFillUps.map((fillUp) => fillUp.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              ),
              width: '4%',
              render: (fillUp: FuelFillUp) => (
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={selectedIds.includes(fillUp.id)}
                  disabled={Boolean(fillUp.isVoided)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={e => {
                    if (fillUp.isVoided) return;
                    if (e.target.checked) {
                      setSelectedIds(prev => [...prev, fillUp.id]);
                    } else {
                      setSelectedIds(prev => prev.filter(id => id !== fillUp.id));
                    }
                  }}
                />
              ),
            }] : []),
            {
              key: 'vehicle',
              header: 'Vehicle',
              width: '17%',
              render: (fillUp) => (
                <div>
                  <div className="font-bold text-[var(--color-text-primary)]">{fillUp.vehicleName ?? 'N/A'}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] font-mono">{fillUp.vehicleId}  -  {fillUp.vehicleModel}</div>
                </div>
              ),
            },
            { key: 'date', header: 'Date / Status', width: '15%', render: (fillUp) => <span>{fillUp.date}{fillUp.isVoided && <strong className="ml-2 text-red-600">VOID</strong>}<small className="block text-xs">{fillUp.isFullTank ? 'Full tank' : 'Partial'} · {fillUp.isVoided ? 'Excluded' : fillUp.fuelClassification}</small></span> },
            { key: 'liters', header: 'Liters', width: '8%', render: (fillUp) => <span className="font-mono">{fillUp.liters}L</span> },
            { key: 'price', header: 'Price/L', width: '8%', render: (fillUp) => <span className="font-mono">₱{fillUp.pricePerLiter?.toFixed(2)}</span> },
            { key: 'total', header: 'Total Cost', width: '10%', render: (fillUp) => <span className="font-bold font-mono">₱{fillUp.totalCost?.toLocaleString()}</span> },
            { key: 'odometer', header: 'Odometer', width: '10%', render: (fillUp) => <span className="font-mono">{fillUp.odometer?.toLocaleString()} km</span> },
            {
              key: 'efficiency',
              header: 'Efficiency',
              width: '10%',
              render: (fillUp) => (
                <span className={`font-bold font-mono ${fillUp.isVoided ? 'text-[var(--color-text-secondary)]' : fillUp.anomaly ? 'text-[var(--color-brand-danger)]' : 'text-[var(--color-brand-success)]'}`}>
                  {fillUp.isVoided ? '—' : fillUp.efficiency == null ? 'N/A' : `${fillUp.efficiency.toFixed(1)} km/L`}
                </span>
              ),
            },
            {
              key: 'anomalyResolution',
              header: 'Anomaly / Resolution Note',
              width: '16%',
              render: (fillUp) => fillUp.anomaly ? (
                <div className="max-w-56 whitespace-normal text-xs">
                  <strong className="text-[var(--color-brand-danger)]">{fillUp.anomaly.status}</strong>
                  <p className="mt-1">{fillUp.anomaly.note?.trim() || 'No resolution note recorded.'}</p>
                </div>
              ) : <span className="text-[var(--color-text-secondary)]">-</span>,
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
                    ...(fillUp.receipt && onDownloadReceipt ? [{
                      label: 'Download receipt',
                      icon: Download,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        if (fillUp.receipt)
                          onDownloadReceipt?.(fillUp.id, fillUp.receipt.name);
                      },
                    }] : []),
                    ...(!fillUp.isVoided && onDelete ? [{
                      label: 'Void',
                      danger: true,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        openVoidConfirmation([fillUp.id]);
                      },
                    }] : []),
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
      {showImport && onImportComplete && (
        <ImportFuelStatement
          stations={stations}
          vehicles={vehicles}
          onClose={() => setShowImport(false)}
          onImported={onImportComplete}
        />
      )}
      <ConfirmationModal
        isOpen={voidTargetIds.length > 0}
        title="Void Fuel Entry"
        variant="danger"
        confirmLabel={isVoiding ? 'Voiding...' : `Void ${voidTargetIds.length} ${voidTargetIds.length === 1 ? 'Entry' : 'Entries'}`}
        busy={isVoiding}
        confirmDisabled={!voidReason.trim()}
        message={(
          <div className="space-y-3 text-left">
            <p>Void {voidTargetIds.length} selected fuel {voidTargetIds.length === 1 ? 'entry' : 'entries'}? The records will remain in the audit history and be excluded from fuel totals and efficiency calculations.</p>
            <label className="block text-sm font-medium">
              Void reason (required)
              <textarea required maxLength={2000} rows={3} value={voidReason} disabled={isVoiding} onChange={(event) => setVoidReason(event.target.value)} className="mt-2 block w-full rounded-lg border border-[#c8ced8] bg-white p-3 text-sm outline-none focus:border-[#070b45]" />
            </label>
            {voidError && <p role="alert" className="text-sm text-red-700">{voidError}</p>}
          </div>
        )}
        onConfirm={() => { void confirmVoid(); }}
        onCancel={() => { if (!isVoiding) setVoidTargetIds([]); }}
      />
    </div>
  );
}
