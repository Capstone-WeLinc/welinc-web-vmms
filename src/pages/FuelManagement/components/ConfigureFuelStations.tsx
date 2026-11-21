import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import {
  getFuelStationManagement,
  type FuelStationManagement,
  type FuelStationUpdate,
} from '../../../lib/api/fuelService';

interface Props {
  onClose: () => void;
  onAddStation: (name: string) => Promise<FuelStationManagement>;
  onUpdateStation: (
    id: string,
    update: FuelStationUpdate,
  ) => Promise<FuelStationManagement>;
}

export default function ConfigureFuelStations({
  onClose,
  onAddStation,
  onUpdateStation,
}: Props) {
  const [name, setName] = useState('');
  const [managedStations, setManagedStations] = useState<FuelStationManagement[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [deactivationCandidate, setDeactivationCandidate] =
    useState<FuelStationManagement | null>(null);

  useEffect(() => {
    let active = true;
    void getFuelStationManagement()
      .then((stations) => {
        if (active) setManagedStations(stations);
      })
      .catch((loadError) => {
        if (active)
          setListError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load registered stations. Close and reopen this dialog to try again.',
          );
      })
      .finally(() => {
        if (active) setLoadingStations(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const closeWhenIdle = () => {
    if (!saving) onClose();
  };

  const sortStations = (stations: FuelStationManagement[]) =>
    [...stations].sort((first, second) =>
      first.name.localeCompare(second.name),
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const stationName = name.trim();
    if (!stationName || stationName.length > 100) {
      setError('Enter a station name between 1 and 100 characters.');
      return;
    }

    setError('');
    setNotice('');
    setSaving(true);
    try {
      const station = await onAddStation(stationName);
      setManagedStations((current) =>
        sortStations([
          ...current.filter((item) => item.id !== station.id),
          station,
        ]),
      );
      setName('');
      setNotice(`${station.name} is now available for fuel entries and imports.`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to add the fuel station. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (station: FuelStationManagement) => {
    setError('');
    setNotice('');
    setDeactivationCandidate(null);
    setEditingStationId(station.id);
    setEditedName(station.name);
  };

  const cancelEdit = () => {
    setEditingStationId(null);
    setEditedName('');
    setError('');
  };

  const saveEdit = async (
    event: FormEvent<HTMLFormElement>,
    station: FuelStationManagement,
  ) => {
    event.preventDefault();
    const stationName = editedName.trim();
    if (!stationName || stationName.length > 100) {
      setError('Enter a station name between 1 and 100 characters.');
      return;
    }

    setError('');
    setNotice('');
    setSaving(true);
    try {
      const updated = await onUpdateStation(station.id, { name: stationName });
      setManagedStations((current) =>
        sortStations(
          current.map((item) => (item.id === updated.id ? updated : item)),
        ),
      );
      setEditingStationId(null);
      setEditedName('');
      setNotice(
        `${updated.name} was renamed. Existing fuel records keep their saved station name.`,
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to rename the fuel station. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    station: FuelStationManagement,
    isActive: boolean,
  ) => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const updated = await onUpdateStation(station.id, { isActive });
      setManagedStations((current) =>
        sortStations(
          current.map((item) => (item.id === updated.id ? updated : item)),
        ),
      );
      setDeactivationCandidate(null);
      setNotice(
        isActive
          ? `${updated.name} is active and available for new fuel entries and imports.`
          : `${updated.name} was deactivated. Existing fuel records are unchanged.`,
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Unable to update the station status. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      title="Configure fuel stations"
      message="Manage stations available to new fuel entries and statement imports. Deactivation keeps existing fuel records intact."
      onClose={closeWhenIdle}
      size="md"
      className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={closeWhenIdle}
            className="min-h-11 w-full sm:w-auto"
          >
            Close
          </Button>
          <Button
            type="submit"
            form="fuel-station-form"
            disabled={saving || !name.trim()}
            icon={
              saving ? (
                <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus size={16} aria-hidden="true" />
              )
            }
            className="min-h-11 w-full sm:w-auto"
          >
            {saving ? 'Adding station…' : 'Add station'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <form
          id="fuel-station-form"
          onSubmit={(event) => void submit(event)}
          className="space-y-3"
        >
          <label
            htmlFor="fuel-station-name"
            className="block text-sm font-medium text-[var(--color-text-primary)]"
          >
            Station name
            <input
              id="fuel-station-name"
              required
              maxLength={100}
              autoComplete="off"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
                setNotice('');
              }}
              placeholder="e.g. Petron Makati"
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
            />
          </label>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Use 1–100 characters. Renames apply to new entries; past fuel records keep their saved station name.
          </p>
        </form>

        {listError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-danger)]/25 bg-[var(--color-brand-danger)]/5 px-3 py-2.5 text-sm text-[var(--color-text-primary)]"
          >
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0 text-[var(--color-brand-danger)]"
              aria-hidden="true"
            />
            <span>{listError}</span>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-danger)]/25 bg-[var(--color-brand-danger)]/5 px-3 py-2.5 text-sm text-[var(--color-text-primary)]"
          >
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0 text-[var(--color-brand-danger)]"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-success)]/25 bg-[var(--color-brand-success)]/5 px-3 py-2.5 text-sm text-[var(--color-text-primary)]"
          >
            <CheckCircle2
              size={17}
              className="mt-0.5 shrink-0 text-[var(--color-brand-success)]"
              aria-hidden="true"
            />
            <span>{notice}</span>
          </div>
        )}

        <section aria-labelledby="fuel-station-list-title" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3
              id="fuel-station-list-title"
              className="text-sm font-semibold text-[var(--color-text-primary)]"
            >
              Registered stations
            </h3>
            <span className="rounded-full bg-[var(--color-page-bg)] px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
              {managedStations.length}
            </span>
          </div>
          {loadingStations ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-5 text-sm text-[var(--color-text-secondary)]"
            >
              <LoaderCircle
                size={16}
                className="animate-spin text-[var(--color-brand-primary)]"
                aria-hidden="true"
              />
              Loading registered stations…
            </p>
          ) : managedStations.length ? (
            <ul className="max-h-72 divide-y divide-[var(--color-divider)] overflow-y-auto rounded-xl border border-[var(--color-border)]">
              {managedStations.map((station) => (
                <li
                  key={station.id}
                  className="px-3 py-3"
                >
                  {editingStationId === station.id ? (
                    <form
                      onSubmit={(event) => void saveEdit(event, station)}
                      className="space-y-2"
                    >
                      <label
                        htmlFor={`fuel-station-edit-${station.id}`}
                        className="sr-only"
                      >
                        Edit station name for {station.name}
                      </label>
                      <input
                        id={`fuel-station-edit-${station.id}`}
                        required
                        maxLength={100}
                        autoFocus
                        value={editedName}
                        onChange={(event) => {
                          setEditedName(event.target.value);
                          setError('');
                        }}
                        disabled={saving}
                        className="min-h-11 w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 disabled:cursor-not-allowed"
                      />
                      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={saving}
                          onClick={cancelEdit}
                          className="min-h-10"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={saving || !editedName.trim()}
                          icon={
                            saving ? (
                              <LoaderCircle
                                size={15}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : undefined
                          }
                          className="min-h-10"
                        >
                          {saving ? 'Saving…' : 'Save name'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                          <MapPin
                            size={16}
                            className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium text-[var(--color-text-primary)]">
                              {station.name}
                            </p>
                            <span
                              className={`mt-1 inline-flex min-h-6 items-center rounded-full px-2 text-xs font-medium ${
                                station.isActive
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {station.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={<Pencil size={14} aria-hidden="true" />}
                            disabled={saving}
                            onClick={() => beginEdit(station)}
                            className="min-h-10"
                          >
                            Edit
                          </Button>
                          {station.isActive ? (
                            <Button
                              type="button"
                              variant="warning"
                              size="sm"
                              icon={<Archive size={14} aria-hidden="true" />}
                              disabled={saving}
                              onClick={() => {
                                setError('');
                                setNotice('');
                                setEditingStationId(null);
                                setDeactivationCandidate(station);
                              }}
                              className="min-h-10"
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              icon={<RotateCcw size={14} aria-hidden="true" />}
                              disabled={saving}
                              onClick={() => void updateStatus(station, true)}
                              className="min-h-10"
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </div>
                      {deactivationCandidate?.id === station.id && (
                        <div
                          role="group"
                          aria-labelledby={`deactivate-station-${station.id}`}
                          aria-live="polite"
                          className="mt-3 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
                        >
                          <p id={`deactivate-station-${station.id}`}>
                            Deactivate {station.name}? It will no longer appear
                            in new fuel forms, but existing records will remain.
                          </p>
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={saving}
                              onClick={() => setDeactivationCandidate(null)}
                              className="min-h-10"
                            >
                              Keep active
                            </Button>
                            <Button
                              type="button"
                              variant="warning"
                              size="sm"
                              disabled={saving}
                              onClick={() =>
                                void updateStatus(station, false)
                              }
                              className="min-h-10"
                            >
                              {saving ? 'Deactivating…' : 'Confirm deactivation'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            listError ? null : (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-5 text-center text-sm text-[var(--color-text-secondary)]">
                No stations registered yet. Add one above to make it available for fuel entries and imports.
              </p>
            )
          )}
        </section>
      </div>
    </Modal>
  );
}
