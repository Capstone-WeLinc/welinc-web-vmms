import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useBodyScrollLock } from '../../../lib/hooks/useBodyScrollLock';
import {
  scanFuelReceipt,
  type FuelFillUpInput,
  type FuelReceiptScanResult,
  type FuelReceiptSuggestion,
  type FuelStation,
  type FuelVehicle,
} from '../../../lib/api/fuelService';

interface Props {
  onClose?: () => void;
  onAdd?: (input: FuelFillUpInput, receipt?: File) => Promise<void> | void;
  vehicles: FuelVehicle[];
  stations: FuelStation[];
}

const MAX_FUEL_RECEIPT_BYTES = 10 * 1024 * 1024;

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function reviewHint(field: FuelReceiptSuggestion<unknown> | undefined) {
  if (!field) return null;
  if (field.value === null) return 'Not detected. Enter this field manually.';
  const confidence =
    field.confidence === null
      ? 'confidence unavailable'
      : `${Math.round(field.confidence * 100)}% confidence`;
  return `${field.needsReview ? 'Review carefully' : 'Verify suggestion'} · ${confidence}.`;
}

export default function LogFuelFillUp({ onClose, onAdd, vehicles, stations }: Props) {
  useBodyScrollLock(true);
  const today = localDateValue(new Date());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanControllerRef = useRef<AbortController | null>(null);
  const receiptPreviewUrlRef = useRef<string | null>(null);
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
  const [scanning, setScanning] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [scanResult, setScanResult] = useState<FuelReceiptScanResult | null>(null);
  const [scanStatus, setScanStatus] = useState('');
  const [stationSearch, setStationSearch] = useState('');
  const [showStationOptions, setShowStationOptions] = useState(false);
  const total = Number(form.liters || 0) * Number(form.pricePerLiter || 0);
  const selectedStation = stations.find((station) => station.id === form.stationId);
  const matchingStations = stations.filter((station) => station.name.toLowerCase().includes(stationSearch.trim().toLowerCase()));
  const set = (key: string, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(
    () => () => {
      scanControllerRef.current?.abort();
      if (receiptPreviewUrlRef.current)
        URL.revokeObjectURL(receiptPreviewUrlRef.current);
    },
    [],
  );

  const updateReceiptPreview = (file: File | null) => {
    if (receiptPreviewUrlRef.current)
      URL.revokeObjectURL(receiptPreviewUrlRef.current);
    const previewUrl = file ? URL.createObjectURL(file) : null;
    receiptPreviewUrlRef.current = previewUrl;
    setReceiptPreview(previewUrl ?? '');
  };

  const closeForm = () => {
    const scanController = scanControllerRef.current;
    if (scanController) {
      scanController.abort();
      scanControllerRef.current = null;
      setScanning(false);
    }
    onClose?.();
  };

  const scanSelectedReceipt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const expectedType =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.png'
          ? 'image/png'
          : null;
    if (!expectedType || file.type.toLowerCase() !== expectedType) {
      setReceiptFile(null);
      updateReceiptPreview(null);
      setScanResult(null);
      setScanStatus('');
      setError('Choose a JPG, JPEG, or PNG receipt image.');
      input.value = '';
      return;
    }
    if (file.size > MAX_FUEL_RECEIPT_BYTES) {
      setReceiptFile(null);
      updateReceiptPreview(null);
      setScanResult(null);
      setScanStatus('');
      setError('Fuel receipt images must be 10 MB or smaller.');
      input.value = '';
      return;
    }

    setError('');
    setReceiptFile(file);
    updateReceiptPreview(file);
    setScanResult(null);
    setScanStatus('');
    setScanning(true);
    const scanController = new AbortController();
    scanControllerRef.current = scanController;
    try {
      const result = await scanFuelReceipt(file, scanController.signal);
      setScanResult(result);
      setForm((current) => ({
        ...current,
        date: result.date.value ?? current.date,
        liters:
          result.liters.value === null
            ? current.liters
            : String(result.liters.value),
        pricePerLiter:
          result.pricePerLiter.value === null
            ? current.pricePerLiter
            : String(result.pricePerLiter.value),
        stationId: result.merchantName.value ? '' : current.stationId,
      }));
      if (result.merchantName.value)
        setStationSearch(result.merchantName.value);
      setScanStatus(
        'Review every suggested value. Select a registered station, and confirm the vehicle, odometer, filled-by name, and full-tank status before saving.',
      );
    } catch (scanError) {
      if (scanController.signal.aborted) return;
      setReceiptFile(null);
      updateReceiptPreview(null);
      setScanResult(null);
      setScanStatus('');
      const message =
        scanError instanceof Error
          ? scanError.message
          : 'Receipt scanning failed.';
      setError(`${message} You can continue with manual entry.`);
    } finally {
      if (scanControllerRef.current === scanController) {
        scanControllerRef.current = null;
        if (!scanController.signal.aborted) setScanning(false);
      }
      input.value = '';
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    updateReceiptPreview(null);
    setScanResult(null);
    setScanStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      }, receiptFile ?? undefined);
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
          <button type="button" aria-label="Close fuel entry form" onClick={closeForm} className="rounded-lg p-2 hover:bg-[var(--color-card-bg-hover)]"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <label className="block text-sm font-medium">
              Scan receipt (optional)
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => void scanSelectedReceipt(event)}
                disabled={scanning || saving}
                className="mt-2 block w-full text-sm"
              />
            </label>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              JPG, JPEG, or PNG up to 10 MB. Receipt data is only a suggestion;
              review and edit it before saving.
            </p>
            {scanning && <p role="status" className="mt-2 text-sm">Reading receipt...</p>}
            {scanStatus && <p role="status" className="mt-2 text-sm">{scanStatus}</p>}
            {receiptPreview && (
              <div className="mt-3 flex flex-wrap items-start gap-3">
                <img
                  src={receiptPreview}
                  alt="Selected fuel receipt preview"
                  className="max-h-48 max-w-full rounded-lg border object-contain"
                />
                <button
                  type="button"
                  onClick={removeReceipt}
                  disabled={scanning || saving}
                  className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                >
                  Remove receipt
                </button>
              </div>
            )}
          </div>
          <fieldset disabled={scanning} className="grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2">
            <label className="text-sm">Vehicle
              <select required className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.vehicleId} onChange={(event) => set('vehicleId', event.target.value)}>
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plateNumber ?? vehicle.value} - {vehicle.model ?? ''}</option>)}
              </select>
            </label>
            <label className="text-sm">Date
              <input required type="date" max={today} className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.date} onChange={(event) => set('date', event.target.value)} />
              {scanResult && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{reviewHint(scanResult.date)}</span>}
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
                  onFocus={() => { if (selectedStation) setStationSearch(''); setShowStationOptions(true); }}
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
              {scanResult && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{reviewHint(scanResult.merchantName)} Choose a registered station from the list.</span>}
              {stations.length === 0 && <span className="mt-1 block text-xs text-red-600">No active fuel stations are available. Configure a station and try again.</span>}
            </label>
            <label className="text-sm">Filled by
              <input required maxLength={100} className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.filledBy} onChange={(event) => set('filledBy', event.target.value)} />
            </label>
            <label className="text-sm">Liters
              <input required min="0.01" step="0.01" type="number" className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.liters} onChange={(event) => set('liters', event.target.value)} />
              {scanResult && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{reviewHint(scanResult.liters)}</span>}
            </label>
            <label className="text-sm">Price per liter (₱)
              <input required min="0.01" step="0.01" type="number" className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.pricePerLiter} onChange={(event) => set('pricePerLiter', event.target.value)} />
              {scanResult && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{reviewHint(scanResult.pricePerLiter)}</span>}
            </label>
            <label className="text-sm">Odometer (km)
              <input required min="0" step="1" type="number" className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" value={form.odometer} onChange={(event) => set('odometer', event.target.value)} />
            </label>
            <label className="text-sm">Total fuel cost
              <input readOnly value={`₱${total.toFixed(2)}`} className="mt-1 w-full rounded-xl border p-2 bg-[var(--color-input-bg)]" />
              {scanResult && scanResult.printedTotal.value !== null && (
                <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                  Receipt total: ₱{scanResult.printedTotal.value.toFixed(2)} · calculated total: ₱{total.toFixed(2)}
                </span>
              )}
              {scanResult && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{reviewHint(scanResult.printedTotal)}</span>}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isFullTank} onChange={(event) => set('isFullTank', event.target.checked)} />
              This fill-up topped the tank to full
            </label>
          </fieldset>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 border-t pt-5">
            <button type="button" onClick={closeForm} className="rounded-xl border px-5 py-2">Cancel</button>
            <button type="submit" disabled={saving || scanning || vehicles.length === 0 || stations.length === 0} className="rounded-xl bg-[var(--color-brand-primary)] px-5 py-2 text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
