function normalizeRoleValue(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

type RoleAwareUser = {
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null } | string | null> | null;
} | null;

function resolveVmmsRole(user?: RoleAwareUser): string {
  if (!user) return "";
  if (!Array.isArray(user.roles) || user.roles.length === 0) {
    return normalizeRoleValue(user.role);
  }

  const vmmsRole = user.roles.find(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      normalizeRoleValue(entry.system) === "VMMS" &&
      typeof entry.role === "string",
  );

  // Never infer VMMS permissions from a role assigned to another system.
  return vmmsRole && typeof vmmsRole !== "string"
    ? normalizeRoleValue(vmmsRole.role)
    : "";
}

function hasVmmsOperationsRole(user?: {
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null }> | null;
} | null): boolean {
  return resolveVmmsRole(user) === "OPERATIONS";
}

export const canManageVehicles = hasVmmsOperationsRole;
export const canManageSchedules = hasVmmsOperationsRole;

export function canEditWorkOrderPriority(user?: {
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null }> | null;
} | null): boolean {
  return ["ADMIN", "OPERATIONS"].includes(resolveVmmsRole(user));
}

export function canSeeVmmsWebNavigation(user?: {
  role?: string | null;
  roles?: Array<{ role?: string | null; system?: string | null }> | null;
} | null): boolean {
  if (!user) return false;

  const role = resolveVmmsRole(user);

  return role === "ADMIN" || role === "OPERATIONS";
}

const OPERATIONS_NAV_PATHS = new Set([
  "/dashboard",
  "/vehicles",
  "/garages",
  "/outsourced-providers",
  "/maintenance-scheduling",
  "/work-orders",
  "/maintenance-logs",
  "/maintenance-reports",
  "/maintenance-costing",
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
  const role = resolveVmmsRole(user);
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
        roles?: Array<{ role?: string | null; system?: string | null } | string | null> | null;
      },
) {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value.roles)) {
    const vmmsRole = value.roles.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        normalizeRoleValue(entry.system) === "VMMS" &&
        typeof entry.role === "string",
    );
    if (vmmsRole && typeof vmmsRole !== "string") return vmmsRole.role ?? null;
    if (value.roles.length > 0) return null;
  }

  return value.role ?? null;
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

