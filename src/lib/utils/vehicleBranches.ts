export type VehicleBranchRecord = {
  garageId: string | null;
  garageName?: string | null;
  plateNumber: string;
};

export function filterAndSortVehiclesByBranch<T extends VehicleBranchRecord>(
  vehicles: T[],
  garageId: string,
  sortDirection: "asc" | "desc" | "none",
): T[] {
  const filtered = vehicles.filter((vehicle) => {
    if (garageId === "all") return true;
    return vehicle.garageId === garageId;
  });

  if (sortDirection === "none") return filtered;
  const direction = sortDirection === "asc" ? 1 : -1;
  return filtered.sort((left, right) => {
    const branchOrder = (left.garageName ?? "Unassigned").localeCompare(
      right.garageName ?? "Unassigned",
    );
    return branchOrder === 0
      ? left.plateNumber.localeCompare(right.plateNumber)
      : branchOrder * direction;
  });
}
