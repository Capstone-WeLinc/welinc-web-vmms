import {
  MaintenanceStatus,
  maintenanceStatusLabels,
} from "../../types/maintenance";
import {
  getMaintenanceStatusClasses,
  maintenanceStatusColors,
} from "../../lib/utils/maintenanceStatusPresentation";

const urgencyStatuses = [
  MaintenanceStatus.PENDING,
  MaintenanceStatus.DUE,
  MaintenanceStatus.OVERDUE,
] as const;

export default function MaintenanceStatusLegend({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Schedule urgency legend"
      className={`flex flex-wrap items-center gap-2 ${className}`}
    >
      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
        Schedule urgency
      </span>
      {urgencyStatuses.map((status) => (
        <span
          key={status}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getMaintenanceStatusClasses(status)}`}
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: maintenanceStatusColors[status] }}
          />
          {maintenanceStatusLabels[status]}
        </span>
      ))}
    </div>
  );
}
