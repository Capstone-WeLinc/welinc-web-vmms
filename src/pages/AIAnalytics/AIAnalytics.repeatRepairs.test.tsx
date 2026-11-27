// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AIAnalyticsPage from "./AIAnalytics";
import {
  getAnalyticsAlerts,
  getAnalyticsDataHealth,
  getAnalyticsHealth,
  getAnalyticsInsights,
  getAnalyticsInsightJobStatus,
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
  getAnalyticsDataHealth: vi.fn(),
  getAnalyticsHealth: vi.fn(),
  getAnalyticsInsights: vi.fn(),
  getAnalyticsInsightJobStatus: vi.fn(),
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
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAnalyticsHealth).mockResolvedValue({
      status: "ok",
      service: "analytics",
      mode: "test",
      port: 0,
    });
    vi.mocked(getAnalyticsDataHealth).mockResolvedValue({
      state: "current",
      generatedAt: dataSource.generatedAt,
      sourceMaxUpdatedAt: dataSource.sourceMaxUpdatedAt,
      ageSeconds: 0,
      maxAgeMinutes: 10,
      sourceCoverage: {
        state: "verified",
        vehicles: { source: 0, mart: 0 },
        schedules: { source: 0, mart: 0 },
        statusesMatch: true,
        maintenanceCostMatches: true,
      },
      semanticIndex: {
        state: "empty",
        eligibleRecords: 0,
        indexedRecords: 0,
        coveragePercentage: 100,
        unmatchedRecords: 0,
      },
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
    vi.mocked(getAnalyticsInsights).mockResolvedValue(null);
    vi.mocked(getAnalyticsInsightJobStatus).mockResolvedValue({
      state: "waiting",
      hasSavedInsight: false,
      hasCurrentInsight: false,
      queuedAt: null,
      runAfter: null,
      startedAt: null,
      finishedAt: null,
      lastGeneratedAt: null,
    });
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

  it("loads analytics on page open and pages older repeat-repair alerts", async () => {
    const user = userEvent.setup();
    render(<AIAnalyticsPage />);

    await waitFor(() =>
      expect(getAnalyticsOverview).toHaveBeenCalledTimes(1),
    );
    expect(getAnalyticsInsights).toHaveBeenCalledTimes(1);
    expect(getAnalyticsInsightJobStatus).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/Provider generation is separate from analytics/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Waiting for a validated analytics sync/),
    ).toBeTruthy();
    expect(
      screen.getByText("No maintenance is due in the next 7 days."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Generate AI Analytics/ }),
    ).toBeNull();

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

    vi.mocked(getAnalyticsOverview).mockRejectedValueOnce(
      new Error("Connection interrupted."),
    );
    await user.click(
      screen.getByRole("button", { name: "Refresh analytics" }),
    );
    const refreshError = await screen.findByRole("alert");
    expect(refreshError.textContent).toContain(
      "Showing the previously loaded data.",
    );
    expect(screen.getByText("VRMS Repeated Repair: TGD 908")).toBeTruthy();
  });

  it("shows queued status without asking for report generation", async () => {
    vi.mocked(getAnalyticsInsightJobStatus).mockResolvedValue({
      state: "queued",
      hasSavedInsight: true,
      hasCurrentInsight: false,
      queuedAt: "2026-11-27T00:00:00.000Z",
      runAfter: "2026-11-27T00:00:30.000Z",
      startedAt: null,
      finishedAt: null,
      lastGeneratedAt: "2026-11-26T00:00:00.000Z",
    });

    render(<AIAnalyticsPage />);

    expect(
      await screen.findByText(/One report is queued for this data revision/),
    ).toBeTruthy();
    expect(screen.getByText("queued")).toBeTruthy();
    expect(getAnalyticsInsights).toHaveBeenCalledTimes(1);
  });

  it("polls queued status and loads the saved report when it becomes current", async () => {
    vi.useFakeTimers();
    vi.mocked(getAnalyticsInsightJobStatus)
      .mockResolvedValueOnce({
        state: "queued",
        hasSavedInsight: false,
        hasCurrentInsight: false,
        queuedAt: null,
        runAfter: null,
        startedAt: null,
        finishedAt: null,
        lastGeneratedAt: null,
      })
      .mockResolvedValueOnce({
        state: "current",
        hasSavedInsight: true,
        hasCurrentInsight: true,
        queuedAt: null,
        runAfter: null,
        startedAt: null,
        finishedAt: "2026-11-27T00:00:30.000Z",
        lastGeneratedAt: "2026-11-27T00:00:30.000Z",
      });
    vi.mocked(getAnalyticsInsights)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        aiSummary: "Fresh report summary",
        evidence: {
          snapshotKey: "current",
          generatedAt: "2026-11-27T00:00:30.000Z",
          sourceMaxUpdatedAt: null,
          ageSeconds: 0,
          isStale: false,
          reportingPeriod: { start: null, end: null },
          metrics: [],
          observations: [],
          limitations: [],
        },
      });

    render(<AIAnalyticsPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/One report is queued for this data revision/)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(getAnalyticsInsightJobStatus).toHaveBeenCalledTimes(2);
    expect(getAnalyticsInsights).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Fresh report summary")).toBeTruthy();
    vi.useRealTimers();
  });

  it("previews the three soonest due schedules and links to scheduling", async () => {
    vi.mocked(getAnalyticsAlerts).mockResolvedValue({
      dataSource,
      alerts: [
        {
          alertId: "later",
          alertType: "DUE_SOON",
          vehiclePlate: "ABC 1234",
          maintenanceTitle: "Later service",
          dueDate: "2026-12-04T00:00:00.000Z",
          severity: "MEDIUM",
          message: "Later service is due soon.",
        },
        {
          alertId: "overdue",
          alertType: "OVERDUE_MAINTENANCE",
          vehiclePlate: "XYZ 9999",
          maintenanceTitle: "Overdue service",
          dueDate: "2026-11-27T00:00:00.000Z",
          severity: "HIGH",
          message: "Service is overdue.",
        },
        {
          alertId: "soonest",
          alertType: "DUE_SOON",
          vehiclePlate: "DEF 5678",
          maintenanceTitle: "Brake inspection",
          dueDate: "2026-11-29T00:00:00.000Z",
          severity: "MEDIUM",
          message: "Brake inspection is due soon.",
        },
        {
          alertId: "second",
          alertType: "DUE_SOON",
          vehiclePlate: "GHI 9012",
          maintenanceTitle: "Oil service",
          dueDate: "2026-11-30T00:00:00.000Z",
          severity: "MEDIUM",
          message: "Oil service is due soon.",
        },
        {
          alertId: "third",
          alertType: "DUE_SOON",
          vehiclePlate: "JKL 3456",
          maintenanceTitle: "Tire rotation",
          dueDate: "2026-12-01T00:00:00.000Z",
          severity: "MEDIUM",
          message: "Tire rotation is due soon.",
        },
      ],
    });

    render(<AIAnalyticsPage />);

    const dueSoonItems = await screen.findAllByRole("listitem");
    expect(dueSoonItems).toHaveLength(3);
    expect(dueSoonItems[0].textContent).toContain("Brake inspection");
    expect(dueSoonItems[1].textContent).toContain("Oil service");
    expect(dueSoonItems[2].textContent).toContain("Tire rotation");
    expect(screen.queryByText("Later service")).toBeNull();
    expect(screen.queryByText("Overdue service")).toBeNull();
    expect(screen.getByRole("link", { name: "View schedules" }).getAttribute("href"))
      .toBe("/maintenance-scheduling");
  });
});
