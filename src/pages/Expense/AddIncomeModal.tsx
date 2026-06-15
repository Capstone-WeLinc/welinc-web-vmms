import { useEffect, useRef, useState } from "react";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { getVehicles } from "../../lib/api/vehicleService";
import {
  defaultChecklistTemplates,
  type WorkOrderTemplate,
} from "../../data/ChecklistData";

type Option = { value: string; label: string };

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
        className={`w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] ${className || ''}`}
        {...props}
      />
    </div>
  );
}

interface DateFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  className?: string;
}

function DateField({ label, id, className, ...props }: DateFieldProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="date"
          className={`w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 pr-10 text-sm text-[var(--color-text-primary)] ${className || ''}`}
          {...props}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-[var(--color-text-secondary)]">
          <CalendarIcon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

interface SearchableSelectProps {
  id: string;
  label?: string;
  options: Option[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

function SearchableSelect({ id, label, options, placeholder = 'Select...', value, onChange }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  const handleToggleOpen = () => {
    setOpen((s) => !s);
    setHighlight(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setHighlight(0);
  };

  return (
    <div ref={ref} className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={handleToggleOpen}
          className="w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] text-left flex items-center justify-between cursor-pointer"
        >
          <span className={value ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}>
            {value ? options.find((o) => o.value === value)?.label : placeholder}
          </span>
          <svg viewBox="0 0 20 20" fill="none" className="ml-2 h-4 w-4 text-[var(--color-text-secondary)]">
            <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-lg">
            <div className="p-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md bg-[var(--color-input-bg)] border border-[var(--color-input-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto m-0 p-0 list-none">
              {filtered.length === 0 && (
                <li className="p-3 text-sm text-[var(--color-text-secondary)]">No results</li>
              )}
              {filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => {
                    onChange?.(opt.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`cursor-pointer px-4 py-3 text-sm ${highlight === idx ? 'bg-sky-700 text-white' : 'text-[var(--color-text-primary)]'}`}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const workOrderTemplates: WorkOrderTemplate[] = Object.keys(
  defaultChecklistTemplates,
) as WorkOrderTemplate[];

export default function AddIncomeModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [clientType, setClientType] = useState("Individual");
  const [workOrderTemplate, setWorkOrderTemplate] = useState("Oil Change");
  const [vehicleOptions, setVehicleOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    getVehicles()
      .then(setVehicleOptions)
      .catch(() => setVehicleOptions([]));
  }, []);

  const handleSave = () => {
    console.log("Income saved:", { clientType, workOrderTemplate });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="max-w-145 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-input-bg)] shrink-0">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Add Income Entry</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg-hover)] hover:text-[var(--color-text-primary)] transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          <div className="grid grid-cols-1 gap-4">
            <SearchableSelect
              id="income-vehicle"
              label="Vehicle Plate Number *"
              options={vehicleOptions}
              placeholder="Select vehicle..."
              onChange={(v) => console.log("selected vehicle", v)}
            />

            <InputField
              id="booking-ref"
              label="Booking / Trip Reference"
              placeholder="e.g., BK-2025-0142"
            />

            <div className="flex flex-col">
              <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Work Order Template *
              </label>
              <select
                value={workOrderTemplate}
                onChange={(e) => setWorkOrderTemplate(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-sky-500/50 focus:outline-hidden"
              >
                {workOrderTemplates.map((type) => (
                  <option
                    key={type}
                    value={type}
                    className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  >
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DateField id="trip-date" label="Trip Date" />
              <div className="flex flex-col">
                <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Client Type *
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClientType("Individual")}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${clientType === "Individual" ? "bg-[var(--color-input-bg)] text-[var(--color-text-primary)]" : "bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border)]"}`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientType("Corporate")}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${clientType === "Corporate" ? "bg-[var(--color-input-bg)] text-[var(--color-text-primary)]" : "bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border)]"}`}
                  >
                    Corporate
                  </button>
                </div>
              </div>
            </div>

            <InputField
              id="revenue-amount"
              label="Revenue Amount (₱) *"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-card-bg)] shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg-hover)] hover:text-[var(--color-text-primary)] transition"
          >
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Income Entry
          </button>
        </div>
      </div>
    </div>
  );
}
