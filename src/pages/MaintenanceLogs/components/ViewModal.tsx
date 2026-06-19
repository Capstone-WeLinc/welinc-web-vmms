import { X } from "lucide-react";
import { useBodyScrollLock } from "../../../lib/hooks/useBodyScrollLock";

type MaintenanceStatus = "Completed" | "Flagged";
type MaintenanceClass = "Maintenance" | "Repair";

interface MaintenanceLog {
  id: string;
  logNumber: string;
  plateNo: string;
  workOrder: string;
  class: MaintenanceClass;
  date: string;
  garage: string;
  accountType: string;
  triggerType: string;
  intervalKm: string;
  bufferDistanceKm: string;
  startReferenceDate: string;
  odometerReading: number;
  status: MaintenanceStatus;
  mechanic: string;
  checklistCompleted: number;
  checklistTotal: number;
  executionCompleted: number;
  executionTotal: number;
  changedParts: number;
  materialCost: number;
  laborCost: number;
  cost: number;
  remarks: string;
  technicianSignature: string;
}

interface ViewModalProps {
  isOpen: boolean;
  log: MaintenanceLog | null;
  onClose: () => void;
}

const modalOverlayClasses =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm";
const modalContentClasses =
  "w-full max-w-3xl animate-in rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-2xl fade-in zoom-in-95 duration-200";
const modalHeaderClasses =
  "mb-5 flex items-center justify-between border-b border-[var(--color-divider)] pb-4";
const modalTitleClasses = "text-lg font-bold text-[var(--color-text-primary)]";
const modalSubtitleClasses = "mt-0.5 text-xs text-[var(--color-text-secondary)]";
const closeButtonClasses =
  "rounded-lg p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-input-bg)] hover:text-[var(--color-text-primary)]";
const infoGridClasses = "grid grid-cols-2 gap-x-4 gap-y-5";
const sectionClasses =
  "mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4";
const sectionTitleClasses =
  "mb-4 text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]";
const infoLabelClasses =
  "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";
const infoValueClasses = "text-sm font-bold text-[var(--color-text-primary)]";
const modalFooterClasses =
  "mt-8 flex justify-end border-t border-[var(--color-divider)] pt-4";
const modalCloseButtonClasses =
  "rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-200 hover:bg-[var(--color-card-bg-hover)] focus:outline-none active:scale-95";

const LogStatusBadge = ({ status }: { status: MaintenanceStatus }) => {
  const getStatusDetails = () => {
    switch (status) {
      case "Completed":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
      case "Flagged":
      default:
        return "border-[#ef4444] bg-[#fee2e2] text-[#ef4444]";
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${getStatusDetails()}`}>
      {status}
    </span>
  );
};

const LogClassBadge = ({ value }: { value: MaintenanceClass }) => {
  const classes =
    value === "Repair"
      ? "border-[#b50000] bg-[#ff8f94] text-[#8f1212]"
      : "border-[#313a9f] bg-[#a9b5ff] text-[#111957]";

  return (
    <span className={`inline-flex min-w-[112px] justify-center rounded-full border-2 px-4 py-1 text-xs font-bold uppercase ${classes}`}>
      {value}
    </span>
  );
};

export default function ViewModal({ isOpen, log, onClose }: ViewModalProps) {
  useBodyScrollLock(isOpen && Boolean(log));

  if (!isOpen || !log) return null;

  return (
    <div className={modalOverlayClasses}>
      <div className={modalContentClasses}>
        <div className={modalHeaderClasses}>
          <div>
            <h3 className={modalTitleClasses}>Maintenance Log Details</h3>
            <p className={modalSubtitleClasses}>{log.logNumber}</p>
          </div>
          <button onClick={onClose} className={closeButtonClasses}>
            <X size={18} />
          </button>
        </div>

        <div className={infoGridClasses}>
          <div>
            <span className={infoLabelClasses}>Plate No.</span>
            <span className={infoValueClasses}>{log.plateNo}</span>
          </div>
          <div>
            <span className={infoLabelClasses}>Status</span>
            <LogStatusBadge status={log.status} />
          </div>
          <div>
            <span className={infoLabelClasses}>Work Order</span>
            <span className={infoValueClasses}>{log.workOrder}</span>
          </div>
          <div>
            <span className={infoLabelClasses}>Class</span>
            <LogClassBadge value={log.class} />
          </div>
          <div>
            <span className={infoLabelClasses}>Date</span>
            <span className={infoValueClasses}>{log.date}</span>
          </div>
          <div>
            <span className={infoLabelClasses}>Odometer Reading (km)</span>
            <span className={infoValueClasses}>{log.odometerReading.toLocaleString()} km</span>
          </div>
          <div>
            <span className={infoLabelClasses}>Mechanic / Shop</span>
            <span className={infoValueClasses}>{log.mechanic}</span>
          </div>
          <div>
            <span className={infoLabelClasses}>Garage</span>
            <span className={infoValueClasses}>{log.garage}</span>
          </div>
          <div>
            <span className={infoLabelClasses}>Account Type</span>
            <span className={infoValueClasses}>{log.accountType}</span>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-400">Cost</span>
            <span className="text-sm font-bold text-emerald-700">
              ₱{log.cost.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={sectionClasses}>
          <h4 className={sectionTitleClasses}>Schedule Details</h4>
          <div className={infoGridClasses}>
            <div>
              <span className={infoLabelClasses}>Trigger</span>
              <span className={infoValueClasses}>{log.triggerType}</span>
            </div>
            <div>
              <span className={infoLabelClasses}>Start Reference Date</span>
              <span className={infoValueClasses}>{log.startReferenceDate}</span>
            </div>
            <div>
              <span className={infoLabelClasses}>Interval Km</span>
              <span className={infoValueClasses}>{log.intervalKm}</span>
            </div>
            <div>
              <span className={infoLabelClasses}>Buffer Distance Km</span>
              <span className={infoValueClasses}>{log.bufferDistanceKm}</span>
            </div>
          </div>
        </div>

        <div className={sectionClasses}>
          <h4 className={sectionTitleClasses}>Work Order Progress</h4>
          <div className={infoGridClasses}>
            <div>
              <span className={infoLabelClasses}>Inspection Checklist</span>
              <span className={infoValueClasses}>
                {log.checklistCompleted}/{log.checklistTotal} items
              </span>
            </div>
            <div>
              <span className={infoLabelClasses}>Execution Checklist</span>
              <span className={infoValueClasses}>
                {log.executionCompleted}/{log.executionTotal} items
              </span>
            </div>
            <div>
              <span className={infoLabelClasses}>Changed Parts</span>
              <span className={infoValueClasses}>{log.changedParts}</span>
            </div>
            <div>
              <span className={infoLabelClasses}>Technician Signature</span>
              <span className={infoValueClasses}>{log.technicianSignature}</span>
            </div>
          </div>
        </div>

        <div className={sectionClasses}>
          <h4 className={sectionTitleClasses}>Cost Breakdown</h4>
          <div className={infoGridClasses}>
            <div>
              <span className={infoLabelClasses}>Material Cost</span>
              <span className={infoValueClasses}>
                â‚±{log.materialCost.toLocaleString()}
              </span>
            </div>
            <div>
              <span className={infoLabelClasses}>Labor Cost</span>
              <span className={infoValueClasses}>
                â‚±{log.laborCost.toLocaleString()}
              </span>
            </div>
            <div className="col-span-2">
              <span className={infoLabelClasses}>Remarks</span>
              <span className={infoValueClasses}>{log.remarks}</span>
            </div>
          </div>
        </div>

        <div className={modalFooterClasses}>
          <button onClick={onClose} className={modalCloseButtonClasses}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
