import {
  maintenanceStatusLabels,
  type MaintenanceStatus as MaintenanceStatusValue,
} from "../../types/maintenance";
import {
  getMaintenanceStatusClasses,
  maintenanceStatusColors,
} from "../../lib/utils/maintenanceStatusPresentation";

export default function MaintenanceStatusBadge({
  status,
}: {
  status: MaintenanceStatusValue;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${getMaintenanceStatusClasses(status)}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: maintenanceStatusColors[status] }}
      />
      {maintenanceStatusLabels[status] ?? status}
    </span>
  );
}
