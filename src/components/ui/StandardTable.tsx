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
import { useFilterPanelPosition } from "./filterPanelPosition";
import {
  Check,
  Download,
  Edit2,
  Eye,
  Filter,
  MoreVertical,
  Search,
  Trash2,
  X,
} from "lucide-react";


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

export const tableShellClasses =
  "overflow-visible bg-white";
export const tableClasses =
  "w-full border-collapse text-left text-sm text-[#141827]";
export const tableHeadClasses =
  "bg-[#070b45] text-white";
export const tableHeaderCellClasses =
  "px-2.5 py-2 text-xs font-bold uppercase tracking-wide align-middle";
export const tableCellClasses =
  "border-b border-[#dde4ef] px-2.5 py-2 align-middle text-sm";
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
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed ${variants} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

interface ConfirmationModalProps {
  confirmDisabled?: boolean;
  busy?: boolean;
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
  confirmDisabled = false,
  busy = false,
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-xl bg-white p-6">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-[#141827]">
          {title}
        </h2>
        <div className="my-4 h-px bg-[#dde3eb]" />
        <div className="text-center text-base leading-relaxed text-[#141827]">
          {message}
        </div>
        {requirePassword ? (
          <input
            type="password"
            value={passwordValue}
            onChange={(event) => onPasswordChange?.(event.target.value)}
            placeholder={passwordPlaceholder}
            className="mt-5 h-12 w-full rounded-xl border-2 border-[#9a8f8f] bg-white px-4 text-sm text-[#141827] outline-none transition focus:border-[#070b45]"
          />
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <ActionButton variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={confirmDisabled || busy}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </section>
    </div>
  );
};

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  className?: string;
  onClear?: () => void;
}

export const SearchInput = ({ className = "", onClear, value, onChange, ...props }: SearchInputProps) => {
  const hasValue = value !== undefined && String(value).length > 0;
  const clearable = hasValue && Boolean(onClear || onChange);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    if (onChange) {
      (onChange as (event: { target: { value: string }; currentTarget: { value: string } }) => void)({
        target: { value: "" },
        currentTarget: { value: "" },
      });
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa3b2]" />
      <input
        value={value}
        onChange={onChange}
        className={`h-11 w-full rounded-xl border border-[#c8ced8] bg-white pl-10 ${clearable ? "pr-10" : "pr-4"} text-sm text-[#141827] placeholder:text-[#9aa3b2] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10`}
        {...props}
      />
      {clearable ? (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[#9aa3b2] transition hover:bg-[#eef2f7] hover:text-[#141827]"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export interface DropdownSelectOption {
  value: string;
  label: string;
}

export interface DropdownSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownSelectOption[];
  className?: string;
}

export const DropdownSelect = ({
  label,
  value,
  onChange,
  options,
  className = "",
}: DropdownSelectProps) => (
  <select
    aria-label={label || "Select option"}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={`h-10 w-full rounded-xl border border-[#c8ced8] bg-white px-3 text-sm font-semibold text-[#141827] outline-none focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10 ${className}`}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export interface SortSelectOption {
  value: string;
  label: string;
}

export interface SortSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SortSelectOption[];
  className?: string;
}

export const SortSelect = ({
  label,
  value,
  onChange,
  options,
  className = "",
}: SortSelectProps) => (
  <div className={`relative ${className}`}>
    <select
      aria-label={label || "Sort"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full appearance-none rounded-xl border border-[#c8ced8] bg-white pl-4 pr-10 text-sm font-semibold text-[#141827] outline-none transition focus:border-[#070b45] focus:ring-2 focus:ring-[#070b45]/10"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

export interface TableToolbarProps {
  search?: ReactNode;
  sort?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const TableToolbar = ({
  search,
  sort,
  actions,
  className = "",
}: TableToolbarProps) => (
  <div className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      {search}
      {sort}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

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
}: FilterPanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { position: panelPosition, preparePosition } = useFilterPanelPosition(
    open,
    buttonRef,
    panelRef,
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onToggle();
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onToggle();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onToggle]);

  const toggleStatus = (status: string) => {
    onStatusChange(
      selectedStatuses.includes(status)
        ? selectedStatuses.filter((item) => item !== status)
        : [...selectedStatuses, status],
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (!open) preparePosition();
          onToggle();
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-2"
      >
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
            open
              ? "border-[#070b45] bg-[#f6f8fc]"
              : "border-[#d8dee8] bg-[#f6f8fc] hover:border-[#070b45]"
          }`}
        >
          <Filter className="h-5 w-5 text-[#63728a]" strokeWidth={2.4} />
        </span>
        <span className="text-sm font-bold uppercase tracking-wide text-[#141827]"></span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 w-[min(92vw,430px)] overflow-y-auto rounded-xl border border-[#e0e5ee] bg-white p-5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: panelPosition?.top ?? 0,
            left: panelPosition?.left ?? 0,
            maxHeight: panelPosition?.maxHeight ?? 320,
            visibility: panelPosition ? "visible" : "hidden",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <h3 className="text-lg font-extrabold uppercase tracking-wide text-[#141827]">
            Filter By
          </h3>
          <div className="my-4 h-px bg-[#dde3eb]" />

          <div>
            <p className="text-sm font-semibold uppercase text-black">Status</p>
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
                    {status}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold uppercase text-black">Date Range</p>
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
        </div>,
        document.body,
      )}
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
  onRowClick?: (row: T) => void;
  density?: "default" | "compact";
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = "No records found.",
  minWidth = "760px",
  onRowClick,
  density = "default",
}: DataTableProps<T>) {
  const headerCellClasses =
    density === "compact"
      ? "px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide align-middle"
      : tableHeaderCellClasses;
  const bodyCellClasses =
    density === "compact"
      ? "border-b border-[#dde4ef] px-2 py-1 align-middle text-sm"
      : tableCellClasses;

  return (
    <div className={`${tableShellClasses} overflow-x-auto`}>
      <table className={tableClasses} style={{ minWidth, tableLayout: "fixed" }}>
        <thead className={tableHeadClasses}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${headerCellClasses} ${
                  column.align === "center"
                    ? "text-center"
                    : column.align === "right"
                      ? "text-right"
                      : ""
                }`}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className={`border-b border-[#dde4ef] px-4 text-center text-sm text-[#70747c] ${
                  density === "compact" ? "py-5" : "py-8"
                }`}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={getRowKey(row)}
                className={`${tableRowClasses} ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
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
  );
}

export const StatusBadge = ({ status }: { status: StandardStatus }) => {
  const normalized = status.toLowerCase();
  const displayStatus = status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const style =
    normalized === "available" || normalized === "active" || normalized.includes("complete")
      ? "border-[#30c967] bg-[#dcfce7] text-[#15803d]"
      : normalized === "in transit" || normalized === "in use" || normalized.includes("progress")
        ? "border-[#168cff] bg-[#dff0ff] text-[#0369a1]"
      : normalized === "under maintenance"
        ? "border-[#f59e0b] bg-[#fef3c7] text-[#b45309]"
      : normalized === "under repair"
        ? "border-[#f97316] bg-[#ffedd5] text-[#c2410c]"
      : normalized === "due"
        ? "border-[#7c3aed] bg-[#ede9fe] text-[#6d28d9]"
      : normalized === "overdue" || normalized === "out of service" || normalized === "unavailable"
        ? "border-[#ef4444] bg-[#fee2e2] text-[#b91c1c]"
      : normalized.includes("flag")
        ? "border-[#ef4444] bg-[#fee2e2] text-[#ef4444]"
        : normalized.includes("pending") || normalized.includes("hold") || normalized === "reserved"
          ? "border-[#ff7a00] bg-[#fff3e4] text-[#c2410c]"
          : normalized.includes("failed") || normalized.includes("cancel") || normalized.includes("lock") || normalized.includes("retired") || normalized.includes("decommission")
            ? "border-[#ef4444] bg-[#fee2e2] text-[#b91c1c]"
            : normalized.includes("inactive")
              ? "border-[#94a3b8] bg-[#f1f5f9] text-[#64748b]"
              : "border-[#94a3b8] bg-[#f8fafc] text-[#475569]";

  return (
    <span
      className={`inline-flex min-w-24 justify-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${style}`}
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
  const itemCount = items?.length ?? [onView, onEdit, onDelete].filter(Boolean).length;
  const hasActions = itemCount > 0;

  useEffect(() => {
    if (!open || !hasActions) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const menuWidth = 160;
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
  }, [hasActions, itemCount, onDelete, onEdit, onView, open]);

  if (!hasActions) return null;

  const menu = open && hasActions && position ? (
    <div
      className="fixed z-[100] w-40 overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-1.5 text-left"
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
  onExcel: () => void;
  onCsv?: () => void;
}

export const ExportButton = ({ open, onToggle, onPdf, onExcel, onCsv }: ExportButtonProps) => (
  <div className="relative">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#070b45] px-4 text-sm font-bold uppercase text-white transition hover:bg-[#11175f]"
      aria-expanded={open}
    >
      <Download className="h-5 w-5" />
      Export
    </button>
    {open && (
      <div
        className="absolute right-0 top-12 z-30 w-40 overflow-hidden rounded-xl border border-[#dce3ed] bg-white py-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="block w-full px-4 py-2.5 text-left text-sm text-[#344158] hover:bg-[#f8fafc]" onClick={onPdf}>
          PDF
        </button>
        {onCsv && (
          <button type="button" className="block w-full px-4 py-2.5 text-left text-sm text-[#344158] hover:bg-[#f8fafc]" onClick={onCsv}>
            CSV
          </button>
        )}
        <button type="button" className="block w-full px-4 py-2.5 text-left text-sm text-[#344158] hover:bg-[#f8fafc]" onClick={onExcel}>
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
  const pages: Array<number | "start-ellipsis" | "end-ellipsis"> = (() => {
    if (totalPages <= 6) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (page <= 3) {
      return [1, 2, 3, 4, 5, "end-ellipsis", totalPages];
    }

    if (page >= totalPages - 2) {
      return [
        1,
        "start-ellipsis",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "start-ellipsis",
      page - 1,
      page,
      page + 1,
      "end-ellipsis",
      totalPages,
    ];
  })();

  return (
    <div className="flex flex-col gap-3 px-0 py-4 text-sm text-[#70747c] sm:flex-row sm:items-center sm:justify-between">
      <span>
        {Math.min(pageSize, totalItems)} of {totalItems} items
      </span>
      <div className="flex items-center gap-2">
        {pages.map((item) =>
          typeof item === "number" ? (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-label={`Go to page ${item}`}
              aria-current={item === page ? "page" : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1 text-sm font-bold ${
                item === page ? "bg-[#070b45] text-white" : "text-[#070b45] hover:bg-[#f1f5f9]"
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
        <label className="flex items-center gap-3">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-full border border-[#eadede] bg-white px-3 py-1.5 text-sm font-bold text-[#070b45] outline-none focus:border-[#070b45]"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} rows
              </option>
            ))}
          </select>
        </label>
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[100] w-[min(24rem,calc(100vw-2rem))]">
      <div
        role={type === "error" ? "alert" : "status"}
        className={`pointer-events-auto flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${styles}`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10">
          <Check className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 break-words">{message}</span>
      </div>
    </div>,
    document.body,
  );
};
