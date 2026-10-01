import { useState, useEffect, useCallback, type MouseEvent } from "react";
import { Eye, Plus, Truck } from "lucide-react";
import {
  getVehicleRecords,
  createVehicleRecord,
  updateVehicleRecord,
  deleteVehicleRecord,
  getGarageRecords,
  getVehicleAuditHistory,
  type VehicleRecord,
  type VehicleAuditEntry,
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
import { useAuthStore } from "../../store/authStore";
import { canManageVehicles, canSeeVmmsWebNavigation } from "../../lib/utils/permissions";
import { filterAndSortVehiclesByBranch } from "../../lib/utils/vehicleBranches";

type VehicleForm = {
  plateNumber: string;
  make: string;
  model: string;
  year: string;
  engineType: string;
  truckSizeCategory: string;
  odometer: string;
  garageId: string;
  isActive: boolean;
};

const emptyForm = (): VehicleForm => ({
  plateNumber: "",
  make: "",
  model: "",
  year: "",
  engineType: "",
  truckSizeCategory: "",
  odometer: "",
  garageId: "",
  isActive: true,
});

const formatMaintenanceDate = (value: string | null): string => {
  if (!value) return "No completed maintenance";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function Vehicles() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const canManage = canManageVehicles(currentUser);
  const canViewAudit = canSeeVmmsWebNavigation(currentUser);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [garages, setGarages] = useState<GarageFullRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [garageFilter, setGarageFilter] = useState("all");
  const [garageSort, setGarageSort] = useState<"asc" | "desc" | "none">("none");
  const [showModal, setShowModal] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState<VehicleRecord | null>(null);
  const [auditEntries, setAuditEntries] = useState<VehicleAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(false);
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
      const [data, garageData] = await Promise.all([
        getVehicleRecords(),
        getGarageRecords(),
      ]);
      setVehicles(data);
      setGarages(garageData.filter((garage) => garage.isActive));
    } catch {
      showToast("Failed to load vehicles.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const vehicleDetailsId = vehicleDetails?.id;
  useEffect(() => {
    if (!vehicleDetailsId || !canViewAudit) {
      setAuditEntries([]);
      setAuditError(false);
      return;
    }

    let active = true;
    setAuditLoading(true);
    setAuditError(false);
    getVehicleAuditHistory(vehicleDetailsId)
      .then((entries) => { if (active) setAuditEntries(entries); })
      .catch(() => { if (active) setAuditError(true); })
      .finally(() => { if (active) setAuditLoading(false); });

    return () => { active = false; };
  }, [vehicleDetailsId, canViewAudit]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const openCreate = () => {
    if (!canManage) return;
    setForm(emptyForm());
    setFormError("");
    setModalMode("create");
    setSelectedId(null);
    setShowModal(true);
  };

  const openEdit = (v: VehicleRecord) => {
    if (!canManage) return;
    setForm({
      plateNumber: v.plateNumber,
      make: v.make ?? "",
      model: v.model,
      year: v.year == null ? "" : String(v.year),
      engineType: v.engineType ?? "",
      truckSizeCategory: v.truckSizeCategory ?? "",
      odometer: String(v.odometer),
      garageId: v.garageId ?? "",
      isActive: v.isActive,
    });
    setFormError("");
    setModalMode("edit");
    setSelectedId(v.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!canManage) return;
    setFormError("");
    if (!form.plateNumber.trim()) { setFormError("Plate number is required."); return; }
    if (!form.make.trim()) { setFormError("Make is required."); return; }
    if (!form.model.trim()) { setFormError("Model is required."); return; }
    const year = Number(form.year);
    if (!form.year.trim() || !Number.isInteger(year) || year < 1) { setFormError("Enter a valid vehicle year."); return; }
    if (!form.engineType.trim()) { setFormError("Engine type is required."); return; }
    if (!form.truckSizeCategory.trim()) { setFormError("Truck size/category is required."); return; }
    const odometer = Number(form.odometer);
    if (!form.odometer.trim() || !Number.isInteger(odometer) || odometer < 0) { setFormError("Enter a valid odometer baseline."); return; }
    if (!form.garageId) { setFormError("Garage branch is required."); return; }
    setSaving(true);
    try {
      const vehicleInput = {
        plateNumber: form.plateNumber.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        year,
        engineType: form.engineType.trim(),
        truckSizeCategory: form.truckSizeCategory.trim(),
        odometer,
        garageId: form.garageId,
      };
      if (modalMode === "create") {
        await createVehicleRecord(vehicleInput);
        showToast("Vehicle created successfully.");
      } else if (selectedId) {
        await updateVehicleRecord(selectedId, { ...vehicleInput, isActive: form.isActive });
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
    if (!canManage) return;
    setDeleteId(v.id);
    setDeletePlate(v.plateNumber);
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    if (!canManage || !deleteId) return;
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

  const filtered = filterAndSortVehiclesByBranch(
    vehicles.filter(
      (v) =>
        v.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
        (v.make ?? "").toLowerCase().includes(search.toLowerCase()) ||
        v.model.toLowerCase().includes(search.toLowerCase()) ||
        (v.garageName ?? "").toLowerCase().includes(search.toLowerCase()),
    ),
    garageFilter,
    garageSort,
  );

  const columns: DataTableColumn<VehicleRecord>[] = [
    {
      key: "plateNumber",
      header: "Plate Number",
      width: "12%",
      render: (v) => (
        <span className="font-bold text-[#141827]">{v.plateNumber}</span>
      ),
    },
    {
      key: "make",
      header: "Make",
      width: "10%",
      render: (v) => <span className="text-[#344158]">{v.make ?? "—"}</span>,
    },
    {
      key: "model",
      header: "Model",
      width: "12%",
      render: (v) => <span className="text-[#344158]">{v.model}</span>,
    },
    {
      key: "garageName",
      header: "Garage Branch",
      width: "14%",
      render: (v) => <span className="text-[#344158]">{v.garageName ?? "Unassigned"}</span>,
    },
    {
      key: "odometer",
      header: "Odometer",
      width: "10%",
      render: (v) => <span className="text-[#344158]">{Number(v.odometer).toLocaleString()} km</span>,
    },
    {
      key: "lastMaintenanceDate",
      header: "Last Maintenance",
      width: "13%",
      render: (v) => <span className="text-[#344158]">{formatMaintenanceDate(v.lastMaintenanceDate)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "11%",
      align: "center",
      render: (v) => <StatusBadge status={v.status.replace(/_/g, " ")} />,
    },
    {
      key: "isActive",
      header: "Fleet Active",
      width: "8%",
      align: "center",
      render: (v) => <StatusBadge status={v.isActive ? "Active" : "Inactive"} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "10%",
      align: "center",
      render: (v) => (
        <ActionMenu
          open={openMenuId === v.id}
          onToggle={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            setOpenMenuId((prev) => (prev === v.id ? null : v.id));
          }}
          items={[
            { label: "View details", icon: Eye, onClick: () => { setOpenMenuId(null); setVehicleDetails(v); } },
            ...(canManage ? [
              { label: "Edit", onClick: () => { setOpenMenuId(null); openEdit(v); } },
              { label: "Delete", onClick: () => confirmDelete(v), danger: true },
            ] : []),
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
        {canManage && <button
          id="create-vehicle-btn"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-[#070b45] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#11175f]"
        >
          <Plus className="h-4 w-4" />
          Create Vehicle
        </button>}
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-[#dde4ef] bg-white shadow-sm">
        <div className="border-b border-[#dde4ef] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <SearchInput
              placeholder="Search by plate, make, model, or branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="grid gap-1 text-xs font-semibold text-[#344158]">
                Filter by branch
                <select
                  aria-label="Filter vehicles by garage branch"
                  value={garageFilter}
                  onChange={(event) => setGarageFilter(event.target.value)}
                  className="h-10 min-w-44 rounded-lg border border-[#c8ced8] bg-white px-3 text-sm"
                >
                  <option value="all">All branches</option>
                  {garages.map((garage) => <option key={garage.id} value={garage.id}>{garage.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[#344158]">
                Sort by branch
                <select
                  aria-label="Sort vehicles by garage branch"
                  value={garageSort}
                  onChange={(event) => setGarageSort(event.target.value as "asc" | "desc" | "none")}
                  className="h-10 min-w-40 rounded-lg border border-[#c8ced8] bg-white px-3 text-sm"
                >
                  <option value="none">Default order</option>
                  <option value="asc">Branch A to Z</option>
                  <option value="desc">Branch Z to A</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[#64748b]">Loading vehicles…</div>
        ) : (
          <div className="overflow-x-auto">
          <DataTable<VehicleRecord>
            columns={columns}
            data={filtered}
            getRowKey={(v) => v.id}
            emptyMessage="No vehicles found."
          />
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={canManage && showModal}
        title={modalMode === "create" ? "Create New Vehicle" : "Edit Vehicle"}
        onClose={() => setShowModal(false)}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : "Save Vehicle"}
        size="lg"
        className="!p-0 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
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
            id="vehicle-make"
            label="Make"
            value={form.make}
            onChange={(e) => setForm({ ...form, make: e.target.value })}
            placeholder="e.g. Isuzu"
          />

          <FormInput
            id="vehicle-model"
            label="Model"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="e.g. Elf NKR"
          />

          <FormInput
            id="vehicle-year"
            label="Year"
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })}
            placeholder="e.g. 2024"
          />

          <FormInput
            id="vehicle-engine-type"
            label="Engine Type"
            value={form.engineType}
            onChange={(e) => setForm({ ...form, engineType: e.target.value })}
            placeholder="e.g. Diesel"
          />

          <FormInput
            id="vehicle-size-category"
            label="Truck Size/Category"
            value={form.truckSizeCategory}
            onChange={(e) => setForm({ ...form, truckSizeCategory: e.target.value })}
            placeholder="e.g. Medium Duty"
          />

          <div>
            <label htmlFor="vehicle-garage" className="mb-1.5 block text-xs font-semibold text-[#344158]">
              Garage Branch <span className="text-red-600">*</span>
            </label>
            <select
              id="vehicle-garage"
              required
              value={form.garageId}
              onChange={(event) => setForm({ ...form, garageId: event.target.value })}
              className="h-11 w-full rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-medium text-[#141827] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
            >
              <option value="" disabled>Select a garage branch</option>
              {garages.map((garage) => <option key={garage.id} value={garage.id}>{garage.name}</option>)}
            </select>
          </div>

          <FormInput
            id="vehicle-odometer"
            label="Odometer Baseline (km)"
            type="number"
            value={form.odometer}
            onChange={(e) => setForm({ ...form, odometer: e.target.value })}
          />

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

      {/* Vehicle Details */}
      <Modal
        isOpen={vehicleDetails !== null}
        title={vehicleDetails ? `Vehicle Details — ${vehicleDetails.plateNumber}` : "Vehicle Details"}
        onClose={() => setVehicleDetails(null)}
        footer={(
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setVehicleDetails(null)}
              className="rounded-lg bg-[#070b45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#11175f]"
            >
              Close
            </button>
          </div>
        )}
        size="lg"
        className="!p-0 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
      >
        {vehicleDetails && (
          <>
            <dl className="divide-y divide-[#dde4ef]">
              {[
                ["Plate Number", vehicleDetails.plateNumber],
                ["Make", vehicleDetails.make || "Not recorded"],
                ["Model", vehicleDetails.model],
                ["Year", vehicleDetails.year ?? "Not recorded"],
                ["Engine Type", vehicleDetails.engineType || "Not recorded"],
                ["Truck Size/Category", vehicleDetails.truckSizeCategory || "Not recorded"],
                ["Garage Branch", vehicleDetails.garageName || "Unassigned"],
                ["Odometer Reading", `${Number(vehicleDetails.odometer).toLocaleString()} km`],
                ["Last Maintenance Date", formatMaintenanceDate(vehicleDetails.lastMaintenanceDate)],
                ["Vehicle Status", vehicleDetails.status.replace(/_/g, " ")],
                ["Fleet Status", vehicleDetails.isActive ? "Active" : "Inactive"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(10rem,0.8fr)_2fr] sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{label}</dt>
                  <dd className="break-words text-sm font-semibold text-[#141827]">{value}</dd>
                </div>
              ))}
            </dl>

            {canViewAudit && (
              <section className="mt-6 border-t border-[#dde4ef] pt-5" aria-labelledby="vehicle-audit-title">
                <h3 id="vehicle-audit-title" className="text-sm font-bold uppercase tracking-wide text-[#141827]">Audit History</h3>
                {auditLoading ? (
                  <p className="py-4 text-sm text-[#64748b]">Loading audit history…</p>
                ) : auditError ? (
                  <p className="py-4 text-sm text-red-700" role="alert">Could not load audit history.</p>
                ) : auditEntries.length === 0 ? (
                  <p className="py-4 text-sm text-[#64748b]">No vehicle edits have been recorded.</p>
                ) : (
                  <ol className="mt-2 divide-y divide-[#dde4ef]">
                    {auditEntries.map((entry) => (
                      <li key={entry.id} className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="text-sm font-semibold text-[#141827]">{entry.fieldName.replace(/([A-Z])/g, " $1")}</span>
                          <time className="text-xs text-[#64748b]" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                        </div>
                        <p className="mt-1 break-words text-sm text-[#344158]">
                          {entry.previousValue ?? "Empty"} <span aria-label="changed to">→</span> {entry.newValue ?? "Empty"}
                        </p>
                        <p className="mt-1 text-xs text-[#64748b]">Edited by {entry.email}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={canManage && !!deleteId}
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
