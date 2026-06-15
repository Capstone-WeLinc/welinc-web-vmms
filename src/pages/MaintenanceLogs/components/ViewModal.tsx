import { X } from 'lucide-react';

type MaintenanceStatus = 'Pending' | 'In Progress' | 'Completed' | 'On Hold';
type MaintenanceClass = 'Maintenance' | 'Repair' | 'Inspection';

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

interface ViewModalProps {
  isOpen: boolean;
  log: MaintenanceLog | null;
  onClose: () => void;
}

const modalOverlayClasses = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';
const modalContentClasses = 'w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200';
const modalHeaderClasses = 'flex items-center justify-between border-b border-[var(--color-divider)] pb-4 mb-5';
const modalTitleClasses = 'text-lg font-bold text-[var(--color-text-primary)]';
const modalSubtitleClasses = 'text-xs text-[var(--color-text-secondary)] mt-0.5';
const closeButtonClasses = 'rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg)] hover:text-[var(--color-text-primary)] transition-colors';
const infoGridClasses = 'grid grid-cols-2 gap-y-5 gap-x-4';
const infoLabelClasses = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1';
const infoValueClasses = 'text-sm font-bold text-[var(--color-text-primary)]';
const classBadgeClasses = 'inline-block rounded-full bg-[var(--color-input-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-primary)]';
const modalFooterClasses = 'mt-8 flex justify-end border-t border-[var(--color-divider)] pt-4';
const modalCloseButtonClasses = 'font-medium rounded-lg transition-all duration-200 active:scale-95 focus:outline-none bg-[var(--color-card-bg)] hover:bg-[var(--color-card-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] px-4 py-2.5 text-sm';

const LogStatusBadge = ({ status }: { status: MaintenanceStatus }) => {
  const getStatusDetails = () => {
    switch (status) {
      case 'In Progress':
        return 'text-sky-700 border-sky-500/30 bg-sky-500/10 dark:text-sky-200';
      case 'Completed':
        return 'text-emerald-700 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-200';
      case 'On Hold':
        return 'text-slate-300 border-slate-500/30 bg-slate-500/10';
      case 'Pending':
      default:
        return 'text-amber-800 border-amber-500/30 bg-amber-500/10 dark:text-amber-200';
    }
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${getStatusDetails()}`}>
      {status}
    </span>
  );
};

export default function ViewModal({ isOpen, log, onClose }: ViewModalProps) {
  if (!isOpen || !log) return null;

  return (
    <div className={modalOverlayClasses}>
      <div className={modalContentClasses}>
        <div className={modalHeaderClasses}>
          <div>
            <h3 className={modalTitleClasses}>Maintenance Log Details</h3>
            <p className={modalSubtitleClasses}>{log.logNumber}</p>
          </div>
          <button
            onClick={onClose}
            className={closeButtonClasses}
          >
            <X size={18} />
          </button>
        </div>

        <div className={infoGridClasses}>
          <div>
            <span className={infoLabelClasses}>Vehicle</span>
            <span className={infoValueClasses}>{log.vehicle}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Status</span>
            <div>
              <LogStatusBadge status={log.status} />
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Type of Maintenance</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{log.type}</span>
          </div>
          <div>
            <span className={infoLabelClasses}>Class</span>
            <div>
              <span className={classBadgeClasses}>
                {log.class}
              </span>
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Date</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{log.date}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Mileage</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{log.mileage.toLocaleString()} km</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Mechanic / Shop</span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">{log.mechanic}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1">Cost</span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-200">₱{log.cost.toLocaleString()}</span>
          </div>
        </div>

        <div className={modalFooterClasses}>
          <button
            onClick={onClose}
            className={modalCloseButtonClasses}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
