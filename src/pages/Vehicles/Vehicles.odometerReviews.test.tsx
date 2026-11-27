// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Vehicles from "./Vehicles";

const authMock = vi.hoisted(() => ({ role: "OPERATIONS" }));
const apiMocks = vi.hoisted(() => ({
  getVehicleRecords: vi.fn(),
  getGarageRecords: vi.fn(),
  getPendingVrmsOdometerReviews: vi.fn(),
  getPendingVrmsRetirementRequests: vi.fn(),
  decideVrmsRetirementRequest: vi.fn(),
  confirmVrmsOdometerReview: vi.fn(),
  dismissVrmsOdometerReview: vi.fn(),
  updateVehicleOdometerRecord: vi.fn(),
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: (
    selector: (state: { currentUser: { role: string } }) => unknown,
  ) => selector({ currentUser: { role: authMock.role } }),
}));

vi.mock("../../lib/api/vmmsApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/api/vmmsApi")>();
  return {
    ...actual,
    getVehicleRecords: apiMocks.getVehicleRecords,
    getGarageRecords: apiMocks.getGarageRecords,
    getPendingVrmsOdometerReviews: apiMocks.getPendingVrmsOdometerReviews,
    getPendingVrmsRetirementRequests: apiMocks.getPendingVrmsRetirementRequests,
    decideVrmsRetirementRequest: apiMocks.decideVrmsRetirementRequest,
    confirmVrmsOdometerReview: apiMocks.confirmVrmsOdometerReview,
    dismissVrmsOdometerReview: apiMocks.dismissVrmsOdometerReview,
    updateVehicleOdometerRecord: apiMocks.updateVehicleOdometerRecord,
  };
});

const pendingReview = {
  id: "c4b5a2e8-59c4-4c18-8bda-97e8df63f1c0",
  repairTicketId: "ee3d6c66-1d30-4c38-9f31-1d8e13b78816",
  repairTicketNumber: "VR-100",
  outsideShopName: "North Shop",
  vehicleId: "23d53ff4-919c-4420-a7d3-83d077c2b93a",
  plateNumber: "TGD 908",
  currentOdometer: 45000,
  isActive: true,
  serviceOdometerReading: 45678,
  occurredAt: "2026-11-27T00:00:00.000Z",
};

const pendingRetirementRequest = {
  requestId: "e35b02b2-0cec-43db-aee7-49b3617e8f91",
  vmmsVehicleId: "23d53ff4-919c-4420-a7d3-83d077c2b93a",
  vehiclePlate: "TGD 908",
  repairTicketId: "ee3d6c66-1d30-4c38-9f31-1d8e13b78816",
  repairTicketNumber: "VR-RET-100",
  reason: "Beyond economical repair",
  occurredAt: "2026-11-27T00:00:00.000Z",
};

const vehicle = {
  id: pendingReview.vehicleId,
  plateNumber: pendingReview.plateNumber,
  make: "Isuzu",
  model: "Elf",
  year: 2022,
  engineType: "Diesel",
  truckSizeCategory: "Light Duty",
  odometer: pendingReview.currentOdometer,
  lastMaintenanceDate: null,
  garageId: null,
  garageName: null,
  status: "AVAILABLE" as const,
  isActive: true,
};

describe("Vehicles page VRMS odometer review", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.role = "OPERATIONS";
    apiMocks.getVehicleRecords.mockResolvedValue([vehicle]);
    apiMocks.getGarageRecords.mockResolvedValue([]);
    apiMocks.getPendingVrmsOdometerReviews
      .mockResolvedValueOnce({
        items: [pendingReview],
        nextCursor: null,
      })
      .mockResolvedValue({
        items: [],
        nextCursor: null,
      });
    apiMocks.getPendingVrmsRetirementRequests.mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    apiMocks.decideVrmsRetirementRequest.mockResolvedValue({
      requestId: pendingRetirementRequest.requestId,
      decision: "APPROVED",
      reason: null,
      deliveryEventId: "47bcf4b4-c82a-4a51-aa7c-73ae3af34b92",
      deliveryStatus: "QUEUED",
    });
    apiMocks.confirmVrmsOdometerReview.mockResolvedValue({
      id: pendingReview.id,
      status: "CONFIRMED",
    });
    apiMocks.dismissVrmsOdometerReview.mockResolvedValue({
      id: pendingReview.id,
      status: "DISMISSED",
    });
  });

  it("confirms the ticket-linked reading through the confirmation step", async () => {
    const user = userEvent.setup();
    render(<Vehicles />);

    await waitFor(() =>
      expect(screen.getByText("VRMS ticket VR-100")).toBeTruthy(),
    );
    expect(screen.getByText("45,678 km")).toBeTruthy();
    expect(screen.getAllByText("45,000 km").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Confirm reading" }));
    expect(
      screen.getByRole("heading", { name: "Confirm service reading" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Confirm and update" }),
    );

    await waitFor(() =>
      expect(apiMocks.confirmVrmsOdometerReview).toHaveBeenCalledWith(
        pendingReview.id,
      ),
    );
    expect(apiMocks.dismissVrmsOdometerReview).not.toHaveBeenCalled();
    expect(apiMocks.updateVehicleOdometerRecord).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByText("No completed VRMS readings are waiting for review."),
      ).toBeTruthy(),
    );
  });

  it("dismisses without calling the master odometer update", async () => {
    const user = userEvent.setup();
    render(<Vehicles />);

    await waitFor(() =>
      expect(screen.getByText("VRMS ticket VR-100")).toBeTruthy(),
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(
      screen.getByRole("heading", { name: "Dismiss service reading" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /The vehicle master odometer will remain unchanged\./,
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Dismiss reading" }));

    await waitFor(() =>
      expect(apiMocks.dismissVrmsOdometerReview).toHaveBeenCalledWith(
        pendingReview.id,
      ),
    );
    expect(apiMocks.confirmVrmsOdometerReview).not.toHaveBeenCalled();
    expect(apiMocks.updateVehicleOdometerRecord).not.toHaveBeenCalled();
  });

  it("disables confirmation for inactive vehicles and lower readings", async () => {
    const user = userEvent.setup();
    apiMocks.getPendingVrmsOdometerReviews.mockReset();
    apiMocks.getPendingVrmsOdometerReviews.mockResolvedValue({
      items: [
        {
          ...pendingReview,
          isActive: false,
          serviceOdometerReading: 44000,
        },
      ],
      nextCursor: null,
    });
    render(<Vehicles />);

    const confirmButton = await screen.findByRole("button", {
      name: "Confirm reading",
    });
    expect(confirmButton).toHaveProperty("disabled", true);
    expect(
      screen.getByText(
        /below the current master reading and cannot be confirmed\./,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveProperty(
      "disabled",
      false,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
  });

  it("requires a reason before Operations can decline a retirement request", async () => {
    const user = userEvent.setup();
    apiMocks.getPendingVrmsRetirementRequests.mockResolvedValue({
      items: [pendingRetirementRequest],
      nextCursor: null,
    });
    render(<Vehicles />);

    await user.click(
      await screen.findByRole("button", { name: "Decline" }),
    );
    const reason = screen.getByRole("textbox", {
      name: "Reason for declining retirement request",
    });
    const sendDecline = screen.getByRole("button", { name: "Send decline" });
    expect(sendDecline).toHaveProperty("disabled", true);
    expect(apiMocks.decideVrmsRetirementRequest).not.toHaveBeenCalled();

    await user.type(reason, "Repair remains feasible");
    expect(sendDecline).toHaveProperty("disabled", false);
    await user.click(sendDecline);

    await waitFor(() =>
      expect(apiMocks.decideVrmsRetirementRequest).toHaveBeenCalledWith(
        pendingRetirementRequest.requestId,
        "DECLINED",
        "Repair remains feasible",
      ),
    );
  });

  it("requires confirmation before approving vehicle retirement", async () => {
    const user = userEvent.setup();
    apiMocks.getPendingVrmsRetirementRequests.mockResolvedValue({
      items: [pendingRetirementRequest],
      nextCursor: null,
    });
    render(<Vehicles />);

    await user.click(
      await screen.findByRole("button", { name: "Approve retirement" }),
    );
    expect(
      screen.getByText(/This deactivates the VMMS vehicle/),
    ).toBeTruthy();
    expect(apiMocks.decideVrmsRetirementRequest).not.toHaveBeenCalled();
    const approveButtons = screen.getAllByRole("button", {
      name: "Approve retirement",
    });
    await user.click(approveButtons[approveButtons.length - 1]);

    await waitFor(() =>
      expect(apiMocks.decideVrmsRetirementRequest).toHaveBeenCalledWith(
        pendingRetirementRequest.requestId,
        "APPROVED",
        undefined,
      ),
    );
  });
});
