import { X } from "lucide-react";
import { useBodyScrollLock } from "../../../lib/hooks/useBodyScrollLock";

type MaintenanceStatus = "Completed" | "Flagged";
type MaintenanceClass = "Maintenance" | "Repair";

interface MaintenanceLog {
  logNumber: string;
  plateNo: string;
  workOrder: string;
  class: MaintenanceClass;
  date: string;
  garage: string;
  accountType: string;
  odometerReading: number;
  status: MaintenanceStatus;
  mechanic: string;
  cost: number;
  costBreakdown: Array<{
    item: string;
    partsUsed: string;
    quantity: string;
    cost: number;
  }>;
}

interface ViewModalProps {
  isOpen: boolean;
  log: MaintenanceLog | null;
  onClose: () => void;
}

const labelClasses =
  "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";
const valueClasses = "text-sm font-bold text-[var(--color-text-primary)]";

const LogStatusBadge = ({ status }: { status: MaintenanceStatus }) => (
  <span
    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${
      status === "Completed"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
        : "border-red-500/30 bg-red-500/10 text-red-600"
    }`}
  >
    {status}
  </span>
);

const LogClassBadge = ({ value }: { value: MaintenanceClass }) => (
  <span
    className={`inline-flex min-w-[112px] justify-center rounded-full border-2 px-4 py-1 text-xs font-bold uppercase ${
      value === "Repair"
        ? "border-[#b50000] bg-[#ff8f94] text-[#8f1212]"
        : "border-[#313a9f] bg-[#a9b5ff] text-[#111957]"
    }`}
  >
    {value}
  </span>
);

export default function ViewModal({ isOpen, log, onClose }: ViewModalProps) {
  useBodyScrollLock(isOpen && Boolean(log));

  if (!isOpen || !log) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-[var(--color-divider)] pb-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              Maintenance Log Details
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {log.logNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-input-bg)] hover:text-[var(--color-text-primary)]"
            aria-label="Close maintenance log details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <div>
            <span className={labelClasses}>Plate No.</span>
            <span className={valueClasses}>{log.plateNo}</span>
          </div>
          <div>
            <span className={labelClasses}>Status</span>
            <LogStatusBadge status={log.status} />
          </div>
          <div>
            <span className={labelClasses}>Work Order</span>
            <span className={valueClasses}>{log.workOrder}</span>
          </div>
          <div>
            <span className={labelClasses}>Class</span>
            <LogClassBadge value={log.class} />
          </div>
          <div>
            <span className={labelClasses}>Date</span>
            <span className={valueClasses}>{log.date}</span>
          </div>
          <div>
            <span className={labelClasses}>Odometer Reading</span>
            <span className={valueClasses}>
              {log.odometerReading.toLocaleString()} km
            </span>
          </div>
          <div>
            <span className={labelClasses}>Mechanic / Shop</span>
            <span className={valueClasses}>{log.mechanic}</span>
          </div>
          <div>
            <span className={labelClasses}>Garage</span>
            <span className={valueClasses}>{log.garage}</span>
          </div>
          <div>
            <span className={labelClasses}>Account Type</span>
            <span className={valueClasses}>{log.accountType}</span>
          </div>
          <div>
            <span className={labelClasses}>Cost</span>
            <span className="text-sm font-bold text-emerald-700">
              ₱{log.cost.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-7 border-t border-[var(--color-divider)] pt-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                Material Cost Breakdown
              </h4>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Parts recorded against changed execution items.
              </p>
            </div>
            <span className="text-sm font-bold text-emerald-700">
              ₱{log.cost.toLocaleString()}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#070b45] text-xs uppercase text-white">
                <tr>
                  <th className="px-4 py-3">Execution Item</th>
                  <th className="px-4 py-3">Parts Used</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {log.costBreakdown.map((line, index) => (
                  <tr key={`${line.item}-${index}`}>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                      {line.item}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {line.partsUsed}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                      {line.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--color-text-primary)]">
                      ₱{line.cost.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {log.costBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                      No material costs recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-7 flex justify-end border-t border-[var(--color-divider)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
