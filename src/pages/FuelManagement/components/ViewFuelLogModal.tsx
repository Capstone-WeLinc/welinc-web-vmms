import type { FuelFillUp } from "../types";
import {
  Calendar,
  Droplet,
  Gauge,
  Navigation,
  Paperclip,
  PhilippinePeso,
  User,
} from "lucide-react";
import { Modal } from "../../../components/ui";

interface ViewFuelLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  fillUp: FuelFillUp;
}

const labelClasses = "text-xs font-bold text-[var(--color-text-secondary)]";
const valueClasses = "mt-1 text-sm font-bold text-[var(--color-text-primary)]";
const cardClasses = "rounded-xl border border-[var(--color-border)] bg-white p-4";

export default function ViewFuelLogModal({
  isOpen,
  onClose,
  fillUp,
}: ViewFuelLogModalProps) {
  if (!isOpen || !fillUp) return null;

  const isAboveBenchmark = fillUp.trend === "above";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <span className="inline-flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-brand-primary)]">
            <Droplet className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-xl font-extrabold">Fuel Fill-up Details</span>
            <span className="mt-1 block text-xs font-semibold text-[var(--color-text-secondary)]">
              {fillUp.id}
            </span>
          </span>
        </span>
      }
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[var(--color-border)] bg-white px-5 text-sm font-bold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-input-bg)] hover:text-[var(--color-text-primary)]"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={labelClasses}>Vehicle profile</p>
            <p className="mt-2 text-2xl font-extrabold text-[var(--color-text-primary)]">
              {fillUp.vehicleName ?? "N/A"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {fillUp.vehicleId} - {fillUp.vehicleModel}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-5 py-3 text-center">
            <p className={labelClasses}>Efficiency metric</p>
            <p
              className={`mt-2 text-xl font-extrabold ${
                isAboveBenchmark ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {fillUp.efficiency} km/L
            </p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className={cardClasses}>
            <div className="mb-4 flex items-center gap-2 border-b border-[var(--color-border)] pb-3 text-sm font-bold text-[var(--color-text-secondary)]">
              <PhilippinePeso className="h-4 w-4 text-[var(--color-brand-primary)]" />
              Cost breakdown
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className={labelClasses}>Volume filled</p>
                <p className={valueClasses}>{fillUp.liters}L</p>
              </div>
              <div>
                <p className={labelClasses}>Price per liter</p>
                <p className={valueClasses}>₱{fillUp.pricePerLiter?.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <p className={labelClasses}>Total transaction cost</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--color-brand-primary)]">
                ₱{fillUp.totalCost?.toLocaleString()}
              </p>
            </div>
          </section>

          <section className={cardClasses}>
            <div className="mb-4 flex items-center gap-2 border-b border-[var(--color-border)] pb-3 text-sm font-bold text-[var(--color-text-secondary)]">
              <Gauge className="h-4 w-4 text-[var(--color-brand-primary)]" />
              Telemetry logs
            </div>
            <div>
              <p className={labelClasses}>Odometer reading</p>
              <p className={valueClasses}>{fillUp.odometer?.toLocaleString()} km</p>
            </div>
            <div className="mt-5">
              <p className={labelClasses}>Performance status</p>
              <span
                className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                  isAboveBenchmark
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {isAboveBenchmark ? "Optimal / Above Benchmark" : "Increased Fuel Consumption"}
              </span>
            </div>
          </section>
        </div>

        <section className="grid gap-4 rounded-xl border border-[var(--color-border)] bg-white p-4 md:grid-cols-3">
          {[
            { icon: Calendar, label: "Date logged", value: fillUp.date },
            { icon: Navigation, label: "Fuel station", value: fillUp.station ?? "N/A" },
            { icon: User, label: "Filled by", value: fillUp.filledBy ?? "N/A" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
                <item.icon className="h-4 w-4" />
              </span>
              <div>
                <p className={labelClasses}>{item.label}</p>
                <p className={valueClasses}>{item.value}</p>
              </div>
            </div>
          ))}
        </section>

        {fillUp.receiptFileName ? (
          <section className={cardClasses}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-input-bg)] text-[var(--color-brand-primary)]">
                <Paperclip className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className={labelClasses}>Receipt / supporting file</p>
                <p className="mt-1 truncate text-sm font-bold text-[var(--color-text-primary)]">
                  {fillUp.receiptFileName}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {fillUp.receiptFileSize
                    ? `${(fillUp.receiptFileSize / 1024).toFixed(1)} KB`
                    : "File attached"}
                  {fillUp.receiptFileType ? ` - ${fillUp.receiptFileType}` : ""}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
