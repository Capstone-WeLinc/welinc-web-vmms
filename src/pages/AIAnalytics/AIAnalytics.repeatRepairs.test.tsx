// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AIAnalyticsPage from "./AIAnalytics";
import {
  getAnalyticsAlerts,
  getAnalyticsHealth,
  getAnalyticsInsights,
  getAnalyticsOverview,
  getAnalyticsReport,
  getAnalyticsVehicles,
} from "../../lib/api/analyticsService";
import {
  getMaintenanceSchedules,
  getVrmsRepeatRepairAlerts,
} from "../../lib/api/vmmsApi";

vi.mock("../../lib/api/analyticsService", () => ({
  getAnalyticsAlerts: vi.fn(),
  getAnalyticsHealth: vi.fn(),
  getAnalyticsInsights: vi.fn(),
  getAnalyticsOverview: vi.fn(),
  getAnalyticsReport: vi.fn(),
  getAnalyticsVehicles: vi.fn(),
  searchMaintenanceSchedules: vi.fn(),
}));

vi.mock("../../lib/api/vmmsApi", () => ({
  getMaintenanceSchedules: vi.fn(),
  getVrmsRepeatRepairAlerts: vi.fn(),
}));

const dataSource = {
  type: "test",
  authoritativeFor: "analytics",
  generatedAt: "2026-11-27T00:00:00.000Z",
  sourceMaxUpdatedAt: null,
  ageSeconds: 0,
  isStale: false,
  maxAgeMinutes: 10,
};

const repeatAlert = (eventId: string, vehiclePlate: string) => ({
  eventId,
  vmmsVehicleId: "23d53ff4-919c-4420-a7d3-83d077c2b93a",
  vehiclePlate,
  category: "Brake system",
  repairTicketNumbers: ["VR-100", "VR-101"],
  windowDays: 90,
  count: 2,
  occurredAt: "2026-11-27T00:00:00.000Z",
});

describe("AI Analytics VRMS repeated-repair alerts", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAnalyticsHealth).mockResolvedValue({
      status: "ok",
      service: "analytics",
      mode: "test",
      port: 0,
    });
    vi.mocked(getAnalyticsOverview).mockResolvedValue({
      dataSource,
      snapshot: {},
      statusBreakdown: [],
      monthlyTrend: [],
      forecast: { dueIn7Days: 0, dueIn30Days: 0, dueIn90Days: 0 },
      anomalies: { repeatedFailures: [], missingDates: [] },
    });
    vi.mocked(getAnalyticsVehicles).mockResolvedValue({
      dataSource,
      vehicles: [],
    });
    vi.mocked(getAnalyticsAlerts).mockResolvedValue({
      dataSource,
      alerts: [],
    });
    vi.mocked(getAnalyticsInsights).mockResolvedValue("No insights available.");
    vi.mocked(getAnalyticsReport).mockResolvedValue({
      dataSource,
      snapshot: {},
      statusBreakdown: [],
      monthlyTrend: [],
      vehicles: [],
      alerts: [],
      schedules: [],
    });
    vi.mocked(getMaintenanceSchedules).mockResolvedValue([]);
    vi.mocked(getVrmsRepeatRepairAlerts).mockResolvedValue({
      items: [repeatAlert("alert-1", "TGD 908")],
      nextCursor: "older-1",
    });
  });

  it("shows repeat-repair alerts beside maintenance anomalies and pages older alerts", async () => {
    const user = userEvent.setup();
    render(<AIAnalyticsPage />);

    await user.click(
      await screen.findByRole("button", { name: /Generate AI Analytics/ }),
    );

    expect(
      await screen.findByText("VRMS Repeated Repair: TGD 908"),
    ).toBeTruthy();
    expect(screen.getByText(/2 Brake system repairs within 90 days/)).toBeTruthy();
    expect(screen.getByText("Tickets: VR-100, VR-101")).toBeTruthy();

    vi.mocked(getVrmsRepeatRepairAlerts).mockResolvedValueOnce({
      items: [repeatAlert("alert-2", "CAK 9043")],
      nextCursor: null,
    });
    await user.click(
      screen.getByRole("button", { name: "Load older repair alerts" }),
    );

    await waitFor(() =>
      expect(getVrmsRepeatRepairAlerts).toHaveBeenLastCalledWith("older-1"),
    );
    expect(
      await screen.findByText("VRMS Repeated Repair: CAK 9043"),
    ).toBeTruthy();
  });
});
