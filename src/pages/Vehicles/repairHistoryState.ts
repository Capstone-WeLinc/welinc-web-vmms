import type { VehicleRepairHistoryItem } from "../../types/maintenance";

export type RepairHistoryPage = {
  items: VehicleRepairHistoryItem[];
  nextCursor: string | null;
};

export type VehicleRepairHistoryState = {
  vehicleId: string;
  requestId: number;
  page: RepairHistoryPage | null;
  loadingMore: boolean;
  error: boolean;
};

export function getCurrentRepairHistory(
  state: VehicleRepairHistoryState | null,
  vehicleId: string | undefined,
): VehicleRepairHistoryState | null {
  return state && state.vehicleId === vehicleId ? state : null;
}

export function appendRepairHistoryPage(
  state: VehicleRepairHistoryState | null,
  vehicleId: string,
  requestId: number,
  nextPage: RepairHistoryPage,
): VehicleRepairHistoryState | null {
  if (
    state?.vehicleId !== vehicleId ||
    state.requestId !== requestId ||
    !state.page
  ) {
    return state;
  }
  return {
    ...state,
    page: {
      items: [...state.page.items, ...nextPage.items],
      nextCursor: nextPage.nextCursor,
    },
    loadingMore: false,
    error: false,
  };
}
