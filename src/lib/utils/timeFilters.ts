export type TimeFilterValue =
  | "all"
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export const timeFilterOptions: { value: TimeFilterValue; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Date Range" },
];

export function isInTimeFilterRange(
  dateInput: Date | string | number | null | undefined,
  filter: TimeFilterValue,
  customFrom?: string,
  customTo?: string,
): boolean {
  if (!dateInput) return false;
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  switch (filter) {
    case "all":
      return true;
    case "today": {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    }
    case "this_week": {
      const startOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return date >= startOfWeek && date <= endOfWeek;
    }
    case "this_month": {
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    }
    case "last_month": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return (
        date.getFullYear() === lastMonth.getFullYear() &&
        date.getMonth() === lastMonth.getMonth()
      );
    }
    case "this_year": {
      return date.getFullYear() === now.getFullYear();
    }
    case "custom": {
      if (customFrom) {
        const fromDate = new Date(customFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (date < fromDate) return false;
      }
      if (customTo) {
        const toDate = new Date(customTo);
        toDate.setHours(23, 59, 59, 999);
        if (date > toDate) return false;
      }
      return true;
    }
    default:
      return true;
  }
}
