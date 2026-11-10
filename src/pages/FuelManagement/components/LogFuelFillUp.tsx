import { useState } from 'react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '../../../lib/hooks/useBodyScrollLock';
import type { FuelStation, FuelVehicle } from '../../../lib/api/fuelService';

interface Props {
  onClose?: () => void;
  onAdd?: (input: unknown) => Promise<void> | void;
  vehicles: FuelVehicle[];
  stations: FuelStation[];
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function LogFuelFillUp({ onClose, onAdd, vehicles, stations }: Props) {
  useBodyScrollLock(true);
  const today = localDateValue(new Date());
  const [form, setForm] = useState({
    vehicleId: '',
    stationId: '',
    date: today,
    liters: '',
    pricePerLiter: '',
    odometer: '',
    filledBy: '',
    isFullTank: true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stationSearch, setStationSearch] = useState('');
  const [showStationOptions, setShowStationOptions] = useState(false);
  const total = Number(form.liters || 0) * Number(form.pricePerLiter || 0);
  const selectedStation = stations.find((station) => station.id === form.stationId);
  const matchingStations = stations.filter((station) => station.name.toLowerCase().includes(stationSearch.trim().toLowerCase()));
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.stationId || !stations.some((station) => station.id === form.stationId)) {
      setError('Select a registered fuel station.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onAdd?.({
        ...form,
        liters: Number(form.liters),
        pricePerLiter: Number(form.pricePerLiter),
        odometer: Number(form.odometer),
      });
      onClose?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save the fuel entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto modal-overlay p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="log-fuel-fill-up-title" className="my-auto w-full max-w-2xl rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-2xl modal-content">
        <div className="mb-6 flex items-center justify-between">
          <h2 id="log-fuel-fill-up-title" className="text-lg font-bold text-[var(--color-text-primary)]">Log Fuel Fill-up</h2>
          <button type="button" aria-label="Close fuel entry form" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--color-card-bg-hover)]"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">Vehicle
              <select required className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.vehicleId} onChange={(event) => set('vehicleId', event.target.value)}>
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber ?? vehicle.value} - {vehicle.model ?? ''}</option>)}
              </select>
            </label>
            <label className="text-sm">Date
              <input required type="date" max={today} className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.date} onChange={(event) => set('date', event.target.value)} />
            </label>
            <label className="text-sm">Fuel station
              <span className="relative mt-1 block">
                <input
                  required
                  role="combobox"
                  aria-label="Search registered fuel stations"
                  aria-autocomplete="list"
                  aria-expanded={showStationOptions}
                  aria-controls="fuel-station-options"
                  autoComplete="off"
                  className="w-full rounded-xl border p-2 bg-[var(--color-input-bg)]"
                  value={selectedStation?.name ?? stationSearch}
                  onFocus={() => { setStationSearch(''); setShowStationOptions(true); }}
                  onChange={(event) => { setStationSearch(event.target.value); set('stationId', ''); setShowStationOptions(true); }}
                  onBlur={() => window.setTimeout(() => setShowStationOptions(false), 120)}
                  placeholder="Type to search registered stations"
                />
                {showStationOptions && (
                  <ul id="fuel-station-options" role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-1 shadow-lg">
                    {matchingStations.map((station) => (
                      <li key={station.id} role="option" aria-selected={station.id === form.stationId}>
                        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { set('stationId', station.id); setStationSearch(station.name); setShowStationOptions(false); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--color-card-bg-hover)]">
                          {station.name}
                        </button>
                      </li>
                    ))}
                    {matchingStations.length === 0 && <li className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">No matching registered station.</li>}
                  </ul>
                )}
              </span>
              {stations.length === 0 && <span className="mt-1 block text-xs text-red-600">No active fuel stations are available. Configure a station and try again.</span>}
            </label>
            <label className="text-sm">Filled by
              <input required maxLength={100} className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.filledBy} onChange={(event) => set('filledBy', event.target.value)} />
            </label>
            <label className="text-sm">Liters
              <input required min="0.01" step="0.01" type="number" className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.liters} onChange={(event) => set('liters', event.target.value)} />
            </label>
            <label className="text-sm">Price per liter (₱)
              <input required min="0.01" step="0.01" type="number" className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.pricePerLiter} onChange={(event) => set('pricePerLiter', event.target.value)} />
            </label>
            <label className="text-sm">Odometer (km)
              <input required min="0" step="1" type="number" className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.odometer} onChange={(event) => set('odometer', event.target.value)} />
            </label>
            <label className="text-sm">Total fuel cost
              <input readOnly value={`₱${total.toFixed(2)}`} className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isFullTank} onChange={(event) => set('isFullTank', event.target.checked)} />
              This fill-up topped the tank to full
            </label>
          </div>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 border-t pt-5">
            <button type="button" onClick={onClose} className="rounded-xl border px-5 py-2">Cancel</button>
            <button type="submit" disabled={saving || vehicles.length === 0 || stations.length === 0} className="rounded-xl bg-[var(--color-brand-primary)] px-5 py-2 text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
