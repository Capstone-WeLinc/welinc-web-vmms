import type {
  ButtonHTMLAttributes,
  ComponentType,
  InputHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DatePicker from "./DatePicker";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  Edit2,
  Eye,
  Filter,
  HelpCircle,
  MoreVertical,
  Search,
  Trash2,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const navy = "#070b45";

const formatFilterLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export type StandardStatus =
  | "Completed"
  | "In Progress"
  | "In-Progress"
  | "Pending"
  | "Flagged"
  | "Active"
  | "Inactive"
  | "Failed"
  | "Cancelled"
  | "On Hold"
  | string;

export const getStatusTone = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized.includes("complete") || normalized === "active" || normalized.includes("approved") || normalized === "normal") {
    return "#059669";
  }
  if (normalized.includes("submitted") || normalized.includes("inspection")) {
    return "#7c3aed";
  }
  if (normalized === "due" || normalized.includes("schedule")) {
    return "#2563eb";
  }
  if (normalized.includes("progress") || normalized.includes("review")) {
    return "#0f766e";
  }
  if (normalized.includes("below avg")) {
    return "#d97706";
  }
  if (normalized.includes("overdue") || normalized.includes("flag") || normalized.includes("failed") || normalized.includes("cancel") || normalized.includes("anomaly")) {
    return "#dc2626";
  }
  if (normalized.includes("pending") || normalized.includes("hold")) {
    return "#d97706";
  }
  if (normalized.includes("locked") || normalized.includes("waiting") || normalized.includes("inactive")) {
    return "#64748b";
  }

  return "#64748b";
};

export const getStatusBadgeClasses = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized.includes("complete") || normalized === "active" || normalized.includes("approved") || normalized === "normal") {
    return "border-[#86efac] bg-[#dcfce7] text-[#059669]";
  }
  if (normalized.includes("submitted") || normalized.includes("inspection")) {
    return "border-[#c4b5fd] bg-[#ede9fe] text-[#7c3aed]";
  }
  if (normalized === "due" || normalized.includes("schedule")) {
    return "border-[#93c5fd] bg-[#dbeafe] text-[#2563eb]";
  }
  if (normalized.includes("progress") || normalized.includes("review")) {
    return "border-[#5eead4] bg-[#ccfbf1] text-[#0f766e]";
  }
  if (normalized.includes("below avg")) {
    return "border-[#fcd34d] bg-[#fef3c7] text-[#d97706]";
  }
  if (normalized.includes("overdue") || normalized.includes("flag") || normalized.includes("failed") || normalized.includes("cancel") || normalized.includes("anomaly")) {
    return "border-[#fca5a5] bg-[#fee2e2] text-[#dc2626]";
  }
  if (normalized.includes("pending") || normalized.includes("hold") || normalized.includes("submitted")) {
    return "border-[#fcd34d] bg-[#fef3c7] text-[#d97706]";
  }
  if (normalized.includes("locked") || normalized.includes("waiting") || normalized.includes("inactive")) {
    return "border-[#cbd5e1] bg-[#f1f5f9] text-[#64748b]";
  }

  return "border-[#cbd5e1] bg-[#f8fafc] text-[#64748b]";
};

export const tableShellClasses =
  "overflow-auto overscroll-contain rounded-xl bg-white";
export const tableClasses =
  "w-full border-collapse text-left text-sm text-[#141827]";
export const tableHeadClasses =
  "bg-[#070b45] text-white";
export const tableHeaderCellClasses =
  "px-3 py-3 text-xs font-bold uppercase tracking-wide align-middle";
export const tableCellClasses =
  "border-b border-[#dde4ef] px-3 py-3 align-middle text-sm";
export const tableRowClasses =
  "transition-colors hover:bg-[#f8fafc]";
export const checkboxClasses =
  "h-4 w-4 rounded border-2 border-[#9aabc1] bg-white text-[#2f7cff] focus:ring-2 focus:ring-[#2f7cff]/30";

type ActionButtonVariant = "primary" | "warning" | "danger" | "secondary";

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
}

export const ActionButton = ({
  variant = "primary",
  className = "",
  children,
  ...props
}: ActionButtonProps) => {
  const variants = {
    primary:
      "bg-[#070b45] text-white hover:bg-[#11175f] disabled:bg-[#444c7c] disabled:text-[#9b9b9b]",
    warning:
      "bg-[#e7b900] text-black hover:bg-[#d7ad00] disabled:bg-[#ffeda8] disabled:text-[#777]",
    danger:
      "bg-[#a90000] text-white hover:bg-[#920000] disabled:bg-[#a7a2a2] disabled:text-[#777]",
    secondary:
      "border border-[#c8ced8] bg-white text-[#141827] hover:bg-[#f8fafc] disabled:bg-[#a7a2a2] disabled:text-[#777]",
  }[variant];

  return (
    <button
      type="button"
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed ${variants} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

interface ConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  requirePassword?: boolean;
  passwordValue?: string;
  passwordPlaceholder?: string;
  onPasswordChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal = ({
  isOpen,
  title = "Confirmation",
  message,
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  variant = "primary",
  requirePassword = false,
  passwordValue = "",
  passwordPlaceholder = "Enter your password to confirm",
  onPasswordChange,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) => {
  if (!isOpen || typeof document === "undefined") return null;

  const modal = (
    <div className="modal-overlay z-[70]">
      <section className="modal-content w-full max-w-sm">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-input-bg)] px-5 py-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[var(--color-text-primary)]">
            {title}
          </h2>
        </div>
        <div className="px-5 py-4 text-center text-sm leading-relaxed text-[var(--color-text-primary)]">
          {message}
        {requirePassword ? (
          <input
            type="password"
            value={passwordValue}
            onChange={(event) => onPasswordChange?.(event.target.value)}
            placeholder={passwordPlaceholder}
            className="mt-5 h-10 w-full rounded-xl border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-4 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-primary)]"
          />
        ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-5">
          <ActionButton
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            className="h-10 rounded-xl"
          >
            {confirmLabel}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onCancel}
            className={`h-10 rounded-xl ${
              variant === "danger" ? "border-[#a90000] text-[#a90000] hover:bg-[#fff1f1]" : ""
            }`}
          >
            {cancelLabel}
          </ActionButton>
        </div>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
};

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  className?: string;
}

export const SearchInput = ({ className = "w-full sm:w-96", ...props }: SearchInputProps) => (
  <div className={`relative max-w-full ${className}`}>
    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b2]" />
    <input
      className="h-10 w-full rounded-xl border border-[#c8ced8] bg-white pl-10 pr-4 text-sm text-[#141827] placeholder:text-[#9aa3b2] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
      {...props}
    />
  </div>
);

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SortSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export const SortSelect = ({
  value,
  options,
  onChange,
  label = "Sort By",
  className = "",
}: SortSelectProps) => {
  const [open, setOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const closeSortMenu = (event: PointerEvent) => {
      if (!sortRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeSortMenu);
    return () => document.removeEventListener("pointerdown", closeSortMenu);
  }, [open]);

  return (
    <div ref={sortRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-[#070b45] bg-white px-5 text-left text-sm font-semibold text-[#141827] shadow-[0_4px_10px_rgba(7,11,69,0.08)] outline-none transition hover:bg-[#f8fafc] focus:ring-2 focus:ring-[#070b45]/10"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedOption?.label ?? label}</span>
        <ChevronDown className="ml-4 h-4 w-4 shrink-0 text-[#63728a]" />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.4rem)] z-50 w-full min-w-max overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-2 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block min-h-10 w-full whitespace-nowrap px-5 py-2 text-left font-semibold transition ${
                option.value === value
                  ? "bg-[#f6f8fc] text-[#070b45]"
                  : "bg-white text-[#141827] hover:bg-[#f6f8fc]"
              }`}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

interface DropdownSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export const DropdownSelect = ({
  value,
  options,
  onChange,
  label = "Select option",
  className = "",
  buttonClassName = "",
  disabled = false,
}: DropdownSelectProps) => {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const closeMenu = (event: PointerEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [open]);

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) return;
          setOpen((current) => !current);
        }}
        disabled={disabled}
        className={`flex h-10 w-full items-center justify-between rounded-xl border border-[#c7d2e2] bg-white px-3 text-left text-sm text-[#141827] outline-none transition hover:bg-[#f8fafc] focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#64748b] disabled:opacity-75 ${buttonClassName}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedOption?.label ?? label}</span>
        <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-[#63728a]" />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.35rem)] z-[60] max-h-72 w-full min-w-max overflow-auto rounded-xl border border-[#dce3ed] bg-white py-2 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.16)]"
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                setOpen(false);
              }}
              disabled={option.disabled}
              className={`block min-h-10 w-full whitespace-nowrap px-5 py-2 text-left font-semibold transition ${
                option.value === value
                  ? "bg-[#f6f8fc] text-[#070b45]"
                  : "bg-white text-[#141827] hover:bg-[#f6f8fc]"
              } disabled:cursor-not-allowed disabled:text-[#94a3b8] disabled:hover:bg-white`}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

interface TableToolbarProps {
  search?: ReactNode;
  sort?: ReactNode;
  filters?: ReactNode;
  exportActions?: ReactNode;
  actions?: ReactNode;
}

export const TableToolbar = ({
  search,
  sort,
  filters,
  exportActions,
  actions,
}: TableToolbarProps) => (
  <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      {search}
      {sort}
    </div>
    <div className="flex flex-wrap items-center justify-end gap-3">
      {filters}
      {actions}
      {exportActions}
    </div>
  </div>
);

export type LegendHelpItem = {
  label: string;
  description: ReactNode;
  tone?: string;
};

interface LegendHelpProps {
  title?: string;
  items: LegendHelpItem[];
  align?: "left" | "right";
  className?: string;
}

export const LegendHelp = ({
  title = "Legend",
  items,
  align = "right",
  className = "",
}: LegendHelpProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        aria-label={`Show ${title.toLowerCase()}`}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8dee8] bg-[#f6f8fc] text-[#63728a] transition hover:border-[#070b45] hover:text-[#070b45]"
      >
        <HelpCircle className="h-5 w-5" strokeWidth={2.3} />
      </button>
      {open ? (
        <div
          className={`absolute top-12 z-50 w-[min(88vw,360px)] rounded-xl border border-[#e0e5ee] bg-white p-4 text-left shadow-[0_18px_45px_rgba(15,23,42,0.18)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#141827]">
            {title}
          </p>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div key={item.label} className="flex gap-3">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.tone ?? "#070b45" }}
                />
                <div>
                  <p className="text-sm font-bold text-[#141827]">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#64748b]">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface FilterPanelProps {
  open: boolean;
  onToggle: () => void;
  statuses: string[];
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApply?: () => void;
  onClear: () => void;
  className?: string;
  children?: ReactNode;
  legendItems?: LegendHelpItem[];
  legendTitle?: string;
}

export const FilterDropdown = ({
  open,
  onToggle,
  statuses,
  selectedStatuses,
  onStatusChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApply,
  onClear,
  className = "",
  children,
  legendItems,
  legendTitle,
}: FilterPanelProps) => {
  const toggleStatus = (status: string) => {
    onStatusChange(
      selectedStatuses.includes(status)
        ? selectedStatuses.filter((item) => item !== status)
        : [...selectedStatuses, status],
    );
  };
  const fallbackLegendItems = statuses.map((status) => ({
    label: formatFilterLabel(status),
    description:
      status.toLowerCase().includes("overdue") || status.toLowerCase().includes("flag")
        ? "Needs attention because it passed its expected date or has an issue."
        : status.toLowerCase().includes("due")
          ? "Ready or almost ready for maintenance action."
          : status.toLowerCase().includes("progress")
            ? "Work has started and is currently being handled."
            : status.toLowerCase().includes("complete")
              ? "Work has been finished and logged."
              : status.toLowerCase().includes("cancel")
                ? "No longer active, but kept for history."
                : "Available status filter for this module.",
    tone: getStatusTone(status),
  }));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          aria-expanded={open}
          className="inline-flex items-center gap-2"
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              open
                ? "border-[#070b45] bg-[#f6f8fc] shadow-sm"
                : "border-[#d8dee8] bg-[#f6f8fc] hover:border-[#070b45]"
            }`}
          >
            <Filter className="h-5 w-5 text-[#63728a]" strokeWidth={2.4} />
          </span>
          <span className="text-sm font-bold uppercase tracking-wide text-[#141827]"></span>
        </button>

        {open && (
          <div
            className="absolute right-0 top-12 z-40 w-[min(92vw,430px)] rounded-xl border border-[#e0e5ee] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.18)] animate-in fade-in zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
          <h3 className="text-lg font-extrabold text-[#141827]">
            Filter by
          </h3>
          <div className="my-4 h-px bg-[#dde3eb]" />

          <div>
            <p className="text-sm font-semibold text-black">Status</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {statuses.map((status) => {
                const checked = selectedStatuses.includes(status);
                return (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-2 text-sm text-[#141827]"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                        checked
                          ? "border-[#2f7cff] bg-[#eaf2ff]"
                          : "border-[#cbd3df] bg-white"
                      }`}
                    >
                      {checked && (
                        <Check className="h-4 w-4 text-[#2f7cff]" strokeWidth={3} />
                      )}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleStatus(status)}
                    />
                    {formatFilterLabel(status)}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-black">Date range</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {[
                {
                  id: "dateFrom",
                  label: "Date From",
                  value: dateFrom,
                  onChange: onDateFromChange,
                },
                {
                  id: "dateTo",
                  label: "Date To",
                  value: dateTo,
                  onChange: onDateToChange,
                },
              ].map((field) => (
                <label key={field.id} className="block">
                  <span className="text-sm text-[#141827]">{field.label}</span>
                  <DatePicker
                    className="mt-2"
                    value={field.value}
                    onChange={field.onChange}
                    popoverAlign={field.id === "dateTo" ? "right" : "left"}
                  />
                </label>
              ))}
            </div>
          </div>

          {children ? (
            <div className="mt-5 border-t border-[#dde3eb] pt-4">
              {children}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onApply}
              className="h-10 rounded-lg bg-[#070b45] text-sm font-bold text-white transition hover:bg-[#11175f]"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={onClear}
              className="h-10 rounded-lg border-2 border-[#070b45] bg-white text-sm font-bold text-[#070b45] transition hover:bg-[#f6f8fc]"
            >
              Clear
            </button>
          </div>
          </div>
        )}
      </div>
      <LegendHelp
        title={legendTitle ?? "Filter Legend"}
        items={legendItems ?? fallbackLegendItems}
      />
    </div>
  );
};

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: ReactNode;
  minWidth?: string;
  density?: "default" | "compact";
  maxHeight?: string;
  adminSelectable?: boolean;
  onDeleteSelected?: (ids: string[]) => void;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = "No records found.",
  minWidth = "760px",
  density = "default",
  maxHeight,
  adminSelectable = true,
  onDeleteSelected,
}: DataTableProps<T>) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === "ADMIN";
  const isOperations = currentUser?.role === "OPERATIONS";
  const showSelection = adminSelectable && (isAdmin || isOperations);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [locallyDeletedRowIds, setLocallyDeletedRowIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const headerCellClasses =
    density === "compact"
      ? "px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide align-middle"
      : tableHeaderCellClasses;
  const bodyCellClasses =
    density === "compact"
      ? "border-b border-[#dde4ef] px-3 py-2.5 align-middle text-sm"
      : tableCellClasses;
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>({});
  const visibleRows = data.filter((row) => !locallyDeletedRowIds.includes(getRowKey(row)));
  const visibleRowIds = visibleRows.map(getRowKey);
  const allVisibleSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedRowIds.includes(id));

  const toggleRowSelection = (rowId: string) => {
    setSelectedRowIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedRowIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleRowIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleRowIds]));
    });
  };

  const confirmSelectedDelete = () => {
    if (selectedRowIds.length === 0) return;
    if (onDeleteSelected) {
      onDeleteSelected(selectedRowIds);
    } else {
      setLocallyDeletedRowIds((current) => Array.from(new Set([...current, ...selectedRowIds])));
    }
    setSelectedRowIds([]);
    setDeleteDialogOpen(false);
  };

  useEffect(() => {
    setColumnWidths((current) => {
      const next: Record<string, string> = {};
      columns.forEach((column) => {
        next[column.key] =
          current[column.key] ?? column.width ?? `${Math.max(120, 760 / columns.length)}px`;
      });
      return next;
    });
  }, [columns]);

  const startColumnResize = (
    event: MouseEvent<HTMLButtonElement>,
    columnKey: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const headerCell = event.currentTarget.closest("th");
    const startWidth = headerCell?.getBoundingClientRect().width ?? 160;
    const startX = event.clientX;

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const nextWidth = Math.max(96, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => ({
        ...current,
        [columnKey]: `${Math.round(nextWidth)}px`,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="space-y-4">
      {showSelection && selectedRowIds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm font-bold text-[#ff3333]">
            <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2.2} />
            <span>
              Delete {selectedRowIds.length} selected record{selectedRowIds.length === 1 ? "" : "s"}? This cannot be undone.
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="h-10 rounded-lg bg-[#ef4444] px-4 text-sm font-bold text-white transition hover:bg-[#dc2626]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedRowIds([])}
              className="h-10 rounded-lg border border-[#d8dee8] bg-white px-4 text-sm font-semibold text-[#475569] transition hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`${tableShellClasses} overflow-x-auto`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <table className={tableClasses} style={{ minWidth, tableLayout: "fixed" }}>
        <colgroup>
          {showSelection ? <col style={{ width: "52px" }} /> : null}
          {columns.map((column) => (
            <col
              key={column.key}
              style={{ width: columnWidths[column.key] ?? column.width }}
            />
          ))}
        </colgroup>
        <thead className={`${tableHeadClasses} sticky top-0 z-10`}>
          <tr>
            {showSelection ? (
              <th className={`${headerCellClasses} border-r border-white/20 text-center`}>
                <input
                  type="checkbox"
                  className={checkboxClasses}
                  checked={allVisibleSelected}
                  onChange={toggleVisibleSelection}
                  aria-label="Select all visible rows"
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`relative select-none ${headerCellClasses} ${
                  column.align === "center"
                    ? "text-center"
                    : column.align === "right"
                      ? "text-right"
                      : ""
                } border-r border-white/20 last:border-r-0`}
              >
                {column.header}
                <button
                  type="button"
                  aria-label={`Resize ${String(column.header)} column`}
                  onMouseDown={(event) => startColumnResize(event, column.key)}
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none bg-transparent transition hover:bg-white/20 focus:bg-white/20 focus:outline-none"
                >
                  <span className="mx-auto block h-full w-px bg-transparent" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showSelection ? 1 : 0)}
                className={`border-b border-[#dde4ef] px-4 text-center text-sm text-[#70747c] ${
                  density === "compact" ? "py-8" : "py-10"
                }`}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={tableRowClasses}
              >
                {showSelection ? (
                  <td className={`${bodyCellClasses} text-center`}>
                    <input
                      type="checkbox"
                      className={checkboxClasses}
                      checked={selectedRowIds.includes(getRowKey(row))}
                      onChange={() => toggleRowSelection(getRowKey(row))}
                      aria-label="Select row"
                    />
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`${bodyCellClasses} ${
                      column.align === "center"
                        ? "text-center"
                        : column.align === "right"
                          ? "text-right"
                          : ""
                    } min-w-0 break-words leading-snug`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        </table>
      </div>
      <ConfirmationModal
        isOpen={deleteDialogOpen}
        title="Delete selected records"
        message={`Delete ${selectedRowIds.length} selected record${selectedRowIds.length === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmSelectedDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

export const StatusBadge = ({ status }: { status: StandardStatus }) => {
  const displayStatus = status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <span
      className={`inline-flex min-w-24 justify-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getStatusBadgeClasses(status)}`}
    >
      {displayStatus}
    </span>
  );
};

interface ActionMenuProps {
  open: boolean;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  items?: {
    label: string;
    icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
    onClick: () => void;
    danger?: boolean;
  }[];
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ActionMenu = ({
  open,
  onToggle,
  items,
  onView,
  onEdit,
  onDelete,
}: ActionMenuProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const menuWidth = 160;
      const itemCount = items?.length ?? [onView, onEdit, onDelete].filter(Boolean).length;
      const estimatedHeight = itemCount * 42 + 12;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );

      if (rect.bottom + estimatedHeight + 8 <= window.innerHeight) {
        setPosition({ left, top: rect.bottom + 4 });
      } else {
        setPosition({ left, bottom: window.innerHeight - rect.top + 4 });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [items?.length, onDelete, onEdit, onView, open]);

  const menu = position ? (
    <div
      className="fixed z-[100] w-40 overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-1.5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
      style={position}
      onClick={(event) => event.stopPropagation()}
    >
        {items?.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                item.onClick();
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#f8fafc] ${
                item.danger ? "text-[#ff4040] hover:bg-[#fff1f1]" : "text-[#344158]"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" strokeWidth={1.8} />}
              {item.label}
            </button>
          );
        })}
        {onView && (
          <button type="button" onClick={(event) => { event.stopPropagation(); onView(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#344158] hover:bg-[#f8fafc]">
            <Eye className="h-4 w-4" /> View
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#344158] hover:bg-[#f8fafc]">
            <Edit2 className="h-4 w-4" /> Edit
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#ff4040] hover:bg-[#fff1f1]">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        )}
    </div>
  ) : null;

  return (
    <div className="flex justify-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(event);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[#070b45] transition hover:bg-[#f1f5f9]"
        aria-expanded={open}
        aria-label="Open row actions"
      >
        <MoreVertical size={20} strokeWidth={2.6} />
      </button>
      {open && menu ? createPortal(menu, document.body) : null}
    </div>
  );
};

interface ExportButtonProps {
  open: boolean;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
  onPdf: () => void;
  onCsv: () => void;
  onExcel: () => void;
}

export const ExportButton = ({ open, onToggle, onPdf, onCsv, onExcel }: ExportButtonProps) => (
  <div className="relative">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#070b45] px-5 text-sm font-bold uppercase text-white shadow-[0_10px_22px_rgba(7,11,69,0.18)] transition hover:bg-[#11175f]"
      aria-expanded={open}
    >
      <Download className="h-5 w-5" />
      Export
    </button>
    {open && (
      <div
        className="absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-2 shadow-[0_18px_45px_rgba(15,23,42,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="block w-full px-5 py-3 text-left text-sm font-semibold text-[#141827] hover:bg-[#f6f8fc]" onClick={onPdf}>
          PDF
        </button>
        <button type="button" className="block w-full px-5 py-3 text-left text-sm font-semibold text-[#141827] hover:bg-[#f6f8fc]" onClick={onCsv}>
          CSV
        </button>
        <button type="button" className="block w-full px-5 py-3 text-left text-sm font-semibold text-[#141827] hover:bg-[#f6f8fc]" onClick={onExcel}>
          Excel
        </button>
      </div>
    )}
  </div>
);

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export const Pagination = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [5, 10, 15, 20],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) => {
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const pageSizeRef = useRef<HTMLDivElement | null>(null);
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const visibleCount = totalItems === 0 ? 0 : Math.min(safePage * pageSize, totalItems);
  const pages: Array<number | "start-ellipsis" | "end-ellipsis"> = (() => {
    if (safeTotalPages <= 6) {
      return Array.from({ length: safeTotalPages }, (_, index) => index + 1);
    }

    if (safePage <= 3) {
      return [1, 2, 3, 4, 5, "end-ellipsis", safeTotalPages];
    }

    if (safePage >= safeTotalPages - 2) {
      return [
        1,
        "start-ellipsis",
        safeTotalPages - 4,
        safeTotalPages - 3,
        safeTotalPages - 2,
        safeTotalPages - 1,
        safeTotalPages,
      ];
    }

    return [
      1,
      "start-ellipsis",
      safePage - 1,
      safePage,
      safePage + 1,
      "end-ellipsis",
      safeTotalPages,
    ];
  })();

  useEffect(() => {
    if (!pageSizeOpen) return;

    const closePageSizeMenu = (event: PointerEvent) => {
      if (!pageSizeRef.current?.contains(event.target as Node)) {
        setPageSizeOpen(false);
      }
    };

    document.addEventListener("pointerdown", closePageSizeMenu);
    return () => document.removeEventListener("pointerdown", closePageSizeMenu);
  }, [pageSizeOpen]);

  return (
    <div className="grid w-full grid-cols-1 items-center gap-3 px-0 py-4 text-sm text-[#5f6b7a] sm:grid-cols-[1fr_auto_1fr]">
      <span className="text-left text-base font-medium text-[#64748b]">
        {visibleCount} of {totalItems} items
      </span>
      <div className="flex items-center justify-center gap-2">
        {pages.map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={`Go to page ${item}`}
              aria-current={item === safePage ? "page" : undefined}
              className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-bold transition ${
                item === safePage ? "bg-[#070b45] text-white shadow-[0_8px_18px_rgba(7,11,69,0.18)]" : "text-[#070b45] hover:bg-[#eef2ff]"
              }`}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="font-bold text-[#070b45]" aria-hidden="true">
              ...
            </span>
          ),
        )}
      </div>
      {onPageSizeChange && (
        <div className="flex items-center justify-start gap-3 sm:justify-end">
          <span className="text-base font-bold text-[#64748b]">Show</span>
          <div ref={pageSizeRef} className="relative">
            {pageSizeOpen ? (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-40 overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-2 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
                {pageSizeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      onPageSizeChange(option);
                      setPageSizeOpen(false);
                    }}
                    className={`block min-h-10 w-full px-8 py-2 text-left font-semibold transition ${
                      option === pageSize
                        ? "bg-[#f6f8fc] text-[#070b45]"
                        : "bg-white text-[#141827] hover:bg-[#f6f8fc]"
                    }`}
                  >
                    {option} rows
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPageSizeOpen((current) => !current);
              }}
              className="flex h-11 min-w-40 items-center justify-between rounded-full border border-[#070b45] bg-white pl-8 pr-8 text-sm font-extrabold text-[#070b45] shadow-[0_4px_10px_rgba(7,11,69,0.12)] outline-none transition hover:bg-[#f8fafc] focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
              aria-haspopup="listbox"
              aria-expanded={pageSizeOpen}
            >
              <span>{pageSize} rows</span>
              <ChevronDown className="h-5 w-5 text-[#070b45]" />
            </button>
          </div>
        </div>
      )}
      {!onPageSizeChange && (
        <span className="hidden sm:block" aria-hidden="true" />
      )}
    </div>
  );
};

interface ToastProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
}

export const ToastNotification = ({ type, message }: ToastProps) => {
  const styles = {
    success: "border-[#35c76f] bg-[#e9fbea] text-[#1d6b2d]",
    error: "border-[#b80f0f] bg-[#fae6e3] text-[#9d1212]",
    warning: "border-[#f59e0b] bg-[#fff7e6] text-[#92400e]",
    info: "border-[#168cff] bg-[#e8f3ff] text-[#075fa8]",
  }[type];

  return (
    <div className={`flex min-h-10 items-center gap-3 rounded-lg border px-4 py-2 text-sm font-medium ${styles}`}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current/10">
        <Check className="h-3.5 w-3.5" />
      </span>
      {message}
    </div>
  );
};

export const brandNavy = navy;
