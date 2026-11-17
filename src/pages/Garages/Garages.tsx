import { useState, useEffect, useCallback, type MouseEvent } from "react";
import { Plus, Warehouse } from "lucide-react";
import {
  getGarageRecords,
  createGarageRecord,
  updateGarageRecord,
  deleteGarageRecord,
  type GarageFullRecord,
} from "../../lib/api/vmmsApi";
import {
  DataTable,
  ConfirmationModal,
  SearchInput,
  StatusBadge,
  ActionMenu,
  ToastNotification,
} from "../../components/ui";
import type { DataTableColumn } from "../../components/ui";
import { Modal, FormInput } from "../../components/ui";

const emptyForm = (): Omit<GarageFullRecord, "id"> => ({ name: "", isActive: true });

export default function Garages() {
  const [garages, setGarages] = useState<GarageFullRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGarageRecords();
      setGarages(data);
    } catch {
      showToast("Failed to load garages.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const openCreate = () => {
    setForm(emptyForm());
    setFormError("");
    setModalMode("create");
    setSelectedId(null);
    setShowModal(true);
  };

  const openEdit = (g: GarageFullRecord) => {
    setForm({ name: g.name, isActive: g.isActive });
    setFormError("");
    setModalMode("edit");
    setSelectedId(g.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.name.trim()) { setFormError("Garage name is required."); return; }
    setSaving(true);
    try {
      if (modalMode === "create") {
        await createGarageRecord({ ...form, name: form.name.trim() });
        showToast("Garage created successfully.");
      } else if (selectedId) {
        await updateGarageRecord(selectedId, { ...form, name: form.name.trim() });
        showToast("Garage updated successfully.");
      }
      setShowModal(false);
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save garage.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (g: GarageFullRecord) => {
    setDeleteId(g.id);
    setDeleteName(g.name);
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteGarageRecord(deleteId);
      showToast("Garage deleted.");
      load();
    } catch {
      showToast("Failed to delete garage.", "error");
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = garages.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: DataTableColumn<GarageFullRecord>[] = [
    {
      key: "name",
      header: "Garage Name",
      width: "65%",
      render: (g) => <span className="font-bold text-[#141827]">{g.name}</span>,
    },
    {
      key: "isActive",
      header: "Status",
      width: "20%",
      align: "center",
      render: (g) => <StatusBadge status={g.isActive ? "Active" : "Inactive"} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "15%",
      align: "center",
      render: (g) => (
        <ActionMenu
          open={openMenuId === g.id}
          onToggle={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            setOpenMenuId((prev) => (prev === g.id ? null : g.id));
          }}
          items={[
            { label: "Edit", onClick: () => { setOpenMenuId(null); openEdit(g); } },
            { label: "Delete", onClick: () => confirmDelete(g), danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      {toast && (
        <ToastNotification message={toast.message} type={toast.type} />
      )}

      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#070b45] text-white">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#141827]">Service Garages</h1>
            <p className="text-sm text-[#64748b]">Manage maintenance garages and service shop hubs.</p>
          </div>
        </div>
        <button
          id="create-garage-btn"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-[#070b45] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#11175f]"
        >
          <Plus className="h-4 w-4" />
          Create Garage
        </button>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-[#dde4ef] bg-white shadow-sm">
        <div className="border-b border-[#dde4ef] p-5">
          <SearchInput
            placeholder="Search garages by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#64748b]">Loading garages…</div>
        ) : (
          <DataTable<GarageFullRecord>
            columns={columns}
            data={filtered}
            getRowKey={(g) => g.id}
            emptyMessage="No garages found."
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        title={modalMode === "create" ? "Create New Garage" : "Edit Garage"}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : "Save Garage"}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
              {formError}
            </div>
          )}

          <FormInput
            id="garage-name"
            label="Garage Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Sta. Rosa Terminal"
          />

          {modalMode === "edit" && (
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                id="garage-isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-2 border-[#9aabc1]"
              />
              <span className="text-sm font-semibold text-[#141827]">Active Garage</span>
            </label>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Garage"
        message={`Are you sure you want to delete garage "${deleteName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
