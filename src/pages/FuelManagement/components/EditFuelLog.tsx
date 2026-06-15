import { useState } from 'react';
import type { FuelFillUp } from '../types';
import { mockFuelFillUps } from "../../../lib/mocks/fuelMocks";
import { X } from 'lucide-react';

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
        className={`${className ?? ''} w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]`}
        {...props}
      />
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  id: string;
  options: SelectOption[];
  className?: string;
}

function SelectField({ label, id, options, className, ...props }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`${className ?? ''} w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] appearance-none cursor-pointer`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface EditFuelLogProps {
  record: FuelFillUp;
  onClose: () => void;
  onSave: (updated: FuelFillUp) => void;
}

export default function EditFuelLog({ record, onClose, onSave }: EditFuelLogProps) {
  const [formData, setFormData] = useState({
    date: record.date,
    liters: record.liters.toString(),
    pricePerLiter: record.pricePerLiter.toString(),
    odometer: record.odometer.toString(),
    station: record.station,
    filledBy: record.filledBy
  });

  const filledByPersons = Array.from(new Set(mockFuelFillUps.map(f => f.filledBy)));
  const filledByOptions = filledByPersons.map(p => ({ value: p, label: p }));

  const totalCost = formData.liters && formData.pricePerLiter
    ? (parseFloat(formData.liters) * parseFloat(formData.pricePerLiter)).toFixed(2)
    : '0.00';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const liters = parseFloat(formData.liters) || 0;
    const pricePerLiter = parseFloat(formData.pricePerLiter) || 0;
    const totalCostNum = parseFloat(totalCost) || 0;
    const odometer = parseInt(formData.odometer) || 0;
    const distanceTraveled = odometer - record.odometer;
    const efficiency = liters > 0 && distanceTraveled > 0
      ? distanceTraveled / liters
      : 0;

    const updated: FuelFillUp = {
      ...record,
      date: formData.date,
      liters,
      pricePerLiter,
      totalCost: totalCostNum,
      odometer,
      station: formData.station,
      filledBy: formData.filledBy,
      efficiency: parseFloat(efficiency.toFixed(1))
    };

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="w-full max-w-2xl rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-2xl modal-content">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Edit Fuel Record</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] transition"
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-[var(--color-card-bg)] p-4 border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text-primary)]">{record.vehicleName}</span> • {record.vehicleModel}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <InputField
              label="Date of Fuel-Up*"
              id="editDate"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />

            <InputField
              label="Liters Consumed*"
              id="editLiters"
              type="number"
              step="0.1"
              value={formData.liters}
              onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
              required
            />

            <InputField
              label="Price per Liter (₱)*"
              id="editPricePerLiter"
              type="number"
              step="0.01"
              value={formData.pricePerLiter}
              onChange={(e) => setFormData({ ...formData, pricePerLiter: e.target.value })}
              required
            />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                Total Fuel Cost (auto-calculated)
              </label>
              <div className="flex h-10.5 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 py-2.5">
                  <span className="text-[var(--color-text-secondary)] text-sm">₱</span>
                  <input
                    type="text"
                    value={totalCost}
                    readOnly
                    className="ml-2 flex-1 bg-transparent text-[var(--color-text-primary)] focus:outline-none text-sm font-semibold"
                  />
                </div>
            </div>

            <InputField
              label="Odometer Reading (km)*"
              id="editOdometer"
              type="number"
              value={formData.odometer}
              onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
              required
            />

            <InputField
              label="Fueling Station*"
              id="editStation"
              placeholder="Enter station name"
              value={formData.station}
              onChange={(e) => setFormData({ ...formData, station: e.target.value })}
              required
            />

            <SelectField
              label="Filled By*"
              id="editFilledBy"
              value={formData.filledBy}
              options={filledByOptions}
              onChange={(e) => setFormData({ ...formData, filledBy: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] transition active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/20 px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-primary-dark)] transition active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
