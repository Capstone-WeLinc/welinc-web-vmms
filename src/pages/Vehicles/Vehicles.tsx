import { useState, useEffect, useCallback, type MouseEvent } from "react";
import { Plus, Truck } from "lucide-react";
import {
  getVehicleRecords,
  createVehicleRecord,
  updateVehicleRecord,
  deleteVehicleRecord,
  type VehicleRecord,
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

type VehicleStatus = VehicleRecord["status"];

const STATUS_OPTIONS: VehicleStatus[] = [
  "AVAILABLE",
  "IN_TRANSIT",
  "UNDER_MAINTENANCE",
  "UNDER_REPAIR",
];

const emptyForm = (): Omit<VehicleRecord, "id"> => ({
  plateNumber: "",
  model: "",
  odometer: 0,
  status: "AVAILABLE",
  isActive: true,
});

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePlate, setDeletePlate] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVehicleRecords();
      setVehicles(data);
    } catch {
      showToast("Failed to load vehicles.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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

  const openEdit = (v: VehicleRecord) => {
    setForm({ plateNumber: v.plateNumber, model: v.model, odometer: v.odometer, status: v.status, isActive: v.isActive });
    setFormError("");
    setModalMode("edit");
    setSelectedId(v.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.plateNumber.trim()) { setFormError("Plate number is required."); return; }
    if (!form.model.trim()) { setFormError("Model is required."); return; }
    setSaving(true);
    try {
      if (modalMode === "create") {
        await createVehicleRecord({ ...form, plateNumber: form.plateNumber.trim(), model: form.model.trim() });
        showToast("Vehicle created successfully.");
      } else if (selectedId) {
        await updateVehicleRecord(selectedId, { ...form, plateNumber: form.plateNumber.trim(), model: form.model.trim() });
        showToast("Vehicle updated successfully.");
      }
      setShowModal(false);
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save vehicle.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (v: VehicleRecord) => {
    setDeleteId(v.id);
    setDeletePlate(v.plateNumber);
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteVehicleRecord(deleteId);
      showToast("Vehicle deleted.");
      load();
    } catch {
      showToast("Failed to delete vehicle.", "error");
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = vehicles.filter(
    (v) =>
      v.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()),
  );

  const columns: DataTableColumn<VehicleRecord>[] = [
    {
      key: "plateNumber",
      header: "Plate Number",
      width: "18%",
      render: (v) => (
        <span className="font-bold text-[#141827]">{v.plateNumber}</span>
      ),
    },
    {
      key: "model",
      header: "Model",
      width: "22%",
      render: (v) => <span className="text-[#344158]">{v.model}</span>,
    },
    {
      key: "odometer",
      header: "Odometer",
      width: "18%",
      render: (v) => <span className="text-[#344158]">{Number(v.odometer).toLocaleString()} km</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "16%",
      align: "center",
      render: (v) => <StatusBadge status={v.status.replace(/_/g, " ")} />,
    },
    {
      key: "isActive",
      header: "Fleet Active",
      width: "14%",
      align: "center",
      render: (v) => <StatusBadge status={v.isActive ? "Active" : "Inactive"} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "12%",
      align: "center",
      render: (v) => (
        <ActionMenu
          open={openMenuId === v.id}
          onToggle={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            setOpenMenuId((prev) => (prev === v.id ? null : v.id));
          }}
          items={[
            { label: "Edit", onClick: () => { setOpenMenuId(null); openEdit(v); } },
            { label: "Delete", onClick: () => confirmDelete(v), danger: true },
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
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#141827]">Fleet Vehicles</h1>
            <p className="text-sm text-[#64748b]">Manage company trucks and logistics vehicles.</p>
          </div>
        </div>
        <button
          id="create-vehicle-btn"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-[#070b45] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#11175f]"
        >
          <Plus className="h-4 w-4" />
          Create Vehicle
        </button>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-[#dde4ef] bg-white shadow-sm">
        <div className="border-b border-[#dde4ef] p-5">
          <SearchInput
            placeholder="Search by plate or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#64748b]">Loading vehicles…</div>
        ) : (
          <DataTable<VehicleRecord>
            columns={columns}
            data={filtered}
            getRowKey={(v) => v.id}
            emptyMessage="No vehicles found."
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        title={modalMode === "create" ? "Create New Vehicle" : "Edit Vehicle"}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : "Save Vehicle"}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
              {formError}
            </div>
          )}

          <FormInput
            id="vehicle-plate"
            label="Plate Number"
            value={form.plateNumber}
            onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
            placeholder="e.g. ABC-1234"
          />

          <FormInput
            id="vehicle-model"
            label="Model"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="e.g. Isuzu Elf"
          />

          <FormInput
            id="vehicle-odometer"
            label="Odometer (km)"
            type="number"
            value={String(form.odometer)}
            onChange={(e) => setForm({ ...form, odometer: Number(e.target.value) || 0 })}
          />

          <div>
            <label htmlFor="vehicle-status" className="mb-1.5 block text-xs font-semibold text-[#344158]">
              Status
            </label>
            <select
              id="vehicle-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}
              className="h-11 w-full rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-medium text-[#141827] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>

          {modalMode === "edit" && (
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                id="vehicle-isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-2 border-[#9aabc1]"
              />
              <span className="text-sm font-semibold text-[#141827]">Active in Fleet</span>
            </label>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Vehicle"
        message={`Are you sure you want to delete vehicle ${deletePlate}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
