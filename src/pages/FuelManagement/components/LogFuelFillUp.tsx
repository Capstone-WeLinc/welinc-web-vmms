import { useState } from 'react';
import { mockFuelFillUps } from "../../../lib/mocks/fuelMocks";
import type { FuelFillUp } from '../types';
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

// Semantic layout constants and inline styles
const modalOverlayClasses = 'fixed inset-0 z-50 flex items-center justify-center modal-overlay';
const modalContentClasses = 'w-full max-w-2xl rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-2xl modal-content';
const modalHeaderClasses = 'mb-6 flex items-center justify-between';
const formGridClasses = 'grid gap-6 md:grid-cols-2';
const footerRowClasses = 'flex justify-end gap-3 border-t border-[var(--color-border)] pt-6';

interface LogFuelFillUpProps {
  onClose?: () => void;
  onAdd?: (newEntry: FuelFillUp) => void;
}

export default function LogFuelFillUp({ onClose, onAdd }: LogFuelFillUpProps) {
  const [formData, setFormData] = useState({
    vehicleId: 'TRK-0011',
    date: new Date().toISOString().split('T')[0],
    liters: '',
    pricePerLiter: '66.50',
    odometer: '',
    station: 'Petron EDSA',
    filledBy: 'Juan Dela Cruz'
  });

  const vehicles = Array.from(new Set(mockFuelFillUps.map(f => f.vehicleId)));
  const filledByPersons = Array.from(new Set(mockFuelFillUps.map(f => f.filledBy)));

  const vehiclesOptions = vehicles.map(v => ({
    value: v,
    label: `${v} — ${mockFuelFillUps.find(f => f.vehicleId === v)?.vehicleModel}`
  }));
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

    const newEntry: FuelFillUp = {
      id: Math.random().toString(36).substring(2, 9),
      vehicleId: formData.vehicleId,
      vehicleName: formData.vehicleId,
      vehicleModel: mockFuelFillUps.find(f => f.vehicleId === formData.vehicleId)?.vehicleModel || 'Unknown Model',
      date: formData.date,
      liters,
      pricePerLiter,
      totalCost: totalCostNum,
      odometer,
      station: formData.station,
      filledBy: formData.filledBy,
      efficiency: parseFloat((7.5 + Math.random() * 3.5).toFixed(1)),
      trend: Math.random() > 0.4 ? 'above' : 'below'
    };

    onAdd?.(newEntry);
    onClose?.();
  };

  return (
    <div className={modalOverlayClasses}>
      <div className={modalContentClasses}>

        {/* Header */}
        <div className={modalHeaderClasses}>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Log Fuel Fill-up</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] transition"
          >
            <X size={20} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={formGridClasses}>
            <SelectField
              label="Vehicle Plate Number*"
              id="vehicleId"
              value={formData.vehicleId}
              options={vehiclesOptions}
              onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
              required
            />

            <InputField
              label="Date of Fuel-Up*"
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />

            <InputField
              label="Liters Consumed*"
              id="liters"
              type="number"
              step="0.1"
              value={formData.liters}
              onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
              placeholder="e.g., 65"
              required
            />

            <InputField
              label="Price per Liter (₱)*"
              id="pricePerLiter"
              type="number"
              step="0.01"
              value={formData.pricePerLiter}
              onChange={(e) => setFormData({ ...formData, pricePerLiter: e.target.value })}
              required
            />

            {/* Auto-calculated total */}
            <div className="flex flex-col gap-1 w-full">
                <label className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Total Fuel Cost (auto-calculated)
                </label>
                <div className="flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 py-2.5 h-10.5">
                  <span className="text-[var(--color-text-secondary)] text-sm">₱</span>
                  <input
                    type="text"
                    value={totalCost}
                    readOnly
                    className="ml-2 flex-1 bg-transparent text-[var(--color-text-primary)] focus:outline-none text-sm font-medium"
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Calculated: {formData.liters || '0'} L × ₱{formData.pricePerLiter}</p>
            </div>

            <InputField
              label="Odometer Reading (km)*"
              id="odometer"
              type="number"
              value={formData.odometer}
              onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
              placeholder="e.g., 86100"
              required
            />

            {/* Fueling Station - typable */}
            <InputField
              label="Fueling Station*"
              id="station"
              placeholder="Enter station name"
              value={formData.station}
              onChange={(e) => setFormData({ ...formData, station: e.target.value })}
              required
            />

            <SelectField
              label="Filled By*"
              id="filledBy"
              value={formData.filledBy}
              options={filledByOptions}
              onChange={(e) => setFormData({ ...formData, filledBy: e.target.value })}
              required
            />
          </div>

          {/* Footer buttons */}
          <div className={footerRowClasses}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] transition active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/20 px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-primary-dark)] transition active:scale-95"
            >
              Save Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
