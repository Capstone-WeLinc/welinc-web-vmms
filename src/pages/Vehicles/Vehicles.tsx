import { useState, useEffect, useCallback, useRef, type ChangeEvent, type MouseEvent } from "react";
import { Eye, FileSpreadsheet, Gauge, Plus, Settings2, Truck } from "lucide-react";
import {
  getVehicleRecords,
  createVehicleRecord,
  updateVehicleRecord,
  updateVehicleOdometerRecord,
  deleteVehicleRecord,
  previewVehicleImport,
  saveVehicleImport,
  previewOdometerImport,
  saveOdometerImport,
  getGarageRecords,
  getVehicleAuditHistory,
  getVehicleMaintenanceDefaults,
  updateVehicleMaintenanceDefaults,
  type VehicleRecord,
  type VehicleAuditEntry,
  type GarageFullRecord,
  type VehicleImportRow,
  type OdometerImportRow,
  type VehicleMaintenanceDefaults,
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
  const [odometerVehicle, setOdometerVehicle] = useState<VehicleRecord | null>(null);
  const [odometerInput, setOdometerInput] = useState("");
  const [odometerError, setOdometerError] = useState("");
  const [odometerSaving, setOdometerSaving] = useState(false);
  const [maintenanceDefaultsVehicle, setMaintenanceDefaultsVehicle] =
    useState<VehicleRecord | null>(null);
  const [maintenanceDefaults, setMaintenanceDefaults] =
    useState<VehicleMaintenanceDefaults | null>(null);
  const [baseIntervalKm, setBaseIntervalKm] = useState("");
  const [baseBufferDistanceKm, setBaseBufferDistanceKm] = useState("");
  const [categoryOverrideInputs, setCategoryOverrideInputs] = useState<
    Record<string, { intervalKm: string; bufferDistanceKm: string }>
  >({});
  const [maintenanceDefaultsLoading, setMaintenanceDefaultsLoading] =
    useState(false);
  const [maintenanceDefaultsSaving, setMaintenanceDefaultsSaving] =
    useState(false);
  const [maintenanceDefaultsError, setMaintenanceDefaultsError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState<VehicleImportRow[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [odometerImportRows, setOdometerImportRows] = useState<OdometerImportRow[] | null>(null);
  const odometerImportInputRef = useRef<HTMLInputElement>(null);
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
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const vehicleDetailsId = vehicleDetails?.id;
  useEffect(() => {
    if (!vehicleDetailsId || !canViewAudit) {
      // Clear details from the previous vehicle when its modal closes or access changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (modalMode === "create" && (!form.odometer.trim() || !Number.isInteger(odometer) || odometer < 0)) { setFormError("Enter a valid odometer baseline."); return; }
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
        garageId: form.garageId,
      };
      if (modalMode === "create") {
        await createVehicleRecord({ ...vehicleInput, odometer });
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

  const openOdometerUpdate = (vehicle: VehicleRecord) => {
    if (!canManage || !vehicle.isActive) return;
    setOpenMenuId(null);
    setOdometerVehicle(vehicle);
    setOdometerInput("");
    setOdometerError("");
  };

  const openMaintenanceDefaults = async (vehicle: VehicleRecord) => {
    setOpenMenuId(null);
    setMaintenanceDefaultsVehicle(vehicle);
    setMaintenanceDefaults(null);
    setMaintenanceDefaultsError("");
    setMaintenanceDefaultsLoading(true);
    try {
      const defaults = await getVehicleMaintenanceDefaults(vehicle.id);
      setMaintenanceDefaults(defaults);
      setBaseIntervalKm(
        defaults.baseIntervalKm == null ? "" : String(defaults.baseIntervalKm),
      );
      setBaseBufferDistanceKm(
        defaults.baseBufferDistanceKm == null
          ? ""
          : String(defaults.baseBufferDistanceKm),
      );
      setCategoryOverrideInputs(
        Object.fromEntries(
          defaults.categories.map((category) => [
            category.checklistTemplateId,
            {
              intervalKm:
                category.intervalKm == null ? "" : String(category.intervalKm),
              bufferDistanceKm:
                category.bufferDistanceKm == null
                  ? ""
                  : String(category.bufferDistanceKm),
            },
          ]),
        ),
      );
    } catch (error) {
      setMaintenanceDefaultsError(
        error instanceof Error
          ? error.message
          : "Failed to load vehicle maintenance defaults.",
      );
    } finally {
      setMaintenanceDefaultsLoading(false);
    }
  };

  const handleSaveMaintenanceDefaults = async () => {
    if (
      !maintenanceDefaultsVehicle ||
      !maintenanceDefaults ||
      maintenanceDefaultsLoading ||
      maintenanceDefaultsSaving
    )
      return;
    setMaintenanceDefaultsError("");
    const baseValues = [baseIntervalKm.trim(), baseBufferDistanceKm.trim()];
    if (baseValues.some(Boolean) && baseValues.some((value) => !value)) {
      setMaintenanceDefaultsError(
        "Set both vehicle default values, or leave both blank.",
      );
      return;
    }
    const isValidKm = (value: string, allowZero: boolean) => {
      if (!/^\d+$/.test(value)) return false;
      const parsed = Number(value);
      return (
        Number.isSafeInteger(parsed) &&
        parsed <= 2147483647 &&
        (allowZero ? parsed >= 0 : parsed > 0)
      );
    };
    if (
      (baseValues[0] &&
        (!isValidKm(baseValues[0], false) ||
          !isValidKm(baseValues[1], true))) ||
      Object.values(categoryOverrideInputs).some(
        ({ intervalKm, bufferDistanceKm }) =>
          Boolean(intervalKm.trim()) !== Boolean(bufferDistanceKm.trim()) ||
          (intervalKm.trim() &&
            (!isValidKm(intervalKm.trim(), false) ||
              !isValidKm(bufferDistanceKm.trim(), true))),
      )
    ) {
      setMaintenanceDefaultsError(
        "Intervals must be positive whole kilometres and buffers must be non-negative whole kilometres. Enter both values for each default.",
      );
      return;
    }

    setMaintenanceDefaultsSaving(true);
    try {
      const saved = await updateVehicleMaintenanceDefaults(
        maintenanceDefaultsVehicle.id,
        {
          baseIntervalKm: baseIntervalKm.trim(),
          baseBufferDistanceKm: baseBufferDistanceKm.trim(),
          categoryOverrides: Object.entries(categoryOverrideInputs)
            .filter(
              ([, values]) =>
                values.intervalKm.trim() && values.bufferDistanceKm.trim(),
            )
            .map(([checklistTemplateId, values]) => ({
              checklistTemplateId,
              intervalKm: values.intervalKm.trim(),
              bufferDistanceKm: values.bufferDistanceKm.trim(),
            })),
        },
      );
      setMaintenanceDefaults(saved);
      setMaintenanceDefaultsVehicle(null);
      showToast("Vehicle maintenance defaults saved.");
    } catch (error) {
      setMaintenanceDefaultsError(
        error instanceof Error
          ? error.message
          : "Failed to save vehicle maintenance defaults.",
      );
    } finally {
      setMaintenanceDefaultsSaving(false);
    }
  };

  const handleOdometerUpdate = async () => {
    if (!canManage || !odometerVehicle || odometerSaving) return;
    setOdometerError("");
    const odometer = Number(odometerInput);
    if (
      !odometerInput.trim() ||
      !Number.isSafeInteger(odometer) ||
      odometer < 1 ||
      odometer > 2147483647
    ) {
      setOdometerError("Enter a positive whole-number odometer reading.");
      return;
    }
    if (odometer < odometerVehicle.odometer) {
      setOdometerError(
        `Reading cannot be lower than the current value (${odometerVehicle.odometer.toLocaleString()} km).`,
      );
      return;
    }

    setOdometerSaving(true);
    try {
      await updateVehicleOdometerRecord(odometerVehicle.id, odometer);
      setOdometerVehicle(null);
      showToast("Odometer updated successfully.");
      await load();
    } catch (error) {
      setOdometerError(
        error instanceof Error ? error.message : "Failed to update odometer.",
      );
    } finally {
      setOdometerSaving(false);
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

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canManage) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      showToast("Choose an .xlsx workbook.", "error");
      return;
    }
    setImporting(true);
    setImportRows(null);
    setOdometerImportRows(null);
    try {
      const preview = await previewVehicleImport(file);
      setImportRows(preview.rows);
      showToast(`Preview ready: review ${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"}, then save.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Vehicle import failed.", "error");
    } finally {
      setImporting(false);
    }
  };

  const handleOdometerImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canManage) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      showToast("Choose an .xlsx workbook.", "error");
      return;
    }
    setImporting(true);
    setImportRows(null);
    setOdometerImportRows(null);
    try {
      const preview = await previewOdometerImport(file);
      setOdometerImportRows(preview.rows);
      showToast(
        `Preview ready: review ${preview.rows.length} odometer row${preview.rows.length === 1 ? "" : "s"}, then save.`,
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Odometer import failed.", "error");
    } finally {
      setImporting(false);
    }
  };

  const updateOdometerImportRow = (
    index: number,
    field: "plateNumber" | "odometerReading",
    value: string,
  ) => {
    setOdometerImportRows((current) => current?.map((row, rowIndex) =>
      rowIndex === index
        ? { ...row, [field]: value, status: "READY", errors: [] }
        : row,
    ) ?? null);
  };

  const handleSaveOdometerImport = async () => {
    if (!canManage || !odometerImportRows?.length || importing) return;
    setImporting(true);
    try {
      const result = await saveOdometerImport(odometerImportRows);
      setOdometerImportRows(result.rows);
      if (result.updated > 0) await load();
      const failed = result.rows.filter((row) => row.status === "ERROR").length;
      showToast(
        `Updated ${result.updated}; unchanged ${result.unchanged}; failed ${failed}.`,
        failed ? "error" : "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save odometer import.", "error");
    } finally {
      setImporting(false);
    }
  };

  const updateImportRow = (index: number, field: keyof Omit<VehicleImportRow, "row" | "errors">, value: string) => {
    setImportRows((current) => current?.map((row, rowIndex) => rowIndex === index
      ? { ...row, [field]: value, errors: [] }
      : row) ?? null);
  };

  const handleSaveImport = async () => {
    if (!canManage || !importRows?.length || importing) return;
    setImporting(true);
    try {
      const result = await saveVehicleImport(importRows);
      setImportRows(result.rows.length ? result.rows : null);
      if (result.imported > 0) await load();
      showToast(
        result.rows.length
          ? `Saved ${result.imported} vehicle${result.imported === 1 ? "" : "s"}; edit the ${result.rows.length} remaining row${result.rows.length === 1 ? "" : "s"} and save again.`
          : `Saved ${result.imported} vehicle${result.imported === 1 ? "" : "s"}.`,
        result.rows.length ? "error" : "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save vehicle import.", "error");
    } finally {
      setImporting(false);
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
              ...(v.isActive ? [{
                label: "Update odometer",
                icon: Gauge,
                onClick: () => openOdometerUpdate(v),
              }] : []),
              ...(v.isActive ? [{
                label: "Maintenance defaults",
                icon: Settings2,
                onClick: () => void openMaintenanceDefaults(v),
              }] : []),
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
        {canManage && <div className="flex flex-wrap gap-2">
          <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleImportFile} />
          <input ref={odometerImportInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleOdometerImportFile} />
          <button type="button" onClick={() => importInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 rounded-xl border border-[#c8ced8] bg-white px-4 py-2.5 text-sm font-semibold text-[#141827] transition hover:bg-slate-50 disabled:opacity-60">
            <FileSpreadsheet className="h-4 w-4" />
            {importing ? "Working…" : "Import vehicles"}
          </button>
          <button type="button" onClick={() => odometerImportInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 rounded-xl border border-[#c8ced8] bg-white px-4 py-2.5 text-sm font-semibold text-[#141827] transition hover:bg-slate-50 disabled:opacity-60">
            <Gauge className="h-4 w-4" />
            {importing ? "Working…" : "Bulk odometer update"}
          </button>
          <button
            id="create-vehicle-btn"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-[#070b45] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#11175f]"
          >
            <Plus className="h-4 w-4" />
            Create Vehicle
          </button>
        </div>}
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-[#dde4ef] bg-white shadow-sm">
        {odometerImportRows && (
          <section className="border-b border-[#dde4ef] bg-slate-50 p-5" aria-label="Odometer import preview">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#141827]">Review bulk odometer update</h2>
                <p className="text-sm text-[#64748b]">
                  Review each vehicle reading. Valid rows save independently; errors leave that vehicle unchanged.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOdometerImportRows(null)} disabled={importing} className="rounded-lg border border-[#c8ced8] bg-white px-3 py-2 text-sm font-semibold text-[#344158] disabled:opacity-60">Cancel</button>
                <button
                  type="button"
                  onClick={handleSaveOdometerImport}
                  disabled={importing || !odometerImportRows.some((row) => row.status === "READY" || row.status === "ERROR")}
                  className="rounded-lg bg-[#070b45] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {importing ? "Saving…" : "Save valid rows"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#dde4ef] bg-white">
              <table className="min-w-[760px] w-full text-left text-xs">
                <thead className="bg-slate-100 text-[#344158]"><tr>
                  <th className="p-2">Row</th><th className="p-2">Plate Number</th><th className="p-2">Current Odometer</th><th className="p-2">New Odometer (km)</th><th className="p-2">Result</th>
                </tr></thead>
                <tbody className="divide-y divide-[#dde4ef]">{odometerImportRows.map((row, index) => {
                  const cellClass = "w-full min-w-28 rounded border border-[#c8ced8] px-2 py-1.5 text-xs";
                  return <tr key={`${row.row}-${index}`}>
                    <td className="p-2 font-semibold">{row.row}</td>
                    <td className="p-2">
                      <input
                        aria-label={`Row ${row.row} plate number`}
                        className={cellClass}
                        value={row.plateNumber}
                        onChange={(event) => updateOdometerImportRow(index, "plateNumber", event.target.value)}
                      />
                    </td>
                    <td className="p-2">{row.currentOdometer === null ? "—" : `${row.currentOdometer.toLocaleString()} km`}</td>
                    <td className="p-2">
                      <input
                        aria-label={`Row ${row.row} odometer reading`}
                        className={cellClass}
                        type="number"
                        min="1"
                        step="1"
                        value={row.odometerReading}
                        onChange={(event) => updateOdometerImportRow(index, "odometerReading", event.target.value)}
                      />
                    </td>
                    <td className={`max-w-72 p-2 ${row.status === "ERROR" ? "text-red-700" : row.status === "UPDATED" ? "text-green-700" : "text-[#344158]"}`}>
                      {row.errors.length ? row.errors.join(" ") : row.status === "READY" ? "Ready to save" : row.status === "UPDATED" ? "Updated" : "Unchanged"}
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </section>
        )}
        {importRows && (
          <section className="border-b border-[#dde4ef] bg-slate-50 p-5" aria-label="Vehicle import preview">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[#141827]">Review vehicle import</h2>
                <p className="text-sm text-[#64748b]">No vehicles have been saved. Edit the rows, then save when ready.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setImportRows(null)} disabled={importing} className="rounded-lg border border-[#c8ced8] bg-white px-3 py-2 text-sm font-semibold text-[#344158] disabled:opacity-60">Cancel</button>
                <button type="button" onClick={handleSaveImport} disabled={importing || importRows.length === 0} className="rounded-lg bg-[#070b45] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{importing ? "Saving…" : "Save vehicles"}</button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#dde4ef] bg-white">
              <table className="min-w-[1150px] w-full text-left text-xs">
                <thead className="bg-slate-100 text-[#344158]"><tr>
                  <th className="p-2">Row</th><th className="p-2">Plate Number</th><th className="p-2">Make</th><th className="p-2">Model</th><th className="p-2">Year</th><th className="p-2">Engine Type</th><th className="p-2">Truck Size/Category</th><th className="p-2">Garage Branch</th><th className="p-2">Odometer Baseline</th><th className="p-2">Validation</th>
                </tr></thead>
                <tbody className="divide-y divide-[#dde4ef]">{importRows.map((row, index) => {
                  const cellClass = "w-full min-w-24 rounded border border-[#c8ced8] px-2 py-1.5 text-xs";
                  const textCell = (field: keyof Omit<VehicleImportRow, "row" | "errors">, type = "text") => <input aria-label={`Row ${row.row} ${field}`} className={cellClass} type={type} value={row[field]} onChange={(event) => updateImportRow(index, field, event.target.value)} />;
                  const garageIsRegistered = garages.some((garage) => garage.name.toLowerCase() === row.garageBranch.toLowerCase());
                  return <tr key={`${row.row}-${index}`}>
                    <td className="p-2 font-semibold">{row.row}</td>
                    <td className="p-2">{textCell("plateNumber")}</td>
                    <td className="p-2">{textCell("make")}</td>
                    <td className="p-2">{textCell("model")}</td>
                    <td className="p-2">{textCell("year", "number")}</td>
                    <td className="p-2">{textCell("engineType")}</td>
                    <td className="p-2">{textCell("truckSizeCategory")}</td>
                    <td className="p-2"><select aria-label={`Row ${row.row} garage branch`} className={cellClass} value={row.garageBranch} onChange={(event) => updateImportRow(index, "garageBranch", event.target.value)}>
                      {!garageIsRegistered && row.garageBranch && <option value={row.garageBranch}>{row.garageBranch} (unregistered)</option>}
                      <option value="">Select branch</option>{garages.map((garage) => <option key={garage.id} value={garage.name}>{garage.name}</option>)}
                    </select></td>
                    <td className="p-2">{textCell("odometerBaseline", "number")}</td>
                    <td className="max-w-64 p-2 text-red-700">{row.errors.length ? row.errors.join(" ") : "Ready"}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </section>
        )}
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

          {modalMode === "create" && (
            <FormInput
              id="vehicle-odometer"
              label="Initial Odometer Baseline (km)"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              value={form.odometer}
              onChange={(e) => setForm({ ...form, odometer: e.target.value })}
            />
          )}

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

      <Modal
        isOpen={canManage && maintenanceDefaultsVehicle !== null}
        title={
          maintenanceDefaultsVehicle
            ? `Maintenance Defaults — ${maintenanceDefaultsVehicle.plateNumber}`
            : "Maintenance Defaults"
        }
        onClose={() => setMaintenanceDefaultsVehicle(null)}
        onConfirm={handleSaveMaintenanceDefaults}
        confirmLabel={maintenanceDefaultsSaving ? "Saving…" : "Save Defaults"}
        size="lg"
        className="!p-0 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden"
      >
        {maintenanceDefaultsLoading ? (
          <p className="py-8 text-center text-sm text-[#64748b]">
            Loading vehicle maintenance defaults…
          </p>
        ) : maintenanceDefaultsError && !maintenanceDefaults ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {maintenanceDefaultsError}
          </div>
        ) : maintenanceDefaults ? (
          <div className="space-y-5">
            {maintenanceDefaultsError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
              >
                {maintenanceDefaultsError}
              </div>
            )}
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[#141827]">
                  Vehicle base default
                </h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  Used when no value is configured for the selected checklist
                  type. Leave both blank to require Custom values.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormInput
                  id="vehicle-default-interval"
                  label="Default interval (km)"
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  value={baseIntervalKm}
                  onChange={(event) => setBaseIntervalKm(event.target.value)}
                  placeholder="e.g. 5000"
                />
                <FormInput
                  id="vehicle-default-buffer"
                  label="Default buffer (km)"
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  value={baseBufferDistanceKm}
                  onChange={(event) =>
                    setBaseBufferDistanceKm(event.target.value)
                  }
                  placeholder="e.g. 500"
                />
              </div>
            </section>

            <section className="space-y-3 border-t border-[#dde4ef] pt-4">
              <div>
                <h3 className="text-sm font-bold text-[#141827]">
                  Checklist-type overrides
                </h3>
                <p className="mt-1 text-xs text-[#64748b]">
                  Configure only types that differ from the vehicle base.
                  Leave both fields blank to inherit it.
                </p>
              </div>
              {maintenanceDefaults.categories.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-[#64748b]">
                  No active checklist types are available. Add a checklist
                  template before configuring type-specific defaults.
                </p>
              ) : (
                <div className="max-h-64 overflow-auto rounded-lg border border-[#dde4ef]">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                      <tr>
                        <th className="p-3">Checklist type</th>
                        <th className="p-3">Interval override (km)</th>
                        <th className="p-3">Buffer override (km)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dde4ef]">
                      {maintenanceDefaults.categories.map((category) => {
                        const values = categoryOverrideInputs[
                          category.checklistTemplateId
                        ] ?? { intervalKm: "", bufferDistanceKm: "" };
                        return (
                          <tr key={category.checklistTemplateId}>
                            <th className="p-3 font-semibold text-[#141827]">
                              {category.type}
                            </th>
                            <td className="p-3">
                              <input
                                aria-label={`${category.type} interval override in km`}
                                type="number"
                                min={1}
                                max={2147483647}
                                step={1}
                                value={values.intervalKm}
                                onChange={(event) =>
                                  setCategoryOverrideInputs((current) => ({
                                    ...current,
                                    [category.checklistTemplateId]: {
                                      ...values,
                                      intervalKm: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Inherit base"
                                className="h-10 w-full rounded-lg border border-[#c8ced8] bg-white px-3 text-sm text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                aria-label={`${category.type} buffer override in km`}
                                type="number"
                                min={0}
                                max={2147483647}
                                step={1}
                                value={values.bufferDistanceKm}
                                onChange={(event) =>
                                  setCategoryOverrideInputs((current) => ({
                                    ...current,
                                    [category.checklistTemplateId]: {
                                      ...values,
                                      bufferDistanceKm: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Inherit base"
                                className="h-10 w-full rounded-lg border border-[#c8ced8] bg-white px-3 text-sm text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
              Defaults affect newly created schedules only. Existing schedules
              keep their saved interval, buffer, and due threshold.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={canManage && odometerVehicle !== null}
        title={odometerVehicle ? `Update Odometer — ${odometerVehicle.plateNumber}` : "Update Odometer"}
        onClose={() => setOdometerVehicle(null)}
        onConfirm={handleOdometerUpdate}
        confirmLabel={odometerSaving ? "Updating…" : "Update Odometer"}
        size="sm"
      >
        {odometerVehicle && (
          <div className="space-y-4">
            <p className="text-sm text-[#64748b]">
              Current reading: <strong className="text-[#141827]">{odometerVehicle.odometer.toLocaleString()} km</strong>
            </p>
            {odometerError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
                {odometerError}
              </div>
            )}
            <FormInput
              id="vehicle-odometer-update"
              label="New odometer reading (km)"
              type="number"
              min={1}
              max={2147483647}
              step={1}
              required
              autoFocus
              value={odometerInput}
              onChange={(event) => setOdometerInput(event.target.value)}
              helperText="The reading must be equal to or greater than the current value."
            />
          </div>
        )}
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
