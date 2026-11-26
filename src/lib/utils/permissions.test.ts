import { describe, expect, it } from "vitest";
import { canSeeVmmsNavigationPath } from "./permissions";

describe("VMMS navigation permissions", () => {
  it.each([
    ["ADMIN", true],
    ["OPERATIONS", false],
    ["CHIEF_MECHANIC", false],
    ["MECHANIC", false],
  ])("restricts the audit log navigation to Admin for %s", (role, allowed) => {
    expect(canSeeVmmsNavigationPath("/audit-logs", { role })).toBe(allowed);
  });

  it("does not grant access from an Admin role assigned to another system", () => {
    expect(
      canSeeVmmsNavigationPath("/audit-logs", {
        roles: [{ role: "ADMIN", system: "VRMS" }],
      }),
    ).toBe(false);
  });
});
