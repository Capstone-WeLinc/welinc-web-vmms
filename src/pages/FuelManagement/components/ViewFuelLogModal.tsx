import type { FuelFillUp } from '../types';
import { X, Droplet, Calendar, Gauge, Navigation, User, DollarSign } from 'lucide-react';

interface ViewFuelLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  fillUp: FuelFillUp;
}

export default function ViewFuelLogModal({ isOpen, onClose, fillUp }: ViewFuelLogModalProps) {
  if (!isOpen || !fillUp) return null;
  // Layout constants and inline visual styles
    const overlayClasses = 'modal-overlay backdrop-blur-sm p-4';
    const containerClasses = 'w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl modal-content';
    const headerClasses = 'flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]';
    const iconBgClasses = 'p-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-brand-primary)]';
    const infoBannerClasses = 'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]';
    const cardClasses = 'p-4 rounded-xl space-y-3 border border-[var(--color-border)] bg-[var(--color-card-bg)]';
    const statusBadgeClasses = fillUp.trend === 'above'
      ? 'mt-2 inline-flex items-center px-3 py-1.5 rounded-md font-mono text-lg font-bold bg-[var(--color-brand-success)]/15 text-[var(--color-brand-success)] border border-[var(--color-brand-success)]/20'
      : 'mt-2 inline-flex items-center px-3 py-1.5 rounded-md font-mono text-lg font-bold bg-[var(--color-brand-danger)]/15 text-[var(--color-brand-danger)] border border-[var(--color-brand-danger)]/20';

  return (
    <div className={overlayClasses}>
      {/* Modal Container */}
        <div className={containerClasses}>

        {/* Header section */}
          <div className={headerClasses}>
          <div className="flex items-center gap-3">
              <div className={iconBgClasses}>
              <Droplet size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Fuel Fill-up Details</h2>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono mt-0.5">{fillUp.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[var(--color-text-secondary)] bg-transparent border-0">
            <X size={18} />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-6">

          {/* Top Info Banner - Vehicle Primary Stats */}
          <div className={infoBannerClasses}>
            <div>
              <div className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">Vehicle Profile</div>
              <div className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5">{fillUp.vehicleName ?? 'N/A'}</div>
              <div className="text-xs text-[var(--color-text-secondary)] font-mono mt-0.5">
                {fillUp.vehicleId} &middot; {fillUp.vehicleModel}
              </div>
            </div>

              <div className="flex flex-col items-start sm:items-end">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wider">Efficiency Metric</span>
              <div className={statusBadgeClasses}>
                {fillUp.efficiency} km/L
              </div>
            </div>
          </div>

          {/* Grid Layout Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Transaction Metrics Card */}
            <div className={cardClasses}>
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider pb-1 border-b border-[var(--color-border)]">
                <DollarSign size={14} className="text-[var(--color-brand-primary)]" />
                Cost Breakdown
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-[var(--color-text-secondary)]">Volume Filled</span>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] font-mono mt-0.5">{fillUp.liters}L</div>
                </div>
                <div>
                  <span className="text-xs text-[var(--color-text-secondary)]">Price Per Liter</span>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] font-mono mt-0.5">₱{fillUp.pricePerLiter?.toFixed(2)}</div>
                </div>
              </div>
              <div className="pt-2 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">Total Transaction Cost</span>
                  <div className="text-xl font-bold text-[var(--color-brand-primary)] font-mono mt-0.5">
                  ₱{fillUp.totalCost?.toLocaleString()}
                </div>
              </div>
            </div>

            <div className={cardClasses}>
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider pb-1 border-b border-[var(--color-border)]">
                <Gauge size={14} className="text-[var(--color-brand-primary)]" />
                Telemetry Logs
              </div>
                <div>
                <span className="text-xs text-[var(--color-text-secondary)]">Odometer Reading</span>
                <div className="text-sm font-semibold text-[var(--color-text-primary)] font-mono mt-0.5">
                  {fillUp.odometer?.toLocaleString()} km
                </div>
              </div>
              <div>
                <span className="text-xs text-[var(--color-text-secondary)]">Performance Status</span>
                <div className="text-xs font-medium mt-1">
                  {fillUp.trend === 'above' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[var(--color-brand-success)]/10 text-[var(--color-brand-success)] font-semibold">Optimal / Above Benchmark</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[var(--color-brand-danger)]/10 text-[var(--color-brand-danger)] font-semibold">Increased Fuel Consumption</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">

            {/* Date Field */}
            <div className="flex gap-3 items-start">
              <div className="mt-0.5 p-1.5 rounded-lg bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]">
                <Calendar size={14} />
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Date Logged</div>
                <div className="text-xs font-semibold text-[var(--color-text-secondary)] mt-0.5">{fillUp.date}</div>
              </div>
            </div>

            {/* Station Field */}
            <div className="flex gap-3 items-start">
              <div className="mt-0.5 p-1.5 rounded-lg bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]">
                <Navigation size={14} />
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Fuel Station</div>
                <div className="text-xs font-semibold text-[var(--color-text-secondary)] mt-0.5">{fillUp.station ?? 'N/A'}</div>
              </div>
            </div>

            {/* Personnel Field */}
            <div className="flex gap-3 items-start">
              <div className="mt-0.5 p-1.5 rounded-lg bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]">
                <User size={14} />
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Filled By</div>
                <div className="text-xs font-semibold text-[var(--color-text-secondary)] mt-0.5">{fillUp.filledBy ?? 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

          <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-card-bg)]">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">Close Profile</button>
        </div>

      </div>
    </div>
  );
}
