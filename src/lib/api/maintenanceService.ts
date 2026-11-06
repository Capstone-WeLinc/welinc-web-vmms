export {
  createMaintenanceSchedule,
  cancelMaintenanceSchedule,
  deleteMaintenanceSchedule,
  getChecklistTemplates,
  getChecklistTemplateId,
  getMaintenanceSchedules,
  getWorkOrders,
  saveChecklistTemplates,
  updateMaintenanceSchedule,
  updateWorkOrderPriority,
  updateWorkOrder,
  updateWorkOrderProgress,
  uploadWorkOrderAttachment,
  deleteWorkOrderAttachment,
  openWorkOrderAttachment,
} from "./vmmsApi";

export type { WorkOrderAttachment } from "./vmmsApi";

export type {
  ChecklistItemTemplate,
  CreateMaintenanceScheduleInput,
  MaintenanceStatus,
  MaintenanceTask,
  ChecklistTemplateName,
} from "./vmmsApi";
