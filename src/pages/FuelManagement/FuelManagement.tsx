import { useMemo, useState, type FormEvent } from "react";
import {
  Camera,
  Droplet,
  Fuel,
  Gauge,
  PhilippinePeso,
  Plus,
  Upload,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { ActionButton, Modal } from "../../components/ui";
import { luzonFuelStations } from "../../data/luzonFuelStations";
import { mockFuelFillUps, mockVehicleEfficiency } from "../../lib/mocks/fuelMocks";
import FuelLog from "./components/FuelLog";
import StationCombobox from "./components/StationCombobox";
import type { FuelFillUp } from "./types";

type FuelForm = {
  vehicleId: string;
  vehicleModel: string;
  date: string;
  liters: string;
  pricePerLiter: string;
  odometer: string;
  station: string;
  filledBy: string;
  receiptFileName: string;
  receiptFileSize: number;
  receiptFileType: string;
};

const EMPTY_FORM: FuelForm = {
  vehicleId: "",
  vehicleModel: "",
  date: new Date().toISOString().slice(0, 10),
  liters: "",
  pricePerLiter: "",
  odometer: "",
  station: "",
  filledBy: "",
  receiptFileName: "",
  receiptFileSize: 0,
  receiptFileType: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: digits,
  }).format(value);

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof Fuel;
  color: string;
}) {
  return (
    <div className="enterprise-kpi-card">
      <div className="relative ml-2 flex items-start justify-between gap-4">
        <div>
          <p className="enterprise-kpi-label">{label}</p>
          <p className="enterprise-kpi-value">{value}</p>
        </div>
        <div className="enterprise-icon-box" style={{ backgroundColor: `${color}14`, color }}>
          <Icon size={22} strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

export default function FuelManagement() {
  const [fillUps, setFillUps] = useState<FuelFillUp[]>(mockFuelFillUps);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFillUpId, setEditingFillUpId] = useState<string | null>(null);
  const [form, setForm] = useState<FuelForm>(EMPTY_FORM);

  const computedCost = useMemo(() => {
    const liters = Number(form.liters);
    const price = Number(form.pricePerLiter);
    return Number.isFinite(liters) && Number.isFinite(price) ? liters * price : 0;
  }, [form.liters, form.pricePerLiter]);

  const totals = useMemo(() => {
    const totalLiters = fillUps.reduce((sum, item) => sum + item.liters, 0);
    const totalCost = fillUps.reduce((sum, item) => sum + item.totalCost, 0);
    const avgEfficiency = fillUps.length
      ? fillUps.reduce((sum, item) => sum + item.efficiency, 0) / fillUps.length
      : 0;

    return {
      totalLiters,
      totalCost,
      avgEfficiency,
    };
  }, [fillUps]);

  const stationOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...luzonFuelStations,
          ...fillUps.map((fillUp) => fillUp.station).filter(Boolean),
        ]),
      ).sort(),
    [fillUps],
  );
  const vehicleOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...mockVehicleEfficiency.map((vehicle) => vehicle.vehicleId),
          ...fillUps.map((fillUp) => fillUp.vehicleId).filter(Boolean),
        ]),
      ).sort(),
    [fillUps],
  );
  const vehicleModelById = useMemo(
    () =>
      new Map(
        [
          ...mockVehicleEfficiency.map((vehicle) => [vehicle.vehicleId, vehicle.model] as const),
          ...fillUps.map((fillUp) => [fillUp.vehicleId, fillUp.vehicleModel] as const),
        ].filter(([vehicleId]) => Boolean(vehicleId)),
      ),
    [fillUps],
  );

  const updateForm = (field: keyof FuelForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const updateVehicle = (vehicleId: string) => {
    setForm((current) => ({
      ...current,
      vehicleId,
      vehicleModel: vehicleModelById.get(vehicleId) ?? current.vehicleModel,
    }));
  };
  const updateReceiptFile = (file?: File) => {
    setForm((current) => ({
      ...current,
      receiptFileName: file?.name ?? "",
      receiptFileSize: file?.size ?? 0,
      receiptFileType: file?.type ?? "",
    }));
  };

  const openCreateForm = () => {
    setEditingFillUpId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEditForm = (fillUp: FuelFillUp) => {
    setEditingFillUpId(fillUp.id);
    setForm({
      vehicleId: fillUp.vehicleId ?? "",
      vehicleModel: fillUp.vehicleModel ?? "",
      date: fillUp.date ?? EMPTY_FORM.date,
      liters: String(fillUp.liters ?? ""),
      pricePerLiter: String(fillUp.pricePerLiter ?? ""),
      odometer: String(fillUp.odometer ?? ""),
      station: fillUp.station ?? "",
      filledBy: fillUp.filledBy ?? "",
      receiptFileName: fillUp.receiptFileName ?? "",
      receiptFileSize: fillUp.receiptFileSize ?? 0,
      receiptFileType: fillUp.receiptFileType ?? "",
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingFillUpId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const liters = Number(form.liters);
    const pricePerLiter = Number(form.pricePerLiter);
    const odometer = Number(form.odometer);

    if (!form.vehicleId.trim() || !form.date || !Number.isFinite(liters) || !Number.isFinite(pricePerLiter)) {
      return;
    }

    const nextValues = {
      vehicleId: form.vehicleId.trim(),
      vehicleName: form.vehicleId.trim(),
      vehicleModel: form.vehicleModel.trim() || "Fleet Vehicle",
      date: form.date,
      liters,
      pricePerLiter,
      totalCost: liters * pricePerLiter,
      odometer: Number.isFinite(odometer) ? odometer : 0,
      station: form.station.trim() || "Not specified",
      filledBy: form.filledBy.trim() || "Not specified",
      receiptFileName: form.receiptFileName || undefined,
      receiptFileSize: form.receiptFileSize || undefined,
      receiptFileType: form.receiptFileType || undefined,
    };

    if (editingFillUpId) {
      setFillUps((current) =>
        current.map((fillUp) =>
          fillUp.id === editingFillUpId
            ? { ...fillUp, ...nextValues }
            : fillUp,
        ),
      );
    } else {
      const nextFillUp: FuelFillUp = {
        id: `fuel-${Date.now()}`,
        ...nextValues,
        efficiency: 0,
        trend: "normal",
      };
      setFillUps((current) => [nextFillUp, ...current]);
    }

    closeForm();
  };

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        icon={Fuel}
        title="FUEL EXPENSES"
        subtitle="Record fuel fill-ups, calculate fuel costs, and monitor vehicle fuel expenses"
        action={
          <ActionButton onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            Log Fill-Up
          </ActionButton>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Fuel Cost" value={formatCurrency(totals.totalCost)} icon={PhilippinePeso} color="#0f766e" />
        <SummaryCard label="Fuel Consumed" value={`${formatNumber(totals.totalLiters, 1)} L`} icon={Droplet} color="#2563eb" />
        <SummaryCard label="Fill-Up Records" value={fillUps.length} icon={Fuel} color="#7c3aed" />
        <SummaryCard label="Avg Consumption" value={`${formatNumber(totals.avgEfficiency, 1)} km/L`} icon={Gauge} color="#d97706" />
      </div>
      <FuelLog
        fillUps={fillUps}
        onEdit={openEditForm}
        onDelete={(id) =>
          setFillUps((current) => current.filter((item) => item.id !== id))
        }
      />

      <Modal
        isOpen={isFormOpen}
        title={editingFillUpId ? "Edit Fuel Fill-Up" : "Log Fuel Fill-Up"}
        size="lg"
        onClose={closeForm}
        footer={
          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" onClick={closeForm}>Cancel</ActionButton>
            <ActionButton type="submit" form="fuel-fill-up-form">
              {editingFillUpId ? "Save Changes" : "Save Fill-Up"}
            </ActionButton>
          </div>
        }
      >
        <form id="fuel-fill-up-form" className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <StationCombobox
            id="fuel-management-vehicle"
            label="Vehicle"
            value={form.vehicleId}
            options={vehicleOptions}
            onChange={updateVehicle}
            placeholder="Search or select vehicle..."
            required
          />
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Vehicle Model
            <input value={form.vehicleModel} onChange={(event) => updateForm("vehicleModel", event.target.value)} placeholder="e.g., Isuzu NPR75" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Date
            <input type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Odometer
            <input type="number" min="0" value={form.odometer} onChange={(event) => updateForm("odometer", event.target.value)} placeholder="e.g., 85420" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Liters
            <input type="number" min="0" step="0.01" value={form.liters} onChange={(event) => updateForm("liters", event.target.value)} placeholder="e.g., 65" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Price Per Liter
            <input type="number" min="0" step="0.01" value={form.pricePerLiter} onChange={(event) => updateForm("pricePerLiter", event.target.value)} placeholder="e.g., 65.50" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]" />
          </label>
          <StationCombobox
            id="fuel-management-station"
            label="Station"
            value={form.station}
            options={stationOptions}
            onChange={(station) => updateForm("station", station)}
          />
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Filled By
            <input value={form.filledBy} onChange={(event) => updateForm("filledBy", event.target.value)} placeholder="Driver or staff name" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]" />
          </label>
          <div className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] md:col-span-2">
            <span>Receipt / Supporting File</span>
            <div className="flex min-h-24 flex-col gap-4 rounded-xl border border-dashed border-[#c7d2e2] bg-white px-4 py-4 text-sm transition hover:border-[#070b45] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#070b45]/10 text-[#070b45]">
                  <Upload className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-[#141827]">
                    {form.receiptFileName || "Upload receipt, invoice, or supporting file"}
                  </span>
                  <span className="mt-1 block text-xs font-medium text-[#64748b]">
                    {form.receiptFileName
                      ? `${(form.receiptFileSize / 1024).toFixed(1)} KB`
                      : "Accepted: image or PDF file"}
                  </span>
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#070b45] px-4 text-xs font-extrabold uppercase text-[#070b45] transition hover:bg-[#f6f8fc]">
                  <Upload className="h-4 w-4" />
                  Choose File
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(event) => updateReceiptFile(event.target.files?.[0])}
                  />
                </label>
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#070b45] px-4 text-xs font-extrabold uppercase text-white transition hover:bg-[#11175f]">
                  <Camera className="h-4 w-4" />
                  Take Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => updateReceiptFile(event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 md:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Calculated Total Cost</p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(computedCost)}</p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
