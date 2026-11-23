import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  LoaderCircle,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react';
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
const fieldClass =
  'mt-1 w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20';

type FuelEntryForm = {
  vehicleId: string;
  stationId: string;
  date: string;
  liters: string;
  pricePerLiter: string;
  siNumber: string;
  product: string;
  odometer: string;
  filledBy: string;
  isFullTank: boolean | null;
};

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

function ReviewHint({ field }: { field: FuelReceiptSuggestion<unknown> }) {
  const needsReview = field.value === null || field.needsReview;
  const Icon = needsReview ? AlertCircle : CheckCircle2;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-normal ${needsReview ? 'text-amber-900' : 'text-[var(--color-text-secondary)]'}`}>
      <Icon size={13} aria-hidden="true" />
      {reviewHint(field)}
    </span>
  );
}

export default function LogFuelFillUp({ onClose, onAdd, vehicles, stations }: Props) {
  useBodyScrollLock(true);
  const today = localDateValue(new Date());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanControllerRef = useRef<AbortController | null>(null);
  const receiptPreviewUrlRef = useRef<string | null>(null);
  const [form, setForm] = useState<FuelEntryForm>({
    vehicleId: '',
    stationId: '',
    date: today,
    liters: '',
    pricePerLiter: '',
    siNumber: '',
    product: '',
    odometer: '',
    filledBy: '',
    isFullTank: null,
  });
  const [error, setError] = useState('');
  const [scanError, setScanError] = useState('');
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [scanResult, setScanResult] = useState<FuelReceiptScanResult | null>(null);
  const [scanStatus, setScanStatus] = useState('');
  const [stationSearch, setStationSearch] = useState('');
  const total = Number(form.liters || 0) * Number(form.pricePerLiter || 0);
  const printedTotal = scanResult?.printedTotal.value;
  const totalMismatch =
    printedTotal !== null &&
    printedTotal !== undefined &&
    Math.abs(Math.round(total * 100) / 100 - printedTotal) >= 0.02;
  const selectedStation = stations.find((station) => station.id === form.stationId);
  const set = <K extends keyof FuelEntryForm>(key: K, value: FuelEntryForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

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
      setScanError('Choose a JPG, JPEG, or PNG receipt image.');
      input.value = '';
      return;
    }
    if (file.size > MAX_FUEL_RECEIPT_BYTES) {
      setReceiptFile(null);
      updateReceiptPreview(null);
      setScanResult(null);
      setScanStatus('');
      setScanError('Fuel receipt images must be 10 MB or smaller.');
      input.value = '';
      return;
    }

    setError('');
    setScanError('');
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
        siNumber: result.siNumber.value ?? current.siNumber,
        product: result.product.value ?? current.product,
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
      setScanError(`${message} You can continue with manual entry.`);
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
    setScanError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.stationId || !stations.some((station) => station.id === form.stationId)) {
      setError('Select a registered fuel station.');
      return;
    }
    if (form.isFullTank === null) {
      setError('Confirm whether this was a full or partial tank.');
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
        isFullTank: form.isFullTank,
      }, receiptFile ?? undefined);
      onClose?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save the fuel entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-2 sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-fuel-fill-up-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
              <ScanLine size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 id="log-fuel-fill-up-title" className="text-lg font-bold text-[var(--color-text-primary)]">
                Log fuel fill-up
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Scan a receipt or enter the fill-up manually.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close fuel entry form"
            onClick={closeForm}
            disabled={saving}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <section
              aria-busy={scanning}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-page-bg)] p-4 sm:p-5"
            >
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileImage size={18} className="text-[var(--color-brand-primary)]" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Scan receipt <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
                    </h3>
                  </div>
                  <p id="fuel-receipt-help" className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
                    Upload a JPG or PNG up to 10 MB. We’ll suggest the date, fuel amounts, product, and SI number. You review everything before saving.
                  </p>
                  <input
                    ref={fileInputRef}
                    id="fuel-receipt-file"
                    type="file"
                    accept="image/jpeg,image/png"
                    aria-describedby="fuel-receipt-help"
                    onChange={(event) => void scanSelectedReceipt(event)}
                    disabled={scanning || saving}
                    className="mt-3 block min-h-11 w-full text-sm text-[var(--color-text-secondary)] file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[var(--color-brand-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--color-brand-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed"
                  />
                  {receiptFile && (
                    <p className="mt-2 truncate text-xs text-[var(--color-text-secondary)]" title={receiptFile.name}>
                      Selected: {receiptFile.name}
                    </p>
                  )}
                </div>

                {receiptPreview ? (
                  <div className="flex items-start gap-3 sm:flex-col">
                    <img
                      src={receiptPreview}
                      alt="Preview of the selected fuel receipt"
                      className="h-28 w-24 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] object-contain sm:h-36 sm:w-full"
                    />
                    <button
                      type="button"
                      onClick={removeReceipt}
                      disabled={scanning || saving}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="hidden min-h-24 items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] sm:flex">
                    <span className="flex items-center gap-2 text-xs">
                      <FileImage size={16} aria-hidden="true" />
                      Receipt preview appears here
                    </span>
                  </div>
                )}
              </div>

              {scanning && (
                <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/5 px-3 py-2.5 text-sm text-[var(--color-brand-primary)]">
                  <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                  Reading receipt… You can continue when suggestions are ready.
                </div>
              )}
              {scanStatus && !scanning && (
                <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--color-brand-success)]/25 bg-[var(--color-brand-success)]/5 px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
                  <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--color-brand-success)]" aria-hidden="true" />
                  <span>{scanStatus}</span>
                </div>
              )}
              {scanError && (
                <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--color-brand-danger)]/25 bg-[var(--color-brand-danger)]/5 px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
                  <AlertCircle size={17} className="mt-0.5 shrink-0 text-[var(--color-brand-danger)]" aria-hidden="true" />
                  <span>{scanError}</span>
                </div>
              )}
            </section>

            <fieldset disabled={scanning || saving} className="min-w-0 space-y-4 border-0 p-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Fill-up details</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Confirm the vehicle, registered station, odometer, and tank status before saving.
                </p>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <label htmlFor="fuel-vehicle" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Vehicle <span className="text-[var(--color-brand-danger)]">*</span>
                  <select
                    id="fuel-vehicle"
                    required
                    className={fieldClass}
                    value={form.vehicleId}
                    onChange={(event) => set('vehicleId', event.target.value)}
                  >
                    <option value="">Select a vehicle</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber ?? vehicle.value} · {vehicle.model ?? ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor="fuel-date" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Fill-up date <span className="text-[var(--color-brand-danger)]">*</span>
                  <input
                    id="fuel-date"
                    required
                    type="date"
                    max={today}
                    className={fieldClass}
                    value={form.date}
                    onChange={(event) => set('date', event.target.value)}
                  />
                  {scanResult && <span className="mt-1 block"><ReviewHint field={scanResult.date} /></span>}
                </label>

                <label htmlFor="fuel-station-search" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Fuel station <span className="text-[var(--color-brand-danger)]">*</span>
                  <div className="relative mt-1">
                    <input
                      id="fuel-station-search"
                      required
                      list="fuel-station-options"
                      autoComplete="off"
                      className={`${fieldClass} ${(selectedStation?.name ?? stationSearch) ? 'pr-9' : ''}`}
                      value={selectedStation?.name ?? stationSearch}
                      onChange={(event) => {
                        const stationName = event.target.value;
                        const station = stations.find((item) => item.name === stationName);
                        setStationSearch(stationName);
                        set('stationId', station?.id ?? '');
                      }}
                      placeholder="Search registered stations"
                    />
                    {(selectedStation?.name ?? stationSearch) ? (
                      <button
                        type="button"
                        aria-label="Clear station search"
                        title="Clear"
                        onClick={() => {
                          setStationSearch('');
                          set('stationId', '');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <datalist id="fuel-station-options">
                    {stations.map((station) => <option key={station.id} value={station.name} />)}
                  </datalist>
                  {scanResult && (
                    <span className="mt-1 block text-xs font-normal text-[var(--color-text-secondary)]">
                      Receipt merchant: {scanResult.merchantName.value ?? 'not detected'}. Select a registered station from the suggestions.
                    </span>
                  )}
                  {stations.length === 0 && (
                    <span className="mt-1 block text-xs font-normal text-[var(--color-brand-danger)]">
                      No active stations are available. Add a station before logging fuel.
                    </span>
                  )}
                </label>

                <label htmlFor="fuel-filled-by" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Filled by <span className="text-[var(--color-brand-danger)]">*</span>
                  <input
                    id="fuel-filled-by"
                    required
                    maxLength={100}
                    className={fieldClass}
                    value={form.filledBy}
                    onChange={(event) => set('filledBy', event.target.value)}
                  />
                </label>

                <label htmlFor="fuel-liters" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Liters <span className="text-[var(--color-brand-danger)]">*</span>
                  <input
                    id="fuel-liters"
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    className={fieldClass}
                    value={form.liters}
                    onChange={(event) => set('liters', event.target.value)}
                  />
                  {scanResult && <span className="mt-1 block"><ReviewHint field={scanResult.liters} /></span>}
                </label>

                <label htmlFor="fuel-price-per-liter" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Price per liter (₱) <span className="text-[var(--color-brand-danger)]">*</span>
                  <input
                    id="fuel-price-per-liter"
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    className={fieldClass}
                    value={form.pricePerLiter}
                    onChange={(event) => set('pricePerLiter', event.target.value)}
                  />
                  {scanResult && <span className="mt-1 block"><ReviewHint field={scanResult.pricePerLiter} /></span>}
                </label>

                <label htmlFor="fuel-product" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Product <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
                  <input
                    id="fuel-product"
                    maxLength={100}
                    className={fieldClass}
                    value={form.product}
                    onChange={(event) => set('product', event.target.value)}
                  />
                  {scanResult && <span className="mt-1 block"><ReviewHint field={scanResult.product} /></span>}
                </label>

                <label htmlFor="fuel-si-number" className="text-sm font-medium text-[var(--color-text-primary)]">
                  SI number <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
                  <input
                    id="fuel-si-number"
                    maxLength={100}
                    className={fieldClass}
                    value={form.siNumber}
                    onChange={(event) => set('siNumber', event.target.value)}
                  />
                  {scanResult && <span className="mt-1 block"><ReviewHint field={scanResult.siNumber} /></span>}
                </label>

                <label htmlFor="fuel-odometer" className="text-sm font-medium text-[var(--color-text-primary)]">
                  Odometer (km) <span className="text-[var(--color-brand-danger)]">*</span>
                  <input
                    id="fuel-odometer"
                    required
                    min="0"
                    step="1"
                    type="number"
                    className={fieldClass}
                    value={form.odometer}
                    onChange={(event) => set('odometer', event.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="rounded-xl border border-[var(--color-border)] p-3">
                  <legend className="px-1 text-sm font-medium text-[var(--color-text-primary)]">
                    Tank status <span className="text-[var(--color-brand-danger)]">*</span>
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: true, label: 'Full tank' },
                      { value: false, label: 'Partial fill' },
                    ].map((choice) => (
                      <label key={choice.label} className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)]">
                        <input
                          required
                          type="radio"
                          name="fuel-tank-status"
                          checked={form.isFullTank === choice.value}
                          onChange={() => set('isFullTank', choice.value)}
                          className="accent-[var(--color-brand-primary)]"
                        />
                        {choice.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-page-bg)] p-4" aria-live="polite">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">Calculated total</span>
                    <span className="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">₱{total.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Calculated from liters × price per liter.
                  </p>
                  {scanResult && scanResult.printedTotal.value !== null && (
                    <p className={`mt-2 text-xs ${totalMismatch ? 'font-medium text-amber-900' : 'text-[var(--color-text-secondary)]'}`}>
                      Receipt total: ₱{scanResult.printedTotal.value.toFixed(2)}
                      {totalMismatch ? ' · Check the receipt amounts' : ' · Matches the calculated total'}
                    </p>
                  )}
                  {scanResult && <div className="mt-1"><ReviewHint field={scanResult.printedTotal} /></div>}
                </div>
              </div>
            </fieldset>
          </div>

          <footer className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-3 sm:px-6">
            {error && (
              <div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-[var(--color-brand-danger)]/25 bg-[var(--color-brand-danger)]/5 px-3 py-2 text-sm text-[var(--color-text-primary)]">
                <AlertCircle size={17} className="mt-0.5 shrink-0 text-[var(--color-brand-danger)]" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="min-h-11 rounded-xl border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || scanning || vehicles.length === 0 || stations.length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-brand-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed"
              >
                {saving && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
                {saving ? 'Saving fuel entry…' : 'Save fuel entry'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
