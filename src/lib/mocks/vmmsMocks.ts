import {
  AccountType,
  MaintenanceIntervalType,
  MaintenanceStatus,
  MaintenanceTriggerType,
  type MaintenanceTask,
} from "../../types/maintenance";
import {
  defaultChecklistTemplates,
  type ChecklistTemplateName,
  type ChecklistItemTemplate,
} from "../../data/ChecklistData";

export type DashboardStat = {
  label: string;
  value: string;
  change: string;
  icon: string;
  color: string;
  bgColor: string;
};

export type ActivityItem = {
  action: string;
  vehicle: string;
  time: string;
  status: "completed" | "scheduled" | "in-progress" | "failed";
};

export type MaintenanceItem = {
  vehicle: string;
  task: string;
  due: string;
  priority: "high" | "medium" | "low";
};


export type UserStatus = "Active" | "Inactive" | "Suspended";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  contact?: string | null;
  profilePicture?: string | null;
  username?: string;
  role: "ADMIN" | "MECHANIC" | "OPERATIONS" | "CHIEF_MECHANIC";
  status: UserStatus;
  lastActive: string;
  updatedAt?: string;
  isLocked?: boolean;
  lockedAt?: string | null;
  systems?: string[];
};

export type UserRole = UserRecord["role"];
export type UserCreateInput = {
  name: string;
  email: string;
  username?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
};

export const mockDashboardStats: DashboardStat[] = [
  {
    label: "Total Vehicles",
    value: "148",
    change: "+3 this month",
    icon: "Truck",
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.12)",
  },
  {
    label: "Active Work Orders",
    value: "23",
    change: "5 urgent",
    icon: "Wrench",
    color: "#f59e0b",
    bgColor: "rgba(245, 158, 11, 0.12)",
  },
  {
    label: "Overdue Maintenance",
    value: "7",
    change: "Needs attention",
    icon: "AlertTriangle",
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.12)",
  },
  {
    label: "Completed This Week",
    value: "31",
    change: "+12% vs last week",
    icon: "CheckCircle2",
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.12)",
  },
];

export const mockRecentActivity: ActivityItem[] = [
  {
    action: "Oil change completed",
    vehicle: "TRK-2045",
    time: "12 min ago",
    status: "completed",
  },
  {
    action: "Brake inspection scheduled",
    vehicle: "VAN-1089",
    time: "34 min ago",
    status: "scheduled",
  },
  {
    action: "Tire rotation in progress",
    vehicle: "SUV-3021",
    time: "1 hr ago",
    status: "in-progress",
  },
  {
    action: "Engine diagnostic failed",
    vehicle: "TRK-1567",
    time: "2 hr ago",
    status: "failed",
  },
  {
    action: "Transmission fluid replaced",
    vehicle: "SED-0842",
    time: "3 hr ago",
    status: "completed",
  },
];

export const mockUpcomingMaintenance: MaintenanceItem[] = [
  {
    vehicle: "TRK-2045",
    task: "Transmission Service",
    due: "Tomorrow",
    priority: "high",
  },
  {
    vehicle: "VAN-1089",
    task: "Tire Replacement",
    due: "In 2 days",
    priority: "medium",
  },
  {
    vehicle: "SUV-3021",
    task: "A/C Recharge",
    due: "In 3 days",
    priority: "low",
  },
  {
    vehicle: "SED-0842",
    task: "Battery Check",
    due: "In 5 days",
    priority: "low",
  },
];


export const mockWorkOrders: MaintenanceTask[] = [
  {
    id: "task-1",
    vehicleId: "TRK-0011",
    title: "Oil Change",
    status: MaintenanceStatus.PENDING,
    date: "2026-05-22",
    assignedDriver: "J. Dela Cruz",
    chiefMechanic: "Chief Mech One",
    notes: "Standard oil and filter change. Synthetic 5W-30.",
    garageId: "g1",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "12000",
    systemAffected: "engine",
    triggerType: MaintenanceTriggerType.ODOMETER,
    intervalKm: "10000",
    bufferDistanceKm: "500",
    startingReferenceReadingKm: "2000",
    intervalType: MaintenanceIntervalType.MONTHLY,
    startReferenceDate: "2026-01-01",
  },
  {
    id: "task-2",
    vehicleId: "TRK-0022",
    title: "Brake Inspection",
    status: MaintenanceStatus.IN_PROGRESS,
    date: "2026-05-20",
    assignedDriver: "Sarah Connor",
    chiefMechanic: "Chief Mech One",
    notes: "Scheduled 10,000-mile tire rotation and alignment check.",
    garageId: "g2",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "45000",
    systemAffected: "brakes",
    triggerType: MaintenanceTriggerType.TIME,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.DAILY,
    startReferenceDate: "2026-05-01",
  },
  {
    id: "task-3",
    vehicleId: "TRK-11",
    title: "Oil Change",
    status: MaintenanceStatus.PENDING,
    date: "2026-05-22",
    assignedDriver: "David Miller",
    chiefMechanic: "Chief Mech One",
    notes: "Standard oil and filter change. Synthetic 5W-30.",
  },
  {
    id: "task-4",
    vehicleId: "TRK-44",
    title: "Engine Tune",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-05-25",
    assignedDriver: "Elena Rostova",
    chiefMechanic: "Chief Mech One",
    notes: "Spark plug replacement and engine timing calibration completed.",
  },
  {
    id: "task-5",
    vehicleId: "TRK-55",
    title: "Flagged PM",
    status: MaintenanceStatus.OVERDUE,
    date: "2026-05-27",
    assignedDriver: "James Carter",
    chiefMechanic: "Chief Mech One",
    notes:
      "Coolant leak reported near radiator intake. Urgently flag for repair inspection.",
  },
];


export const mockUsers: UserRecord[] = [
  {
    id: "u1",
    name: "Alice Mendoza",
    email: "alice.mendoza@welinc.com",
    role: "ADMIN",
    status: "Active",
    lastActive: "2026-05-28T10:15:00.000Z",
  },
  {
    id: "u2",
    name: "Brian Santos",
    email: "brian.santos@welinc.com",
    role: "OPERATIONS",
    status: "Active",
    lastActive: "2026-05-27T16:40:00.000Z",
  },
  {
    id: "u3",
    name: "Cara Gomez",
    email: "cara.gomez@welinc.com",
    role: "MECHANIC",
    status: "Inactive",
    lastActive: "2026-05-20T08:10:00.000Z",
  },
  {
    id: "u4",
    name: "Daniel Park",
    email: "daniel.park@welinc.com",
    role: "OPERATIONS",
    status: "Suspended",
    lastActive: "2026-05-18T15:25:00.000Z",
  },
  {
    id: "u5",
    name: "Erica Lopez",
    email: "erica.lopez@welinc.com",
    role: "MECHANIC",
    status: "Active",
    lastActive: "2026-05-29T09:05:00.000Z",
  },
  {
    id: "u6",
    name: "Chief Mech One",
    email: "vmms.chiefmech@welinc.com",
    role: "CHIEF_MECHANIC",
    status: "Active",
    lastActive: "2026-05-30T07:00:00.000Z",
  },
];

export function getMockChecklistTemplates(): Record<
  ChecklistTemplateName,
  ChecklistItemTemplate[]
> {
  const saved = window.localStorage.getItem("checklistTemplates");
  if (saved) {
    try {
      return JSON.parse(saved) as Record<
        ChecklistTemplateName,
        ChecklistItemTemplate[]
      >;
    } catch {
      return defaultChecklistTemplates;
    }
  }
  return defaultChecklistTemplates;
}

export function saveMockChecklistTemplates(
  templates: Record<ChecklistTemplateName, ChecklistItemTemplate[]>,
) {
  window.localStorage.setItem("checklistTemplates", JSON.stringify(templates));
  return templates;
}

export type GarageRecord = { id: string; name: string };
export const mockGarages: GarageRecord[] = [
  { id: "g1", name: "Marikina" },
  { id: "g2", name: "Sta. Rosa" },
  { id: "g3", name: "Pulilan" },
];

export type SystemRecord = { id: string; name: string };
export const mockSystems: SystemRecord[] = [
  { id: "s1", name: "Engine" },
  { id: "s2", name: "Brakes" },
  { id: "s3", name: "Electrical" },
  { id: "s4", name: "Transmission" },
];

// --- Vehicle Management ---
export type VehicleRecord = {
  id: string;
  plateNumber: string;
  make: string | null;
  model: string;
  year: number | null;
  engineType: string | null;
  truckSizeCategory: string | null;
  odometer: number;
  lastMaintenanceDate: string | null;
  garageId: string | null;
  garageName?: string | null;
  status: "AVAILABLE" | "IN_TRANSIT" | "UNDER_MAINTENANCE" | "UNDER_REPAIR";
  isActive: boolean;
};

export type VehicleRecordInput = Omit<
  VehicleRecord,
  "id" | "garageId" | "garageName" | "make" | "year" | "engineType" | "truckSizeCategory" | "lastMaintenanceDate" | "status" | "isActive"
> & {
  garageId: string;
  make: string;
  year: number;
  engineType: string;
  truckSizeCategory: string;
};

export const mockVehicleRecords: VehicleRecord[] = [
  { id: "vr1", plateNumber: "ABC-1234", make: "Isuzu", model: "Elf", year: 2020, engineType: "Diesel", truckSizeCategory: "Light Duty", odometer: 12000, lastMaintenanceDate: "2026-09-12T08:30:00.000Z", garageId: "g1", garageName: "Marikina", status: "AVAILABLE", isActive: true },
  { id: "vr2", plateNumber: "DEF-5678", make: "Mitsubishi", model: "Fuso FB", year: 2019, engineType: "Diesel", truckSizeCategory: "Medium Duty", odometer: 45000, lastMaintenanceDate: "2026-08-18T08:30:00.000Z", garageId: "g2", garageName: "Sta. Rosa", status: "UNDER_REPAIR", isActive: true },
  { id: "vr3", plateNumber: "GHI-9012", make: "Fuso", model: "Canter", year: 2021, engineType: "Diesel", truckSizeCategory: "Light Duty", odometer: 8200, lastMaintenanceDate: null, garageId: "g3", garageName: "Pulilan", status: "AVAILABLE", isActive: true },
  { id: "vr4", plateNumber: "JKL-3456", make: null, model: "Hino 500", year: null, engineType: null, truckSizeCategory: null, odometer: 62000, lastMaintenanceDate: null, garageId: null, garageName: null, status: "UNDER_MAINTENANCE", isActive: false },
  { id: "vr5", plateNumber: "MNO-7890", make: "Isuzu", model: "NKR", year: 2018, engineType: "Diesel", truckSizeCategory: "Light Duty", odometer: 3100, lastMaintenanceDate: "2026-07-01T08:30:00.000Z", garageId: "g1", garageName: "Marikina", status: "AVAILABLE", isActive: true },
];

// --- Garage Management ---
export type GarageFullRecord = {
  id: string;
  name: string;
  isActive: boolean;
};

export const mockGarageRecords: GarageFullRecord[] = [
  { id: "g1", name: "Marikina", isActive: true },
  { id: "g2", name: "Sta. Rosa", isActive: true },
  { id: "g3", name: "Pulilan", isActive: true },
];
