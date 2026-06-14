import { useEffect, useRef, useState } from "react";
import {
  X,
  Calendar as CalendarIcon,
  ClipboardCheck,
  Wrench,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import {
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  getChecklistTemplates,
  getUsers,
  type UserRecord,
  getGarages,
  getVehicles,
} from "../../api/fleetService";
import type { MaintenanceTask } from "../../types/maintenance";

type WorkOrderTemplate = string;

interface ChecklistItemTemplate {
  id: string;
  text: string;
}

export default function CreateScheduleModal({
  isOpen,
  editingTask,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  editingTask?: MaintenanceTask;
  onClose: () => void;
  onSaved?: (task: MaintenanceTask) => void;
}) {
  const [workOrderTemplate, setWorkOrderTemplate] =
    useState<WorkOrderTemplate>("");
  const [templates, setTemplates] = useState<
    Record<WorkOrderTemplate, ChecklistItemTemplate[]>
  >({});
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [vehicleId, setVehicleId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startReferenceDate, setStartReferenceDate] = useState("");
  const [assignedMechanic, setAssignedMechanic] = useState("");
  const [mechanics, setMechanics] = useState<UserRecord[]>([]);
  const [garages, setGarages] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ value: string; label: string }[]>(
    [],
  );
  const [garageId, setGarageId] = useState("");
  const [systemAffected, setSystemAffected] = useState("");
  const [odometerReading, setOdometerReading] = useState("");
  const [intervalKm, setIntervalKm] = useState("");
  const [bufferDistanceKm, setBufferDistanceKm] = useState("");
  const [startingReferenceReadingKm, setStartingReferenceReadingKm] =
    useState("");
  const [intervalTypeState, setIntervalTypeState] = useState<
    "DAILY" | "WEEKLY" | "MONTHLY" | ""
  >("");
  const [triggerType, setTriggerType] = useState<
    "ODOMETER" | "TIME" | "MANUAL"
  >("ODOMETER");
  const [isScheduledCalendarOpen, setIsScheduledCalendarOpen] = useState(false);
  const [isStartReferenceCalendarOpen, setIsStartReferenceCalendarOpen] =
    useState(false);
  const [scheduledCalendarMonth, setScheduledCalendarMonth] = useState(
    () => new Date(),
  );
  const [startReferenceCalendarMonth, setStartReferenceCalendarMonth] =
    useState(() => new Date());
  const scheduledCalendarRef = useRef<HTMLDivElement | null>(null);
  const startReferenceCalendarRef = useRef<HTMLDivElement | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (!target) return;

      const clickedInsideScheduled = scheduledCalendarRef.current?.contains(target);
      const clickedInsideStartReference =
        startReferenceCalendarRef.current?.contains(target);

      if (!clickedInsideScheduled) {
        setIsScheduledCalendarOpen(false);
      }

      if (!clickedInsideStartReference) {
        setIsStartReferenceCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        if (editingTask) {
          setVehicleId(editingTask.vehicleId);
          setWorkOrderTemplate(editingTask.title);
          setScheduledDate(editingTask.date);
          setAssignedMechanic(editingTask.assignedDriver ?? "");
          setNotes(editingTask.notes ?? "");
          setGarageId(editingTask.garageId ?? "");
          setSystemAffected(editingTask.systemAffected ?? "");
          setOdometerReading(editingTask.odometerReading ?? "");
          setTriggerType(editingTask.triggerType ?? "ODOMETER");
          setStartReferenceDate(editingTask.startReferenceDate ?? "");
          setIntervalKm(editingTask.intervalKm ?? "");
          setBufferDistanceKm(editingTask.bufferDistanceKm ?? "");
          setStartingReferenceReadingKm(
            editingTask.startingReferenceReadingKm ?? "",
          );

          const it = editingTask.intervalType;
          if (it === "DAILY" || it === "WEEKLY" || it === "MONTHLY") {
            setIntervalTypeState(it);
          } else {
            setIntervalTypeState("");
          }

          if (editingTask.date) {
            setScheduledCalendarMonth(
              new Date(editingTask.date.replace(/-/g, "/")),
            );
          }
        } else {
          // Reset all fields for new schedule
          setVehicleId("");
          setWorkOrderTemplate("");
          setScheduledDate("");
          setAssignedMechanic("");
          setNotes("");
          setGarageId("");
          setSystemAffected("");
          setOdometerReading("");
          setTriggerType("ODOMETER");
          setStartReferenceDate("");
          setIntervalKm("");
          setBufferDistanceKm("");
          setStartingReferenceReadingKm("");
          setIntervalTypeState("");
          setIsScheduledCalendarOpen(false);
          setIsStartReferenceCalendarOpen(false);
          setScheduledCalendarMonth(new Date());
          setStartReferenceCalendarMonth(new Date());
        }
      });
    } else {
      requestAnimationFrame(() => {
        setIsScheduledCalendarOpen(false);
        setIsStartReferenceCalendarOpen(false);
      });
    }
  }, [isOpen, editingTask]);

  const handleSaveSchedule = async () => {
    setIsSaving(true);
    try {
      if (editingTask) {
        const updated: MaintenanceTask = {
          ...editingTask,
          vehicleId,
          title: workOrderTemplate,
          date: scheduledDate,
          assignedDriver: assignedMechanic,
          notes,
          garageId,
          systemAffected,
          odometerReading,
          triggerType,
          startReferenceDate,
          intervalKm,
          bufferDistanceKm,
          startingReferenceReadingKm,
          intervalType: intervalTypeState,
        };
        try {
          const saved = await updateMaintenanceSchedule(updated);
          onSaved?.(saved);
        } catch (err) {
          console.error("Failed to update schedule", err);
          // fallback to local update
          onSaved?.(updated);
        }
      } else {
        const task = await createMaintenanceSchedule({
          vehicleId,
          title: workOrderTemplate,
          status: "Pending",
          date: scheduledDate,
          assignedDriver: assignedMechanic,
          notes,
          garageId,
          systemAffected,
          odometerReading,
          triggerType,
          startReferenceDate,
          intervalKm,
          bufferDistanceKm,
          startingReferenceReadingKm,
          intervalType: intervalTypeState,
        });
        onSaved?.(task);
      }

      // Reset form state
      setVehicleId("");
      setWorkOrderTemplate("");
      setScheduledDate("");
      setAssignedMechanic("");
      setNotes("");
      setGarageId("");
      setSystemAffected("");
      setOdometerReading("");
      setTriggerType("ODOMETER");
      setStartReferenceDate("");
      setIntervalKm("");
      setBufferDistanceKm("");
      setStartingReferenceReadingKm("");
      setIntervalTypeState("");
      setIsScheduledCalendarOpen(false);
      setIsStartReferenceCalendarOpen(false);

      onClose();
    } catch (error) {
      console.error("Failed to save schedule", error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCalendarLabel = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(date);

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { year, month, firstDayOfWeek, daysInMonth };
  };

  const formatIsoDate = (date: Date) => formatLocalDate(date);

  // Helpers to ensure values present in selects when editing
  const vehicleExists = vehicles.some((v) => v.value === vehicleId);
  const templateExists = Object.prototype.hasOwnProperty.call(
    templates,
    workOrderTemplate,
  );
  const mechanicExists = mechanics.some((m) => m.name === assignedMechanic);

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
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
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
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-secondary)] mb-2">
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay p-4 backdrop-blur-sm">
      <div className="modal-content max-w-6xl w-full rounded-[30px] flex flex-col max-h-[92vh] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card-bg)] px-6 py-5 shrink-0">
          <div>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">Create / Edit Maintenance Schedule</h2>

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
          {/* Vehicle Information */}
          <section className="card-base">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-2 text-sky-700 dark:text-sky-200">
                <Wrench className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Vehicle Information</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                  Vehicle
                </label>
                <div className="relative">
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="select-dark w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  >
                    {vehicles.length > 0 || vehicleId ? (
                      <>
                        <option value="" disabled>
                          Select vehicle
                        </option>
                        {/* include current edited vehicle if it's not in the loaded list */}
                        {vehicleId && !vehicleExists ? (
                          <option value={vehicleId}>{vehicleId}</option>
                        ) : null}
                        {vehicles.map((vehicle) => (
                          <option key={vehicle.value} value={vehicle.value}>
                            {vehicle.label}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value="" disabled>
                        No vehicles available
                      </option>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                    Odometer Reading (km)
                  </label>
                  <input
                    type="text"
                    placeholder="km"
                    value={odometerReading}
                    onChange={(e) => setOdometerReading(e.target.value)}
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  />
                </div>
              </div>

              <div className="col-start-2 row-start-1">
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                  Garage / Cluster
                </label>
                <div className="relative">
                  <select
                    value={garageId}
                    onChange={(e) => setGarageId(e.target.value)}
                    className="select-dark w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  >
                    {garages.length > 0 ? (
                      <>
                        <option value="" disabled>
                          Select garage
                        </option>
                        {garages.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value="" disabled>
                        No garages available
                      </option>
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
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                  Account Type
                </label>
                <input
                  type="text"
                  defaultValue="In-house Marikina"
                  readOnly
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none opacity-80 cursor-not-allowed"
                />
              </div>

            </div>
          </section>

          {/* Schedule Trigger */}
          <section className="card-base">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-violet-400/30 bg-violet-400/10 p-2 text-violet-700 dark:text-violet-200">
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Schedule Trigger</h3>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap gap-3">
              {(
                [
                  { value: "ODOMETER", label: "Odometer-Based" },
                  { value: "TIME", label: "Time-Based" },
                  { value: "MANUAL", label: "Manual" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    triggerType === option.value
                      ? "border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] shadow-[0_10px_30px_rgba(56,189,248,0.12)] dark:text-sky-100"
                      : "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-card-bg-hover)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="trigger"
                    value={option.value}
                    checked={triggerType === option.value}
                    onChange={() => setTriggerType(option.value)}
                    className="h-3.5 w-3.5 accent-sky-400"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start mb-4">
              <div className="flex h-full flex-col">
                <label className="mb-1.5 min-h-[2.2rem] text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  Interval (km)
                </label>
                <input
                  type="text"
                  placeholder="km"
                  value={intervalKm}
                  onChange={(e) => setIntervalKm(e.target.value)}
                  disabled={triggerType === "TIME"}
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === "TIME"
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
              </div>
              <div className="flex h-full flex-col">
                <label className="mb-1.5 min-h-[2.2rem] text-[11px] font-semibold text-[var(--color-text-secondary)]">
                  Buffer Distance (km)
                </label>
                <input
                  type="text"
                  placeholder="km"
                  value={bufferDistanceKm}
                  onChange={(e) => setBufferDistanceKm(e.target.value)}
                  disabled={triggerType === "TIME"}
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === "TIME"
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
              </div>
              <div className="flex h-full flex-col">
                <label className="mb-1.5 min-h-[2.2rem] text-[11px] font-semibold text-[var(--color-text-secondary)] leading-tight">
                  Starting Reference Reading (km)
                </label>
                <input
                  type="text"
                  placeholder="km"
                  value={startingReferenceReadingKm}
                  onChange={(e) =>
                    setStartingReferenceReadingKm(e.target.value)
                  }
                  disabled={triggerType === "TIME"}
                  className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                    triggerType === "TIME"
                      ? "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                      : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)]"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                  Interval Type
                </label>
                <div className="relative">
                  <select
                    disabled={triggerType === "ODOMETER"}
                    value={intervalTypeState}
                    onChange={(e) =>
                      setIntervalTypeState(
                        e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "",
                      )
                    }
                    className={`select-dark w-full appearance-none rounded-md border px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                      triggerType === "ODOMETER"
                        ? "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                        : "border-[var(--color-border)] bg-[var(--color-input-bg)]"
                    }`}
                  >
                    <option value="" disabled>
                      Select type
                    </option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                  Start Reference Date
                </label>
                <div className="relative" ref={startReferenceCalendarRef}>
                  <input
                    value={startReferenceDate}
                    onClick={() => {
                      if (triggerType !== "ODOMETER") {
                        setIsStartReferenceCalendarOpen(true);
                        setIsScheduledCalendarOpen(false);
                      }
                    }}
                    readOnly
                    placeholder="YYYY-MM-DD"
                    disabled={triggerType === "ODOMETER"}
                    className={`w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 ${
                      triggerType === "ODOMETER"
                        ? "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                        : "border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)] cursor-pointer"
                    }`}
                  />
                  {startReferenceDate ? (
                    <button
                      type="button"
                      onClick={() => setStartReferenceDate("")}
                      className="absolute inset-y-0 right-8 flex items-center px-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (triggerType !== "ODOMETER") {
                        setIsStartReferenceCalendarOpen(true);
                        setIsScheduledCalendarOpen(false);
                      }
                    }}
                    disabled={triggerType === "ODOMETER"}
                    className={`absolute inset-y-0 right-0 flex items-center px-3 ${
                      triggerType === "ODOMETER"
                        ? "text-[var(--color-text-secondary)] cursor-not-allowed opacity-80"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                  {isStartReferenceCalendarOpen && (
                    <div className="absolute top-full left-0 mt-2 z-50">
                      {renderCalendar(
                        startReferenceCalendarMonth,
                        (value) => {
                          setStartReferenceDate(value);
                          setIsStartReferenceCalendarOpen(false);
                          setStartReferenceCalendarMonth(
                            new Date(value.replace(/-/g, "/")),
                          );
                        },
                        (offset) => {
                          const next = new Date(
                            startReferenceCalendarMonth.getFullYear(),
                            startReferenceCalendarMonth.getMonth() + offset,
                            1,
                          );
                          setStartReferenceCalendarMonth(next);
                        },
                      )}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-secondary)]" />
                </div>
              </div>
            </div>
          </section>

          {/* Maintenance Details */}
          <section className="card-base">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-700 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Maintenance Details</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                  Work Order Template
                </label>
                <div className="relative">
                  <select
                    value={workOrderTemplate}
                    disabled={isTemplatesLoading}
                    onChange={(e) =>
                      setWorkOrderTemplate(e.target.value as WorkOrderTemplate)
                    }
                    className="select-dark w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                  >
                    <option value="" disabled>
                      {isTemplatesLoading
                        ? "Loading templates..."
                        : Object.keys(templates).length === 0
                          ? "No templates available"
                          : "Select a work order template"}
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
                        {/* if editing and template isn't present, include it */}
                        {workOrderTemplate && !templateExists ? (
                          <option value={workOrderTemplate}>
                            {workOrderTemplate}
                          </option>
                        ) : null}
                        {(Object.keys(templates) as WorkOrderTemplate[]).map(
                          (type) => (
                            <option
                              key={type}
                              value={type}
                              style={{
                                backgroundColor: "var(--color-input-bg)",
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {type}
                            </option>
                          ),
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
                <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                  Scheduled Date
                </label>
                <div className="relative" ref={scheduledCalendarRef}>
                  <input
                    value={scheduledDate}
                    onClick={() => {
                      setIsScheduledCalendarOpen(true);
                      setIsStartReferenceCalendarOpen(false);
                    }}
                    readOnly
                    placeholder="YYYY-MM-DD"
                    className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 cursor-pointer"
                  />
                  {scheduledDate ? (
                    <button
                      type="button"
                      onClick={() => setScheduledDate("")}
                      className="absolute inset-y-0 right-8 flex items-center px-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIsScheduledCalendarOpen(true);
                      setIsStartReferenceCalendarOpen(false);
                    }}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-secondary)]"
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                  {isScheduledCalendarOpen && (
                    <div className="absolute top-full left-0 mt-2 z-50">
                      {renderCalendar(
                        scheduledCalendarMonth,
                        (value) => {
                          setScheduledDate(value);
                          setIsScheduledCalendarOpen(false);
                          setScheduledCalendarMonth(
                            new Date(value.replace(/-/g, "/")),
                          );
                        },
                        (offset) => {
                          const next = new Date(
                            scheduledCalendarMonth.getFullYear(),
                            scheduledCalendarMonth.getMonth() + offset,
                            1,
                          );
                          setScheduledCalendarMonth(next);
                        },
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
                Assigned Mechanic
              </label>
              <div className="relative">
                <select
                  value={assignedMechanic}
                  disabled={mechanics.length === 0 && !assignedMechanic}
                  onChange={(e) => setAssignedMechanic(e.target.value)}
                  className="select-dark w-full appearance-none rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30"
                >
                  {mechanics.length > 0 || assignedMechanic ? (
                    <>
                      <option value="" disabled>
                        Select mechanic
                      </option>
                      {assignedMechanic && !mechanicExists ? (
                        <option value={assignedMechanic}>
                          {assignedMechanic}
                        </option>
                      ) : null}
                      {mechanics.map((mechanic) => (
                        <option key={mechanic.id} value={mechanic.name}>
                          {mechanic.name}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="" disabled>
                      No mechanics available
                    </option>
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--color-text-secondary)]">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>
          </section>

          {/* Work Order Checklist Preview */}
          <section className="card-base">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-2 text-sky-700 dark:text-sky-200">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Work Order Checklist Preview</h3>
              </div>
            </div>
            <div className="card-base shadow-inner">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                Work Order Checklist
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                This work order checklist template will be attached to the work
                order based on the selected Work Order Template (
                {workOrderTemplate || "No template selected"}
                ).
              </p>
              <div className="space-y-2">
                {Object.prototype.hasOwnProperty.call(
                  templates,
                  workOrderTemplate,
                ) && templates[workOrderTemplate]?.length > 0 ? (
                  templates[workOrderTemplate].map((item) => (
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
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSchedule}
            disabled={
              isSaving || !vehicleId || !scheduledDate || !assignedMechanic
            }
            className="btn-primary"
          >
            {isSaving ? "Saving…" : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
