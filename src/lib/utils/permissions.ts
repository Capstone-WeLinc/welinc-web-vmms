function normalizeRoleValue(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function hasVmmsOperationsRole(user?: {
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null }> | null;
} | null): boolean {
  if (!user) return false;
  if (Array.isArray(user.roles)) {
    const vmmsRoles = user.roles.filter((entry) => entry?.system === "VMMS");
    return vmmsRoles.length === 1 && vmmsRoles[0].role === "OPERATIONS";
  }
  // Local demo users expose a single role rather than subsystem assignments.
  return normalizeRoleValue(user.role) === "OPERATIONS";
}

export const canManageVehicles = hasVmmsOperationsRole;
export const canManageSchedules = hasVmmsOperationsRole;

export function canEditWorkOrderPriority(user?: {
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null }> | null;
} | null): boolean {
  if (!user) return false;
  if (Array.isArray(user.roles)) {
    const vmmsRoles = user.roles.filter((entry) => entry?.system === "VMMS");
    if (vmmsRoles.length) {
      return vmmsRoles.some((entry) => ["ADMIN", "OPERATIONS"].includes(normalizeRoleValue(entry.role)));
    }
  }
  return ["ADMIN", "OPERATIONS"].includes(normalizeRoleValue(user.role));
}

export function canSeeVmmsWebNavigation(user?: {
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null }> | null;
} | null): boolean {
  if (!user) return false;

  const role = Array.isArray(user.roles)
    ? user.roles.length === 0
      ? normalizeRoleValue(user.role)
      : user.roles.filter((entry) => entry?.system === "VMMS").length === 1
        ? normalizeRoleValue(
            user.roles.find((entry) => entry?.system === "VMMS")?.role,
          )
        : ""
    : normalizeRoleValue(user.role);

  return role === "ADMIN" || role === "OPERATIONS";
}

const OPERATIONS_NAV_PATHS = new Set([
  "/dashboard",
  "/vehicles",
  "/garages",
  "/maintenance-scheduling",
  "/work-orders",
  "/maintenance-logs",
  "/maintenance-reports",
  "/fuel-management",
  "/ai-analytics",
]);

export function canSeeVmmsNavigationPath(
  path: string,
  user?: {
    role?: string | null;
    roles?: Array<{ role?: string | null; system?: string | null }> | null;
  } | null,
): boolean {
  if (!user || path === "/expense-profitability") return false;
  const vmmsRoles = Array.isArray(user.roles)
    ? user.roles.filter((entry) => entry?.system === "VMMS")
    : [];
  const role = vmmsRoles.length === 1
    ? normalizeRoleValue(vmmsRoles[0].role)
    : Array.isArray(user.roles)
      ? user.roles.length === 0
        ? normalizeRoleValue(user.role)
        : ""
      : normalizeRoleValue(user.role);
  if (role === "OPERATIONS") return OPERATIONS_NAV_PATHS.has(path);
  if (role === "CHIEF_MECHANIC") return path === "/work-orders";
  return role === "ADMIN";
}

function extractRoleFromUser(
  value?:
    | string
    | null
    | {
        role?: string | null;
        roles?: Array<{ role?: string | null } | string | null> | null;
      },
) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.role) {
    return value.role;
  }

  if (Array.isArray(value.roles)) {
    for (const entry of value.roles) {
      if (typeof entry === "string") {
        return entry;
      }

      if (entry && typeof entry === "object" && entry.role) {
        return entry.role;
      }
    }
  }

  return null;
}

export function isMechanicRole(
  roleOrUser?:
    | string
    | null
    | {
        role?: string | null;
        roles?: Array<{ role?: string | null } | string | null> | null;
      },
): boolean {
  const resolvedRole = extractRoleFromUser(roleOrUser);
  return normalizeRoleValue(resolvedRole) === "MECHANIC";
}

export function isOperationsRole(
  roleOrUser?:
    | string
    | null
    | {
        role?: string | null;
        roles?: Array<{ role?: string | null } | string | null> | null;
      },
): boolean {
  const resolvedRole = extractRoleFromUser(roleOrUser);
  return normalizeRoleValue(resolvedRole) === "OPERATIONS";
}

export function isChiefMechanicRole(
  roleOrUser?:
    | string
    | null
    | {
        role?: string | null;
        roles?: Array<{ role?: string | null } | string | null> | null;
      },
): boolean {
  const resolvedRole = extractRoleFromUser(roleOrUser);
  return normalizeRoleValue(resolvedRole) === "CHIEF_MECHANIC";
}

