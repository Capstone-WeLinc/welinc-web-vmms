import { X, Wrench, AlertTriangle, ShieldAlert, CheckCircle, Info } from 'lucide-react';
import { useBodyScrollLock } from '../../../lib/hooks/useBodyScrollLock';
import type { FuelAnomaly } from '../types';
import FuelStatusBadge from './FuelStatusBadge';

interface AnomalyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomaly: FuelAnomaly | null;
  onAction?: (actionType: string, vehicleId: string) => void;
}

export default function AnomalyDetailModal({ isOpen, onClose, anomaly, onAction }: AnomalyDetailModalProps) {
  useBodyScrollLock(isOpen && Boolean(anomaly));

  if (!isOpen || !anomaly) return null;

  const diff = anomaly.efficiency - anomaly.fleetAvg;
  const diffPercent = Math.abs((diff / anomaly.fleetAvg) * 100).toFixed(1);
  const isAbove = diff >= 0;

  const handleActionClick = (actionType: string) => {
    onAction?.(actionType, anomaly.vehicleId);
    onClose();
  };

  // layout / style constants
  const overlayClasses = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
  const containerClasses = 'w-full max-w-150 rounded-xl flex flex-col max-h-[90vh] border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-2xl';
  const headerClasses = 'flex items-center justify-between px-6 py-4 shrink-0 border-b border-[var(--color-border)]';
  const contentWrapperClasses = 'flex-1 overflow-y-auto px-6 py-6 space-y-6';
  const infoCardClasses = 'flex items-start justify-between rounded-xl p-4 border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card';
  const diagCardClasses = anomaly.status === 'Anomaly'
    ? 'rounded-xl border border-[var(--color-brand-danger)]/20 bg-[var(--color-brand-danger)]/10 p-4 text-[var(--color-brand-danger)]'
    : 'rounded-xl border border-[var(--color-brand-warning)]/20 bg-[var(--color-brand-warning)]/10 p-4 text-[var(--color-brand-warning)]';
  const actionFooterClasses = 'flex items-center justify-end gap-3 px-6 py-4 shrink-0 border-t border-[var(--color-border)] bg-[var(--color-card-bg)]';
  const btnBase = 'rounded-xl px-4 py-2.5 text-sm font-medium transition cursor-pointer';

  return (
    <div className={overlayClasses}>
      <div className={containerClasses}>
        {/* Header */}
        <div className={headerClasses}>
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-[var(--color-brand-danger)] w-5 h-5" />
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Fuel Anomaly Diagnostics</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition">
            <X size={20} />
          </button>
        </div>
        <div className={contentWrapperClasses}>
          {/* Vehicle Metadata & Status */}
          <div className={infoCardClasses}>
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">{anomaly.vehicleName}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] font-mono mt-0.5">{anomaly.vehicleId} · {anomaly.model}</p>
            </div>
            <FuelStatusBadge status={anomaly.status} />
          </div>
          <div className={diagCardClasses}>
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5" />
              <div className="text-sm leading-relaxed">
                <strong>Telemetry Alert:</strong> This vehicle is operating at{' '}
                <span className="font-mono font-bold">{anomaly.efficiency.toFixed(1)} km/L</span>, which is{' '}
                <span className="font-mono font-bold">{diffPercent}% {isAbove ? 'above' : 'below'}</span> the fleet average of{' '}
                <span className="font-mono font-bold">{anomaly.fleetAvg.toFixed(1)} km/L</span>.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Info size={16} className="text-[var(--color-brand-primary)]" />
              Potential Diagnostics
            </h4>
            <div className="grid gap-3 text-sm">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3.5 space-y-1.5 shadow-card">
                <div className="flex justify-between font-semibold">
                  <span className="text-[var(--color-text-primary)]">1. Fuel Siphoning / Theft Threat</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-danger)]">Medium Probability</span>
                </div>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  Telemetry detected sharp drops in the fuel level sensor while the vehicle was parked. Odometer readings did not change during these intervals.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3.5 space-y-1.5 shadow-card">
                <div className="flex justify-between font-semibold">
                  <span className="text-[var(--color-text-primary)]">2. Fuel Injector Leak / Engine Misfires</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-warning)]">High Probability</span>
                </div>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  Historical diagnostic codes indicate misfire alarms. Low efficiency correlates with high exhaust gas temperature readings.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3.5 space-y-1.5 shadow-card">
                <div className="flex justify-between font-semibold">
                  <span className="text-[var(--color-text-primary)]">3. Driver Behavior Deviation</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Low Probability</span>
                </div>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  High engine idle times (over 45 minutes per trip) recorded. Advise driver briefing on eco-driving practices.
                </p>
              </div>
            </div>
          </div>

          {/* Action Checklist */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Recommended Action Steps</h4>
            <ul className="space-y-2 pl-1 text-sm text-[var(--color-text-secondary)]">
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-[var(--color-brand-primary)] shrink-0" />
                Inspect fuel caps and lines for physical tamper markings or leaks.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-[var(--color-brand-primary)] shrink-0" />
                Connect OBD-II scanner and run dynamic compression checks on fuel pump cylinders.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-[var(--color-brand-primary)] shrink-0" />
                Audit matching driver logs against automated fuel-up receipts.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={actionFooterClasses}>
          <button
            onClick={() => handleActionClick('dismiss')}
            className={btnBase}
            style={{ border: '1px solid rgba(148,163,184,0.08)', color: '#94a3b8', background: 'transparent' }}
          >
            Dismiss Alert
          </button>
          <button
            onClick={() => handleActionClick('audit')}
            className={btnBase}
            style={{ border: '1px solid rgba(148,163,184,0.08)', color: '#94a3b8', background: 'transparent' }}
          >
            Audit Telemetry
          </button>
          <button
            onClick={() => handleActionClick('maintenance')}
            className={`${btnBase} flex items-center gap-1.5`}
            style={{ backgroundColor: 'rgba(14,165,233,0.08)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.12)' }}
          >
            <Wrench size={14} />
            Schedule Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
