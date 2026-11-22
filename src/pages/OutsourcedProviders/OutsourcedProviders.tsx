import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { ConfirmationModal } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import { canManageSchedules } from "../../lib/utils/permissions";
import {
  createOutsourcedProvider,
  deleteOutsourcedProvider,
  getOutsourcedProviders,
  updateOutsourcedProvider,
  type OutsourcedProviderRecord,
} from "../../lib/api/vmmsApi";

export default function OutsourcedProviders() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const canManage = canManageSchedules(currentUser);
  const [providers, setProviders] = useState<OutsourcedProviderRecord[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<OutsourcedProviderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await getOutsourcedProviders());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load providers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getOutsourcedProviders()
      .then((records) => {
        if (active) setProviders(records);
      })
      .catch((e: unknown) => {
        if (active) {
          setError(
            e instanceof Error ? e.message : "Unable to load providers.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function addProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    setError("");
    try {
      await createOutsourcedProvider(trimmedName);
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save provider.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(provider: OutsourcedProviderRecord) {
    setEditingId(provider.id);
    setEditingName(provider.name);
    setError("");
  }

  async function saveName(provider: OutsourcedProviderRecord) {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      setError("Provider name is required.");
      return;
    }

    setBusyProviderId(provider.id);
    setError("");
    try {
      await updateOutsourcedProvider(provider.id, { name: trimmedName });
      setEditingId(null);
      setEditingName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update provider.");
    } finally {
      setBusyProviderId(null);
    }
  }

  async function toggle(provider: OutsourcedProviderRecord) {
    setBusyProviderId(provider.id);
    setError("");
    try {
      await updateOutsourcedProvider(provider.id, {
        isActive: !provider.isActive,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update provider.");
    } finally {
      setBusyProviderId(null);
    }
  }

  async function removeProvider() {
    if (!deleteTarget) return;
    setBusyProviderId(deleteTarget.id);
    setError("");
    try {
      await deleteOutsourcedProvider(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete provider.");
    } finally {
      setBusyProviderId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Outsourced Providers
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Providers used by maintenance schedules can only be activated or
            deactivated.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {canManage && (
        <form
          onSubmit={(event) => void addProvider(event)}
          className="mb-6 flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
        >
          <input
            aria-label="Provider name"
            maxLength={150}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Provider name"
            className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus size={16} />
            Add provider
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
        {loading ? (
          <p className="p-5 text-sm">Loading providers…</p>
        ) : providers.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-text-secondary)]">
            No providers registered.
          </p>
        ) : (
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-[var(--color-surface)] text-xs uppercase text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Used by</th>
                <th className="px-4 py-3">Status</th>
                {canManage && (
                  <th className="px-4 py-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => {
                const isEditing = editingId === provider.id;
                const isBusy = busyProviderId === provider.id;
                const isUsed = provider.usageCount > 0;

                return (
                  <tr
                    key={provider.id}
                    className="border-t border-[var(--color-border)]"
                  >
                    <td className="px-4 py-3 font-medium">
                      {isEditing ? (
                        <input
                          aria-label={`Edit ${provider.name}`}
                          maxLength={150}
                          value={editingName}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm"
                        />
                      ) : (
                        provider.name
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {provider.usageCount === 0
                        ? "Not used"
                        : `${provider.usageCount} ${
                            provider.usageCount === 1 ? "schedule" : "schedules"
                          }`}
                    </td>
                    <td className="px-4 py-3">
                      {provider.isActive ? "Active" : "Inactive"}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          {isUsed ? (
                            <span className="self-center text-xs text-[var(--color-text-secondary)]">
                              In use
                            </span>
                          ) : isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void saveName(provider)}
                                className="inline-flex items-center gap-1 rounded-md bg-[var(--color-brand-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                <Check size={14} />
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingName("");
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-50"
                              >
                                <X size={14} />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => startEditing(provider)}
                                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-50"
                              >
                                <Pencil size={14} />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setDeleteTarget(provider)}
                                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </>
                          )}
                          {!isEditing && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void toggle(provider)}
                              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-50"
                            >
                              {provider.isActive ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteTarget !== null}
        title="Delete outsourced provider"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This provider has no maintenance schedule history.`
            : ""
        }
        confirmLabel={
          busyProviderId === deleteTarget?.id ? "Deleting…" : "Delete"
        }
        variant="danger"
        busy={busyProviderId === deleteTarget?.id}
        onConfirm={() => void removeProvider()}
        onCancel={() => {
          if (busyProviderId === null) setDeleteTarget(null);
        }}
      />
    </main>
  );
}
