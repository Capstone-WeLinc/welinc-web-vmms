import { useEffect, useState } from 'react';
import {
  Download,
  FileText,
  AlertTriangle,
  ChevronDown,
  Filter,
  Eye,
} from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';
import ViewModal from './components/ViewModal';
import { getCurrentUser } from "../../lib/api/authService";
import type { UserRecord } from "../../lib/api/authService";
import { isMechanicRole } from "../../lib/utils/permissions";

type MaintenanceClass = 'Maintenance' | 'Repair' | 'Inspection';
type MaintenanceStatus = 'Pending' | 'In Progress' | 'Completed' | 'On Hold';

interface MaintenanceLog {
  id: string;
  logNumber: string;
  vehicle: string;
  type: string;
  class: MaintenanceClass;
  date: string;
  mileage: number;
  status: MaintenanceStatus;
  mechanic: string;
  cost: number;
}

const initialLogs: MaintenanceLog[] = [
  {
    id: 'log-1',
    logNumber: 'MLG-20260514-0005',
    vehicle: 'TRK-0005',
    type: 'Battery Replacement',
    class: 'Maintenance',
    date: '2026-05-14',
    mileage: 12000,
    status: 'Pending',
    mechanic: 'Pedro Santos',
    cost: 5000,
  },
  {
    id: 'log-2',
    logNumber: 'MLG-20260510-0001',
    vehicle: 'TRK-0001',
    type: 'Oil Change',
    class: 'Maintenance',
    date: '2026-05-10',
    mileage: 45000,
    status: 'In Progress',
    mechanic: 'Juan Dela Cruz',
    cost: 2500,
  },
  {
    id: 'log-5',
    logNumber: 'MLG-20260428-0003',
    vehicle: 'TRK-0003',
    type: 'Tire Rotation',
    class: 'Maintenance',
    date: '2026-04-28',
    mileage: 55000,
    status: 'Completed',
    mechanic: 'Juan Dela Cruz',
    cost: 1800,
  },
];

const pageContainerClasses = 'space-y-6';
const panelClasses = 'rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-card transition duration-200';
const headerSectionClasses = 'flex flex-col gap-4 mb-6 md:flex-row md:items-end md:justify-between';
const actionRowClasses = 'flex gap-3';
const filterGridClasses = 'grid gap-3 mb-6 grid-cols-1 md:grid-cols-5';
const alertBannerClasses = 'mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4';
const alertContentClasses = 'flex items-start gap-3';
const alertActionsClasses = 'flex gap-2 shrink-0';
const tableWrapperClasses = 'overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-card';
const tableClasses = 'w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]';
const tableHeadClasses = 'bg-[var(--color-input-bg)] border-b border-[var(--color-border)]';
const tableRowClasses = 'hover:bg-[var(--color-card-bg-hover)] transition-colors';
const tableCellClasses = 'px-4 py-3';
const tableHeaderCellClasses = 'px-4 py-3 font-semibold text-[var(--color-text-secondary)]';
const footerRowClasses = 'mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-sm text-[var(--color-text-secondary)]';
const paginationButtonClasses = 'flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] disabled:opacity-20 disabled:hover:bg-[var(--color-input-bg)] cursor-pointer disabled:cursor-not-allowed transition';
const pageLabelClasses = 'text-xs text-[var(--color-text-secondary)] select-none font-medium px-1';
const viewButtonClasses = 'inline-flex items-center gap-1.5 py-1 px-2.5 text-xs';
const checkboxClasses = 'w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-card-bg)] cursor-pointer';
const pillBadgeClasses = 'inline-block rounded-full bg-[var(--color-card-bg)] px-3 py-1 text-xs font-medium text-[var(--color-text-primary)]';

const inputWrapperClasses = 'w-full';
const labelClasses = 'block text-xs font-medium mb-1.5 text-[var(--color-text-secondary)]';
const inputBaseClasses = 'w-full px-3.5 py-2.5 rounded-xl border font-normal text-sm transition-colors duration-200 bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 focus:outline-none';
const selectWrapperClasses = 'relative';
const selectBaseClasses = 'w-full px-3.5 py-2.5 rounded-xl border bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-primary)] focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 focus:outline-none appearance-none text-sm';
const dropdownIconClasses = 'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none';
const buttonBaseClasses = 'font-semibold rounded-lg transition-all duration-200 active:scale-95 focus:outline-none';
const primaryButtonClasses = 'bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-dark)] border border-[var(--color-brand-primary)]';
const secondaryButtonClasses = 'bg-[var(--color-card-bg)] hover:bg-[var(--color-card-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]';
const dangerButtonClasses = 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-700';
const logStatusBadgeBaseClasses = 'inline-flex items-center font-medium rounded-full border px-3 py-1 text-xs uppercase tracking-wider';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  id: string;
}

const InputField = ({ label, id, className = '', ...props }: InputFieldProps) => (
  <div className={inputWrapperClasses}>
    {label && (
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
    )}
    <input
      id={id}
      className={`${inputBaseClasses} ${className}`}
      {...props}
    />
  </div>
);

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  id: string;
  options: { value: string; label: string }[];
}

const SelectField = ({ label, id, options, className = '', ...props }: SelectFieldProps) => (
  <div className={inputWrapperClasses}>
    {label && (
      <label htmlFor={id} className={labelClasses}>
        {label}
      </label>
    )}
    <div className={selectWrapperClasses}>
      <select
        id={id}
        className={`${selectBaseClasses} ${className}`}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={dropdownIconClasses} />
    </div>
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const Button = ({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) => {
  const variantClass = {
    primary: primaryButtonClasses,
    secondary: secondaryButtonClasses,
    danger: dangerButtonClasses,
  }[variant];

  const sizeClass = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size];

  return (
    <button
      className={`${buttonBaseClasses} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    />
  );
};

interface StatusBadgeProps {
  status: MaintenanceStatus;
}

const LogStatusBadge = ({ status }: StatusBadgeProps) => {
  const getStatusDetails = () => {
    switch (status) {
      case 'In Progress':
        return 'text-sky-700 border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 dark:text-sky-200';
      case 'Completed':
        return 'text-emerald-700 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-200';
      case 'On Hold':
        return 'text-[var(--color-text-secondary)] border-[var(--color-border)]/50 bg-[var(--color-card-bg-hover)]';
      case 'Pending':
      default:
        return 'text-amber-800 border-amber-500/30 bg-amber-500/10 dark:text-amber-200';
    }
  };

  return (
    <span className={`${logStatusBadgeBaseClasses} ${getStatusDetails()}`}>
      {status}
    </span>
  );
};

export default function MaintenanceLogs() {
  const [logs, setLogs] = useState<MaintenanceLog[]>(initialLogs);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingLog, setViewingLog] = useState<MaintenanceLog | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const isMechanic = isMechanicRole(currentUser);

  const normalizeText = (value?: string | null) =>
    value?.trim().toLowerCase() ?? "";

  const isAssignedToCurrentMechanic = (log: MaintenanceLog) => {
    if (!isMechanic || !currentUser) return true;

    const currentNames = [currentUser.name, currentUser.username]
      .map(normalizeText)
      .filter(Boolean);

    const logMechanic = normalizeText(log.mechanic);

    return currentNames.some(
      (name) =>
        logMechanic === name ||
        logMechanic.includes(name) ||
        name.includes(logMechanic),
    );
  };

  useEffect(() => {
    getCurrentUser()
      .then((user) => setCurrentUser(user))
      .catch(() => setCurrentUser(null));
  }, []);

  const filteredLogs = logs.filter(log => {
    if (isMechanic && !isAssignedToCurrentMechanic(log)) {
      return false;
    }

    const matchesSearch =
      log.logNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.vehicle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVehicle = vehicleFilter === 'All' || log.vehicle === vehicleFilter;
    const matchesType = typeFilter === 'All' || log.class === typeFilter;
    const matchesStatus = statusFilter === 'All' || log.status === statusFilter;
    const matchesDateFrom = !dateFrom || log.date >= dateFrom;
    const matchesDateTo = !dateTo || log.date <= dateTo;

    return matchesSearch && matchesVehicle && matchesType && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const confirmDelete = () => {
    if (selectedIds.length > 0) {
      setLogs(logs.filter(log => !selectedIds.includes(log.id)));
      setSelectedIds([]);
    }
  };

  const handleExportExcel = () => {
    const headers = ['Log #', 'Vehicle', 'Type', 'Class', 'Date', 'Mileage', 'Status', 'Mechanic', 'Cost'];
    const rows = filteredLogs.map(log => [
      log.logNumber,
      log.vehicle,
      log.type,
      log.class,
      log.date,
      log.mileage,
      log.status,
      log.mechanic,
      `₱${log.cost.toLocaleString()}`,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maintenance-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export to PDF');
      return;
    }

    const headers = ['Log #', 'Vehicle', 'Type', 'Class', 'Date', 'Mileage', 'Status', 'Mechanic', 'Cost'];
    const rows = filteredLogs.map(log => `
      <tr>
        <td>${log.logNumber}</td>
        <td>${log.vehicle}</td>
        <td>${log.type}</td>
        <td>${log.class}</td>
        <td>${log.date}</td>
        <td>${log.mileage}</td>
        <td>${log.status}</td>
        <td>${log.mechanic}</td>
        <td>₱${log.cost.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Maintenance Logs</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 24px; }
            h1 { margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Maintenance Logs</h1>
          <table>
            <thead>
              <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="9" style="text-align:center;padding:16px;color:#6b7280;">No logs to export</td></tr>'}
            </tbody>
          </table>
          <script>
            function triggerPrint() {
              window.focus();
              window.print();
            }
            window.onload = triggerPrint;
          </script>
        </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    const interval = setInterval(() => {
      if (printWindow.document.readyState === 'complete') {
        clearInterval(interval);
        printWindow.focus();
        printWindow.print();
      }
    }, 100);
  };

  return (
    <div className={pageContainerClasses}>
      <PageHeader
        icon={FileText}
        title="Maintenance Logs"
        subtitle={isMechanic ? 'Search, filter, and view maintenance history records (read-only)' : 'Search, filter, and view maintenance history records'}
      />

      <div className={panelClasses}>
        <div className={headerSectionClasses}>
          <div className="flex-1">
            <InputField
              label="Search"
              id="search"
              placeholder="Search by log #, plate, or type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={actionRowClasses}>
            <Button
              variant="secondary"
              size="md"
              className={`flex items-center gap-2 whitespace-nowrap ${showFilters ? 'active-filter' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="flex items-center gap-2 whitespace-nowrap"
              onClick={handleExportExcel}
            >
              <Download size={16} />
              Export .xlsx
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="flex items-center gap-2 whitespace-nowrap"
              onClick={handleExportPdf}
            >
              <Download size={16} />
              Export PDF
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className={filterGridClasses}>
            <InputField id="dateFrom" label="Date From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <InputField id="dateTo" label="Date To" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            <SelectField
              id="vehicles"
              label="All Vehicles"
              options={[
                { value: 'All', label: 'All Vehicles' },
                { value: 'TRK-0001', label: 'TRK-0001' },
                { value: 'TRK-0002', label: 'TRK-0002' },
                { value: 'TRK-0003', label: 'TRK-0003' },
                { value: 'TRK-0004', label: 'TRK-0004' },
                { value: 'TRK-0005', label: 'TRK-0005' },
              ]}
              value={vehicleFilter}
              onChange={e => setVehicleFilter(e.target.value)}
            />
            <SelectField
              id="types"
              label="All Types"
              options={[
                { value: 'All', label: 'All Types' },
                { value: 'Maintenance', label: 'Maintenance' },
                { value: 'Repair', label: 'Repair' },
                { value: 'Inspection', label: 'Inspection' },
              ]}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            />
            <SelectField
              id="status"
              label="All Status"
              options={[
                { value: 'All', label: 'All Status' },
                { value: 'Pending', label: 'Pending' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Completed', label: 'Completed' },
                { value: 'On Hold', label: 'On Hold' },
              ]}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            />
          </div>
        )}

        {!isMechanic && selectedIds.length > 0 && (
          <div className={alertBannerClasses}>
            <div className={alertContentClasses}>
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
                  Delete {selectedIds.length} selected record{selectedIds.length > 1 ? 's' : ''}? This cannot be undone.
                </p>
              </div>
              <div className={alertActionsClasses}>
                <Button variant="danger" size="sm" onClick={confirmDelete}>
                  Yes, delete
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedIds([])}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className={tableWrapperClasses}>
          <table className={tableClasses}>
            <thead className={tableHeadClasses}>
              <tr>
                {!isMechanic && (
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      className={checkboxClasses}
                      checked={filteredLogs.length > 0 && selectedIds.length === filteredLogs.length}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedIds(filteredLogs.map(l => l.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                )}
                <th className={tableHeaderCellClasses}>Log #</th>
                <th className={tableHeaderCellClasses}>Vehicle</th>
                <th className={tableHeaderCellClasses}>Type of Maintenance</th>
                <th className={tableHeaderCellClasses}>Class</th>
                <th className={tableHeaderCellClasses}>Date</th>
                <th className={tableHeaderCellClasses}>Mileage</th>
                <th className={tableHeaderCellClasses}>Status</th>
                <th className={tableHeaderCellClasses}>Mechanic</th>
                <th className={tableHeaderCellClasses}>Cost</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-divider)]">
              {paginatedLogs.map(log => (
                <tr key={log.id} className={`${tableRowClasses} hover:bg-[var(--color-input-bg-hover)] transition-colors`}>
                  {!isMechanic && (
                    <td className={tableCellClasses}>
                      <input
                        type="checkbox"
                        className={checkboxClasses}
                        checked={selectedIds.includes(log.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, log.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== log.id));
                          }
                        }}
                      />
                    </td>
                  )}
                  <td className={`${tableCellClasses} font-medium text-[var(--color-text-secondary)]`}>{log.logNumber}</td>
                  <td className={`${tableCellClasses} font-medium text-[var(--color-text-primary)]`}>{log.vehicle}</td>
                  <td className={`${tableCellClasses} text-[var(--color-text-secondary)]`}>{log.type}</td>
                  <td className={tableCellClasses}>
                    <span className={pillBadgeClasses}>
                      {log.class}
                    </span>
                  </td>
                  <td className={`${tableCellClasses} text-[var(--color-text-secondary)]`}>{log.date}</td>
                  <td className={`${tableCellClasses} text-[var(--color-text-secondary)]`}>{log.mileage.toLocaleString()}</td>
                  <td className={tableCellClasses}>
                    <LogStatusBadge status={log.status} />
                  </td>
                  <td className={`${tableCellClasses} text-[var(--color-text-secondary)]`}>{log.mechanic}</td>
                  <td className={`${tableCellClasses} font-semibold text-green-400`}>₱{log.cost.toLocaleString()}</td>
                  <td className={`${tableCellClasses} text-center`}>
                    <Button
                      variant="secondary"
                      size="sm"
                      className={viewButtonClasses}
                      onClick={() => setViewingLog(log)}
                    >
                      <Eye size={14} />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={footerRowClasses}>
          <div>
            Showing <span className="text-[var(--color-text-secondary)] font-bold">{paginatedLogs.length}</span> of{' '}
            <span className="text-[var(--color-text-secondary)] font-bold">{filteredLogs.length}</span> matching entries
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={paginationButtonClasses}
              aria-label="Previous Page"
            >
              &lt;
            </button>

            <span className={pageLabelClasses}>
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={paginationButtonClasses}
              aria-label="Next Page"
            >
              &gt;
            </button>
          </div>
        </div>

      </div>

      <ViewModal
        isOpen={!!viewingLog}
        log={viewingLog}
        onClose={() => setViewingLog(null)}
      />
    </div>
  );
}
