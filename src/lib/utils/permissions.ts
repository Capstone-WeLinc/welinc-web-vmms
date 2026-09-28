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

