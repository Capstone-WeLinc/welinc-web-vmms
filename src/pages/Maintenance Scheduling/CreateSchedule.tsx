import { useEffect, useState } from "react";
import { useAuthStore } from "../../store/authStore";
import { canManageSchedules } from "../../lib/utils/permissions";
import { philippineToday } from "../../lib/utils/scheduleStartDate";
import { scheduleMileageError } from "../../lib/utils/scheduleMileage";
import {
  timeIntervalFields,
  timeIntervalError,
  timeIntervalReferenceDate,
} from "../../lib/utils/timeInterval";
import {
  X,
  ClipboardCheck,
  Wrench,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { SearchableSelect, ToastNotification } from "../../components/ui";
import {
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  getChecklistTemplates,
  getChecklistTemplateId,
} from "../../lib/api/maintenanceService";
import { getOutsourcedProviders, getUsers, type OutsourcedProviderRecord, type UserRecord } from "../../lib/api/vmmsApi";
import {
  getGarages,
} from "../../lib/api/locationService";
import {
  getVehicles,
  getVehicleMaintenanceDefaults,
  type VehicleOption,
  type VehicleMaintenanceDefaults,
} from "../../lib/api/vehicleService";
import { useBodyScrollLock } from "../../lib/hooks/useBodyScrollLock";
import {
  AccountType,
  accountTypeLabels,
  MaintenancePriority,
  maintenancePriorityLabels,
  MaintenanceStatus,
  MaintenanceTriggerType,
  maintenanceTriggerTypeLabels,
  type MaintenanceTask,
} from "../../types/maintenance";

type ChecklistTemplateName = string;

interface ChecklistItemTemplate {
  id: string;
  text: string;
}

const NON_NEGATIVE_NUMBER_PATTERN = /^\d+$/;
const ACCOUNT_TYPE_OPTIONS = [
  AccountType.IN_HOUSE,
  AccountType.OUTSOURCED,
] as const;

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
  existingSchedules,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  editingTask?: MaintenanceTask;
  existingSchedules: MaintenanceTask[];
  onClose: () => void;
  onSaved?: (task: MaintenanceTask) => void | Promise<void>;
}) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const canSchedule = canManageSchedules(currentUser);
  const [checklistTemplate, setChecklistTemplateName] =
    useState<ChecklistTemplateName>("");
  const [templates, setTemplates] = useState<
    Record<ChecklistTemplateName, ChecklistItemTemplate[]>
  >({});
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [vehicleId, setVehicleId] = useState("");
  const [targetDueDate, setTargetDueDate] = useState('');
  const [assignedMechanic, setAssignedMechanic] = useState("");
  const [mechanics, setMechanics] = useState<UserRecord[]>([]);
  const [chiefMechanicId, setChiefMechanicId] = useState("");
  const [chiefMechanic, setChiefMechanic] = useState("");
  const [chiefMechanics, setChiefMechanics] = useState<UserRecord[]>([]);
  const [isChiefMechanicsLoading, setIsChiefMechanicsLoading] = useState(true);
  const [garages, setGarages] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [accountType, setAccountType] = useState<AccountType | "">("");
  const [priority, setPriority] = useState<MaintenancePriority>(MaintenancePriority.MEDIUM);
  const [outsourcedProvider, setOutsourcedProvider] = useState("");
  const [outsourcedProviders, setOutsourcedProviders] = useState<OutsourcedProviderRecord[]>([]);
  const [systemAffected, setSystemAffected] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [intervalKm, setIntervalKm] = useState("");
  const [bufferDistanceKm, setBufferDistanceKm] = useState("");
  const [startingReferenceReadingKm, setStartingReferenceReadingKm] =
    useState("");
  const [odometerMileageMode, setOdometerMileageMode] = useState<
    "DEFAULT" | "CUSTOM"
  >("CUSTOM");
  const [odometerMileageModeTouched, setOdometerMileageModeTouched] =
    useState(false);
  const [vehicleMaintenanceDefaults, setVehicleMaintenanceDefaults] =
    useState<VehicleMaintenanceDefaults | null>(null);
  const [maintenanceDefaultsLoading, setMaintenanceDefaultsLoading] =
    useState(false);
  const [maintenanceDefaultsError, setMaintenanceDefaultsError] = useState("");
  const [timeIntervalValue, setTimeIntervalValue] = useState('3');
  const [timeIntervalUnit, setTimeIntervalUnit] = useState<'DAYS' | 'MONTHS'>('MONTHS');
  const [triggerType, setTriggerType] = useState<
    MaintenanceTriggerType
  >(MaintenanceTriggerType.ODOMETER);
  const [notes, setNotes] = useState("");

  useBodyScrollLock(isOpen && canSchedule);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);
  const [duplicateSchedule, setDuplicateSchedule] =
    useState<MaintenanceTask | null>(null);

  useEffect(() => {
    getOutsourcedProviders().then(setOutsourcedProviders).catch(() => setOutsourcedProviders([]));
  }, []);

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
        setMechanics(users.filter((u) => u.role === "MECHANIC"));
        setChiefMechanics(users.filter((u) => u.role === "CHIEF_MECHANIC"));
      })
      .catch(() => {
        console.error("Failed to load users");
      })
      .finally(() => setIsChiefMechanicsLoading(false));

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
          setOdometerMileageMode("CUSTOM");
          setOdometerMileageModeTouched(true);
          setVehicleId(editingTask.vehicleId);
          setTargetDueDate(editingTask.targetDueDate ?? editingTask.dueDate ?? '');
          setChecklistTemplateName(editingTask.title);
          setAssignedMechanic(editingTask.assignedDriver ?? "");
          setChiefMechanicId(editingTask.chiefMechanicId ?? "");
          setChiefMechanic(editingTask.chiefMechanic ?? "");
          setNotes(editingTask.notes ?? "");
          setAccountType(
            editingTask.accountType &&
            ACCOUNT_TYPE_OPTIONS.includes(editingTask.accountType)
              ? (editingTask.accountType ?? "")
              : "",
          );
          setPriority(editingTask.priority ?? MaintenancePriority.MEDIUM);
          setOutsourcedProvider(editingTask.outsourcedProvider ?? "");
          setSystemAffected(editingTask.systemAffected ?? "");
          setOdometerReading(editingTask.odometerReading ?? "");
          setTriggerType(editingTask.triggerType ?? MaintenanceTriggerType.ODOMETER);
          setIntervalKm(editingTask.intervalKm ?? "");
          setBufferDistanceKm(editingTask.bufferDistanceKm ?? "");
          setStartingReferenceReadingKm(
            editingTask.startingReferenceReadingKm ?? "",
          );

          const interval = timeIntervalFields(editingTask);
          setTimeIntervalValue(String(interval.value));
          setTimeIntervalUnit(interval.unit);

        } else {
          // Reset all fields for new schedule
          setOdometerMileageMode("DEFAULT");
          setOdometerMileageModeTouched(false);
          setTargetDueDate('');
          setVehicleId("");
          setChecklistTemplateName("");
          setAssignedMechanic("");
          setChiefMechanicId("");
          setChiefMechanic("");
          setNotes("");
          setAccountType("");
          setPriority(MaintenancePriority.MEDIUM);
          setOutsourcedProvider("");
          setSystemAffected("");
          setOdometerReading("");
          setTriggerType(MaintenanceTriggerType.ODOMETER);
          setIntervalKm("");
          setBufferDistanceKm("");
          setStartingReferenceReadingKm("");
          setTimeIntervalValue('3');
          setTimeIntervalUnit('MONTHS');
        }
        setVehicleMaintenanceDefaults(null);
        setMaintenanceDefaultsError("");
      });
    }
  }, [isOpen, editingTask]);

  useEffect(() => {
    if (!isOpen) return;
    if (triggerType !== MaintenanceTriggerType.ODOMETER) {
      const frame = requestAnimationFrame(() =>
        setMaintenanceDefaultsLoading(false),
      );
      return () => cancelAnimationFrame(frame);
    }

    let active = true;
    const frame = requestAnimationFrame(() => {
      setVehicleMaintenanceDefaults(null);
      setMaintenanceDefaultsError("");
      if (!vehicleId || !checklistTemplate) {
        setMaintenanceDefaultsLoading(false);
        return;
      }

      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.value === vehicleId,
      );
      if (!selectedVehicle?.id) {
        setMaintenanceDefaultsLoading(false);
        setOdometerMileageMode("CUSTOM");
        setMaintenanceDefaultsError(
          "Vehicle defaults are unavailable. Enter custom interval and buffer values.",
        );
        return;
      }

      setMaintenanceDefaultsLoading(true);
      getVehicleMaintenanceDefaults(selectedVehicle.id)
        .then((defaults) => {
          if (!active) return;
          setVehicleMaintenanceDefaults(defaults);
          const category = defaults.categories.find(
            (item) =>
              item.type.trim().toLowerCase() ===
              checklistTemplate.trim().toLowerCase(),
          );
          const hasCategoryOverride =
            category?.intervalKm != null &&
            category.bufferDistanceKm != null;
          const intervalKm = hasCategoryOverride
            ? category.intervalKm
            : defaults.baseIntervalKm;
          const bufferDistanceKm = hasCategoryOverride
            ? category.bufferDistanceKm
            : defaults.baseBufferDistanceKm;
          if (intervalKm != null && bufferDistanceKm != null) {
            if (!odometerMileageModeTouched) {
              setOdometerMileageMode("DEFAULT");
              setIntervalKm(String(intervalKm));
              setBufferDistanceKm(String(bufferDistanceKm));
            }
          } else {
            setOdometerMileageMode("CUSTOM");
          }
        })
        .catch((error: unknown) => {
          if (!active) return;
          setOdometerMileageMode("CUSTOM");
          setMaintenanceDefaultsError(
            error instanceof Error
              ? error.message
              : "Could not load vehicle maintenance defaults.",
          );
        })
        .finally(() => {
          if (active) setMaintenanceDefaultsLoading(false);
        });
    });

    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [
    isOpen,
    triggerType,
    vehicleId,
    checklistTemplate,
    vehicles,
    odometerMileageModeTouched,
  ]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const notifyDisabledField = (message: string) => {
    setToast({ type: "info", message });
  };

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.value === vehicleId,
  );
  const selectedGarageId = selectedVehicle
    ? selectedVehicle.branchGarageId ?? null
    : editingTask?.vehicleId === vehicleId
      ? editingTask.garageId ?? null
      : null;
  const selectedGarageName = selectedGarageId
    ? garages.find((garage) => garage.id === selectedGarageId)?.name ??
      selectedGarageId
    : vehicleId
      ? "Unassigned"
      : "Select a vehicle";
  const selectableTemplateNames = Object.entries(templates)
    .filter(([, items]) => items.some((item) => item.text.trim() !== ""))
    .map(([templateName]) => templateName);
  const isSelectedTemplateUsable =
    selectableTemplateNames.includes(checklistTemplate);
  const categoryMaintenanceDefault =
    vehicleMaintenanceDefaults?.categories.find(
      (item) =>
        item.type.trim().toLowerCase() ===
        checklistTemplate.trim().toLowerCase(),
    );
  const categoryIntervalKm = categoryMaintenanceDefault?.intervalKm;
  const categoryBufferDistanceKm =
    categoryMaintenanceDefault?.bufferDistanceKm;
  const resolvedMaintenanceDefault =
    categoryIntervalKm != null && categoryBufferDistanceKm != null
      ? {
          intervalKm: categoryIntervalKm,
          bufferDistanceKm: categoryBufferDistanceKm,
          source: "Checklist type override",
        }
      : vehicleMaintenanceDefaults?.baseIntervalKm != null &&
          vehicleMaintenanceDefaults.baseBufferDistanceKm != null
        ? {
            intervalKm: vehicleMaintenanceDefaults.baseIntervalKm,
            bufferDistanceKm:
              vehicleMaintenanceDefaults.baseBufferDistanceKm,
            source: "Vehicle base default",
          }
        : null;
  const effectiveIntervalKm =
    triggerType === MaintenanceTriggerType.ODOMETER &&
    odometerMileageMode === "DEFAULT" && resolvedMaintenanceDefault
      ? String(resolvedMaintenanceDefault.intervalKm)
      : intervalKm;
  const effectiveBufferDistanceKm =
    triggerType === MaintenanceTriggerType.ODOMETER &&
    odometerMileageMode === "DEFAULT" && resolvedMaintenanceDefault
      ? String(resolvedMaintenanceDefault.bufferDistanceKm)
      : bufferDistanceKm;
  const odometerDefaultsError =
    triggerType === MaintenanceTriggerType.ODOMETER &&
    vehicleId &&
    checklistTemplate &&
    odometerMileageMode === "DEFAULT" &&
    !maintenanceDefaultsLoading &&
    !resolvedMaintenanceDefault
      ? maintenanceDefaultsError ||
        "No default is configured. Choose Custom and enter an interval and buffer."
      : "";
  const internalStartDate = editingTask?.startDate || philippineToday();
  const requiredFieldValues = [
    vehicleId,
    targetDueDate,
    odometerReading,
    accountType,
    ...(accountType === AccountType.OUTSOURCED ? [outsourcedProvider] : []),
    checklistTemplate,
    assignedMechanic,
    ...(triggerType !== MaintenanceTriggerType.TIME
      ? [
          effectiveIntervalKm,
          effectiveBufferDistanceKm,
          startingReferenceReadingKm,
        ]
      : []),
    ...(triggerType !== MaintenanceTriggerType.ODOMETER
      ? [timeIntervalValue, timeIntervalUnit]
      : []),
  ];
  const targetDueDateError = !targetDueDate
    ? 'Due date is required.'
    : targetDueDate < internalStartDate
      ? 'Due date cannot be earlier than the schedule start date.'
      : '';
  const mileageError = odometerDefaultsError || scheduleMileageError({
    vehicleId, title: checklistTemplate, triggerType, odometerReading,
    intervalKm:
      triggerType === MaintenanceTriggerType.TIME ? "" : effectiveIntervalKm,
    bufferDistanceKm:
      triggerType === MaintenanceTriggerType.TIME
        ? ""
        : effectiveBufferDistanceKm,
    startingReferenceReadingKm: triggerType === MaintenanceTriggerType.TIME ? '' : startingReferenceReadingKm,
  }, vehicles.find((vehicle) => vehicle.value === vehicleId)?.odometer, editingTask);
  const startingReferenceReadingError = mileageError ===
    'A non-negative starting reference reading is required for odometer scheduling.'
    ? mileageError
    : '';
  const maintenanceIntervalError = mileageError === 'Maintenance interval must be greater than zero.'
    ? mileageError
    : '';
  const intervalError = triggerType === MaintenanceTriggerType.TIME ? timeIntervalError(timeIntervalValue, timeIntervalUnit) : '';
  const isFormComplete =
    !targetDueDateError &&
    !mileageError &&
    !maintenanceDefaultsLoading &&
    !intervalError &&
    requiredFieldValues.every((value) => value.trim().length > 0) &&
    isSelectedTemplateUsable &&
    [
      odometerReading,
      ...(triggerType !== MaintenanceTriggerType.TIME
        ? [
            effectiveIntervalKm,
            effectiveBufferDistanceKm,
            startingReferenceReadingKm,
          ]
        : []),
    ].every((value) => NON_NEGATIVE_NUMBER_PATTERN.test(value.trim()));

  const saveSchedule = async () => {
    if (!canSchedule) return;
    if (targetDueDateError) { setToast({ type: 'error', message: targetDueDateError }); return; }
    if (maintenanceDefaultsLoading) {
      setToast({ type: "error", message: "Wait for vehicle defaults to finish loading." });
      return;
    }
    if (mileageError) { setToast({ type: 'error', message: mileageError }); return; }
    if (intervalError) { setToast({ type: 'error', message: intervalError }); return; }
    const isTimeBased = triggerType === MaintenanceTriggerType.TIME;
    const submittedStartReferenceDate = isTimeBased
      ? timeIntervalReferenceDate(
          targetDueDate,
          timeIntervalValue,
          timeIntervalUnit,
        )
      : "";
    if (isTimeBased && !submittedStartReferenceDate) {
      setToast({
        type: "error",
        message: "The reference date could not be calculated. Check Due Date and the time interval.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const checklistTemplateId = await getChecklistTemplateId(checklistTemplate);
      const selectedMechanic = mechanics.find(
        (mechanic) => mechanic.name === assignedMechanic,
      );
      const selectedChiefMechanic = chiefMechanics.find(
        (cm) => cm.id === chiefMechanicId || cm.name === chiefMechanic,
      );
      const resolvedChiefMechanicId = selectedChiefMechanic?.id || (chiefMechanicId ? chiefMechanicId : undefined);
      const resolvedChiefMechanicName = selectedChiefMechanic?.name || (chiefMechanic ? chiefMechanic : undefined);

      const timeConfig = isTimeBased ? { timeIntervalValue: Number(timeIntervalValue), timeIntervalUnit } : {};
      const submittedIntervalKm = isTimeBased ? "" : effectiveIntervalKm;
      const submittedBufferDistanceKm = isTimeBased
        ? ""
        : effectiveBufferDistanceKm;
      const submittedStartingReferenceReadingKm = isTimeBased
        ? ""
        : startingReferenceReadingKm;

      if (editingTask) {
        const targetSchedule = editingTask;

        const updated: MaintenanceTask = {
          ...targetSchedule,
          vehicleId,
          startDate: internalStartDate,
          targetDueDate,
          title: checklistTemplate,
          checklistTemplateId,
          assignedDriver: assignedMechanic,
          assignedMechanicId: selectedMechanic?.id,
          assignedMechanicEmail: selectedMechanic?.email,
          chiefMechanicId: resolvedChiefMechanicId,
          chiefMechanic: resolvedChiefMechanicName,
          notes,
          garageId: selectedGarageId,
          accountType: accountType || undefined,
          priority,
          outsourcedProvider:
            accountType === AccountType.OUTSOURCED ? outsourcedProvider.trim() : "",
          systemAffected,
          odometerReading,
          triggerType,
          useVehicleDefaults:
            triggerType === MaintenanceTriggerType.ODOMETER &&
            odometerMileageMode === "DEFAULT",
          startReferenceDate: submittedStartReferenceDate,
          intervalKm: submittedIntervalKm,
          bufferDistanceKm: submittedBufferDistanceKm,
          startingReferenceReadingKm: submittedStartingReferenceReadingKm,
          ...timeConfig,
        };
        const saved = await updateMaintenanceSchedule(updated);
        await onSaved?.(saved);
      } else {
        const task = await createMaintenanceSchedule({
          startDate: internalStartDate,
          targetDueDate,
          vehicleId,
          title: checklistTemplate,
          checklistTemplateId,
          status: MaintenanceStatus.PENDING,
          date: getTodayDateText(),
          assignedDriver: assignedMechanic,
          assignedMechanicId: selectedMechanic?.id,
          assignedMechanicEmail: selectedMechanic?.email,
          chiefMechanicId: resolvedChiefMechanicId,
          chiefMechanic: resolvedChiefMechanicName,
          notes,
          garageId: selectedGarageId,
          accountType: accountType || undefined,
          priority,
          outsourcedProvider:
            accountType === AccountType.OUTSOURCED ? outsourcedProvider.trim() : "",
          systemAffected,
          odometerReading,
          triggerType,
          useVehicleDefaults:
            triggerType === MaintenanceTriggerType.ODOMETER &&
            odometerMileageMode === "DEFAULT",
          startReferenceDate: submittedStartReferenceDate,
          intervalKm: submittedIntervalKm,
          bufferDistanceKm: submittedBufferDistanceKm,
          startingReferenceReadingKm: submittedStartingReferenceReadingKm,
          ...timeConfig,
        });
        await onSaved?.(task);
      }

      // Reset form state
      setTargetDueDate('');
      setVehicleId("");
      setChecklistTemplateName("");
      setAssignedMechanic("");
      setChiefMechanicId("");
      setChiefMechanic("");
      setNotes("");
      setAccountType("");
      setPriority(MaintenancePriority.MEDIUM);
      setOutsourcedProvider("");
      setSystemAffected("");
      setOdometerReading("");
      setTriggerType(MaintenanceTriggerType.ODOMETER);
      setIntervalKm("");
      setBufferDistanceKm("");
      setStartingReferenceReadingKm("");
      setTimeIntervalValue('3');
      setTimeIntervalUnit('MONTHS');
      setDuplicateSchedule(null);

      onClose();
    } catch (error) {
      console.error("Failed to save schedule", error);
      setToast({ type: "error", message: error instanceof Error ? error.message : "Schedule was not saved. Refresh and try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!isFormComplete) return;

    // The server also checks persisted Pending status (display status may be
    // calculated as Due Soon/Overdue) and protects against concurrent saves.
    const duplicate = editingTask && editingTask.status !== MaintenanceStatus.PENDING
      ? null
      : existingSchedules.find(
      (schedule) =>
        schedule.status === MaintenanceStatus.PENDING &&
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
    (vehicle) =>
      (vehicle.status ?? "AVAILABLE").trim().toUpperCase() === "AVAILABLE" ||
      vehicle.value === editingTask?.vehicleId,
  );
  const templateExists = Object.prototype.hasOwnProperty.call(
    templates,
    checklistTemplate,
  );
  const mechanicExists = mechanics.some((m) => m.name === assignedMechanic);
  const modalTitle = editingTask
    ? "EDIT MAINTENANCE SCHEDULE"
    : "CREATE MAINTENANCE SCHEDULE";
  const modalSubtitle = editingTask
    ? "Update schedule details, trigger rules, assignment, and checklist template."
    : "Set up a new maintenance schedule with vehicle, trigger, assignment, and checklist details.";
  const submitLabel = editingTask ? "Update Schedule" : "Create Schedule";

  /*
  const renderCalendar = (
    calendarDate: Date,
    onDaySelect: (value: string) => void,
    onNavigate: (monthOffset: number) => void,
  ) => {
    const { year, month, firstDayOfWeek, daysInMonth } =
      getCalendarDays(calendarDate);

    return (
      <div className="card-base w-72">
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
  if (!isOpen || !canSchedule) return null;

  return (
    <div className="modal-overlay p-4 backdrop-blur-sm">
      <div className="fixed right-6 top-6 z-[80] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>
      <div className="modal-content max-w-6xl w-full rounded-[30px] flex flex-col max-h-[92vh] overflow-hidden">
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
          <section>
            <label htmlFor="schedule-due-date" className="mb-1.5 block text-sm font-medium">Due Date (required)</label>
            <input id="schedule-due-date" type="date" required value={targetDueDate}
              min={internalStartDate}
              onChange={(event) => setTargetDueDate(event.target.value)}
              aria-invalid={Boolean(targetDueDateError)} aria-describedby="schedule-due-date-error"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3" />
            {targetDueDateError && <p id="schedule-due-date-error" role="alert" className="mt-1 text-sm text-red-600">{targetDueDateError}</p>}
          </section>
          <section>
            <label htmlFor="schedule-priority" className="mb-1.5 block text-sm font-medium">Work-order priority</label>
            <select
              id="schedule-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as MaintenancePriority)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3"
            >
              {Object.values(MaintenancePriority).map((value) => (
                <option key={value} value={value}>{maintenancePriorityLabels[value]}</option>
              ))}
            </select>
          </section>
          {mileageError && !startingReferenceReadingError && !maintenanceIntervalError && <p role="alert" className="text-sm text-red-600">{mileageError}</p>}
          {intervalError && <p role="alert" className="text-sm text-red-600">{intervalError}</p>}
          {/* Vehicle Information */}
          <section className="space-y-4 border-b border-[var(--color-border)] pb-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10 p-2 text-[#0369a1]">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Vehicle Information</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="schedule-vehicle" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  VEHICLE
                </label>
                <SearchableSelect
                    id="schedule-vehicle"
                    options={availableVehicles.map((vehicle) => ({
                      value: vehicle.value,
                      label: vehicle.label,
                    }))}
                    value={vehicleId}
                    onChange={(nextVehicleId) => {
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
                    placeholder={
                      availableVehicles.length > 0
                        ? "Search registered vehicles"
                        : "No vehicles available"
                    }
                    disabled={availableVehicles.length === 0}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                    ODOMETER READING (km)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g., 12000"
                    value={odometerReading}
                    onChange={(e) =>
                      setOdometerReading(
                        e.target.value,
                      )
                    }
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  />
                </div>
              </div>

              <div className="col-start-2 row-start-1">
                <label
                  htmlFor="schedule-garage"
                  className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  GARAGE (ASSIGNED TO VEHICLE)
                </label>
                <input
                  id="schedule-garage"
                  readOnly
                  value={selectedGarageName}
                  aria-describedby="schedule-garage-help"
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                />
                <p
                  id="schedule-garage-help"
                  className="mt-1 text-xs text-[var(--color-text-secondary)]"
                >
                  Garage assignment comes from the vehicle record.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                  ACCOUNT TYPE
                </label>
                <div className="relative">
                  <select
                    value={accountType}
                    onChange={(e) => {
                      setAccountType(e.target.value as AccountType);
                      if (e.target.value !== AccountType.OUTSOURCED) {
                        setOutsourcedProvider("");
                      }
                    }}
                    className="select-control w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  >
                    <option value="" disabled>
                      Select account type
                    </option>
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {accountTypeLabels[option]}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {accountType === AccountType.OUTSOURCED ? (
                <div>
                  <label htmlFor="schedule-provider" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                    OUTSOURCED COMPANY / SERVICE PROVIDER
                  </label>
                  <SearchableSelect
                    id="schedule-provider"
                    options={outsourcedProviders
                      .filter((provider) => provider.isActive || provider.name === outsourcedProvider)
                      .map((provider) => ({
                        value: provider.name,
                        label: `${provider.name}${provider.isActive ? "" : " (inactive)"}`,
                      }))}
                    value={outsourcedProvider}
                    onChange={setOutsourcedProvider}
                    placeholder="Search registered providers"
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  />
                  {outsourcedProviders.filter((provider) => provider.isActive).length === 0 && (
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Operations must register an active provider before outsourced work can be scheduled.</p>
                  )}
                </div>
              ) : null}

            </div>
          </section>

          {/* Schedule Trigger */}
          <section className="space-y-4 border-b border-[var(--color-border)] pb-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-violet-400/30 bg-violet-400/10 p-2 text-violet-700">
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
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]"
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

            {triggerType === MaintenanceTriggerType.ODOMETER && (
              <fieldset className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
                <legend className="px-1 text-sm font-bold text-[var(--color-text-primary)]">
                  Interval and buffer source
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      odometerMileageMode === "DEFAULT"
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5"
                        : "border-[var(--color-border)]"
                    } ${
                      resolvedMaintenanceDefault
                        ? "cursor-pointer"
                        : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="odometer-mileage-mode"
                      value="DEFAULT"
                      checked={odometerMileageMode === "DEFAULT"}
                      disabled={
                        maintenanceDefaultsLoading ||
                        !resolvedMaintenanceDefault
                      }
                      onChange={() => {
                        if (!resolvedMaintenanceDefault) return;
                        setOdometerMileageModeTouched(true);
                        setOdometerMileageMode("DEFAULT");
                        setIntervalKm(
                          String(resolvedMaintenanceDefault.intervalKm),
                        );
                        setBufferDistanceKm(
                          String(resolvedMaintenanceDefault.bufferDistanceKm),
                        );
                      }}
                      className="mt-1 h-4 w-4 accent-[var(--color-brand-primary)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                        Use vehicle default
                      </span>
                      <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                        {maintenanceDefaultsLoading
                          ? "Loading defaults…"
                          : resolvedMaintenanceDefault
                            ? `${resolvedMaintenanceDefault.source}: ${resolvedMaintenanceDefault.intervalKm.toLocaleString()} km interval, ${resolvedMaintenanceDefault.bufferDistanceKm.toLocaleString()} km buffer`
                            : "No applicable default is configured."}
                      </span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                      odometerMileageMode === "CUSTOM"
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="odometer-mileage-mode"
                      value="CUSTOM"
                      checked={odometerMileageMode === "CUSTOM"}
                      onChange={() => {
                        setOdometerMileageModeTouched(true);
                        setOdometerMileageMode("CUSTOM");
                      }}
                      className="mt-1 h-4 w-4 accent-[var(--color-brand-primary)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                        Custom for this schedule
                      </span>
                      <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                        Enter both values below. This does not change vehicle defaults.
                      </span>
                    </span>
                  </label>
                </div>
                {maintenanceDefaultsError && (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    {maintenanceDefaultsError}
                  </p>
                )}
                {!maintenanceDefaultsLoading &&
                  !resolvedMaintenanceDefault &&
                  !maintenanceDefaultsError &&
                  vehicleId &&
                  checklistTemplate && (
                    <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                      No defaults are configured for this vehicle and checklist
                      type. Enter Custom values to continue.
                    </p>
                  )}
              </fieldset>
            )}

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
                  id="schedule-interval-km"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g., 5000"
                  value={effectiveIntervalKm}
                  aria-invalid={Boolean(maintenanceIntervalError)}
                  aria-describedby={maintenanceIntervalError ? "schedule-interval-km-error" : undefined}
                  onChange={(e) =>
                    setIntervalKm(e.target.value)
                  }
                  disabled={
                    triggerType === MaintenanceTriggerType.TIME ||
                    (triggerType === MaintenanceTriggerType.ODOMETER &&
                      odometerMileageMode === "DEFAULT")
                  }
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === MaintenanceTriggerType.TIME ||
                    (triggerType === MaintenanceTriggerType.ODOMETER &&
                      odometerMileageMode === "DEFAULT")
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
                {maintenanceIntervalError && (
                  <p id="schedule-interval-km-error" role="alert" className="mt-1 text-sm text-red-600">
                    {maintenanceIntervalError}
                  </p>
                )}
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
                  inputMode="numeric"
                  placeholder="e.g., 500"
                  value={effectiveBufferDistanceKm}
                  onChange={(e) =>
                    setBufferDistanceKm(
                      e.target.value,
                    )
                  }
                  disabled={
                    triggerType === MaintenanceTriggerType.TIME ||
                    (triggerType === MaintenanceTriggerType.ODOMETER &&
                      odometerMileageMode === "DEFAULT")
                  }
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === MaintenanceTriggerType.TIME ||
                    (triggerType === MaintenanceTriggerType.ODOMETER &&
                      odometerMileageMode === "DEFAULT")
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
                  id="schedule-starting-reference-reading"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g., 12000"
                  value={startingReferenceReadingKm}
                  aria-invalid={Boolean(startingReferenceReadingError)}
                  aria-describedby={startingReferenceReadingError ? "schedule-starting-reference-reading-error" : undefined}
                  onChange={(e) =>
                    setStartingReferenceReadingKm(
                      e.target.value,
                    )
                  }
                  disabled={triggerType === MaintenanceTriggerType.TIME}
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === MaintenanceTriggerType.TIME
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
                {startingReferenceReadingError && (
                  <p id="schedule-starting-reference-reading-error" role="alert" className="mt-1 text-sm text-red-600">
                    {startingReferenceReadingError}
                  </p>
                )}
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
                  TIME INTERVAL
                </label>
                <div
                  className="relative"
                  onPointerDownCapture={() => {
                    if (isTemplatesLoading) {
                      notifyDisabledField("Checklist templates are disabled while checklist templates are loading.");
                    }
                  }}
                >
                  <input aria-label="Time interval value" type="text" inputMode="numeric"
                    value={timeIntervalValue} onChange={(event) => setTimeIntervalValue(event.target.value)}
                    disabled={triggerType !== MaintenanceTriggerType.TIME} className="mb-2 w-full rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2" />
                  <select
                    disabled={triggerType === MaintenanceTriggerType.ODOMETER}
                    aria-label="Time interval unit"
                    value={timeIntervalUnit}
                    onChange={(e) =>
                      setTimeIntervalUnit(
                        e.target.value as 'DAYS' | 'MONTHS',
                      )
                    }
                    className={`select-control w-full appearance-none rounded-md border px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                      triggerType === MaintenanceTriggerType.ODOMETER
                        ? "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                        : "border-[var(--color-border)] bg-[var(--color-input-bg)]"
                    }`}
                  >
                    <option value="DAYS">Days</option>
                    <option value="MONTHS">Months</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
              {triggerType === MaintenanceTriggerType.TIME && (
                <p className="self-center text-sm text-[var(--color-text-secondary)]">
                  The reference date is calculated from Due Date and this interval.
                </p>
              )}
            </div>
          </section>

          {/* Maintenance Details */}
          <section className="space-y-4 border-b border-[var(--color-border)] pb-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-700">
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
                  <select
                    value={checklistTemplate}
                    disabled={isTemplatesLoading}
                    onChange={(e) =>
                      setChecklistTemplateName(e.target.value as ChecklistTemplateName)
                    }
                    className="select-control w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  >
                    <option value="" disabled>
                      {isTemplatesLoading
                        ? "Loading templates..."
                        : selectableTemplateNames.length === 0
                          ? "No templates with checklist items available"
                          : "Select a checklist template"}
                    </option>
                    {isTemplatesLoading ? (
                      <option
                        value=""
                        disabled
                        style={{ backgroundColor: "var(--color-input-bg)", color: "var(--color-text-primary)" }}
                      >
                        Loading templates...
                      </option>
                    ) : (
                      <>
                        {checklistTemplate && !templateExists ? (
                          <option value={checklistTemplate}>
                            {checklistTemplate}
                          </option>
                        ) : null}
                        {(Object.keys(templates) as ChecklistTemplateName[]).map(
                          (type) => {
                            const hasChecklistItems =
                              selectableTemplateNames.includes(type);

                            return (
                              <option
                                key={type}
                                value={type}
                                disabled={!hasChecklistItems}
                                style={{
                                  backgroundColor: "var(--color-input-bg)",
                                  color: "var(--color-text-primary)",
                                }}
                              >
                                {type}
                                {hasChecklistItems
                                  ? ""
                                  : " (No checklist items)"}
                              </option>
                            );
                          },
                        )}
                      </>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
              <label htmlFor="schedule-assigned-mechanic" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
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
                <SearchableSelect
                  id="schedule-assigned-mechanic"
                  options={[
                    ...(assignedMechanic && !mechanicExists
                      ? [{ value: assignedMechanic, label: assignedMechanic }]
                      : []),
                    ...mechanics.map((mechanic) => ({
                      value: mechanic.name,
                      label: mechanic.name,
                    })),
                  ]}
                  value={assignedMechanic}
                  disabled={mechanics.length === 0 && !assignedMechanic}
                  onChange={setAssignedMechanic}
                  placeholder={mechanics.length > 0 ? "Search mechanics" : "No mechanics available"}
                  className="select-control w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="schedule-chief-mechanic" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
                CHIEF MECHANIC
              </label>
              <div
                className="relative"
                onPointerDownCapture={() => {
                  if (chiefMechanics.length === 0 && !chiefMechanic) {
                    notifyDisabledField("Chief mechanic is disabled because no chief mechanic users are available.");
                  }
                }}
              >
                <SearchableSelect
                  id="schedule-chief-mechanic"
                  options={[
                    ...(chiefMechanic && !chiefMechanics.some(
                      (mechanic) => mechanic.id === chiefMechanicId || mechanic.name === chiefMechanic,
                    )
                      ? [{
                          value: chiefMechanicId || chiefMechanic,
                          label: chiefMechanic,
                        }]
                      : []),
                    ...chiefMechanics.map((mechanic) => ({
                      value: mechanic.id,
                      label: mechanic.name,
                    })),
                  ]}
                  value={chiefMechanicId || chiefMechanic}
                  disabled={isChiefMechanicsLoading || (chiefMechanics.length === 0 && !chiefMechanic)}
                  onChange={(val) => {
                    const selected = chiefMechanics.find((cm) => cm.id === val || cm.name === val);
                    if (selected) {
                      setChiefMechanicId(selected.id);
                      setChiefMechanic(selected.name);
                    } else {
                      setChiefMechanicId(val);
                      setChiefMechanic(val);
                    }
                  }}
                  placeholder={
                    isChiefMechanicsLoading
                      ? "Loading chief mechanics"
                      : chiefMechanics.length > 0
                        ? "Search chief mechanics"
                        : "No chief mechanics available"
                  }
                  className="select-control w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
            </div>
          </section>

          {/* Work Order Checklist Preview */}
          <section className="space-y-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-[var(--color-status-info)]/30 bg-[var(--color-status-info)]/10 p-2 text-[#0369a1]">
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
        <div className="modal-overlay z-[60] px-4 backdrop-blur-sm">
          <div className="modal-content w-full max-w-lg rounded-xl p-6">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              Existing Maintenance Schedule
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              A pending schedule of this type already exists for this truck
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
