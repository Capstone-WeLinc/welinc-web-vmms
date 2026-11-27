import { describe, expect, it } from "vitest";
import {
  appendRepairHistoryPage,
  getCurrentRepairHistory,
  type VehicleRepairHistoryState,
} from "./repairHistoryState";

const state: VehicleRepairHistoryState = {
  vehicleId: "vehicle-a",
  requestId: 3,
  page: {
    items: [
      {
        repairTicketId: "ticket-a",
        repairTicketNumber: "VR-100",
        openedAt: "2026-11-20T00:00:00.000Z",
        closedAt: null,
        issues: [],
        partsUsed: [],
        repairPersonnel: [],
        provider: null,
      },
    ],
    nextCursor: "cursor-a",
  },
  loadingMore: true,
  error: false,
};

describe("vehicle repair-history request state", () => {
  it("hides history belonging to another vehicle or a closed details view", () => {
    expect(getCurrentRepairHistory(state, "vehicle-b")).toBeNull();
    expect(getCurrentRepairHistory(state, undefined)).toBeNull();
    expect(getCurrentRepairHistory(state, "vehicle-a")).toBe(state);
  });

  it("ignores a page from an outdated vehicle request", () => {
    const nextPage = { items: [], nextCursor: null };

    expect(appendRepairHistoryPage(state, "vehicle-b", 3, nextPage)).toBe(
      state,
    );
    expect(appendRepairHistoryPage(state, "vehicle-a", 4, nextPage)).toBe(
      state,
    );
  });

  it("appends a matching page and clears its loading/error state", () => {
    const nextPage = {
      items: [
        {
          repairTicketId: "ticket-b",
          repairTicketNumber: "VR-101",
          openedAt: "2026-11-21T00:00:00.000Z",
          closedAt: null,
          issues: [],
          partsUsed: [],
          repairPersonnel: [],
          provider: null,
        },
      ],
      nextCursor: null,
    };

    expect(appendRepairHistoryPage(state, "vehicle-a", 3, nextPage)).toEqual({
      ...state,
      page: {
        items: [...state.page!.items, ...nextPage.items],
        nextCursor: null,
      },
      loadingMore: false,
      error: false,
    });
  });
});
