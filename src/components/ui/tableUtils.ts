export function getStatusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("complete") || normalized === "active") return "#059669";
  if (normalized.includes("progress")) return "#2563eb";
  if (normalized === "due") return "#7c3aed";
  if (
    normalized.includes("overdue") ||
    normalized.includes("flag") ||
    normalized.includes("failed") ||
    normalized.includes("cancel")
  ) return "#dc2626";
  if (normalized.includes("pending") || normalized.includes("hold")) return "#d97706";
  return "#64748b";
}
