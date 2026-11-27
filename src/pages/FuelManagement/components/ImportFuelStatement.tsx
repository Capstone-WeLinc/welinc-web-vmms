import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LoaderCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ConfirmationModal, SearchableSelect } from '../../../components/ui';
import { useBodyScrollLock } from '../../../lib/hooks/useBodyScrollLock';
import {
  createFuelImportDraft,
  deleteFuelImportDraft,
  getFuelImportDraft,
  listFuelImportDrafts,
  previewFuelImport,
  saveFuelImport,
  updateFuelImportDraft,
  type FuelImportDraft,
  type FuelImportRow,
  type FuelImportDraftSummary,
  type FuelStation,
  type FuelVehicle,
} from '../../../lib/api/fuelService';
import {
  summarizeFuelImportRows,
  type FuelImportReconciliation,
} from '../fuelImportReconciliation';

interface Props {
  stations: FuelStation[];
  vehicles: FuelVehicle[];
  onClose: () => void;
  onImported: () => Promise<void>;
}

type EditableField =
  | 'plateNumber'
  | 'date'
  | 'odometer'
  | 'poNumber'
  | 'siNumber'
  | 'product'
  | 'liters'
  | 'pricePerLiter'
  | 'stationId'
  | 'filledBy'
  | 'isFullTank';
type RowFilter = 'all' | 'needs-review' | 'ready' | 'saved';

const PAGE_SIZE = 20;
const MANUAL_SHEET_NAME = 'Manually added';
const MANUAL_DRAFT_NAME = 'Manual fuel entries';
const fieldClass =
  'mt-1 w-full min-w-0 rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-2.5 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 disabled:cursor-not-allowed disabled:bg-[var(--color-page-bg)]';

function normalizedPlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function vehiclePlate(vehicle: FuelVehicle): string {
  return (vehicle.plateNumber ?? vehicle.value).trim();
}

function summarizeDraft(draft: FuelImportDraft): FuelImportDraftSummary {
  return {
    id: draft.id,
    sourceName: draft.sourceName,
    rowCount: draft.rows.length,
    sheetNames: [...new Set(draft.rows.map((row) => row.sheetName))],
    updatedAt: draft.updatedAt,
  };
}

function numberValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasMissingRequiredValues(row: FuelImportRow): boolean {
  return (
    !row.plateNumber.trim() ||
    !row.vehicleId ||
    !row.stationId ||
    !row.date ||
    row.odometer === null ||
    !Number.isInteger(row.odometer) ||
    row.liters === null ||
    row.liters <= 0 ||
    row.pricePerLiter === null ||
    row.pricePerLiter <= 0 ||
    row.isFullTank === null
  );
}

function canSaveRow(row: FuelImportRow): boolean {
  return row.status !== 'SAVED' && row.errors.length === 0 && !hasMissingRequiredValues(row);
}

function rowState(row: FuelImportRow): { label: string; className: string } {
  if (row.status === 'SAVED')
    return {
      label: 'Saved',
      className: 'bg-emerald-50 text-emerald-800',
    };
  if (row.errors.length)
    return {
      label: 'Needs attention',
      className: 'bg-red-50 text-red-800',
    };
  if (hasMissingRequiredValues(row))
    return {
      label: 'Complete required fields',
      className: 'bg-amber-50 text-amber-950',
    };
  return {
    label: 'Ready to save',
    className: 'bg-indigo-50 text-indigo-900',
  };
}

export default function ImportFuelStatement({
  stations,
  vehicles,
  onClose,
  onImported,
}: Props) {
  useBodyScrollLock(true);
  const manualRowSequence = useRef(0);
  const [rows, setRows] = useState<FuelImportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [reconciliation, setReconciliation] =
    useState<FuelImportReconciliation | null>(null);
  const [saveHadFailures, setSaveHadFailures] = useState(false);
  const [skippedSheets, setSkippedSheets] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [newlyAddedRowKey, setNewlyAddedRowKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<FuelImportDraftSummary[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const draftIdRef = useRef<string | null>(null);
  const reviewSectionRef = useRef<HTMLElement | null>(null);
  const newlyAddedRowRef = useRef<HTMLElement | null>(null);
  const [draftSourceName, setDraftSourceName] = useState(MANUAL_DRAFT_NAME);
  const [draftVersion, setDraftVersion] = useState(0);
  const draftVersionRef = useRef(0);
  const savedDraftVersionRef = useRef(0);
  const draftSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const [draftSyncState, setDraftSyncState] = useState<
    'idle' | 'unsaved' | 'saving' | 'saved' | 'error'
  >('idle');
  const [draftToDelete, setDraftToDelete] =
    useState<FuelImportDraftSummary | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [rowToRemove, setRowToRemove] = useState<FuelImportRow | null>(null);

  const markDraftDirty = () => {
    draftVersionRef.current += 1;
    setDraftVersion(draftVersionRef.current);
    setDraftSyncState('unsaved');
  };

  const persistDraftSnapshot = useCallback(
    async (
      snapshot: FuelImportRow[],
      sourceName: string,
      version: number,
    ) => {
      const draftRows = snapshot.map((row) => {
        const draftRow = { ...row };
        delete draftRow.totalCost;
        return draftRow;
      });
      const write = draftSaveQueue.current
        .catch(() => undefined)
        .then(async () => {
          if (version <= savedDraftVersionRef.current && draftIdRef.current)
            return;
          if (!snapshot.length && !draftIdRef.current) {
            savedDraftVersionRef.current = version;
            setDraftSyncState('idle');
            return;
          }

          if (!snapshot.length && draftIdRef.current) {
            const draftId = draftIdRef.current;
            setDraftSyncState('saving');
            await deleteFuelImportDraft(draftId);
            draftIdRef.current = null;
            setDrafts((current) => current.filter((item) => item.id !== draftId));
            if (version === draftVersionRef.current) {
              savedDraftVersionRef.current = version;
              setDraftSyncState('idle');
            }
            return;
          }

          setDraftSyncState('saving');
          const draft = draftIdRef.current
            ? await updateFuelImportDraft(
                draftIdRef.current,
                sourceName,
                draftRows,
              )
            : await createFuelImportDraft(sourceName, draftRows);
          draftIdRef.current = draft.id;
          setDrafts((current) => [
            summarizeDraft(draft),
            ...current.filter((item) => item.id !== draft.id),
          ]);
          if (version === draftVersionRef.current) {
            savedDraftVersionRef.current = version;
            setDraftSyncState('saved');
          }
        });
      draftSaveQueue.current = write;
      await write;
    },
    [],
  );

  const flushDraft = useCallback(
    async (
      snapshot = rows,
      sourceName = draftSourceName,
      version = draftVersionRef.current,
    ) => {
      if (
        version <= savedDraftVersionRef.current &&
        (draftIdRef.current || !snapshot.length)
      )
        return true;
      try {
        await persistDraftSnapshot(snapshot, sourceName, version);
        return true;
      } catch (draftError) {
        setDraftSyncState('error');
        setError(
          draftError instanceof Error
            ? `Draft could not be saved: ${draftError.message}`
            : 'Draft could not be saved. Keep this dialog open and try again.',
        );
        return false;
      }
    },
    [draftSourceName, persistDraftSnapshot, rows],
  );

  const closeAndSaveDraft = useCallback(async () => {
    if (busy) return;
    if (await flushDraft()) onClose();
  }, [busy, flushDraft, onClose]);

  useEffect(() => {
    let active = true;
    listFuelImportDrafts()
      .then((savedDrafts) => {
        if (active) setDrafts(savedDrafts);
      })
      .catch((draftError: unknown) => {
        if (active)
          setError(
            draftError instanceof Error
              ? `Unable to load saved drafts: ${draftError.message}`
              : 'Unable to load saved fuel-import drafts.',
          );
      })
      .finally(() => {
        if (active) setDraftsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (draftVersion <= savedDraftVersionRef.current || busy) return;
    const timer = window.setTimeout(() => {
      void persistDraftSnapshot(rows, draftSourceName, draftVersion).catch(
        (draftError: unknown) => {
          if (draftVersionRef.current !== draftVersion) return;
          setDraftSyncState('error');
          setError(
            draftError instanceof Error
              ? `Draft could not be saved: ${draftError.message}`
              : 'Draft could not be saved. Keep this dialog open and try again.',
          );
        },
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [busy, draftSourceName, draftVersion, persistDraftSnapshot, rows]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) void closeAndSaveDraft();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, closeAndSaveDraft]);

  const sheets = [...new Set(rows.map((row) => row.sheetName))];
  const readyCount = rows.filter(canSaveRow).length;
  const savedCount = rows.filter((row) => row.status === 'SAVED').length;
  const needsReviewCount = rows.length - readyCount - savedCount;

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const stateMatches =
        rowFilter === 'all' ||
        (rowFilter === 'ready' && canSaveRow(row)) ||
        (rowFilter === 'saved' && row.status === 'SAVED') ||
        (rowFilter === 'needs-review' && row.status !== 'SAVED' && !canSaveRow(row));
      const searchMatches =
        !query ||
        [
          row.sheetName,
          String(row.worksheetRow),
          row.plateNumber,
          row.poNumber,
          row.siNumber,
          row.product,
        ].some((value) => value.toLowerCase().includes(query));
      return stateMatches && searchMatches;
    });
  }, [rows, rowFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visiblePage = Math.min(currentPage, pageCount);
  const pageRows = filteredRows.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const firstVisibleRow = filteredRows.length
    ? (visiblePage - 1) * PAGE_SIZE + 1
    : 0;
  const lastVisibleRow = Math.min(visiblePage * PAGE_SIZE, filteredRows.length);

  useEffect(() => {
    if (!newlyAddedRowKey) return;
    newlyAddedRowRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    });
    const timer = window.setTimeout(() => setNewlyAddedRowKey(null), 1800);
    return () => window.clearTimeout(timer);
  }, [newlyAddedRowKey, visiblePage]);

  const navigateToPage = (page: number) => {
    setNewlyAddedRowKey(null);
    setCurrentPage(page);
    reviewSectionRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const updateRow = <K extends EditableField>(
    key: string,
    field: K,
    value: FuelImportRow[K],
  ) => {
    setError('');
    setResultMessage('');
    setReconciliation(null);
    setSaveHadFailures(false);
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const errorTerm = {
          plateNumber: 'vehicle',
          date: 'date',
          odometer: 'odometer',
          poNumber: 'PO number',
          siNumber: 'SI number',
          product: 'product',
          liters: 'liters',
          pricePerLiter: 'unit price',
          stationId: 'station',
          filledBy: 'filled-by',
          isFullTank: 'full',
        }[field];
        const duplicateIdentityField = [
          'plateNumber',
          'date',
          'odometer',
          'poNumber',
          'siNumber',
          'liters',
          'pricePerLiter',
          'stationId',
        ].includes(field);
        const errors = row.errors.filter((message) => {
          const normalized = message.toLowerCase();
          const isDuplicate =
            normalized.includes('duplicat') ||
            normalized.includes('matching fuel fill-up') ||
            normalized.includes('already recorded');
          if (duplicateIdentityField && isDuplicate) return false;
          return !normalized.includes(errorTerm.toLowerCase());
        });
        return {
          ...row,
          [field]: value,
          errors,
          status: errors.length ? 'ERROR' : 'READY',
        };
      }),
    );
    markDraftDirty();
  };

  const updateVehicleByPlate = (key: string, plateNumber: string) => {
    setError('');
    setResultMessage('');
    setReconciliation(null);
    setSaveHadFailures(false);
    const normalized = normalizedPlate(plateNumber);
    const vehicle = normalized
      ? vehicles.find(
          (candidate) =>
            normalizedPlate(vehiclePlate(candidate)) === normalized,
        )
      : undefined;
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const errors = row.errors.filter((message) => {
          const normalizedError = message.toLowerCase();
          const isDuplicate =
            normalizedError.includes('duplicat') ||
            normalizedError.includes('matching fuel fill-up') ||
            normalizedError.includes('already recorded');
          return (
            !normalizedError.includes('vehicle') &&
            !isDuplicate
          );
        });
        if (!vehicle) {
          errors.push('Select an active registered vehicle by plate number.');
        }
        return {
          ...row,
          plateNumber: vehicle ? vehiclePlate(vehicle) : plateNumber,
          vehicleId: vehicle?.id ?? null,
          errors,
          status: errors.length ? 'ERROR' : 'READY',
        };
      }),
    );
    markDraftDirty();
  };

  const addManualRow = () => {
    let sequence = manualRowSequence.current;
    let key: string;
    do {
      sequence += 1;
      key = `manual-${sequence}`;
    } while (rows.some((row) => row.key === key));
    manualRowSequence.current = sequence;
    const worksheetRow =
      rows
        .filter((row) => row.sheetName === MANUAL_SHEET_NAME)
        .reduce((highest, row) => Math.max(highest, row.worksheetRow), 0) + 1;
    const row: FuelImportRow = {
      key,
      sheetName: MANUAL_SHEET_NAME,
      worksheetRow,
      plateNumber: '',
      date: '',
      odometer: null,
      poNumber: '',
      siNumber: '',
      product: '',
      liters: null,
      pricePerLiter: null,
      vehicleId: null,
      stationId: '',
      filledBy: '',
      isFullTank: null,
      errors: [],
      status: 'READY',
    };
    const targetPage = Math.ceil((rows.length + 1) / PAGE_SIZE);
    setRows((current) => [...current, row]);
    setNewlyAddedRowKey(row.key);
    markDraftDirty();
    setError('');
    setReconciliation(null);
    setResultMessage(
      `Added manual row ${worksheetRow}. Showing page ${targetPage} of ${targetPage}.`,
    );
    setSaveHadFailures(false);
    setSearch('');
    setRowFilter('all');
    setCurrentPage(targetPage);
  };

  const confirmRemoveRow = () => {
    if (!rowToRemove || rowToRemove.status === 'SAVED') return;
    setRows((current) =>
      current.filter(
        (row) => row.key !== rowToRemove.key || row.status === 'SAVED',
      ),
    );
    markDraftDirty();
    setError('');
    setResultMessage('');
    setReconciliation(null);
    setSaveHadFailures(false);
    setRowToRemove(null);
  };

  const updateSheetStation = (sheetName: string, stationId: string) => {
    setError('');
    setResultMessage('');
    setReconciliation(null);
    setSaveHadFailures(false);
    setRows((current) =>
      current.map((row) => {
        if (row.sheetName !== sheetName) return row;
        const errors = row.errors.filter(
          (message) => !message.toLowerCase().includes('station'),
        );
        return {
          ...row,
          stationId,
          errors,
          status: errors.length ? 'ERROR' : 'READY',
        };
      }),
    );
    markDraftDirty();
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setResultMessage('');
    setReconciliation(null);
    setSaveHadFailures(false);
    setSkippedSheets([]);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Choose an .xlsx fuel statement workbook.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Workbook must be 5 MB or smaller.');
      return;
    }
    if (!(await flushDraft())) return;
    setBusy(true);
    draftIdRef.current = null;
    const resetVersion = draftVersionRef.current + 1;
    draftVersionRef.current = resetVersion;
    savedDraftVersionRef.current = resetVersion;
    setDraftVersion(resetVersion);
    setDraftSyncState('idle');
    setFileName(file.name);
    setDraftSourceName(file.name);
    setRows([]);
    setSearch('');
    setRowFilter('all');
    setCurrentPage(1);
    try {
      const preview = await previewFuelImport(file);
      setRows(preview.rows);
      setSkippedSheets(preview.skippedSheets);
      if (preview.rows.length) markDraftDirty();
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'Unable to read this workbook.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openDraft = async (id: string) => {
    if (!(await flushDraft())) return;
    setBusy(true);
    setError('');
    setResultMessage('');
    setReconciliation(null);
    try {
      const draft = await getFuelImportDraft(id);
      draftIdRef.current = draft.id;
      setDraftSourceName(draft.sourceName);
      setFileName(
        draft.sourceName === MANUAL_DRAFT_NAME ? '' : draft.sourceName,
      );
      setRows(draft.rows);
      setSkippedSheets([]);
      setSearch('');
      setRowFilter('all');
      setCurrentPage(1);
      const version = draftVersionRef.current + 1;
      draftVersionRef.current = version;
      savedDraftVersionRef.current = version;
      setDraftVersion(version);
      setDraftSyncState('saved');
      setDrafts((current) => [
        summarizeDraft(draft),
        ...current.filter((item) => item.id !== draft.id),
      ]);
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? `Unable to open this draft: ${draftError.message}`
          : 'Unable to open this fuel-import draft.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteDraft = async () => {
    if (!draftToDelete) return;
    setDeletingDraft(true);
    setError('');
    try {
      const deletingActiveDraft = draftIdRef.current === draftToDelete.id;
      if (deletingActiveDraft) {
        await flushDraft().catch(() => undefined);
      }
      await deleteFuelImportDraft(draftToDelete.id);
      setDrafts((current) =>
        current.filter((draft) => draft.id !== draftToDelete.id),
      );
      if (deletingActiveDraft) {
        draftVersionRef.current += 1;
        draftIdRef.current = null;
        savedDraftVersionRef.current = draftVersionRef.current;
        setDraftVersion(draftVersionRef.current);
        setRows([]);
        setDraftSourceName(MANUAL_DRAFT_NAME);
        setFileName('');
        setSkippedSheets([]);
        setSearch('');
        setRowFilter('all');
        setCurrentPage(1);
        setDraftSyncState('idle');
        setResultMessage('');
        setReconciliation(null);
      }
      setDraftToDelete(null);
    } catch (draftError) {
      setError(
        draftError instanceof Error
          ? `Unable to delete this draft: ${draftError.message}`
          : 'Unable to delete this fuel-import draft.',
      );
    } finally {
      setDeletingDraft(false);
    }
  };

  const save = async () => {
    const readyRows = rows.filter(canSaveRow);
    if (!readyRows.length) return;
    if (!(await flushDraft())) return;
    setError('');
    setResultMessage('');
    setReconciliation(null);
    setSaveHadFailures(false);
    setBusy(true);
    try {
      const result = await saveFuelImport(readyRows);
      const reconciliationResult = summarizeFuelImportRows(result.rows, stations);
      setReconciliation(reconciliationResult);
      const returnedRows = new Map(result.rows.map((row) => [row.key, row]));
      const updatedRows = rows.map((row) => returnedRows.get(row.key) ?? row);
      setRows(updatedRows);
      const version = draftVersionRef.current + 1;
      draftVersionRef.current = version;
      setDraftVersion(version);
      setDraftSyncState('unsaved');
      setSaveHadFailures(
        reconciliationResult.failed > 0 || reconciliationResult.saved === 0,
      );
      const messages = [];
      if (reconciliationResult.saved > 0)
        messages.push(`Saved ${reconciliationResult.saved} fill-up${reconciliationResult.saved === 1 ? '' : 's'}.`);
      else messages.push('No fill-ups were saved.');
      if (reconciliationResult.failed > 0)
        messages.push(
          `${reconciliationResult.failed} submitted row${reconciliationResult.failed === 1 ? '' : 's'} need attention.`,
        );
      setResultMessage(messages.join(' '));
      try {
        await persistDraftSnapshot(updatedRows, draftSourceName, version);
        const complete =
          updatedRows.length > 0 &&
          updatedRows.every((row) => row.status === 'SAVED');
        if (complete && draftIdRef.current) {
          const completedDraftId = draftIdRef.current;
          await deleteFuelImportDraft(completedDraftId);
          draftIdRef.current = null;
          setDrafts((current) =>
            current.filter((draft) => draft.id !== completedDraftId),
          );
          setDraftSyncState('idle');
        }
      } catch (draftError) {
        setDraftSyncState('error');
        setError(
          draftError instanceof Error
            ? `Fuel rows were saved, but their draft could not be updated: ${draftError.message}`
            : 'Fuel rows were saved, but their draft could not be updated.',
        );
      }
      if (reconciliationResult.saved > 0) {
        try {
          await onImported();
        } catch {
          setError('Entries were saved, but the fuel log could not be refreshed. Close and reopen Fuel Management to reload them.');
        }
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save the reviewed rows.',
      );
    } finally {
      setBusy(false);
    }
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const updateFilter = (value: RowFilter) => {
    setRowFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-2 sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="fuel-import-title"
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
              <FileSpreadsheet size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="fuel-import-title" className="text-lg font-bold text-[var(--color-text-primary)]">
                Import fuel statement
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
                Upload, map each worksheet to a station, then review the rows before saving. The workbook is not retained.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close fuel statement import"
            onClick={() => void closeAndSaveDraft()}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-page-bg)] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Choose an Excel workbook
                </h3>
                <p id="fuel-import-file-help" className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Use an .xlsx file up to 5 MB. Review suggested values and complete required fields; filled-by is optional.
                </p>
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  aria-describedby="fuel-import-file-help"
                  disabled={busy}
                  onChange={(event) => {
                    void chooseFile(event.currentTarget.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  className="mt-3 block min-h-11 w-full text-sm text-[var(--color-text-secondary)] file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[var(--color-brand-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[var(--color-brand-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed"
                />
                {fileName && (
                  <p className="mt-2 truncate text-xs text-[var(--color-text-secondary)]" title={fileName}>
                    {fileName} · {rows.length} candidate rows
                  </p>
                )}
              </div>
            </div>
          </section>

          {rows.length === 0 && (
            <section className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Continue a saved draft
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Drafts are private to your Operations account and grouped by file and worksheet.
                </p>
              </div>
              {draftsLoading ? (
                <p role="status" className="text-sm text-[var(--color-text-secondary)]">
                  Loading saved drafts…
                </p>
              ) : drafts.length ? (
                <ul className="divide-y divide-[var(--color-divider)]">
                  {drafts.map((draft) => (
                    <li
                      key={draft.id}
                      className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]" title={draft.sourceName}>
                          {draft.sourceName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {draft.rowCount} row{draft.rowCount === 1 ? '' : 's'}
                          {draft.sheetNames.length
                            ? ` · ${draft.sheetNames.join(', ')}`
                            : ' · No rows yet'}
                          {' · Updated '}
                          {new Date(draft.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy || deletingDraft}
                          onClick={() => void openDraft(draft.id)}
                        >
                          Resume
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          icon={<Trash2 size={15} aria-hidden="true" />}
                          disabled={busy || deletingDraft}
                          onClick={() => setDraftToDelete(draft)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p role="status" className="text-sm text-[var(--color-text-secondary)]">
                  No saved drafts. Upload a workbook or add a manual row to begin.
                </p>
              )}
            </section>
          )}

          {rows.length > 0 && (
            <p role="status" aria-live="polite" className="text-xs text-[var(--color-text-secondary)]">
              {draftSyncState === 'saving'
                ? 'Saving draft changes…'
                : draftSyncState === 'saved'
                  ? `Draft saved · ${draftSourceName}`
                  : draftSyncState === 'error'
                    ? 'Draft save failed'
                    : 'Draft changes not saved yet'}
            </p>
          )}

          {busy && (
            <p role="status" className="flex items-center gap-2 text-sm text-[var(--color-brand-primary)]">
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              {draftsLoading && !rows.length
                ? 'Loading saved drafts…'
                : rows.length
                  ? 'Saving reviewed rows…'
                  : 'Reading workbook…'}
            </p>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-danger)]/25 bg-[var(--color-brand-danger)]/5 px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
              <AlertCircle size={17} className="mt-0.5 shrink-0 text-[var(--color-brand-danger)]" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {resultMessage && (
            <div
              role={saveHadFailures ? 'alert' : 'status'}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm text-[var(--color-text-primary)] ${
                saveHadFailures
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-[var(--color-brand-success)]/25 bg-[var(--color-brand-success)]/5'
              }`}
            >
              {saveHadFailures ? (
                <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-800" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--color-brand-success)]" aria-hidden="true" />
              )}
              <span>{resultMessage}</span>
            </div>
          )}
          {reconciliation && (
            <section
              aria-label="Import reconciliation summary"
              className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4"
            >
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                Import reconciliation
              </h3>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Submitted rows</dt>
                  <dd className="font-semibold tabular-nums">{reconciliation.submitted}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Saved rows</dt>
                  <dd className="font-semibold tabular-nums">{reconciliation.saved}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Failed rows</dt>
                  <dd className="font-semibold tabular-nums">{reconciliation.failed}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Saved liters</dt>
                  <dd className="font-semibold tabular-nums">
                    {reconciliation.liters.toLocaleString('en-PH', {
                      maximumFractionDigits: 2,
                    })} L
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">Persisted total cost</dt>
                  <dd className="font-semibold tabular-nums">
                    ₱{reconciliation.totalCost.toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
              </dl>
              {reconciliation.groups.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Saved totals by worksheet and station
                  </h4>
                  <ul aria-label="Totals by worksheet and station" className="mt-1 space-y-1 text-sm">
                    {reconciliation.groups.map((group) => (
                      <li key={`${group.sheetName}:${group.stationName}`}>
                        <span className="font-medium">{group.sheetName} · {group.stationName}</span>
                        {`: ${group.saved} saved, ${group.failed} failed · ${group.liters.toLocaleString('en-PH', {
                          maximumFractionDigits: 2,
                        })} L · ₱${group.totalCost.toLocaleString('en-PH', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {reconciliation.failedRows.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-amber-950">
                    Failed rows excluded from totals
                  </h4>
                  <ul className="mt-1 space-y-1 text-sm text-amber-950">
                    {reconciliation.failedRows.map((row) => (
                      <li key={`${row.sheetName}:${row.worksheetRow}`}>
                        {row.sheetName} · row {row.worksheetRow}: {row.errors.join(' ') || 'Unable to save this row.'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
          {skippedSheets.length > 0 && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
              <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                These populated worksheets had no supported transaction headers and were skipped: {skippedSheets.join(', ')}.
              </span>
            </div>
          )}

          {vehicles.length > 0 && (
            <datalist id="fuel-import-vehicle-options">
              {vehicles.map((vehicle) => (
                <option
                  key={vehicle.id}
                  value={vehiclePlate(vehicle)}
                  label={vehicle.model ? `${vehiclePlate(vehicle)} · ${vehicle.model}` : vehiclePlate(vehicle)}
                />
              ))}
            </datalist>
          )}

          {rows.length === 0 && !busy && (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
              <FileSpreadsheet size={28} className="mx-auto text-[var(--color-text-secondary)]" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
                {fileName ? 'No rows in this import' : 'Start an import'}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Add a manual row to continue without a workbook, or choose a workbook above.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addManualRow}
                className="mt-4 min-h-10"
              >
                Add manual row
              </Button>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                      Assign a station to each worksheet
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Every worksheet needs an active registered fuel station. You can remove unsaved rows from this import; saved fill-ups cannot be removed here.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addManualRow}
                    className="min-h-10 shrink-0"
                  >
                    Add manual row
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sheets.map((sheet) => (
                    <label key={sheet} className="min-w-0 rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium text-[var(--color-text-primary)]">
                      <span className="block truncate" title={sheet}>{sheet}</span>
                      <SearchableSelect
                        className={fieldClass}
                        value={rows.find((row) => row.sheetName === sheet)?.stationId ?? ''}
                        options={stations.map((station) => ({
                          value: station.id,
                          label: station.name,
                        }))}
                        disabled={busy || stations.length === 0}
                        onChange={(stationId) => updateSheetStation(sheet, stationId)}
                        placeholder={
                          stations.length > 0
                            ? 'Search registered stations'
                            : 'No active stations available'
                        }
                        aria-label={`Fuel station for worksheet ${sheet}`}
                      />
                      {stations.length === 0 && (
                        <span className="mt-1 block text-xs font-normal text-red-700">
                          No active fuel stations are available.
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </section>

              <section ref={reviewSectionRef} className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                      Review fill-up rows
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      Correct flagged values. Only complete, issue-free rows can be submitted.
                    </p>
                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-2 text-xs font-semibold tabular-nums text-[var(--color-brand-primary)]"
                    >
                      Page {visiblePage} of {pageCount} · Showing rows {firstVisibleRow}–{lastVisibleRow} of {filteredRows.length}
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 divide-x divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-page-bg)] text-center">
                    <div className="px-3 py-2">
                      <dt className="text-xs text-[var(--color-text-secondary)]">Ready</dt>
                      <dd className="text-sm font-semibold tabular-nums text-[var(--color-brand-primary)]">{readyCount}</dd>
                    </div>
                    <div className="px-3 py-2">
                      <dt className="text-xs text-[var(--color-text-secondary)]">Needs review</dt>
                      <dd className="text-sm font-semibold tabular-nums text-amber-950">{needsReviewCount}</dd>
                    </div>
                    <div className="px-3 py-2">
                      <dt className="text-xs text-[var(--color-text-secondary)]">Saved</dt>
                      <dd className="text-sm font-semibold tabular-nums text-emerald-800">{savedCount}</dd>
                    </div>
                  </dl>
                </div>

                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="relative block">
                    <span className="sr-only">Search imported rows</span>
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => updateSearch(event.target.value)}
                      placeholder="Search plate, product, invoice, or worksheet"
                      className={`min-h-11 w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] py-2 pl-9 ${search ? 'pr-10' : 'pr-3'} text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20`}
                    />
                    {search ? (
                      <button
                        type="button"
                        aria-label="Clear search"
                        title="Clear search"
                        onClick={() => updateSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </label>
                  <label className="text-sm">
                    <span className="sr-only">Filter imported rows</span>
                    <select
                      value={rowFilter}
                      onChange={(event) => updateFilter(event.target.value as RowFilter)}
                      className="min-h-11 w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
                    >
                      <option value="all">All rows ({rows.length})</option>
                      <option value="needs-review">Needs review ({needsReviewCount})</option>
                      <option value="ready">Ready to save ({readyCount})</option>
                      <option value="saved">Saved ({savedCount})</option>
                    </select>
                  </label>
                </div>

                {filteredRows.length === 0 ? (
                  <p role="status" className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
                    No rows match this search and filter.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pageRows.map((row) => {
                      const state = rowState(row);
                      const disabled = busy || row.status === 'SAVED';
                      const vehicleError = row.errors.find((message) =>
                        message.toLowerCase().includes('vehicle'),
                      );
                      const otherErrors = row.errors.filter(
                        (message) => !message.toLowerCase().includes('vehicle'),
                      );
                      return (
                        <article
                          key={row.key}
                          ref={
                            row.key === newlyAddedRowKey
                              ? newlyAddedRowRef
                              : null
                          }
                          className={`rounded-xl border bg-[var(--color-card-bg)] p-3 transition-colors sm:p-4 ${
                            row.key === newlyAddedRowKey
                              ? 'border-[var(--color-brand-primary)] ring-2 ring-[var(--color-brand-primary)]/25'
                              : 'border-[var(--color-border)]'
                          }`}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-divider)] pb-3">
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                              Source <span className="font-semibold text-[var(--color-text-primary)]">{row.sheetName} · row {row.worksheetRow}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {row.key === newlyAddedRowKey && (
                                <span className="inline-flex min-h-7 items-center rounded-full bg-[var(--color-brand-primary)]/10 px-2.5 text-xs font-semibold text-[var(--color-brand-primary)]">
                                  Just added
                                </span>
                              )}
                              <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${state.className}`}>
                                {state.label}
                              </span>
                              {row.status !== 'SAVED' && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  icon={<Trash2 size={15} aria-hidden="true" />}
                                  disabled={busy}
                                  onClick={() => setRowToRemove(row)}
                                  className="min-h-9"
                                >
                                  Remove row
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                            <label className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                              Active vehicle plate *
                              <input
                                aria-label={`Active vehicle plate for ${row.sheetName} row ${row.worksheetRow}`}
                                aria-invalid={row.status !== 'SAVED' && !row.vehicleId}
                                aria-describedby={`fuel-import-vehicle-help-${row.key}`}
                                className={fieldClass}
                                list="fuel-import-vehicle-options"
                                value={row.plateNumber}
                                disabled={disabled || vehicles.length === 0}
                                onChange={(event) => updateVehicleByPlate(row.key, event.target.value)}
                              />
                              <span
                                id={`fuel-import-vehicle-help-${row.key}`}
                                className={`mt-1 block text-xs ${row.vehicleId ? 'text-[var(--color-text-secondary)]' : 'text-amber-950'}`}
                              >
                                {vehicles.length === 0
                                  ? 'No active registered vehicles are available.'
                                  : row.vehicleId
                                    ? 'Matched to an active registered vehicle.'
                                    : vehicleError ?? 'Select an active registered vehicle by plate number.'}
                              </span>
                            </label>
                            <label className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                              Date *
                              <input
                                aria-label={`Date for ${row.sheetName} row ${row.worksheetRow}`}
                                className={fieldClass}
                                type="date"
                                value={row.date}
                                disabled={disabled}
                                onChange={(event) => updateRow(row.key, 'date', event.target.value)}
                              />
                            </label>
                            <label className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                              Odometer (km) *
                              <input
                                aria-label={`Odometer for ${row.sheetName} row ${row.worksheetRow}`}
                                className={fieldClass}
                                type="number"
                                min="0"
                                step="1"
                                value={row.odometer ?? ''}
                                disabled={disabled}
                                onChange={(event) => updateRow(row.key, 'odometer', numberValue(event.target.value))}
                              />
                            </label>
                            <label className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                              Liters *
                              <input
                                aria-label={`Liters for ${row.sheetName} row ${row.worksheetRow}`}
                                className={fieldClass}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={row.liters ?? ''}
                                disabled={disabled}
                                onChange={(event) => updateRow(row.key, 'liters', numberValue(event.target.value))}
                              />
                            </label>
                            <label className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                              Unit price (₱) *
                              <input
                                aria-label={`Unit price for ${row.sheetName} row ${row.worksheetRow}`}
                                className={fieldClass}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={row.pricePerLiter ?? ''}
                                disabled={disabled}
                                onChange={(event) => updateRow(row.key, 'pricePerLiter', numberValue(event.target.value))}
                              />
                            </label>
                            <label className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                              Filled by (optional)
                              <input
                                aria-label={`Filled by for ${row.sheetName} row ${row.worksheetRow}`}
                                className={fieldClass}
                                value={row.filledBy}
                                maxLength={100}
                                disabled={disabled}
                                onChange={(event) => updateRow(row.key, 'filledBy', event.target.value)}
                              />
                            </label>
                            {(['poNumber', 'siNumber', 'product'] as const).map((field) => (
                              <label key={field} className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                                {field === 'poNumber' ? 'PO number' : field === 'siNumber' ? 'SI number' : 'Product'}
                                <input
                                  aria-label={`${field === 'poNumber' ? 'PO number' : field === 'siNumber' ? 'SI number' : 'Product'} for ${row.sheetName} row ${row.worksheetRow}`}
                                  className={fieldClass}
                                  value={row[field]}
                                  maxLength={100}
                                  disabled={disabled}
                                  onChange={(event) => updateRow(row.key, field, event.target.value)}
                                />
                              </label>
                            ))}
                            <label className="min-w-0 text-xs font-medium text-[var(--color-text-secondary)]">
                              Tank status *
                              <select
                                aria-label={`Tank status for ${row.sheetName} row ${row.worksheetRow}`}
                                className={fieldClass}
                                value={row.isFullTank === null ? '' : String(row.isFullTank)}
                                disabled={disabled}
                                onChange={(event) =>
                                  updateRow(
                                    row.key,
                                    'isFullTank',
                                    event.target.value === ''
                                      ? null
                                      : event.target.value === 'true',
                                  )
                                }
                              >
                                <option value="">Confirm</option>
                                <option value="true">Full tank</option>
                                <option value="false">Partial fill</option>
                              </select>
                            </label>
                          </div>

                          {otherErrors.length > 0 && (
                            <p className="mt-3 flex items-start gap-2 text-sm text-red-800">
                              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                              <span>{otherErrors.join(' ')}</span>
                            </p>
                          )}
                          {row.status !== 'SAVED' && otherErrors.length === 0 && !vehicleError && hasMissingRequiredValues(row) && (
                            <p className="mt-3 text-sm text-amber-950">
                              Complete the required fields above before this row can be saved.
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}

                {filteredRows.length > 0 && (
                  <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[var(--color-text-secondary)]" aria-live="polite">
                      Showing {firstVisibleRow}–{lastVisibleRow} of {filteredRows.length} rows
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<ChevronLeft size={16} aria-hidden="true" />}
                        disabled={visiblePage <= 1}
                        onClick={() =>
                          navigateToPage(Math.max(1, visiblePage - 1))
                        }
                      >
                        Previous
                      </Button>
                      <span className="min-w-24 text-center text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
                        Page {visiblePage} of {pageCount}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<ChevronRight size={16} aria-hidden="true" />}
                        iconPosition="right"
                        disabled={visiblePage >= pageCount}
                        onClick={() =>
                          navigateToPage(Math.min(pageCount, visiblePage + 1))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-text-secondary)]" aria-live="polite">
              {rows.length > 0
                ? `${readyCount} ready to save · ${needsReviewCount} need review · ${savedCount} saved`
                : 'No rows ready to save'}
            </p>
            {rows.length > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                {draftSyncState === 'saving'
                  ? 'Saving draft changes…'
                  : draftSyncState === 'saved'
                    ? 'Draft changes saved'
                    : draftSyncState === 'error'
                      ? 'Draft save failed; closing will retry'
                      : 'Saving draft changes automatically'}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void closeAndSaveDraft()}
              className="min-h-11"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || readyCount === 0}
              onClick={() => void save()}
              icon={busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : undefined}
              className="min-h-11"
            >
              {busy ? 'Working…' : `Save ready rows (${readyCount})`}
            </Button>
          </div>
        </footer>
      </section>
      <ConfirmationModal
        isOpen={draftToDelete !== null}
        title="Delete saved draft"
        variant="danger"
        confirmLabel={deletingDraft ? 'Deleting…' : 'Delete draft'}
        busy={deletingDraft}
        message={
          <p>
            Delete “{draftToDelete?.sourceName}”? This removes only the saved
            draft. Fuel fill-ups already saved from it are not deleted.
          </p>
        }
        onConfirm={() => void confirmDeleteDraft()}
        onCancel={() => {
          if (!deletingDraft) setDraftToDelete(null);
        }}
      />
      <ConfirmationModal
        isOpen={rowToRemove !== null}
        title="Remove import row"
        variant="danger"
        confirmLabel="Remove row"
        message={
          <p>
            Remove {rowToRemove?.sheetName} row {rowToRemove?.worksheetRow}
            {' '}from this unsaved import? This won’t remove any fuel fill-ups
            that have already been saved.
          </p>
        }
        onConfirm={confirmRemoveRow}
        onCancel={() => setRowToRemove(null)}
      />
    </div>
  );
}
