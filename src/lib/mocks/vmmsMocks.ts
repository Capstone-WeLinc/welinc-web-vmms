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
  username?: string;
  role: "ADMIN" | "OPERATIONS" | "CHIEF_MECHANIC" | "MECHANIC";
  status: UserStatus;
  lastActive: string;
  createdAt?: string;
  updatedAt?: string;
  isLocked?: boolean;
  lockedAt?: string | null;
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
    status: MaintenanceStatus.PENDING,
    date: "2026-07-12",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
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
    date: "2026-07-11",
    assignedDriver: "Chief Mechanic Tester",
    assignedMechanicId: "u-chief-mechanic-test",
    assignedMechanicEmail: "chief.mechanic@welinc.test",
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
    title: "Tire Rotation",
    status: MaintenanceStatus.PENDING,
    date: "2026-07-14",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes: "Rotate tires, inspect tread depth, and verify wheel alignment.",
  },
  {
    id: "task-4",
    vehicleId: "TRK-44",
    title: "Engine Tune",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-07-08",
    assignedDriver: "Elena Rostova",
    notes: "Spark plug replacement and engine timing calibration completed.",
  },
  {
    id: "task-5",
    vehicleId: "TRK-55",
    title: "Flagged PM",
    status: MaintenanceStatus.OVERDUE,
    date: "2026-07-06",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes:
      "Coolant leak reported near radiator intake. Urgently flag for repair inspection.",
  },
  {
    id: "task-6",
    vehicleId: "ABC 1234",
    title: "Transmission Service",
    status: MaintenanceStatus.DUE,
    date: "2026-07-13",
    assignedDriver: "Sarah Connor",
    notes: "Service transmission fluid and inspect mounts before next dispatch cycle.",
    garageId: "g1",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "62500",
    systemAffected: "transmission",
    triggerType: MaintenanceTriggerType.ODOMETER,
    intervalKm: "20000",
    bufferDistanceKm: "750",
    startingReferenceReadingKm: "43000",
    intervalType: MaintenanceIntervalType.QUARTERLY,
    startReferenceDate: "2026-07-01",
  },
  {
    id: "task-7",
    vehicleId: "DEF 5678",
    title: "Electrical Diagnostic",
    status: MaintenanceStatus.IN_PROGRESS,
    date: "2026-07-12",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes: "Intermittent dashboard warning light. Check alternator and battery terminals.",
    garageId: "g2",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "38600",
    systemAffected: "electrical",
    triggerType: MaintenanceTriggerType.MANUAL,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.MONTHLY,
    startReferenceDate: "2026-07-12",
  },
  {
    id: "task-8",
    vehicleId: "GHI 9012",
    title: "Cooling System Flush",
    status: MaintenanceStatus.PENDING,
    date: "2026-07-17",
    assignedDriver: "Chief Mechanic Tester",
    assignedMechanicId: "u-chief-mechanic-test",
    assignedMechanicEmail: "chief.mechanic@welinc.test",
    notes: "Preventive cooling system service scheduled before long-haul assignment.",
    garageId: "g3",
    accountType: AccountType.OUTSOURCED,
    outsourcedProvider: "North Hub Service Partner",
    odometerReading: "51200",
    systemAffected: "engine",
    triggerType: MaintenanceTriggerType.TIME,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.MONTHLY,
    startReferenceDate: "2026-07-17",
  },
  {
    id: "task-chief-review-001",
    vehicleId: "DEF 5678",
    title: "Brake Inspection",
    status: MaintenanceStatus.IN_PROGRESS,
    date: "2026-07-14",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes: "Mock review case: mechanic submitted execution and Chief Mechanic needs to inspect.",
    garageId: "g2",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "42150",
    systemAffected: "brakes",
    triggerType: MaintenanceTriggerType.MANUAL,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.MONTHLY,
    startReferenceDate: "2026-07-14",
    workOrderProgress: {
      checklist: [
        { id: "1", text: "Check brake pad thickness", status: "pending", note: "" },
        { id: "2", text: "Inspect brake rotors for wear", status: "pending", note: "" },
        { id: "3", text: "Check brake fluid level and condition", status: "pending", note: "" },
        { id: "4", text: "Inspect brake lines for leaks", status: "pending", note: "" },
        { id: "5", text: "Test brake pedal feel", status: "pending", note: "" },
      ],
      execution: {
        done: true,
        remarks: "Front pads replaced, brake fluid topped up, and road test completed.",
        technicianSignature: "Mechanic Tester",
        items: [
          {
            id: "1",
            text: "Check brake pad thickness",
            status: "changed",
            note: "Front pads were below service limit and replaced.",
            partsUsed: "Front brake pad set",
            partsCost: "9800",
            attachments: ["front-brake-pads-after.jpg"],
          },
          {
            id: "2",
            text: "Inspect brake rotors for wear",
            status: "checked",
            note: "Rotor wear is within service range.",
            partsUsed: "",
            partsCost: "",
            attachments: [],
          },
          {
            id: "3",
            text: "Check brake fluid level and condition",
            status: "checked",
            note: "Fluid topped up after pad replacement.",
            partsUsed: "DOT 4 brake fluid",
            partsCost: "650",
            attachments: [],
          },
          {
            id: "4",
            text: "Inspect brake lines for leaks",
            status: "checked",
            note: "No visible leaks after pressure check.",
            partsUsed: "",
            partsCost: "",
            attachments: [],
          },
          {
            id: "5",
            text: "Test brake pedal feel",
            status: "checked",
            note: "No pull or vibration during controlled stop.",
            partsUsed: "",
            partsCost: "",
            attachments: [],
          },
        ],
      },
    },
  },
  {
    id: "task-chief-review-002",
    vehicleId: "PQR 2345",
    title: "General Inspection",
    status: MaintenanceStatus.IN_PROGRESS,
    date: "2026-07-14",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes: "Mock review case with one item already inspected so the inspection status can show in progress.",
    garageId: "g3",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "66950",
    systemAffected: "safety",
    triggerType: MaintenanceTriggerType.TIME,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.ANNUALLY,
    startReferenceDate: "2026-07-14",
    workOrderProgress: {
      checklist: [
        { id: "1", text: "Check all fluid levels", status: "pass", note: "All levels verified." },
        { id: "2", text: "Inspect belts and hoses", status: "pending", note: "" },
        { id: "3", text: "Test battery and charging system", status: "pending", note: "" },
        { id: "4", text: "Check exterior and interior lights", status: "pending", note: "" },
        { id: "5", text: "Inspect wiper blades", status: "pending", note: "" },
      ],
      execution: {
        done: true,
        remarks: "Lighting, wipers, and safety equipment prepared for chief review.",
        technicianSignature: "Mechanic Tester",
        items: [
          {
            id: "1",
            text: "Check all fluid levels",
            status: "checked",
            note: "Oil, coolant, brake, and washer fluid levels verified.",
            partsUsed: "",
            partsCost: "",
            attachments: [],
          },
          {
            id: "2",
            text: "Inspect belts and hoses",
            status: "checked",
            note: "No cracking, leaks, or loose clamps found.",
            partsUsed: "",
            partsCost: "",
            attachments: [],
          },
          {
            id: "3",
            text: "Test battery and charging system",
            status: "checked",
            note: "Battery passed load test.",
            partsUsed: "",
            partsCost: "",
            attachments: [],
          },
          {
            id: "4",
            text: "Check exterior and interior lights",
            status: "checked",
            note: "Headlights, brake lights, and reflectors verified.",
            partsUsed: "",
            partsCost: "",
            attachments: [],
          },
          {
            id: "5",
            text: "Inspect wiper blades",
            status: "changed",
            note: "Wiper blades streaking and replaced.",
            partsUsed: "Wiper blade pair",
            partsCost: "1600",
            attachments: ["wiper-blades-replaced.jpg"],
          },
        ],
      },
    },
  },
  {
    id: "task-demo-jan-001",
    vehicleId: "ABC 1234",
    title: "Preventive Maintenance A",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-01-18",
    assignedDriver: "Chief Mechanic Tester",
    assignedMechanicId: "u-chief-mechanic-test",
    assignedMechanicEmail: "chief.mechanic@welinc.test",
    notes: "Demo completed PM record for frontend chart validation.",
    garageId: "g1",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "59800",
    systemAffected: "engine",
    triggerType: MaintenanceTriggerType.ODOMETER,
    intervalKm: "10000",
    bufferDistanceKm: "500",
    startingReferenceReadingKm: "50000",
    intervalType: MaintenanceIntervalType.MONTHLY,
    startReferenceDate: "2026-01-15",
    workOrderProgress: {
      checklist: [{ status: "passed" }, { status: "passed" }, { status: "passed" }],
      execution: {
        done: true,
        remarks: "Oil, filters, and belt inspection completed.",
        technicianSignature: "Chief Mechanic Tester",
        items: [
          { text: "Engine oil", status: "changed", partsUsed: "Synthetic oil", partsCost: "4200" },
          { text: "Oil filter", status: "changed", partsUsed: "OEM filter", partsCost: "1200" },
          { text: "Labor", status: "passed", partsUsed: "In-house labor", partsCost: "1800" },
        ],
      },
    },
  },
  {
    id: "task-demo-feb-001",
    vehicleId: "DEF 5678",
    title: "Brake System Repair",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-02-20",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes: "Demo repair record with higher cost for flagged vehicle charts.",
    garageId: "g2",
    accountType: AccountType.OUTSOURCED,
    outsourcedProvider: "Metro Brake Specialist",
    odometerReading: "40200",
    systemAffected: "brakes",
    triggerType: MaintenanceTriggerType.MANUAL,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.QUARTERLY,
    startReferenceDate: "2026-02-18",
    workOrderProgress: {
      checklist: [{ status: "failed" }, { status: "passed" }, { status: "passed" }],
      execution: {
        done: true,
        remarks: "Brake pads and rotors replaced by outsourced provider.",
        technicianSignature: "Metro Brake Specialist",
        items: [
          { text: "Brake pads", status: "changed", partsUsed: "Front and rear pads", partsCost: "9800" },
          { text: "Brake rotors", status: "changed", partsUsed: "Rotor set", partsCost: "14500" },
          { text: "Service labor", status: "changed", partsUsed: "Outsourced labor", partsCost: "6200" },
        ],
      },
    },
  },
  {
    id: "task-demo-mar-001",
    vehicleId: "GHI 9012",
    title: "Cooling System Flush",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-03-16",
    assignedDriver: "Elena Rostova",
    notes: "Demo completed cooling maintenance for reports.",
    garageId: "g3",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "52100",
    systemAffected: "engine",
    triggerType: MaintenanceTriggerType.TIME,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.MONTHLY,
    startReferenceDate: "2026-03-15",
    workOrderProgress: {
      checklist: [{ status: "passed" }, { status: "passed" }],
      execution: {
        done: true,
        remarks: "Coolant replaced and radiator pressure test passed.",
        technicianSignature: "Elena Rostova",
        items: [
          { text: "Coolant", status: "changed", partsUsed: "Long-life coolant", partsCost: "3600" },
          { text: "Radiator cap", status: "changed", partsUsed: "Replacement cap", partsCost: "900" },
          { text: "Labor", status: "passed", partsUsed: "In-house labor", partsCost: "1600" },
        ],
      },
    },
  },
  {
    id: "task-demo-apr-001",
    vehicleId: "BCD 8901",
    title: "Transmission Service",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-04-11",
    assignedDriver: "Sarah Connor",
    notes: "Demo transmission service with material cost.",
    garageId: "g1",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "73650",
    systemAffected: "transmission",
    triggerType: MaintenanceTriggerType.ODOMETER,
    intervalKm: "20000",
    bufferDistanceKm: "1000",
    startingReferenceReadingKm: "54000",
    intervalType: MaintenanceIntervalType.QUARTERLY,
    startReferenceDate: "2026-04-10",
    workOrderProgress: {
      checklist: [{ status: "passed" }, { status: "passed" }, { status: "passed" }],
      execution: {
        done: true,
        remarks: "Transmission fluid, filter, and gasket replaced.",
        technicianSignature: "Sarah Connor",
        items: [
          { text: "ATF fluid", status: "changed", partsUsed: "Automatic transmission fluid", partsCost: "8200" },
          { text: "Transmission filter", status: "changed", partsUsed: "Filter kit", partsCost: "4300" },
          { text: "Labor", status: "passed", partsUsed: "In-house labor", partsCost: "3500" },
        ],
      },
    },
  },
  {
    id: "task-demo-may-001",
    vehicleId: "STU 6789",
    title: "Suspension Repair",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-05-21",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes: "Demo high-cost suspension repair for flagged vehicle insight.",
    garageId: "g2",
    accountType: AccountType.OUTSOURCED,
    outsourcedProvider: "North Hub Service Partner",
    odometerReading: "89120",
    systemAffected: "suspension",
    triggerType: MaintenanceTriggerType.MANUAL,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.SEMI_ANNUALLY,
    startReferenceDate: "2026-05-20",
    workOrderProgress: {
      checklist: [{ status: "failed" }, { status: "passed" }, { status: "passed" }],
      execution: {
        done: true,
        remarks: "Shock absorbers and bushings replaced after repeated road vibration complaints.",
        technicianSignature: "North Hub Service Partner",
        items: [
          { text: "Shock absorbers", status: "changed", partsUsed: "Heavy duty shock set", partsCost: "18500" },
          { text: "Suspension bushings", status: "changed", partsUsed: "Bushing kit", partsCost: "7600" },
          { text: "Outsourced labor", status: "changed", partsUsed: "Service labor", partsCost: "9200" },
        ],
      },
    },
  },
  {
    id: "task-demo-jun-001",
    vehicleId: "PQR 2345",
    title: "Annual Safety Inspection",
    status: MaintenanceStatus.COMPLETED,
    date: "2026-06-09",
    assignedDriver: "Chief Mechanic Tester",
    assignedMechanicId: "u-chief-mechanic-test",
    assignedMechanicEmail: "chief.mechanic@welinc.test",
    notes: "Demo annual compliance maintenance.",
    garageId: "g3",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "66400",
    systemAffected: "safety",
    triggerType: MaintenanceTriggerType.TIME,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.ANNUALLY,
    startReferenceDate: "2026-06-01",
    workOrderProgress: {
      checklist: [{ status: "passed" }, { status: "passed" }, { status: "passed" }, { status: "passed" }],
      execution: {
        done: true,
        remarks: "Safety inspection completed. Reflectors and wiper blades replaced.",
        technicianSignature: "Chief Mechanic Tester",
        items: [
          { text: "Wiper blades", status: "changed", partsUsed: "Blade pair", partsCost: "1600" },
          { text: "Reflector kit", status: "changed", partsUsed: "Rear reflector kit", partsCost: "950" },
          { text: "Inspection labor", status: "passed", partsUsed: "In-house labor", partsCost: "2200" },
        ],
      },
    },
  },
  {
    id: "task-demo-jul-001",
    vehicleId: "DEF 5678",
    title: "Electrical System Repair",
    status: MaintenanceStatus.OVERDUE,
    date: "2026-07-05",
    assignedDriver: "Mechanic Tester",
    assignedMechanicId: "u-mechanic-test",
    assignedMechanicEmail: "mechanic@welinc.test",
    notes: "Demo overdue repair for status and alert cards.",
    garageId: "g2",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "41880",
    systemAffected: "electrical",
    triggerType: MaintenanceTriggerType.MANUAL,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.MONTHLY,
    startReferenceDate: "2026-07-05",
    workOrderProgress: {
      checklist: [{ status: "failed" }, { status: "pending" }],
      execution: {
        done: false,
        remarks: "Alternator replacement pending parts release.",
        technicianSignature: "N/A",
        items: [
          { text: "Alternator", status: "changed", partsUsed: "Alternator assembly", partsCost: "12800" },
          { text: "Diagnostic labor", status: "passed", partsUsed: "Electrical diagnosis", partsCost: "2400" },
        ],
      },
    },
  },
  {
    id: "task-demo-jul-002",
    vehicleId: "MNO 7890",
    title: "Time-Based Quarterly PM",
    status: MaintenanceStatus.DUE,
    date: "2026-07-25",
    assignedDriver: "Elena Rostova",
    notes: "Demo upcoming PM due within the reporting window.",
    garageId: "g1",
    accountType: AccountType.IN_HOUSE,
    odometerReading: "33750",
    systemAffected: "general",
    triggerType: MaintenanceTriggerType.TIME,
    intervalKm: "",
    bufferDistanceKm: "",
    startingReferenceReadingKm: "",
    intervalType: MaintenanceIntervalType.QUARTERLY,
    startReferenceDate: "2026-07-25",
  },
];

export const defaultProfitabilitySummary: ProfitabilitySummary = {
  totalIncome: "₱1,200,000",
  totalExpenses: "₱850,000",
  netProfit: "₱350,000",
  profitMargin: 29.2,
  flaggedVehicles: [
    {
      id: "v1",
      name: "Truck A",
      plate: "ABC-123",
      model: "Model X",
      flagReason: "Overdue maintenance",
      netProfit: "-₱12,000",
    },
    {
      id: "v2",
      name: "Van B",
      plate: "XYZ-789",
      model: "Model Y",
      flagReason: "Low fuel efficiency",
      netProfit: "-₱5,400",
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
    id: "u-admin-test",
    name: "Admin Tester",
    email: "admin@welinc.test",
    role: "ADMIN",
    status: "Active",
    createdAt: "2026-07-08T09:00:00.000Z",
    lastActive: "2026-07-10T08:30:00.000Z",
  },
  {
    id: "u-chief-mechanic-test",
    name: "Chief Mechanic Tester",
    email: "chief.mechanic@welinc.test",
    role: "CHIEF_MECHANIC",
    status: "Active",
    createdAt: "2026-07-09T09:00:00.000Z",
    lastActive: "2026-07-10T08:30:00.000Z",
  },
  {
    id: "u-operations-test",
    name: "Operations Tester",
    email: "operations@welinc.test",
    role: "OPERATIONS",
    status: "Active",
    createdAt: "2026-07-09T09:15:00.000Z",
    lastActive: "2026-07-10T08:30:00.000Z",
  },
  {
    id: "u-mechanic-test",
    name: "Mechanic Tester",
    email: "mechanic@welinc.test",
    role: "MECHANIC",
    status: "Active",
    createdAt: "2026-07-09T09:30:00.000Z",
    lastActive: "2026-07-10T08:30:00.000Z",
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
