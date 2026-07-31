import type { FuelFillUp } from '../types';
import { Edit, Filter, Eye } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { printToPDF } from "../../../lib/utils/fuelExport";
import { exportRowsToCsv, exportRowsToExcel } from "../../../lib/utils/frontendExport";
import ViewFuelLogModal from './ViewFuelLogModal';
import {
  ActionMenu,
  ConfirmationModal,
  DataTable,
  DropdownSelect,
  ExportButton,
  LegendHelp,
  Pagination,
  SearchInput,
  SortSelect,
} from "../../../components/ui";
import { useAuthStore } from "../../../store/authStore";
type FuelSortField = "date" | "vehicle" | "station" | "cost" | "efficiency";
type SortDirection = "asc" | "desc";

// Semantic className constants and inline style objects
const containerClasses = 'space-y-4';
const searchRowClasses = 'flex flex-col gap-4 md:flex-row md:items-center md:justify-between';
const actionsGroupClasses = 'flex flex-wrap gap-2 shrink-0';
const actionButtonFilter = 'flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]';
const actionButtonActiveFilter = `${actionButtonFilter} active-filter hover:bg-[var(--color-brand-primary)]/20`;

interface FuelLogProps {
  fillUps: FuelFillUp[];
  onEdit?: (fillUp: FuelFillUp) => void;
  onDelete?: (id: string) => void;
}

export default function FuelLog({ fillUps = [], onEdit, onDelete }: FuelLogProps) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const canManageFuelRecords = currentUser?.role === 'ADMIN' || currentUser?.role === 'OPERATIONS';
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [stationFilter, setStationFilter] = useState("All");
  const [filledByFilter, setFilledByFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<FuelSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedViewRecord, setSelectedViewRecord] = useState<FuelFillUp | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FuelFillUp | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const resetPagination = () => {
    setCurrentPage(1);
  };

  const toggleStatusFilter = (status: string) => {
    resetPagination();
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  };

  const filteredFillUps = useMemo(() => {
    return fillUps.filter(fillUp => {
      const searchLower = search.toLowerCase().trim();

      const matchesSearch = !searchLower ||
        (fillUp.vehicleName ?? '').toLowerCase().includes(searchLower) ||
        (fillUp.vehicleId ?? '').toLowerCase().includes(searchLower) ||
        (fillUp.station ?? '').toLowerCase().includes(searchLower);

      const status = fillUp.trend === 'above' ? 'Normal' : 'Flagged';
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(status);
      const matchesStation = stationFilter === 'All' || fillUp.station === stationFilter;
      const matchesFilledBy = filledByFilter === 'All' || fillUp.filledBy === filledByFilter;
      const matchesDateFrom = !dateFrom || fillUp.date >= dateFrom;
      const matchesDateTo = !dateTo || fillUp.date <= dateTo;

      return matchesSearch && matchesStatus && matchesStation && matchesFilledBy && matchesDateFrom && matchesDateTo;
    }).sort((left, right) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'date') return left.date.localeCompare(right.date) * direction;
      if (sortField === 'vehicle') return (left.vehicleId ?? '').localeCompare(right.vehicleId ?? '') * direction;
      if (sortField === 'station') return (left.station ?? '').localeCompare(right.station ?? '') * direction;
      if (sortField === 'cost') return ((left.totalCost ?? 0) - (right.totalCost ?? 0)) * direction;
      return ((left.efficiency ?? 0) - (right.efficiency ?? 0)) * direction;
    });
  }, [fillUps, search, statusFilters, stationFilter, filledByFilter, dateFrom, dateTo, sortDirection, sortField]);

  const stationOptions = useMemo(
    () => ['All', ...Array.from(new Set(fillUps.map((fillUp) => fillUp.station).filter(Boolean))).sort()],
    [fillUps],
  );
  const filledByOptions = useMemo(
    () => ['All', ...Array.from(new Set(fillUps.map((fillUp) => fillUp.filledBy).filter(Boolean))).sort()],
    [fillUps],
  );

  const totalPages = Math.ceil(filteredFillUps.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedFillUps = filteredFillUps.slice(startIndex, startIndex + itemsPerPage);

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

  const getExportRows = () => {
    const headers = ['Vehicle', 'ID', 'Model', 'Date', 'Liters', 'Price/L', 'Total Cost', 'Odometer', 'Station', 'Filled By', 'Receipt'];
    const rows = filteredFillUps.map(f => [
      f.vehicleName, f.vehicleId, f.vehicleModel, f.date, f.liters, f.pricePerLiter, f.totalCost, f.odometer, f.station, f.filledBy, f.receiptFileName ?? ''
    ]);
    return { headers, rows };
  };

  const handleExportCSV = () => {
    if (filteredFillUps.length === 0) return;
    const { headers, rows } = getExportRows();
    exportRowsToCsv(`fuel_log_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const handleExportXLSX = () => {
    if (filteredFillUps.length === 0) return;
    const { headers, rows } = getExportRows();
    exportRowsToExcel(`fuel_log_${new Date().toISOString().split('T')[0]}.xls`, headers, rows);
  };

  const handleExportPDF = () => {
    printToPDF('fuel-log-table', 'fuel-log');
  };

  return (
    <div className={containerClasses}>
      {/* Search + Actions Row */}
      <div className="relative">
      <div className={searchRowClasses}>
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-96">
            <SearchInput
              placeholder="Search by vehicle name, plate, or station..."
              value={search}
              onChange={(e) => {
                resetPagination();
                setSearch(e.target.value);
              }}
            />
          </div>
          <SortSelect
            className="w-full sm:w-60"
            value={`${sortField}-${sortDirection}`}
            onChange={(value) => {
              const [field, direction] = value.split("-") as [FuelSortField, SortDirection];
              setSortField(field);
              setSortDirection(direction);
              resetPagination();
            }}
            options={[
              { value: "date-desc", label: "Date - Newest" },
              { value: "date-asc", label: "Date - Oldest" },
              { value: "vehicle-asc", label: "Vehicle - A to Z" },
              { value: "vehicle-desc", label: "Vehicle - Z to A" },
              { value: "station-asc", label: "Station - A to Z" },
              { value: "station-desc", label: "Station - Z to A" },
              { value: "cost-desc", label: "Cost - Highest" },
              { value: "cost-asc", label: "Cost - Lowest" },
              { value: "efficiency-desc", label: "Efficiency - Highest" },
              { value: "efficiency-asc", label: "Efficiency - Lowest" },
            ]}
          />
        </div>
        <div className={actionsGroupClasses}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? actionButtonActiveFilter : actionButtonFilter}
              aria-expanded={showFilters}
              aria-label="Open fuel log filters"
            >
              <Filter size={16} strokeWidth={1.8} />
            </button>
            <LegendHelp
              title="Fuel Log Legend"
              items={[
                { label: "Normal", description: "Fuel record is within the expected efficiency range.", tone: "#059669" },
                { label: "Below Avg", description: "Vehicle efficiency is lower than the fleet average.", tone: "#f59e0b" },
                { label: "Anomaly", description: "Fuel activity needs review for possible issue or misuse.", tone: "#dc2626" },
                { label: "Filters", description: "Limit records by vehicle, date, station, or filled-by person.", tone: "#2563eb" },
              ]}
            />
          </div>
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
            onCsv={() => {
              setIsExportMenuOpen(false);
              handleExportCSV();
            }}
            onExcel={() => {
              setIsExportMenuOpen(false);
              handleExportXLSX();
            }}
          />
        </div>
      </div>      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute right-0 top-full z-40 mt-3 w-[min(92vw,34rem)] rounded-xl border border-[#e0e5ee] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.18)] lg:right-[13.75rem]">
          <h3 className="text-xl font-extrabold text-[#141827]">Filter by</h3>
          <div className="my-5 h-px bg-[#dde3eb]" />

          <div>
            <p className="text-sm font-bold text-black">Status</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {["Normal", "Flagged"].map((status) => (
                <label key={status} className="flex items-center gap-3 text-sm font-semibold text-[#141827]">
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(status)}
                    onChange={() => toggleStatusFilter(status)}
                    className="h-5 w-5 rounded border-2 border-[#c7d2e2] text-[#070b45] focus:ring-[#070b45]/20"
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-bold text-black">Date range</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#141827]">Date From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    resetPagination();
                    setDateFrom(event.target.value);
                  }}
                  className="mt-2 h-10 w-full rounded-xl border border-[#c7d2e2] bg-white px-4 text-sm font-semibold text-[#141827] outline-none transition focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#141827]">Date To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    resetPagination();
                    setDateTo(event.target.value);
                  }}
                  className="mt-2 h-10 w-full rounded-xl border border-[#c7d2e2] bg-white px-4 text-sm font-semibold text-[#141827] outline-none transition focus:border-[#070b45]"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[#141827]">Station</span>
              <DropdownSelect
                className="mt-2"
                value={stationFilter}
                onChange={(value) => {
                  resetPagination();
                  setStationFilter(value);
                }}
                label="Station"
                buttonClassName="px-4 font-semibold"
                options={stationOptions.map((option) => ({
                  value: option,
                  label: option === 'All' ? 'All stations' : option,
                }))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#141827]">Filled by</span>
              <DropdownSelect
                className="mt-2"
                value={filledByFilter}
                onChange={(value) => {
                  resetPagination();
                  setFilledByFilter(value);
                }}
                label="Filled by"
                buttonClassName="px-4 font-semibold"
                options={filledByOptions.map((option) => ({
                  value: option,
                  label: option === 'All' ? 'All staff' : option,
                }))}
              />
            </label>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              className="h-10 rounded-lg bg-[#070b45] text-sm font-bold text-white transition hover:bg-[#11175f]"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                resetPagination();
                setStatusFilters([]);
                setStationFilter('All');
                setFilledByFilter('All');
                setDateFrom('');
                setDateTo('');
                setShowFilters(false);
              }}
              className="h-10 rounded-lg border-2 border-[#070b45] bg-white text-sm font-bold text-[#070b45] transition hover:bg-[#f6f8fc]"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      </div>
      {/* Table Structure */}
      <div id="fuel-log-table">
        <DataTable
          data={paginatedFillUps}
          getRowKey={(fillUp) => fillUp.id}
          minWidth="1120px"
          emptyMessage="No records found matching your filters."
          onDeleteSelected={(ids) => ids.forEach((id) => onDelete?.(id))}
          columns={[

            {
              key: 'vehicle',
              header: 'Vehicle',
              width: '17%',
              render: (fillUp) => (
                <div>
                  <div className="font-bold text-[var(--color-text-primary)]">{fillUp.vehicleName ?? 'N/A'}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{fillUp.vehicleId} · {fillUp.vehicleModel}</div>
                </div>
              ),
            },
            { key: 'date', header: 'Date', width: '10%', render: (fillUp) => fillUp.date },
            { key: 'liters', header: 'Liters', width: '8%', render: (fillUp) => `${fillUp.liters}L` },
            { key: 'price', header: 'Price/L', width: '8%', render: (fillUp) => `₱${fillUp.pricePerLiter?.toFixed(2)}` },
            { key: 'total', header: 'Total Cost', width: '10%', render: (fillUp) => <span className="font-bold">₱{fillUp.totalCost?.toLocaleString()}</span> },
            { key: 'odometer', header: 'Odometer', width: '10%', render: (fillUp) => `${fillUp.odometer?.toLocaleString()} km` },
            {
              key: 'efficiency',
              header: 'Efficiency',
              width: '10%',
              render: (fillUp) => (
                <span className={`font-bold ${fillUp.trend === 'above' ? 'text-[var(--color-brand-success)]' : 'text-[var(--color-brand-danger)]'}`}>
                  {fillUp.efficiency} km/L
                </span>
              ),
            },
            { key: 'station', header: 'Station', width: '10%', render: (fillUp) => fillUp.station ?? 'N/A' },
            { key: 'filledBy', header: 'Filled By', width: '10%', render: (fillUp) => fillUp.filledBy ?? 'N/A' },
            {
              key: 'actions',
              header: '',
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
                    ...(canManageFuelRecords && onEdit ? [{
                      label: 'Edit',
                      icon: Edit,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        onEdit?.(fillUp);
                      },
                    }] : []),
                    ...(canManageFuelRecords ? [{
                      label: 'Delete',
                      danger: true,
                      onClick: () => {
                        setOpenActionMenuId(null);
                        setDeleteTarget(fillUp);
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
                  setStatusFilters([]);
                  setStationFilter('All');
                  setFilledByFilter('All');
                  setDateFrom('');
                  setDateTo('');
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
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Delete fuel record"
        message={
          deleteTarget
            ? `Delete the fuel fill-up for ${deleteTarget.vehicleName ?? deleteTarget.vehicleId}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          onDelete?.(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
