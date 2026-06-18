import type { MaintenanceTask } from "../../types/maintenance";
import {
  defaultChecklistTemplates,
  type WorkOrderTemplate,
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

export type Transaction = {
  id: string;
  date: string;
  type: "Income" | "Expense";
  vehicle: string;
  plate: string;
  description: string;
  client: string;
  amount: string;
};

export type ProfitabilitySummary = {
  totalIncome: string;
  totalExpenses: string;
  netProfit: string;
  profitMargin: number;
  flaggedVehicles: {
    id: string;
    name: string;
    plate: string;
    model: string;
    flagReason: string;
    netProfit: string;
  }[];
  profitabilityRanking: Array<{
    id: string;
    vehicleName: string;
    plate: string;
    income: string;
    cost: string;
    netProfit: string;
    margin: number;
    clientType: string;
    region: string;
    flagged?: boolean;
    details: string;
    individual: string;
    corporate: string;
    fuel: string;
    maint: string;
    repairs: string;
  }>;
  incomeByClientType: {
    corporate: { percentage: number };
    individual: { percentage: number };
  };
  topProfitableVehicles: Array<{
    id: string;
    name: string;
    plate: string;
    netProfit: string;
  }>;
};

export type UserStatus = "Active" | "Inactive" | "Suspended";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MECHANIC" | "OPERATIONS";
  status: UserStatus;
  lastActive: string;
  isLocked?: boolean;
  lockedAt?: string | null;
};

export type UserRole = UserRecord["role"];
export type UserCreateInput = {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
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

export const mockTransactions: Transaction[] = [
  {
    id: "t1",
    date: "2025-03-30",
    type: "Income",
    vehicle: "Truck Juliet",
    plate: "BCD-8901",
    description: "BK-2025-0285",
    client: "Individual",
    amount: "+₱32,000",
  },
  {
    id: "t2",
    date: "2025-03-28",
    type: "Income",
    vehicle: "Truck India",
    plate: "YZA-4567",
    description: "BK-2025-0282",
    client: "Corporate",
    amount: "+₱46,000",
  },
  {
    id: "t3",
    date: "2025-03-25",
    type: "Income",
    vehicle: "Truck Hotel",
    plate: "VWX-0123",
    description: "BK-2025-0278",
    client: "Individual",
    amount: "+₱24,000",
  },
  {
    id: "t4",
    date: "2025-03-25",
    type: "Expense",
    vehicle: "Truck Juliet",
    plate: "BCD-8901",
    description: "Cooling System Flush",
    client: "—",
    amount: "-₱4,500",
  },
  {
    id: "t5",
    date: "2025-03-20",
    type: "Income",
    vehicle: "Truck Foxtrot",
    plate: "PQR-2345",
    description: "BK-2025-0272",
    client: "Corporate",
    amount: "+₱33,000",
  },
  {
    id: "t6",
    date: "2025-03-20",
    type: "Expense",
    vehicle: "Truck Echo",
    plate: "MNO-7890",
    description: "Filter Replacement",
    client: "—",
    amount: "-₱6,500",
  },
  {
    id: "t7",
    date: "2025-03-18",
    type: "Income",
    vehicle: "Truck Alpha",
    plate: "ABC-1234",
    description: "BK-2025-0269",
    client: "Individual",
    amount: "+₱28,000",
  },
  {
    id: "t8",
    date: "2025-03-16",
    type: "Expense",
    vehicle: "Truck Echo",
    plate: "VWX-0123",
    description: "Electrical System Diagnostic",
    client: "—",
    amount: "-₱5,000",
  },
];

export const mockWorkOrders: MaintenanceTask[] = [
  {
    id: "task-1",
    vehicleId: "TRK-0011",
    title: "Oil Change",
    status: "Pending",
    date: "2026-05-22",
    assignedDriver: "J. Dela Cruz",
    notes: "Standard oil and filter change. Synthetic 5W-30.",
    garageId: "g1",
    accountType: "Corporate - Bonchon",
    odometerReading: "12000",
    systemAffected: "engine",
    triggerType: "ODOMETER",
    intervalKm: "10000",
    bufferDistanceKm: "500",
    startingReferenceReadingKm: "2000",
    intervalType: "MONTHLY",
    startReferenceDate: "2026-01-01",
  },
  {
    id: "task-2",
    vehicleId: "TRK-0022",
    title: "Brake Inspection",
    status: "In-Progress",
    date: "2026-05-20",
    assignedDriver: "Sarah Connor",
    notes: "Scheduled 10,000-mile tire rotation and alignment check.",
    garageId: "g2",
    accountType: "Corporate - Bonchon",
    odometerReading: "45000",
    systemAffected: "brakes",
    triggerType: "TIME",
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: "DAILY",
    startReferenceDate: "2026-05-01",
  },
  {
    id: "task-3",
    vehicleId: "TRK-11",
    title: "Oil Change",
    status: "Pending",
    date: "2026-05-22",
    assignedDriver: "David Miller",
    notes: "Standard oil and filter change. Synthetic 5W-30.",
  },
  {
    id: "task-4",
    vehicleId: "TRK-44",
    title: "Engine Tune",
    status: "Completed",
    date: "2026-05-25",
    assignedDriver: "Elena Rostova",
    notes: "Spark plug replacement and engine timing calibration completed.",
  },
  {
    id: "task-5",
    vehicleId: "TRK-55",
    title: "Flagged PM",
    status: "Flagged",
    date: "2026-05-27",
    assignedDriver: "James Carter",
    notes:
      "Coolant leak reported near radiator intake. Urgently flag for repair inspection.",
  },
];

export const defaultProfitabilitySummary: ProfitabilitySummary = {
  totalIncome: "$1,200,000",
  totalExpenses: "$850,000",
  netProfit: "$350,000",
  profitMargin: 29.2,
  flaggedVehicles: [
    {
      id: "v1",
      name: "Truck A",
      plate: "ABC-123",
      model: "Model X",
      flagReason: "Overdue maintenance",
      netProfit: "-$12,000",
    },
    {
      id: "v2",
      name: "Van B",
      plate: "XYZ-789",
      model: "Model Y",
      flagReason: "Low fuel efficiency",
      netProfit: "-$5,400",
    },
  ],
  profitabilityRanking: [
    {
      id: "r1",
      vehicleName: "Truck Echo",
      plate: "MNO-7890",
      income: "₱210,000",
      cost: "₱55,000",
      netProfit: "₱154,500",
      margin: 73.6,
      clientType: "Corporate",
      region: "North",
      flagged: false,
      details: "View",
      individual: "₱90,000",
      corporate: "₱120,000",
      fuel: "₱48,000",
      maint: "₱6,500",
      repairs: "₱1,000",
    },
    {
      id: "r2",
      vehicleName: "Truck Alpha",
      plate: "ABC-1234",
      income: "₱185,000",
      cost: "₱53,500",
      netProfit: "₱131,500",
      margin: 71.1,
      clientType: "Individual",
      region: "Central",
      flagged: false,
      details: "View",
      individual: "₱82,000",
      corporate: "₱103,000",
      fuel: "₱42,000",
      maint: "₱6,500",
      repairs: "₱5,000",
    },
    {
      id: "r3",
      vehicleName: "Truck Foxtrot",
      plate: "PQR-2345",
      income: "₱178,000",
      cost: "₱54,800",
      netProfit: "₱123,200",
      margin: 69.2,
      clientType: "Corporate",
      region: "South",
      flagged: false,
      details: "View",
      individual: "₱97,000",
      corporate: "₱81,000",
      fuel: "₱44,500",
      maint: "₱7,800",
      repairs: "₱2,500",
    },
    {
      id: "r4",
      vehicleName: "Truck Bravo",
      plate: "DEF-5678",
      income: "₱162,000",
      cost: "₱71,500",
      netProfit: "₱90,500",
      margin: 55.9,
      clientType: "Individual",
      region: "East",
      flagged: false,
      details: "View",
      individual: "₱67,000",
      corporate: "₱95,000",
      fuel: "₱51,000",
      maint: "₱12,000",
      repairs: "₱8,500",
    },
    {
      id: "r5",
      vehicleName: "Truck Kilo",
      plate: "EFG-2345",
      income: "₱142,000",
      cost: "₱39,500",
      netProfit: "₱103,700",
      margin: 73,
      clientType: "Corporate",
      region: "West",
      flagged: false,
      details: "View",
      individual: "₱62,000",
      corporate: "₱80,000",
      fuel: "₱32,000",
      maint: "₱5,500",
      repairs: "₱800",
    },
    {
      id: "r6",
      vehicleName: "Truck Hotel",
      plate: "VWX-0123",
      income: "₱89,000",
      cost: "₱35,000",
      netProfit: "₱68,000",
      margin: 76.4,
      clientType: "Individual",
      region: "North",
      flagged: false,
      details: "View",
      individual: "₱54,000",
      corporate: "₱35,000",
      fuel: "₱18,000",
      maint: "₱3,000",
      repairs: "₱0",
    },
    {
      id: "r7",
      vehicleName: "Truck Golf",
      plate: "STU-6789",
      income: "₱145,000",
      cost: "₱97,000",
      netProfit: "₱48,000",
      margin: 33.1,
      clientType: "Corporate",
      region: "Central",
      flagged: false,
      details: "View",
      individual: "₱62,000",
      corporate: "₱83,000",
      fuel: "₱55,000",
      maint: "₱14,000",
      repairs: "₱28,000",
    },
    {
      id: "r8",
      vehicleName: "Truck Juliet",
      plate: "BCD-8901",
      income: "₱112,000",
      cost: "₱42,000",
      netProfit: "₱41,500",
      margin: 46.6,
      clientType: "Individual",
      region: "South",
      flagged: false,
      details: "View",
      individual: "₱70,000",
      corporate: "₱42,000",
      fuel: "₱48,000",
      maint: "₱11,000",
      repairs: "₱13,500",
    },
    {
      id: "r9",
      vehicleName: "Truck Charlie A",
      plate: "GHI-9012",
      income: "₱98,000",
      cost: "₱65,000",
      netProfit: "₱32,500",
      margin: 33.2,
      clientType: "Corporate",
      region: "East",
      flagged: false,
      details: "View",
      individual: "₱60,000",
      corporate: "₱38,000",
      fuel: "₱28,000",
      maint: "₱15,000",
      repairs: "₱22,500",
    },
    {
      id: "r10",
      vehicleName: "Truck Delta A",
      plate: "JKL-3456",
      income: "₱134,000",
      cost: "₱100,000",
      netProfit: "₱32,000",
      margin: 23.9,
      clientType: "Corporate",
      region: "North",
      flagged: false,
      details: "View",
      individual: "₱44,000",
      corporate: "₱90,000",
      fuel: "₱58,000",
      maint: "₱9,000",
      repairs: "₱35,000",
    },
  ],
  incomeByClientType: {
    corporate: { percentage: 65 },
    individual: { percentage: 35 },
  },
  topProfitableVehicles: [
    { id: "t1", name: "Truck Echo", plate: "MNO-7890", netProfit: "₱154,500" },
    { id: "t2", name: "Truck Alpha", plate: "ABC-1234", netProfit: "₱131,500" },
    {
      id: "t3",
      name: "Truck Foxtrot",
      plate: "PQR-2345",
      netProfit: "₱123,200",
    },
  ],
};

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
];

export function getMockChecklistTemplates(): Record<
  WorkOrderTemplate,
  ChecklistItemTemplate[]
> {
  const saved = window.localStorage.getItem("checklistTemplates");
  if (saved) {
    try {
      return JSON.parse(saved) as Record<
        WorkOrderTemplate,
        ChecklistItemTemplate[]
      >;
    } catch {
      return defaultChecklistTemplates;
    }
  }
  return defaultChecklistTemplates;
}

export function saveMockChecklistTemplates(
  templates: Record<WorkOrderTemplate, ChecklistItemTemplate[]>,
) {
  window.localStorage.setItem("checklistTemplates", JSON.stringify(templates));
  return templates;
}

export type GarageRecord = { id: string; name: string };
export const mockGarages: GarageRecord[] = [
  { id: "g1", name: "Main Garage" },
  { id: "g2", name: "North Cluster" },
  { id: "g3", name: "South Hub" },
];

export type SystemRecord = { id: string; name: string };
export const mockSystems: SystemRecord[] = [
  { id: "s1", name: "Engine" },
  { id: "s2", name: "Brakes" },
  { id: "s3", name: "Electrical" },
  { id: "s4", name: "Transmission" },
];
