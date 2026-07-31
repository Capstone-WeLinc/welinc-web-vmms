import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ClipboardCheck,
  Wrench,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { DatePicker, DropdownSelect, ToastNotification } from "../../components/ui";
import {
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  getChecklistTemplates,
} from "../../lib/api/maintenanceService";
import {
  getUsers,
  type UserRecord,
} from "../../lib/api/userService";
import {
  getGarages,
} from "../../lib/api/locationService";
import {
  getVehicles,
  type VehicleOption,
} from "../../lib/api/vehicleService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import { getOdometerActivationRange } from "../../lib/utils/workOrders";
import {
  AccountType,
  accountTypeLabels,
  MaintenanceIntervalType,
  MaintenanceStatus,
  MaintenanceTriggerType,
  maintenanceIntervalTypeLabels,
  maintenanceTriggerTypeLabels,
  type MaintenanceTask,
} from "../../types/maintenance";

type ChecklistTemplateName = string;

interface ChecklistItemTemplate {
  id: string;
  text: string;
}

const OTHER_GARAGE_VALUE = "__other__";
const NON_NEGATIVE_NUMBER_PATTERN = /^\d+(?:\.\d+)?$/;
const ACCOUNT_TYPE_OPTIONS = [
  AccountType.IN_HOUSE,
  AccountType.OUTSOURCED,
] as const;
const ACCREDITED_SERVICE_PROVIDERS = [
  "North Hub Service Partner",
  "Metro Brake Specialist",
  "Luzon FleetCare Center",
  "Welinc Accredited Tire & Alignment",
] as const;

const sanitizeNonNegativeNumber = (value: string) => {
  const sanitized = value.replace(/[^\d.]/g, "");
  const [wholeNumber, ...decimalParts] = sanitized.split(".");

  return decimalParts.length > 0
    ? `${wholeNumber}.${decimalParts.join("")}`
    : wholeNumber;
};

const getTodayDateText = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function CreateScheduleModal({
  isOpen,
  editingTask,
  odometerOnly = false,
  existingSchedules,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  editingTask?: MaintenanceTask;
  odometerOnly?: boolean;
  existingSchedules: MaintenanceTask[];
  onClose: () => void;
  onSaved?: (task: MaintenanceTask) => void | Promise<void>;
}) {
  const [checklistTemplate, setChecklistTemplateName] =
    useState<ChecklistTemplateName>("");
  const [templates, setTemplates] = useState<
    Record<ChecklistTemplateName, ChecklistItemTemplate[]>
  >({});
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [vehicleId, setVehicleId] = useState("");
  const [startReferenceDate, setStartReferenceDate] = useState("");
  const [assignedMechanic, setAssignedMechanic] = useState("");
  const [mechanics, setMechanics] = useState<UserRecord[]>([]);
  const [garages, setGarages] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [garageId, setGarageId] = useState("");
  const [isOtherGarage, setIsOtherGarage] = useState(false);
  const [otherGarage, setOtherGarage] = useState("");
  const [accountType, setAccountType] = useState<AccountType | "">("");
  const [outsourcedProvider, setOutsourcedProvider] = useState("");
  const [systemAffected, setSystemAffected] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [intervalKm, setIntervalKm] = useState("");
  const [bufferDistanceKm, setBufferDistanceKm] = useState("");
  const [startingReferenceReadingKm, setStartingReferenceReadingKm] =
    useState("");
  const [intervalTypeState, setIntervalTypeState] = useState<
    MaintenanceIntervalType | ""
  >("");
  const [triggerType, setTriggerType] = useState<
    MaintenanceTriggerType
  >(MaintenanceTriggerType.ODOMETER);
  const [notes, setNotes] = useState("");

  useBodyScrollLock(isOpen);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);
  const [duplicateSchedule, setDuplicateSchedule] =
    useState<MaintenanceTask | null>(null);
  const isOdometerOnlyUpdate = Boolean(odometerOnly && editingTask);

  useEffect(() => {
    getChecklistTemplates()
      .then((loadedTemplates) => {
        setTemplates(loadedTemplates);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setIsTemplatesLoading(false));

    getUsers()
      .then((users) => {
        const mechanicUsers = users.filter((user) => user.role === "MECHANIC");
        setMechanics(mechanicUsers);
      })
      .catch(() => {
        console.error("Failed to load mechanic users");
      });

    getGarages()
      .then((g) => setGarages(g))
      .catch(() => console.error("Failed to load garages"));

    getVehicles()
      .then((loadedVehicles) => setVehicles(loadedVehicles))
      .catch(() => console.error("Failed to load vehicles"));
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        if (editingTask) {
          setVehicleId(editingTask.vehicleId);
          setChecklistTemplateName(editingTask.title);
          setAssignedMechanic(editingTask.assignedDriver ?? "");
          setNotes(editingTask.notes ?? "");
          setGarageId(editingTask.garageId ?? "");
          setIsOtherGarage(false);
          setOtherGarage("");
          setAccountType(
            editingTask.accountType &&
            ACCOUNT_TYPE_OPTIONS.includes(editingTask.accountType)
              ? (editingTask.accountType ?? "")
              : "",
          );
          setOutsourcedProvider(editingTask.outsourcedProvider ?? "");
          setSystemAffected(editingTask.systemAffected ?? "");
          setOdometerReading(editingTask.odometerReading ?? "");
          setTriggerType(editingTask.triggerType ?? MaintenanceTriggerType.ODOMETER);
          setStartReferenceDate(editingTask.startReferenceDate ?? "");
          setIntervalKm(editingTask.intervalKm ?? "");
          setBufferDistanceKm(editingTask.bufferDistanceKm ?? "");
          setStartingReferenceReadingKm(
            editingTask.startingReferenceReadingKm ?? "",
          );

          const it = editingTask.intervalType;
          if (it && Object.values(MaintenanceIntervalType).includes(it)) {
            setIntervalTypeState(it);
          } else {
            setIntervalTypeState("");
          }

        } else {
          // Reset all fields for new schedule
          setVehicleId("");
          setChecklistTemplateName("");
          setAssignedMechanic("");
          setNotes("");
          setGarageId("");
          setIsOtherGarage(false);
          setOtherGarage("");
          setAccountType("");
          setOutsourcedProvider("");
          setSystemAffected("");
          setOdometerReading("");
          setTriggerType(MaintenanceTriggerType.ODOMETER);
          setStartReferenceDate("");
          setIntervalKm("");
          setBufferDistanceKm("");
          setStartingReferenceReadingKm("");
          setIntervalTypeState("");
        }
      });
    }
  }, [isOpen, editingTask]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const notifyDisabledField = (message: string) => {
    setToast({ type: "info", message });
  };

  const isEditingGarageOther =
    Boolean(editingTask?.garageId) &&
    garageId === editingTask?.garageId &&
    garages.length > 0 &&
    !garages.some((garage) => garage.id === editingTask?.garageId);
  const garageIsOther = isOtherGarage || isEditingGarageOther;
  const otherGarageValue =
    isEditingGarageOther && !otherGarage
      ? (editingTask?.garageId ?? "")
      : otherGarage;
  const selectableTemplateNames = Object.entries(templates)
    .filter(([, items]) => items.some((item) => item.text.trim() !== ""))
    .map(([templateName]) => templateName);
  const isSelectedTemplateUsable =
    selectableTemplateNames.includes(checklistTemplate);
  const requiredFieldValues = [
    vehicleId,
    odometerReading,
    garageIsOther ? otherGarageValue : garageId,
    accountType,
    ...(accountType === AccountType.OUTSOURCED ? [outsourcedProvider] : []),
    checklistTemplate,
    assignedMechanic,
    ...(triggerType !== MaintenanceTriggerType.TIME
      ? [intervalKm, bufferDistanceKm, startingReferenceReadingKm]
      : []),
    ...(triggerType !== MaintenanceTriggerType.ODOMETER
      ? [intervalTypeState, startReferenceDate]
      : []),
  ];
  const isFormComplete = isOdometerOnlyUpdate
    ? odometerReading.trim().length > 0 &&
      NON_NEGATIVE_NUMBER_PATTERN.test(odometerReading)
    : requiredFieldValues.every((value) => value.trim().length > 0) &&
      isSelectedTemplateUsable &&
      [
        odometerReading,
        ...(triggerType !== MaintenanceTriggerType.TIME
          ? [intervalKm, bufferDistanceKm, startingReferenceReadingKm]
          : []),
      ].every((value) => NON_NEGATIVE_NUMBER_PATTERN.test(value));

  const saveSchedule = async (scheduleToReplace?: MaintenanceTask) => {
    setIsSaving(true);
    try {
      const savedGarageId = garageIsOther
        ? otherGarageValue.trim()
        : garageId;
      const selectedMechanic = mechanics.find(
        (mechanic) => mechanic.name === assignedMechanic,
      );
      const isTimeBased = triggerType === MaintenanceTriggerType.TIME;
      const submittedStartReferenceDate = isTimeBased ? startReferenceDate : "";
      const submittedIntervalType = isTimeBased
        ? intervalTypeState || undefined
        : undefined;
      const submittedIntervalKm = isTimeBased ? "" : intervalKm;
      const submittedBufferDistanceKm = isTimeBased ? "" : bufferDistanceKm;
      const submittedStartingReferenceReadingKm = isTimeBased
        ? ""
        : startingReferenceReadingKm;

      if (scheduleToReplace || editingTask) {
        const targetSchedule = scheduleToReplace ?? editingTask;
        if (!targetSchedule) return;

        const updated: MaintenanceTask = isOdometerOnlyUpdate
          ? {
              ...targetSchedule,
              odometerReading,
            }
          : {
              ...targetSchedule,
              vehicleId,
              title: checklistTemplate,
              assignedDriver: assignedMechanic,
              assignedMechanicId: selectedMechanic?.id,
              assignedMechanicEmail: selectedMechanic?.email,
              notes,
              garageId: savedGarageId,
              accountType: accountType || undefined,
              outsourcedProvider:
                accountType === AccountType.OUTSOURCED ? outsourcedProvider.trim() : "",
              systemAffected,
              odometerReading,
              triggerType,
              startReferenceDate: submittedStartReferenceDate,
              intervalKm: submittedIntervalKm,
              bufferDistanceKm: submittedBufferDistanceKm,
              startingReferenceReadingKm: submittedStartingReferenceReadingKm,
              intervalType: submittedIntervalType,
            };
        try {
          const saved = await updateMaintenanceSchedule(updated);
          await onSaved?.(saved);
        } catch (err) {
          console.error("Failed to update schedule", err);
          // fallback to local update
          await onSaved?.(updated);
        }
      } else {
        const task = await createMaintenanceSchedule({
          vehicleId,
          title: checklistTemplate,
          status: MaintenanceStatus.PENDING,
          date: getTodayDateText(),
          assignedDriver: assignedMechanic,
          assignedMechanicId: selectedMechanic?.id,
          assignedMechanicEmail: selectedMechanic?.email,
          notes,
          garageId: savedGarageId,
          accountType: accountType || undefined,
          outsourcedProvider:
            accountType === AccountType.OUTSOURCED ? outsourcedProvider.trim() : "",
          systemAffected,
          odometerReading,
          triggerType,
          startReferenceDate: submittedStartReferenceDate,
          intervalKm: submittedIntervalKm,
          bufferDistanceKm: submittedBufferDistanceKm,
          startingReferenceReadingKm: submittedStartingReferenceReadingKm,
          intervalType: submittedIntervalType,
        });
        await onSaved?.(task);
      }

      // Reset form state
      setVehicleId("");
      setChecklistTemplateName("");
      setAssignedMechanic("");
      setNotes("");
      setGarageId("");
      setIsOtherGarage(false);
      setOtherGarage("");
      setAccountType("");
      setOutsourcedProvider("");
      setSystemAffected("");
      setOdometerReading("");
      setTriggerType(MaintenanceTriggerType.ODOMETER);
      setStartReferenceDate("");
      setIntervalKm("");
      setBufferDistanceKm("");
      setStartingReferenceReadingKm("");
      setIntervalTypeState("");
      setDuplicateSchedule(null);

      onClose();
    } catch (error) {
      console.error("Failed to save schedule", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!isFormComplete) return;

    const duplicate = isOdometerOnlyUpdate
      ? null
      : existingSchedules.find(
      (schedule) =>
        schedule.id !== editingTask?.id &&
        schedule.vehicleId.trim().toLowerCase() ===
          vehicleId.trim().toLowerCase() &&
        schedule.title.trim().toLowerCase() ===
          checklistTemplate.trim().toLowerCase(),
    );

    if (duplicate) {
      setDuplicateSchedule(duplicate);
      return;
    }

    await saveSchedule();
  };

  const availableVehicles = vehicles.filter(
    (vehicle) => (vehicle.status ?? "AVAILABLE").trim().toUpperCase() === "AVAILABLE",
  );
  const templateExists = Object.prototype.hasOwnProperty.call(
    templates,
    checklistTemplate,
  );
  const mechanicExists = mechanics.some((m) => m.name === assignedMechanic);
  const activationRange = editingTask
    ? getOdometerActivationRange(editingTask)
    : null;
  const modalTitle = isOdometerOnlyUpdate
    ? "UPDATE ODOMETER READING"
    : editingTask
      ? "EDIT MAINTENANCE SCHEDULE"
      : "CREATE MAINTENANCE SCHEDULE";
  const modalSubtitle = isOdometerOnlyUpdate
    ? "Update the latest odometer reading for this pending schedule."
    : editingTask
      ? "Update schedule details, trigger rules, assignment, and checklist template."
      : "Set up a new maintenance schedule with vehicle, trigger, assignment, and checklist details.";
  const submitLabel = isOdometerOnlyUpdate
    ? "Update Odometer"
    : editingTask
      ? "Update Schedule"
      : "Create Schedule";

  /*
  const renderCalendar = (
    calendarDate: Date,
    onDaySelect: (value: string) => void,
    onNavigate: (monthOffset: number) => void,
  ) => {
    const { year, month, firstDayOfWeek, daysInMonth } =
      getCalendarDays(calendarDate);

    return (
      <div className="card-base w-72 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]"
          >
            <span className="font-bold">‹</span>
          </button>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">
            {formatCalendarLabel(calendarDate)}
          </div>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            className="h-9 w-9 rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]"
          >
            <span className="font-bold">›</span>
          </button>
        </div>
        <div className="mb-2 grid grid-cols-7 gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-sm text-[var(--color-text-primary)]">
          {Array.from({ length: firstDayOfWeek }).map((_, index) => (
            <div key={`blank-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            return (
                <button
                key={day}
                type="button"
                onClick={() =>
                  onDaySelect(formatIsoDate(new Date(year, month, day)))
                }
                className="h-9 rounded-lg bg-[var(--color-card-bg)] hover:bg-[var(--color-card-bg-hover)] transition"
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  */
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay z-[90]">
      <div className="fixed right-6 top-6 z-[80] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>
      <div className="modal-content flex h-[min(900px,calc(100vh-2rem))] w-full max-w-6xl flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-5 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {modalTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {modalSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
            aria-label="Close schedule form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          {isOdometerOnlyUpdate ? (
            <section className="space-y-4 border-b border-[var(--color-border)] pb-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl border border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10 p-2 text-[#0369a1]">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Update Pending Schedule Odometer
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Pending schedules only allow odometer reading updates.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "Vehicle", value: editingTask?.vehicleId },
                  { label: "Checklist Template", value: editingTask?.title },
                  {
                    label: "Assigned Mechanic",
                    value: editingTask?.assignedDriver,
                  },
                  { label: "Status", value: editingTask?.status },
                  {
                    label: "Activation Range",
                    value: activationRange
                      ? `${activationRange.minimum} km - ${activationRange.maximum} km`
                      : "Not available",
                  },
                ].map((detail) => (
                  <div
                    key={detail.label}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {detail.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                      {detail.value || "Not specified"}
                    </p>
                  </div>
                ))}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4 md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                    Odometer Reading (km)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g., 12000"
                    value={odometerReading}
                    onChange={(e) =>
                      setOdometerReading(
                        sanitizeNonNegativeNumber(e.target.value),
                      )
                    }
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  />
                </div>
              </div>
            </section>
          ) : (
            <>
          {/* Vehicle Information */}
          <section className="space-y-4 border-b border-[var(--color-border)] pb-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl border border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10 p-2 text-[#0369a1]">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Vehicle Information</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  VEHICLE
                </label>
                <DropdownSelect
                    label="Vehicle"
                    value={vehicleId}
                    onChange={(value) => {
                      const nextVehicleId = value;
                      const selectedVehicle = vehicles.find(
                        (vehicle) => vehicle.value === nextVehicleId,
                      );
                      setVehicleId(nextVehicleId);
                      setOdometerReading(
                        selectedVehicle?.odometer !== undefined
                          ? String(selectedVehicle.odometer)
                          : "",
                      );
                    }}
                    options={
                      availableVehicles.length > 0
                        ? [
                            { value: "", label: "Select vehicle", disabled: true },
                            ...availableVehicles.map((vehicle) => ({
                              value: vehicle.value,
                              label: vehicle.label,
                            })),
                          ]
                        : [{ value: "", label: "No vehicles available", disabled: true }]
                    }
                  />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                    ODOMETER READING (km)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g., 12000"
                    value={odometerReading}
                    onChange={(e) =>
                      setOdometerReading(
                        sanitizeNonNegativeNumber(e.target.value),
                      )
                    }
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  />
                </div>
              </div>

              <div className="col-start-2 row-start-1">
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  GARAGE
                </label>
                <DropdownSelect
                    label="Garage"
                    value={garageIsOther ? OTHER_GARAGE_VALUE : garageId}
                    onChange={(value) => {
                      if (value === OTHER_GARAGE_VALUE) {
                        setGarageId("");
                        setIsOtherGarage(true);
                        return;
                      }

                      setGarageId(value);
                      setIsOtherGarage(false);
                      setOtherGarage("");
                    }}
                    options={[
                      { value: "", label: "Select garage", disabled: true },
                      ...garages.map((g) => ({ value: g.id, label: g.name })),
                      { value: OTHER_GARAGE_VALUE, label: "Other" },
                    ]}
                  />
                {garageIsOther ? (
                  <input
                    type="text"
                    value={otherGarageValue}
                    onChange={(e) => setOtherGarage(e.target.value)}
                    placeholder="Enter garage"
                    className="mt-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  />
                ) : null}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  ACCOUNT TYPE
                </label>
                <DropdownSelect
                    label="Account type"
                    value={accountType}
                    onChange={(value) => {
                      setAccountType(value as AccountType);
                      if (value !== AccountType.OUTSOURCED) {
                        setOutsourcedProvider("");
                      }
                    }}
                    options={[
                      { value: "", label: "Select account type", disabled: true },
                      ...ACCOUNT_TYPE_OPTIONS.map((option) => ({
                        value: option,
                        label: accountTypeLabels[option],
                      })),
                    ]}
                  />
              </div>

              {accountType === AccountType.OUTSOURCED ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                    ACCREDITED SERVICE PROVIDER
                  </label>
                  <DropdownSelect
                    label="Accredited service provider"
                    value={outsourcedProvider}
                    onChange={setOutsourcedProvider}
                    options={[
                      { value: "", label: "Select accredited provider", disabled: true },
                      ...ACCREDITED_SERVICE_PROVIDERS.map((provider) => ({
                        value: provider,
                        label: provider,
                      })),
                    ]}
                  />
                  <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                    Outsourced maintenance is tracked against the selected accredited provider for review and completion documentation.
                  </p>
                </div>
              ) : null}

            </div>
          </section>

          {/* Schedule Trigger */}
          <section className="space-y-4 border-b border-[var(--color-border)] pb-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl border border-violet-400/30 bg-violet-400/10 p-2 text-violet-700">
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Schedule Trigger</h3>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap gap-3">
              {(
                [
                  { value: MaintenanceTriggerType.ODOMETER, label: "Odometer-Based" },
                  { value: MaintenanceTriggerType.TIME, label: maintenanceTriggerTypeLabels[MaintenanceTriggerType.TIME] },
                  { value: MaintenanceTriggerType.MANUAL, label: maintenanceTriggerTypeLabels[MaintenanceTriggerType.MANUAL] },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    triggerType === option.value
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] shadow-[0_10px_24px_rgba(47,124,255,0.14)]"
                      : "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)]/50 hover:bg-[var(--color-card-bg-hover)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="trigger"
                    value={option.value}
                    checked={triggerType === option.value}
                    onChange={() => setTriggerType(option.value)}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      triggerType === option.value
                        ? "border-[var(--color-brand-primary)] bg-white"
                        : "border-[var(--color-border)] bg-[var(--color-input-bg)] group-hover:border-[var(--color-brand-primary)]/60"
                    }`}
                  >
                    {triggerType === option.value ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-brand-primary)]" />
                    ) : null}
                  </span>
                  {option.label}
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start mb-4">
              <div
                className="flex h-full flex-col"
                onPointerDownCapture={() => {
                  if (triggerType === MaintenanceTriggerType.TIME) {
                    notifyDisabledField("Interval is disabled for time-based schedules because distance rules do not apply.");
                  }
                }}
              >
                <label className="mb-1.5 min-h-[2.2rem] text-sm font-medium text-[var(--color-text-secondary)]">
                  INTERVAL (km)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g., 5000"
                  value={intervalKm}
                  onChange={(e) =>
                    setIntervalKm(sanitizeNonNegativeNumber(e.target.value))
                  }
                  disabled={triggerType === MaintenanceTriggerType.TIME}
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === MaintenanceTriggerType.TIME
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
              </div>
              <div
                className="flex h-full flex-col"
                onPointerDownCapture={() => {
                  if (triggerType === MaintenanceTriggerType.TIME) {
                    notifyDisabledField("Buffer distance is disabled for time-based schedules because odometer activation is not used.");
                  }
                }}
              >
                <label className="mb-1.5 min-h-[2.2rem] text-sm font-medium text-[var(--color-text-secondary)]">
                  BUFFER DISTANCE(km)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g., 500"
                  value={bufferDistanceKm}
                  onChange={(e) =>
                    setBufferDistanceKm(
                      sanitizeNonNegativeNumber(e.target.value),
                    )
                  }
                  disabled={triggerType === MaintenanceTriggerType.TIME}
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === MaintenanceTriggerType.TIME
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
              </div>
              <div
                className="flex h-full flex-col"
                onPointerDownCapture={() => {
                  if (triggerType === MaintenanceTriggerType.TIME) {
                    notifyDisabledField("Starting reference reading is disabled for time-based schedules because mileage is not used.");
                  }
                }}
              >
                <label className="mb-1.5 min-h-[2.2rem] text-sm font-medium leading-tight text-[var(--color-text-secondary)]">
                  STARTING REFERENCE READING(km)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g., 12000"
                  value={startingReferenceReadingKm}
                  onChange={(e) =>
                    setStartingReferenceReadingKm(
                      sanitizeNonNegativeNumber(e.target.value),
                    )
                  }
                  disabled={triggerType === MaintenanceTriggerType.TIME}
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === MaintenanceTriggerType.TIME
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div
                onPointerDownCapture={() => {
                  if (triggerType === MaintenanceTriggerType.ODOMETER) {
                    notifyDisabledField("Interval type is disabled for odometer-based schedules because mileage rules determine activation.");
                  }
                }}
              >
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  INTERVAL TYPE
                </label>
                <div
                  className="relative"
                  onPointerDownCapture={() => {
                    if (isTemplatesLoading) {
                      notifyDisabledField("Checklist templates are disabled while checklist templates are loading.");
                    }
                  }}
                >
                  <DropdownSelect
                    label="Interval type"
                    disabled={triggerType === MaintenanceTriggerType.ODOMETER}
                    value={intervalTypeState}
                    onChange={(value) =>
                      setIntervalTypeState(value as MaintenanceIntervalType | "")
                    }
                    buttonClassName={`${
                      triggerType === MaintenanceTriggerType.ODOMETER
                        ? "bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]"
                        : ""
                    }`}
                    options={[
                      { value: "", label: "Select type", disabled: true },
                      ...Object.values(MaintenanceIntervalType).map((option) => ({
                        value: option,
                        label: maintenanceIntervalTypeLabels[option],
                      })),
                    ]}
                  />
                </div>
              </div>
              <div
                onPointerDownCapture={() => {
                  if (triggerType === MaintenanceTriggerType.ODOMETER) {
                    notifyDisabledField("Start reference date is disabled for odometer-based schedules because mileage rules determine activation.");
                  }
                }}
              >
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  START REFERENCE DATE
                </label>
                <DatePicker
                  value={startReferenceDate}
                  onChange={setStartReferenceDate}
                  disabled={triggerType === MaintenanceTriggerType.ODOMETER}
                  placeholder="YYYY-MM-DD"
                />
              </div>
            </div>
          </section>

          {/* Maintenance Details */}
          <section className="space-y-4 border-b border-[var(--color-border)] pb-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Maintenance Details</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  CHECKLIST TEMPLATE
                </label>
                <div className="relative">
                  <DropdownSelect
                    label="Checklist template"
                    value={checklistTemplate}
                    disabled={isTemplatesLoading}
                    onChange={(value) => setChecklistTemplateName(value as ChecklistTemplateName)}
                    options={[
                      {
                        value: "",
                        label: isTemplatesLoading
                          ? "Loading templates..."
                          : selectableTemplateNames.length === 0
                            ? "No templates with checklist items available"
                            : "Select a checklist template",
                        disabled: true,
                      },
                      ...(checklistTemplate && !templateExists
                        ? [{ value: checklistTemplate, label: checklistTemplate }]
                        : []),
                      ...(Object.keys(templates) as ChecklistTemplateName[]).map((type) => {
                        const hasChecklistItems = selectableTemplateNames.includes(type);
                        return {
                          value: type,
                          label: `${type}${hasChecklistItems ? "" : " (No checklist items)"}`,
                          disabled: !hasChecklistItems,
                        };
                      }),
                    ]}
                  />
                </div>
              </div>
              <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                ASSIGNED MECHANIC
              </label>
              <div
                className="relative"
                onPointerDownCapture={() => {
                  if (mechanics.length === 0 && !assignedMechanic) {
                    notifyDisabledField("Assigned mechanic is disabled because no mechanic users are available.");
                  }
                }}
              >
                <DropdownSelect
                  label="Assigned mechanic"
                  value={assignedMechanic}
                  disabled={mechanics.length === 0 && !assignedMechanic}
                  onChange={setAssignedMechanic}
                  options={
                    mechanics.length > 0 || assignedMechanic
                      ? [
                          { value: "", label: "Select mechanic", disabled: true },
                          ...(assignedMechanic && !mechanicExists
                            ? [{ value: assignedMechanic, label: assignedMechanic }]
                            : []),
                          ...mechanics.map((mechanic) => ({
                            value: mechanic.name,
                            label: mechanic.name,
                          })),
                        ]
                      : [{ value: "", label: "No mechanics available", disabled: true }]
                  }
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>
            </div>
          </section>

          {/* Work Order Checklist Preview */}
          <section className="space-y-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl border border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10 p-2 text-[#0369a1]">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Work Order Checklist Preview</h3>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
                Work Order Checklist
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                This work order checklist template will be attached to the work
                order based on the selected Checklist Template (
                {checklistTemplate || "No template selected"}
                ).
              </p>
              <div className="space-y-2">
                {Object.prototype.hasOwnProperty.call(
                  templates,
                  checklistTemplate,
                ) && templates[checklistTemplate]?.length > 0 ? (
                  templates[checklistTemplate].map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="w-5 h-5 shrink-0 rounded border border-[var(--color-border)] bg-slate-800 flex items-center justify-center mt-0.5" />
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {item.text}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-secondary)] italic">
                    No checklist items defined for this type.
                  </p>
                )}
              </div>
            </div>
          </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSchedule}
            disabled={isSaving || !isFormComplete}
            className="btn-primary"
          >
            {isSaving ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>

      {duplicateSchedule ? (
        <div className="modal-overlay z-[60]">
          <div className="modal-content w-full max-w-lg p-6">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              Existing Maintenance Schedule
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              A schedule already exists for{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {duplicateSchedule.vehicleId}
              </span>{" "}
              using{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {duplicateSchedule.title}
              </span>{" "}
              on{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {duplicateSchedule.date}
              </span>
              .
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDuplicateSchedule(null);
                  onClose();
                }}
                disabled={isSaving}
                className="rounded-xl px-4 py-2 text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDuplicateSchedule(null)}
                disabled={isSaving}
                className="rounded-xl px-4 py-2 text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-card-bg-hover)] disabled:opacity-50"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => void saveSchedule(duplicateSchedule)}
                disabled={isSaving}
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90 disabled:opacity-50"
              >
                {isSaving ? "Replacing..." : "Replace"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
