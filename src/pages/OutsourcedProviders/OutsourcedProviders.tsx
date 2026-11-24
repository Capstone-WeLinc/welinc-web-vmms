import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Check, Pencil, Plus, RefreshCw, Trash2, Warehouse, X } from "lucide-react";
import {
  ActionMenu,
  ConfirmationModal,
  DataTable,
  FormInput,
  Modal,
  SearchInput,
  StatusBadge,
} from "../../components/ui";
import type { DataTableColumn } from "../../components/ui";
import PageHeader from "../../components/PageHeader/PageHeader";
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
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [editingProvider, setEditingProvider] = useState<OutsourcedProviderRecord | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<OutsourcedProviderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  function openCreate() {
    setName("");
    setEditingProvider(null);
    setError("");
    setShowModal(true);
  }

  function openEdit(provider: OutsourcedProviderRecord) {
    setName(provider.name);
    setEditingProvider(provider);
    setError("");
    setShowModal(true);
  }

  async function saveProvider() {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Provider name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingProvider) {
        await updateOutsourcedProvider(editingProvider.id, { name: trimmedName });
      } else {
        await createOutsourcedProvider(trimmedName);
      }
      setShowModal(false);
      setName("");
      setEditingProvider(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save the provider.");
    } finally {
      setSaving(false);
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

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const filteredProviders = providers.filter((provider) =>
    provider.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const columns: DataTableColumn<OutsourcedProviderRecord>[] = [
    {
      key: "name",
      header: "Provider Name",
      width: "40%",
      render: (provider) => <span className="font-bold text-[#141827]">{provider.name}</span>,
    },
    {
      key: "usageCount",
      header: "Used by",
      width: "25%",
      render: (provider) =>
        provider.usageCount === 0
          ? "Not used"
          : `${provider.usageCount} ${provider.usageCount === 1 ? "schedule" : "schedules"}`,
    },
    {
      key: "isActive",
      header: "Status",
      width: "20%",
      align: "center",
      render: (provider) => <StatusBadge status={provider.isActive ? "Active" : "Inactive"} />,
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: "Actions",
      width: "15%",
      align: "center",
      render: (provider) => {
        const isBusy = busyProviderId === provider.id;
        const isUsed = provider.usageCount > 0;
        if (isBusy) {
          return <span className="text-xs text-[#64748b]">Updating…</span>;
        }

        return (
          <ActionMenu
            open={openMenuId === provider.id}
            onToggle={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              setOpenMenuId((current) => (current === provider.id ? null : provider.id));
            }}
            items={[
              ...(!isUsed
                ? [
                    {
                      label: "Edit",
                      icon: Pencil,
                      onClick: () => {
                        setOpenMenuId(null);
                        openEdit(provider);
                      },
                    },
                    {
                      label: "Delete",
                      icon: Trash2,
                      danger: true,
                      onClick: () => {
                        setOpenMenuId(null);
                        setDeleteTarget(provider);
                      },
                    },
                  ]
                : []),
              {
                label: provider.isActive ? "Deactivate" : "Activate",
                icon: provider.isActive ? X : Check,
                onClick: () => {
                  setOpenMenuId(null);
                  void toggle(provider);
                },
              },
            ]}
          />
        );
      },
    });
  }

  return (
    <div>
      <PageHeader
        icon={Warehouse}
        title="OUTSOURCED PROVIDERS"
        subtitle="Providers used by maintenance schedules can only be activated or deactivated."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#c8ced8] bg-white px-4 py-2.5 text-sm font-semibold text-[#141827] transition hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-2 rounded-xl bg-[#070b45] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#11175f]"
              >
                <Plus className="h-4 w-4" />
                Create Provider
              </button>
            )}
          </div>
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#dde4ef] bg-white">
        <div className="border-b border-[#dde4ef] p-5">
          <SearchInput
            placeholder="Search providers by name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="max-w-sm"
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#64748b]">Loading providers…</div>
        ) : (
          <DataTable<OutsourcedProviderRecord>
            columns={columns}
            data={filteredProviders}
            getRowKey={(provider) => provider.id}
            emptyMessage={providers.length ? "No providers match your search." : "No providers registered."}
          />
        )}
      </div>

      <Modal
        isOpen={showModal}
        title={editingProvider ? "Edit Provider" : "Create New Provider"}
        onClose={() => {
          if (saving) return;
          setShowModal(false);
          setError("");
        }}
        onConfirm={() => void saveProvider()}
        confirmLabel={saving ? "Saving…" : editingProvider ? "Save Provider" : "Create Provider"}
        size="md"
      >
        <FormInput
          id="provider-name"
          label="Provider Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Northline Auto Services"
        />
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </Modal>

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
    </div>
  );
}
