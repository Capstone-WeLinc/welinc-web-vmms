import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getInitialMonth = (value: string) =>
  value ? new Date(value.replace(/-/g, "/")) : new Date();

export default function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "MM / DD / YYYY",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getInitialMonth(value),
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keep the visible month aligned when a form changes the selected date.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value) setCalendarMonth(getInitialMonth(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !wrapperRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(calendarMonth);

  const navigateMonth = (offset: number) => {
    setCalendarMonth(new Date(year, month + offset, 1));
  };

  const selectDay = (day: number) => {
    onChange(formatLocalDate(new Date(year, month, day)));
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className={`relative h-11 w-full rounded-xl border bg-white pl-10 pr-10 text-left text-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-[#d8dee8] bg-[#f1f5f9] text-[#8b95a7]"
            : "border-[#c8ced8] text-[#141827] hover:border-[#070b45] focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
        }`}
      >
        <Calendar className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#747b88]" />
        <span className={value ? "" : "text-[#8b95a7]"}>
          {value || placeholder}
        </span>
      </button>

      {value && !disabled ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange("");
          }}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-[#747b88] transition hover:bg-[#f1f5f9] hover:text-[#141827]"
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open ? (
        <div className="absolute left-0 top-[3.25rem] z-50 w-[min(92vw,390px)] rounded-xl border border-[#e0e5ee] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.18)] animate-in fade-in zoom-in-95 duration-150">
          <div className="mb-7 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d8dee8] text-[#5f6672] transition hover:border-[#070b45] hover:text-[#070b45]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <p className="text-xl font-extrabold text-[#141827]">{label}</p>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d8dee8] text-[#5f6672] transition hover:border-[#070b45] hover:text-[#070b45]"
              aria-label="Next month"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          <div className="mb-4 grid grid-cols-7 text-center text-sm font-semibold uppercase text-[#707782]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-3 text-center text-base text-[#20242c]">
            {Array.from({ length: firstDayOfWeek }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const dateValue = formatLocalDate(new Date(year, month, day));
              const selected = value === dateValue;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full transition ${
                    selected
                      ? "bg-[#070b45] font-bold text-white"
                      : "hover:bg-[#eef2ff] hover:text-[#070b45]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
