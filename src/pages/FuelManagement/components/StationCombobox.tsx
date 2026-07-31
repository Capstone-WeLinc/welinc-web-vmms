import { useMemo, useState } from "react";

type StationComboboxProps = {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
};

export default function StationCombobox({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Search or select station...",
  required,
  className = "",
}: StationComboboxProps) {
  const [open, setOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const visibleOptions = useMemo(
    () =>
      options
        .filter((option) => !normalizedValue || option.toLowerCase().includes(normalizedValue))
        .slice(0, 8),
    [normalizedValue, options],
  );

  return (
    <div className={`relative flex w-full flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
      />
      {open && visibleOptions.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[90] overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-2 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
          {visibleOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(option);
                setOpen(false);
              }}
              className="block min-h-10 w-full px-4 py-2.5 text-left text-sm font-semibold text-[#141827] transition hover:bg-[#f6f8fc] focus:bg-[#f6f8fc] focus:outline-none"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
