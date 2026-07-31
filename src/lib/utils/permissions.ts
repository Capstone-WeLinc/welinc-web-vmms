function normalizeRoleValue(value?: string | null) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

      if (entry && typeof entry === "object") {
        const roleEntry = entry as {
          role?: string | null;
          name?: string | null;
          label?: string | null;
          value?: string | null;
        };
        if (roleEntry.role) {
          return roleEntry.role;
        }
        if (roleEntry.name) {
          return roleEntry.name;
        }
        if (roleEntry.label) {
          return roleEntry.label;
        }
        if (roleEntry.value) {
          return roleEntry.value;
        }
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

export function isAdminRole(
  roleOrUser?:
    | string
    | null
    | {
        role?: string | null;
        roles?: Array<{ role?: string | null } | string | null> | null;
      },
): boolean {
  const resolvedRole = extractRoleFromUser(roleOrUser);
  return normalizeRoleValue(resolvedRole) === "ADMIN";
}
