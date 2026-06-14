function normalizeRoleValue(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
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
