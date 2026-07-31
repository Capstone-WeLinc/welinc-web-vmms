export type TimeFilterValue =
  | "all"
  | "today"
  | "week"
  | "month"
  | "last-month"
  | "quarter"
  | "year"
  | "last-year"
  | "custom";

export const timeFilterOptions: { value: TimeFilterValue; label: string }[] = [
  { value: "all", label: "All Records" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "custom", label: "Custom Date" },
];

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const parseLocalDate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const getTimeFilterRange = (
  filter: TimeFilterValue,
  customFrom = "",
  customTo = "",
  now = new Date(),
) => {
  const today = startOfDay(now);

  if (filter === "all") return { from: null, to: null };
  if (filter === "today") return { from: today, to: endOfDay(today) };

  if (filter === "week") {
    const from = new Date(today);
    from.setDate(today.getDate() - today.getDay());
    const to = endOfDay(new Date(from));
    to.setDate(from.getDate() + 6);
    return { from, to };
  }

  if (filter === "month") {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }

  if (filter === "last-month") {
    return {
      from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      to: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }

  if (filter === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return {
      from: new Date(today.getFullYear(), quarterStartMonth, 1),
      to: endOfDay(new Date(today.getFullYear(), quarterStartMonth + 3, 0)),
    };
  }

  if (filter === "year") {
    return {
      from: new Date(today.getFullYear(), 0, 1),
      to: endOfDay(new Date(today.getFullYear(), 11, 31)),
    };
  }

  if (filter === "last-year") {
    return {
      from: new Date(today.getFullYear() - 1, 0, 1),
      to: endOfDay(new Date(today.getFullYear() - 1, 11, 31)),
    };
  }

  return {
    from: parseLocalDate(customFrom),
    to: customTo ? endOfDay(parseLocalDate(customTo) ?? new Date(customTo)) : null,
  };
};

export const isInTimeFilterRange = (
  date: Date,
  filter: TimeFilterValue,
  customFrom = "",
  customTo = "",
  now = new Date(),
) => {
  if (filter === "all") return true;
  if (Number.isNaN(date.getTime())) return false;
  const { from, to } = getTimeFilterRange(filter, customFrom, customTo, now);
  return (!from || date >= from) && (!to || date <= to);
};
