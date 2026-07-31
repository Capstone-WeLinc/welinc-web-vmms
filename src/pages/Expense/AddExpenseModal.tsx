import { X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { getVehicles } from "../../lib/api/vehicleService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { DropdownSelect } from "../../components/ui";
import {
  defaultChecklistTemplates,
  type ChecklistTemplateName,
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
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-secondary)]">
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
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-secondary)]">
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
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={handleToggleOpen}
          className="flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-[var(--color-input-border)] bg-white px-3 text-left text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
        >
          <span className={value ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}>
            {value ? options.find((o) => o.value === value)?.label : placeholder}
          </span>
          <svg viewBox="0 0 20 20" fill="none" className="ml-2 h-4 w-4 text-[var(--color-text-secondary)]">
            <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-2 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
            <div className="p-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search..."
                className="h-10 w-full rounded-xl border border-[var(--color-input-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
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
                  className={`cursor-pointer px-4 py-3 text-sm font-semibold ${highlight === idx ? 'bg-[#f6f8fc] text-[#070b45]' : 'text-[#141827] hover:bg-[#f6f8fc]'}`}
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

const checklistTemplates: ChecklistTemplateName[] = Object.keys(
  defaultChecklistTemplates,
) as ChecklistTemplateName[];

export default function AddExpenseModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    vehicle: "",
    date: "",
    description: "",
    cost: "",
  });
  const [vehicleOptions, setVehicleOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    getVehicles()
      .then(setVehicleOptions)
      .catch(() => setVehicleOptions([]));
  }, []);

  if (!isOpen || typeof document === "undefined") return null;

  const handleInputChange = (
    field: string,
    value: string | ChangeEvent<HTMLInputElement>,
  ) => {
    const inputValue = typeof value === "string" ? value : value.target.value;
    setFormData((prev) => ({ ...prev, [field]: inputValue }));
  };

  const handleSave = () => {
    if (
      formData.vehicle &&
      formData.date &&
      formData.description &&
      formData.cost
    ) {
      console.log("Expense saved:", formData);
      setFormData({ vehicle: "", date: "", description: "", cost: "" });
      onClose();
    }
  };

  return createPortal((
    <div className="modal-overlay">
      <div className="modal-content max-w-145 flex max-h-[90vh] flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-input-bg)] shrink-0">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            Add Maintenance Expense
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          <div className="grid grid-cols-1 gap-4">
            <SearchableSelect
              id="expense-vehicle"
              label="Vehicle Plate Number *"
              options={vehicleOptions}
              placeholder="Select vehicle..."
              onChange={(v: string) => handleInputChange("vehicle", v)}
            />

            <DateField
              id="maintenance-date"
              label="Maintenance Date *"
              value={formData.date}
              onChange={(e) => handleInputChange("date", e)}
            />

            <div className="flex flex-col">
              <label className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
                Checklist Template *
              </label>
              <DropdownSelect
                value={formData.description}
                onChange={(value) => handleInputChange("description", value)}
                label="Checklist Template"
                buttonClassName="rounded-lg border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-4 text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)]"
                options={[
                  { value: "", label: "Select Checklist Template..." },
                  ...checklistTemplates.map((type) => ({
                    value: type,
                    label: type,
                  })),
                ]}
              />
            </div>

            <InputField
              id="maintenance-cost"
              label="Total Maintenance Cost (₱) *"
              placeholder="0.00"
              value={formData.cost}
              onChange={(e) => handleInputChange("cost", e)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-card-bg)] shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg-hover)] hover:text-[var(--color-text-primary)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
          >
            Save Expense Entry
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
