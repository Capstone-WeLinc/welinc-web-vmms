import { MaintenanceStatus } from "../../types/maintenance";

export const maintenanceStatusColors: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PENDING]: "#047857",
  [MaintenanceStatus.DUE]: "#c2410c",
  [MaintenanceStatus.IN_PROGRESS]: "#1d4ed8",
  [MaintenanceStatus.DONE]: "#b45309",
  [MaintenanceStatus.COMPLETED]: "#64748b",
  [MaintenanceStatus.OVERDUE]: "#b91c1c",
  [MaintenanceStatus.CANCELLED]: "#64748b",
};

const maintenanceStatusClasses: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.PENDING]: "border-emerald-200 bg-emerald-50 text-emerald-800",
  [MaintenanceStatus.DUE]: "border-orange-200 bg-orange-50 text-orange-800",
  [MaintenanceStatus.IN_PROGRESS]: "border-blue-200 bg-blue-50 text-blue-800",
  [MaintenanceStatus.DONE]: "border-amber-200 bg-amber-50 text-amber-900",
  [MaintenanceStatus.COMPLETED]: "border-slate-200 bg-slate-50 text-slate-600",
  [MaintenanceStatus.OVERDUE]: "border-red-200 bg-red-50 text-red-800",
  [MaintenanceStatus.CANCELLED]: "border-slate-200 bg-slate-50 text-slate-600",
};

export const getMaintenanceStatusClasses = (status: MaintenanceStatus) =>
  maintenanceStatusClasses[status];
