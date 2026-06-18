import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  Unlock,
  Users,
  XCircle,
} from "lucide-react";
import { fetchJSON, useBackend } from "../../lib/api/httpClient";
import { getCurrentUser } from "../../lib/api/authService";
import {
  ActionButton,
  ActionMenu,
  ConfirmationModal,
  DataTable,
  SearchInput,
  StatusBadge,
  ToastNotification,
} from "../../components/ui";

interface SystemRole {
  role: string;
  system: string;
}

interface PortalUserRecord {
  id: string;
  name: string;
  username: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedAt: string | null;
  roles: SystemRole[];
}

type ModalMode = "create" | "edit" | "reset-pw";
type PendingUserAction =
  | { type: "unlock" | "status" | "delete"; user: PortalUserRecord }
  | null;

const roleSystems = ["VRMS", "VMMS", "BMS", "SHARED"] as const;
const emptyRoleState = {
  vrmsRole: "",
  vmmsRole: "",
  bmsRole: "",
  sharedRole: "",
};

function normalizeRole(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function normalizeSystem(value?: string | null) {
  return (value ?? "").trim().toUpperCase();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string") return message;
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function hasSharedAdminAccess(user: unknown) {
  if (!user || typeof user !== "object") return false;

  const userRecord = user as {
    role?: string | null;
    roles?: { role?: string | null; system?: string | null }[];
  };

  if (normalizeRole(userRecord.role) === "ADMIN") return true;

  return (userRecord.roles ?? []).some(
    (role) =>
      normalizeSystem(role.system) === "SHARED" &&
      normalizeRole(role.role) === "ADMIN",
  );
}

function normalizePortalUser(user: unknown): PortalUserRecord {
  const source =
    user && typeof user === "object"
      ? (user as Partial<PortalUserRecord> & {
          role?: string;
          status?: string;
        })
      : {};

  const roles = Array.isArray(source.roles)
    ? source.roles.map((role) => ({
        system: normalizeSystem(role.system),
        role: normalizeRole(role.role),
      }))
    : source.role
      ? [{ system: "VMMS", role: normalizeRole(source.role) }]
      : [];

  return {
    id: String(source.id ?? ""),
    name: String(source.name ?? ""),
    username: String(source.username ?? ""),
    isActive:
      typeof source.isActive === "boolean"
        ? source.isActive
        : source.status !== "Inactive",
    failedLoginAttempts: Number(source.failedLoginAttempts ?? 0),
    lockedAt: source.lockedAt ?? null,
    roles,
  };
}

async function fetchUsers() {
  const endpoint = useBackend ? "/auth/users" : "/users";
  const users = await fetchJSON<unknown[]>(endpoint);
  return users.map((user) => normalizePortalUser(user));
}

function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character.";
  }
  return null;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<PortalUserRecord[]>([]);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [vrmsRole, setVrmsRole] = useState("");
  const [vmmsRole, setVmmsRole] = useState("");
  const [bmsRole, setBmsRole] = useState("");
  const [sharedRole, setSharedRole] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [pendingUserAction, setPendingUserAction] =
    useState<PendingUserAction>(null);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = usersSearch.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.username.toLowerCase().includes(normalizedSearch),
    );
  }, [users, usersSearch]);

  const showToast = (message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(""), 4000);
  };

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      setUsers(await fetchUsers());
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("accessToken");
    if (useBackend && !token) {
      navigate("/login", { replace: true });
      return;
    }

    let isMounted = true;
    getCurrentUser()
      .then((user) => {
        if (!isMounted) return;
        setIsAdmin(hasSharedAdminAccess(user));
      })
      .catch((error) => {
        console.error("Failed to load current user:", error);
        if (isMounted) setIsAdmin(false);
      });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    void loadUsers();
  }, [isAdmin, loadUsers]);

  useEffect(() => {
    const closeActionMenu = () => setOpenActionMenuId(null);
    document.addEventListener("click", closeActionMenu);
    return () => document.removeEventListener("click", closeActionMenu);
  }, []);

  const buildRoleAssignments = () => {
    const roleAssignments: SystemRole[] = [];
    if (vrmsRole) roleAssignments.push({ system: "VRMS", role: vrmsRole });
    if (vmmsRole) roleAssignments.push({ system: "VMMS", role: vmmsRole });
    if (bmsRole) roleAssignments.push({ system: "BMS", role: bmsRole });
    if (sharedRole) {
      roleAssignments.push({ system: "SHARED", role: sharedRole });
    }
    return roleAssignments;
  };

  const handleCreateOrUpdateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!name.trim() || !username.trim()) {
      setFormError("Name and Username are required.");
      return;
    }

    const roleAssignments = buildRoleAssignments();
    if (roleAssignments.length === 0) {
      setFormError("At least one role assignment is required.");
      return;
    }

    try {
      if (modalMode === "create") {
        if (!password) {
          setFormError("Password is required for new users.");
          return;
        }
        const passwordError = validatePasswordStrength(password);
        if (passwordError) {
          setFormError(passwordError);
          return;
        }

        await fetchJSON("/auth/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            password,
            roleAssignments,
          }),
        });
        showToast(`User ${username} created successfully!`);
      } else {
        if (password) {
          const passwordError = validatePasswordStrength(password);
          if (passwordError) {
            setFormError(passwordError);
            return;
          }
        }

        await fetchJSON(`/auth/users/${encodeURIComponent(selectedUserId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            password: password || undefined,
            roleAssignments,
          }),
        });
        showToast(`User ${username} updated successfully!`);
      }

      setShowUserModal(false);
      await loadUsers();
    } catch (error) {
      setFormError(getErrorMessage(error, "Failed to save user."));
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!password) {
      setFormError("Please enter a new password.");
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setFormError(passwordError);
      return;
    }

    try {
      await fetchJSON(`/auth/users/${encodeURIComponent(selectedUserId)}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      showToast(`Password reset successfully for ${username}!`);
      setShowUserModal(false);
      await loadUsers();
    } catch (error) {
      setFormError(getErrorMessage(error, "Failed to save user."));
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await fetchJSON(`/auth/users/${encodeURIComponent(userId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      showToast("User status updated!");
      await loadUsers();
    } catch (error) {
      console.error("Failed to toggle user status:", error);
    }
  };

  const handleUnlockUser = async (userId: string) => {
    try {
      await fetchJSON(`/auth/users/${encodeURIComponent(userId)}/unlock`, {
        method: "PATCH",
      });
      showToast("User account unlocked!");
      await loadUsers();
    } catch (error) {
      console.error("Failed to unlock user:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await fetchJSON(`/auth/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      showToast("User deleted successfully!");
      await loadUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
  };

  const confirmUserAction = async () => {
    if (!pendingUserAction) return;
    const { type, user } = pendingUserAction;
    setPendingUserAction(null);

    if (type === "unlock") {
      await handleUnlockUser(user.id);
      return;
    }

    if (type === "status") {
      await toggleUserStatus(user.id, user.isActive);
      return;
    }

    await handleDeleteUser(user.id);
  };

  const openModal = (mode: ModalMode, user?: PortalUserRecord) => {
    setModalMode(mode);
    setFormError("");

    if (mode === "create") {
      setSelectedUserId("");
      setName("");
      setUsername("");
      setPassword("");
      setVrmsRole(emptyRoleState.vrmsRole);
      setVmmsRole(emptyRoleState.vmmsRole);
      setBmsRole(emptyRoleState.bmsRole);
      setSharedRole(emptyRoleState.sharedRole);
    } else {
      if (!user) return;
      setSelectedUserId(user.id);
      setName(user.name);
      setUsername(user.username);
      setPassword("");

      const getRole = (system: (typeof roleSystems)[number]) =>
        user.roles.find((role) => normalizeSystem(role.system) === system)
          ?.role || "";

      setVrmsRole(getRole("VRMS"));
      setVmmsRole(getRole("VMMS"));
      setBmsRole(getRole("BMS"));
      setSharedRole(getRole("SHARED"));
    }

    setShowUserModal(true);
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="fixed right-8 top-8 z-[60] w-[390px] max-w-[calc(100vw-2rem)]">
          <ToastNotification type="success" message={successMessage} />
        </div>
      )}

      {!isAdmin ? (
        <div className="flex min-h-[520px] items-center justify-center">
          <div className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-8 text-center shadow-card">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <Lock size={26} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]">
              Access Restricted
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              User Accounts can only be managed by a Shared Portal
              administrator.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
                <Users size={24} />
              </div>
              <h2 className="mb-2 text-3xl font-bold text-[var(--color-text-primary)]">
                USER ACCOUNT MANAGEMENT
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Add or edit system roles and active/lockout configurations.
              </p>
            </div>
            <ActionButton
              onClick={() => openModal("create")}
              className="cursor-pointer"
              type="button"
            >
              <Plus size={16} />
              Create New User
            </ActionButton>
          </div>

          <section className="space-y-6">
            <div className="mb-6">
              <SearchInput
                placeholder="Search user by username or name..."
                value={usersSearch}
                onChange={(event) => setUsersSearch(event.target.value)}
              />
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-12 text-sm text-[var(--color-text-secondary)]">
                <RefreshCw className="animate-spin" size={16} />
                Loading user records...
              </div>
            ) : (
              <DataTable
                data={filteredUsers}
                getRowKey={(user) => user.id}
                minWidth="900px"
                emptyMessage="No user accounts found."
                columns={[
                  {
                    key: "name",
                    header: "Full Name",
                    width: "22%",
                    render: (user) => <span className="font-bold">{user.name}</span>,
                  },
                  {
                    key: "username",
                    header: "Username",
                    width: "18%",
                    render: (user) => (
                      <span className="font-semibold text-[#2f3b52]">{user.username}</span>
                    ),
                  },
                  {
                    key: "roles",
                    header: "System Roles",
                    width: "34%",
                    render: (user) => (
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((role, index) => (
                          <span
                            key={`${role.system}-${role.role}-${index}`}
                            className="rounded-full border border-[var(--color-brand-primary)]/20 bg-[var(--color-brand-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-brand-primary)]"
                          >
                            {role.system}: {role.role}
                          </span>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "14%",
                    render: (user) =>
                      user.lockedAt ? (
                        <StatusBadge status="Failed" />
                      ) : user.isActive ? (
                        <StatusBadge status="Active" />
                      ) : (
                        <StatusBadge status="Inactive" />
                      ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    width: "12%",
                    align: "center",
                    render: (user) => (
                      <ActionMenu
                        open={openActionMenuId === user.id}
                        onToggle={(event) => {
                          event.stopPropagation();
                          setOpenActionMenuId((current) =>
                            current === user.id ? null : user.id,
                          );
                        }}
                        items={[
                          ...(user.lockedAt
                            ? [{
                                label: "Unlock",
                                icon: Unlock,
                                onClick: () => {
                                  setOpenActionMenuId(null);
                                  setPendingUserAction({ type: "unlock", user });
                                },
                              }]
                            : []),
                          {
                            label: user.isActive ? "Deactivate" : "Activate",
                            icon: user.isActive ? XCircle : CheckCircle,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              setPendingUserAction({ type: "status", user });
                            },
                          },
                          {
                            label: "Reset Password",
                            icon: Key,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              openModal("reset-pw", user);
                            },
                          },
                          {
                            label: "Edit",
                            icon: Edit2,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              openModal("edit", user);
                            },
                          },
                          {
                            label: "Delete",
                            icon: Trash2,
                            danger: true,
                            onClick: () => {
                              setOpenActionMenuId(null);
                              setPendingUserAction({ type: "delete", user });
                            },
                          },
                        ]}
                      />
                    ),
                  },
                ]} 
              />
            )}
          </section>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(pendingUserAction)}
        variant={pendingUserAction?.type === "delete" ? "danger" : "primary"}
        message={
          pendingUserAction ? (
            <>
              Are you sure you want to{" "}
              {pendingUserAction.type === "unlock"
                ? "unlock"
                : pendingUserAction.type === "status"
                  ? pendingUserAction.user.isActive
                    ? "deactivate"
                    : "activate"
                  : "delete"}{" "}
              this user?
              <span className="mt-2 block font-bold">
                {pendingUserAction.user.username}
              </span>
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Yes"
        onConfirm={() => void confirmUserAction()}
        onCancel={() => setPendingUserAction(null)}
      />

      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.5)] p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-6">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                {modalMode === "create"
                  ? "Create New User Account"
                  : modalMode === "edit"
                    ? "Edit User Roles"
                    : "Reset Password"}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="cursor-pointer text-xl font-bold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                type="button"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                modalMode === "reset-pw"
                  ? handleResetPassword
                  : handleCreateOrUpdateUser
              }
              className="space-y-4 p-6"
            >
              {formError && (
                <div className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              {modalMode !== "reset-pw" && (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. Maria Santos"
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="e.g. msantos"
                      disabled={modalMode === "edit"}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 disabled:opacity-50"
                    />
                  </div>
                </>
              )}

              {(modalMode === "create" || modalMode === "reset-pw") && (
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    {modalMode === "create" ? "Password" : "New Password"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
                  />
                </div>
              )}

              {modalMode !== "reset-pw" && (
                <div>
                  <label className="mb-4 block border-b border-[var(--color-border)] pb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Application Role Mappings
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-blue-400">
                        VRMS Role
                      </label>
                      <select
                        value={vrmsRole}
                        onChange={(event) => setVrmsRole(event.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                      >
                        <option value="">None (No Access)</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="MECHANIC">MECHANIC</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        VMMS Role
                      </label>
                      <select
                        value={vmmsRole}
                        onChange={(event) => setVmmsRole(event.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                      >
                        <option value="">None (No Access)</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="MECHANIC">MECHANIC</option>
                        <option value="OPERATIONS">OPERATIONS</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        BMS Role
                      </label>
                      <select
                        value={bmsRole}
                        onChange={(event) => setBmsRole(event.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                      >
                        <option value="">None (No Access)</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATIONS">OPERATIONS</option>
                        <option value="CUSTOMER_SUPPORT">
                          CUSTOMER_SUPPORT
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        SHARED Portal Role
                      </label>
                      <select
                        value={sharedRole}
                        onChange={(event) => setSharedRole(event.target.value)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                      >
                        <option value="">None</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="cursor-pointer rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[var(--color-brand-dark)]"
                >
                  {modalMode === "reset-pw" ? "Reset Password" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
