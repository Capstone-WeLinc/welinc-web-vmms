import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { MaintenanceLogEditValues } from "../../../lib/api/maintenanceService";

type EditLog = {
  logNumber: string;
  class: "Repair" | "Preventive";
  odometerReading: number;
  laborCost: number;
  partsCost: number;
  remarks: string;
};

interface EditModalProps {
  log: EditLog | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: MaintenanceLogEditValues) => Promise<void>;
}

const inputClass = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]";

export default function EditModal({ log, isSaving, onClose, onSave }: EditModalProps) {
  const [maintenanceClass, setMaintenanceClass] = useState<"REPAIR" | "PREVENTIVE">(
    log?.class === "Repair" ? "REPAIR" : "PREVENTIVE",
  );
  const [remarks, setRemarks] = useState(log?.remarks === "N/A" ? "" : log?.remarks ?? "");
  const [odometer, setOdometer] = useState(String(log?.odometerReading ?? ""));
  const [laborCost, setLaborCost] = useState(String(log?.laborCost ?? ""));

  if (!log) return null;

  const parsedOdometer = Number(odometer);
  const parsedLabor = Number(laborCost);
  const valid = Boolean(remarks.trim()) && Number.isSafeInteger(parsedOdometer) && parsedOdometer > 0 &&
    Number.isFinite(parsedLabor) && parsedLabor >= 0;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || isSaving) return;
    await onSave({
      maintenanceClass,
      maintenanceRemarks: remarks.trim(),
      serviceOdometerReading: parsedOdometer,
      laborCost: parsedLabor,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}>
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6">
        <div className="mb-5 flex items-start justify-between border-b border-[var(--color-divider)] pb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Edit maintenance log</h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{log.logNumber} · Save will relock this record.</p>
          </div>
          <button type="button" disabled={isSaving} onClick={onClose} aria-label="Close edit dialog" className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg)] disabled:opacity-50"><X size={18} /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Maintenance type
            <select className={inputClass} value={maintenanceClass} onChange={(event) => setMaintenanceClass(event.target.value as "REPAIR" | "PREVENTIVE")}>
              <option value="PREVENTIVE">Preventive</option>
              <option value="REPAIR">Repair</option>
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Odometer at service (km)
            <input className={inputClass} type="number" min="1" step="1" required value={odometer} onChange={(event) => setOdometer(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-[var(--color-text-primary)]">Labor cost (₱)
            <input className={inputClass} type="number" min="0" step="0.01" required value={laborCost} onChange={(event) => setLaborCost(event.target.value)} />
          </label>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">Parts cost
            <div className={`${inputClass} font-normal`}>₱{log.partsCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <label className="mt-4 block text-sm font-medium text-[var(--color-text-primary)]">Description of work
          <textarea className={`${inputClass} min-h-28`} required maxLength={4000} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </label>
        <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">Computed total: ₱{(log.partsCost + (Number.isFinite(parsedLabor) ? parsedLabor : 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <div className="mt-6 flex justify-end gap-3 border-t border-[var(--color-divider)] pt-4">
          <button type="button" disabled={isSaving} onClick={onClose} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] disabled:opacity-50">Close</button>
          <button type="submit" disabled={!valid || isSaving} className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Saving…" : "Save and relock"}</button>
        </div>
      </form>
    </div>
  );
}
