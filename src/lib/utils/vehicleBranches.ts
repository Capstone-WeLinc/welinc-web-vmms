export type VehicleBranchRecord = {
  garageId: string | null;
  garageName?: string | null;
  plateNumber: string;
  lastMaintenanceDate?: string | null;
};

export type VehicleSortMode =
  | "DATE_DESC"
  | "DATE_ASC"
  | "BRANCH_ASC"
  | "BRANCH_DESC"
  | "NONE";

const maintenanceDateValue = (value: string | null | undefined): number => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

export function filterAndSortVehiclesByBranch<T extends VehicleBranchRecord>(
  vehicles: T[],
  garageId: string,
  sortMode: VehicleSortMode,
): T[] {
  const filtered = vehicles.filter((vehicle) => {
    if (garageId === "all") return true;
    return vehicle.garageId === garageId;
  });

  if (sortMode === "NONE") return filtered;

  return [...filtered].sort((left, right) => {
    if (sortMode === "DATE_ASC" || sortMode === "DATE_DESC") {
      const dateOrder = maintenanceDateValue(left.lastMaintenanceDate) - maintenanceDateValue(right.lastMaintenanceDate);
      const comparison = sortMode === "DATE_DESC" ? -dateOrder : dateOrder;
      if (comparison !== 0) return comparison;
      return left.plateNumber.localeCompare(right.plateNumber);
    }

    const direction = sortMode === "BRANCH_ASC" ? 1 : -1;
    const branchOrder = (left.garageName ?? "Unassigned").localeCompare(
      right.garageName ?? "Unassigned",
    );
    if (branchOrder !== 0) return branchOrder * direction;
    return left.plateNumber.localeCompare(right.plateNumber);
  });
}
