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

function validatePassword(password: string) {
  const trimmedPassword = password.trim();

  if (!trimmedPassword) {
    return "";
  }

  if (trimmedPassword.length < 8) {
    return "Password must be at least 8 characters long.";
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
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<
    MaintenanceTask[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<"name" | "role">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserRecord | null>(null);
  const [confirmUnlockUser, setConfirmUnlockUser] =
    useState<UserRecord | null>(null);
  const [blockedDeleteUser, setBlockedDeleteUser] =
    useState<UserRecord | null>(null);
  const [confirmCreateUser, setConfirmCreateUser] = useState(false);
  const [duplicateUser, setDuplicateUser] = useState<UserRecord | null>(null);

  useBodyScrollLock(
    Boolean(duplicateUser || confirmDeleteUser || blockedDeleteUser),
  );

  const [passwordError, setPasswordError] = useState("");
  const [newUserForm, setNewUserForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: UserRole | "";
  }>({
    name: "",
    email: "",
    password: "",
    role: "",
  });
  const isCreateFormComplete =
    newUserForm.name.trim().length > 0 &&
    newUserForm.email.trim().length > 0 &&
    newUserForm.password.trim().length > 0 &&
    newUserForm.role !== "";
  const nameValidationMessage = validateUserField(
    newUserForm.name,
    "Name",
  );
  const emailValidationMessage = validateUserField(
    newUserForm.email,
    "Email",
  );
  const isCreatePasswordValid =
    validatePassword(newUserForm.password) === "";
  const isCreateFormValid =
    isCreateFormComplete &&
    !nameValidationMessage &&
    !emailValidationMessage &&
    isCreatePasswordValid;
  const userHasMaintenanceSchedule = (user: UserRecord) =>
    maintenanceSchedules.some(
      (schedule) =>
        schedule.assignedDriver.trim().toLowerCase() ===
        user.name.trim().toLowerCase(),
    );
  const findDuplicateUser = () => {
    const normalizedName = normalizeUserIdentity(newUserForm.name);
    const normalizedEmail = normalizeUserIdentity(newUserForm.email);

    return users.find(
      (user) =>
        normalizeUserIdentity(user.name) === normalizedName ||
        normalizeUserIdentity(user.email) === normalizedEmail,
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

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase();

    return users
      .filter((user) => {
        const matchesSearch = [user.name, user.email, normalizeRole(user.role)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

        const matchesStatus =
          statusFilter === "All" ? true : user.status === statusFilter;

        const matchesRole =
          roleFilter === "All"
            ? true
            : normalizeRole(user.role) === normalizeRole(roleFilter);

        return matchesSearch && matchesStatus && matchesRole;
      })
      .sort((a, b) => {
        const left =
          sortField === "name" ? a.name.toLowerCase() : a.role.toLowerCase();
        const right =
          sortField === "name" ? b.name.toLowerCase() : b.role.toLowerCase();

        if (left < right) return sortDirection === "asc" ? -1 : 1;
        if (left > right) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [users, searchQuery, statusFilter, roleFilter, sortField, sortDirection]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (activePage - 1) * usersPerPage,
    activePage * usersPerPage,
  );

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((user) => user.status === "Active").length;
    const adminUsers = users.filter(
      (user) => normalizeRole(user.role) === "ADMIN",
    ).length;

    return [
      { label: "Total Users", value: totalUsers, icon: ShieldCheck },
      { label: "Active Users", value: activeUsers, icon: UserCheck },
      { label: "Admins", value: adminUsers, icon: Shield },
    ];
  }, [users]);

  const handleDeleteUser = async (user: UserRecord) => {
    if (!currentUser) return;
    if (user.id === currentUser.id) {
      alert("You cannot delete your own account.");
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

    if (!newUserForm.role) {
      alert("Please select a role for the new user.");
      setProcessingUserId(null);
      return;
    }

    const passwordValidationMessage = validatePassword(newUserForm.password);
    if (passwordValidationMessage) {
      setPasswordError(passwordValidationMessage);
      setProcessingUserId(null);
      return;
    }

    setPasswordError("");
    const selectedRole = newUserForm.role;

    try {
      const userInput: UserCreateInput = {
        name: newUserForm.name.trim(),
        email: newUserForm.email.trim(),
        role: newUserForm.role || undefined,
        ...(newUserForm.password.trim() ? { password: newUserForm.password.trim() } : {}),
      };

      if (userToReplace) {
        if (userToReplace.id === currentUser.id) {
          alert("You cannot replace your own account.");
          return;
        }

        const updatedUser = await updateUser(userToReplace.id, {
          name: userInput.name,
          email: userInput.email,
          ...(userInput.password ? { password: userInput.password } : {}),
        });
        const userWithRole =
          userToReplace.role === selectedRole
            ? updatedUser
            : await updateUserRole(userToReplace.id, selectedRole);

        if (userToReplace.name !== userInput.name) {
          await updateScheduledMechanicName(
            userToReplace.name,
            userInput.name,
          );
        }

        setUsers((currentUsers) =>
          currentUsers.map((user) =>
            user.id === userToReplace.id
              ? { ...user, ...updatedUser, role: userWithRole.role }
              : user,
          ),
        );
      } else {
        const createdUser = await createUser(userInput);
        setUsers((currentUsers) => [createdUser, ...currentUsers]);
      }

      setIsCreateModalOpen(false);
      setConfirmCreateUser(false);
      setDuplicateUser(null);
      setNewUserForm({
        name: "",
        email: "",
        password: "",
        role: "",
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

    // Handle self-edit: allow only display name change
    if (isSelf) {
      const nameChanged = editingUser.name !== newUserForm.name;
      const emailChanged = editingUser.email !== newUserForm.email;
      const roleChanged = editingUser.role !== newUserForm.role;

      if (emailChanged || roleChanged) {
        alert("You cannot change your email or role for your own account.");
        return;
      }

      if (!nameChanged) {
        setIsCreateModalOpen(false);
        setEditingUser(null);
        return;
      }

      setProcessingUserId(editingUser.id);
      try {
        const nextName = newUserForm.name.trim();
        await updateUser(editingUser.id, { name: nextName });
        await updateScheduledMechanicName(editingUser.name, nextName);
        const fresh = await getUsers();
        setUsers(fresh);
        setIsCreateModalOpen(false);
        setEditingUser(null);
      } catch (error) {
        console.error("Failed to edit own user", error);
      } finally {
        setProcessingUserId(null);
      }
      return;
    }

    // Non-self edits
    setProcessingUserId(editingUser.id);
    try {
      const nameChanged = editingUser.name !== newUserForm.name;
      const emailChanged = editingUser.email !== newUserForm.email;
      const roleChanged = editingUser.role !== newUserForm.role;

      // Persist name/email changes
      if (nameChanged || emailChanged) {
        const nextName = newUserForm.name.trim();
        await updateUser(editingUser.id, {
          name: newUserForm.name.trim(),
          email: newUserForm.email.trim(),
        });
        if (nameChanged) {
          await updateScheduledMechanicName(editingUser.name, nextName);
        }
      }

      // Persist role change
      if (roleChanged) {
        if (!newUserForm.role) {
          alert("Please select a role for the user.");
        } else {
          const updated = await updateUserRole(
            editingUser.id,
            newUserForm.role,
          );
          setUsers((currentUsers) =>
            currentUsers.map((u) =>
              u.id === updated.id ? { ...u, role: updated.role } : u,
            ),
          );
        }
      }

      // Refresh full user list to ensure backend canonical state
      const fresh = await getUsers();
      setUsers(fresh);
      setIsCreateModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Failed to edit user", error);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleSort = (field: "name" | "role") => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  function canPerform(role: UserRecord["role"], action: string) {
    const normalizedRole = normalizeRole(role);
    const map: Record<string, Record<string, boolean>> = {
      ADMIN: {
        create: true,
        edit: true,
        suspend: true,
        delete: true,
      },
      OPERATIONS: {
        create: true,
        edit: false,
        suspend: true,
        delete: false,
      },
      MECHANIC: {
        create: false,
        edit: false,
        suspend: false,
        delete: false,
      },
    };
    return !!map[normalizedRole]?.[action];
  }

  return (
    <div className={containerClasses}>
      <PageHeader
        icon={ShieldCheck}
        title="User Management"
        subtitle="Manage system users, roles, permissions, and account states"
      />

      <div className={statsGridClasses}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={cardClasses}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{stat.label}</p>
                  <p className="mt-3 text-3xl font-bold text-[var(--color-text-primary)]">
                    {stat.value}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)]/80 p-3 text-[var(--color-text-secondary)] shadow-card">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={cardClasses}>
        <div className={headerSectionClasses}>
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              System Users
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Review users, update roles, suspend accounts, and remove access.
            </p>
          </div>
          <Button
            variant="primary"
            className="flex items-center gap-2"
            onClick={() => {
              setEditingUser(null);
              setNewUserForm({
                name: "",
                email: "",
                password: "",
                role: "",
              });
              setPasswordError("");
              setIsCreateModalOpen(true);
            }}
            disabled={!currentUser || !canPerform(currentUser.role, "create")}
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </Button>
        </div>

        <div className={filtersGridClasses}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search name, email, role..."
              className={searchInputClasses}
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={selectInputClasses}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={selectInputClasses}
            >
              <option value="All">All Roles</option>
              {roleOptions.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {displayRole(roleOption)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className={loadingStateClasses}>
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={emptyStateClasses}>
            No users match your current filters.
          </div>
        ) : (
          <div className={tableWrapperClasses}>
            <div className="min-h-full overflow-x-auto">
              <table className={tableClasses}>
                <thead className={theadClasses}>
                  <tr>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort("name")}
                        className={sortButtonClasses}
                      >
                        <span>User</span>
                        {sortField === "name" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort("role")}
                        className={sortButtonClasses}
                      >
                        <span>Role</span>
                        {sortField === "role" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : null}
                      </button>
                    </th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className={tbodyClasses}>
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="bg-transparent align-top">
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-[var(--color-text-primary)]">
                            {user.name}
                          </p>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {user.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`${badgeClasses} ${roleStyles[user.role] ?? "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]"}`}
                        >
                          {displayRole(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`${badgeClasses} ${
                            user.isLocked
                              ? "border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-200"
                              : statusStyles[user.status] ??
                                "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {user.isLocked ? "Locked" : user.status ?? "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {user.lastActive
                          ? new Date(user.lastActive).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className={actionButtonsGroupClasses}>
                          {normalizeRole(currentUser?.role) === "ADMIN" &&
                          user.isLocked ? (
                            <button
                              type="button"
                              onClick={() => setConfirmUnlockUser(user)}
                              disabled={processingUserId === user.id}
                              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
                            >
                              {processingUserId === user.id
                                ? "Unlocking..."
                                : "Unlock"}
                            </button>
                          ) : null}

                          {normalizeRole(currentUser?.role) === "ADMIN" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(user);
                                setNewUserForm({
                                  name: user.name,
                                  email: user.email,
                                  password: "",
                                  role: user.role,
                                });
                                setIsCreateModalOpen(true);
                              }}
                              className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] ${processingUserId === user.id ? "cursor-not-allowed opacity-50" : ""}`}
                            >
                              Edit
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={
                              processingUserId === user.id ||
                              user.id === currentUser?.id ||
                              normalizeRole(currentUser?.role) !== "ADMIN"
                            }
                            className={`table-delete-button !text-sm !font-medium ${
                              processingUserId === user.id ||
                              user.id === currentUser?.id ||
                              currentUser?.role !== "ADMIN" ||
                              userHasMaintenanceSchedule(user)
                                ? "cursor-not-allowed opacity-50"
                                : ""
                            }`}
                            title={
                              userHasMaintenanceSchedule(user)
                                ? "Cannot delete a user assigned to a maintenance schedule"
                                : "Delete user"
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {paginatedUsers.length} of {filteredUsers.length} users
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
                  disabled={activePage === 1}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span>Page {activePage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
                  disabled={activePage === totalPages}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                {totalPages >= 20 ? (
                  <label className="flex items-center gap-2">
                    <span>Go to</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      placeholder={String(activePage)}
                      aria-label="Go to user page"
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        if (!event.currentTarget.value.trim()) return;
                        const requestedPage = Number(event.currentTarget.value);
                        if (!Number.isFinite(requestedPage)) return;
                        setCurrentPage(
                          Math.min(totalPages, Math.max(1, Math.trunc(requestedPage))),
                        );
                        event.currentTarget.value = "";
                      }}
                      className="w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1.5 text-center text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        title={editingUser ? "Edit user account" : "Create new user account"}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingUser(null);
          setPasswordError("");
        }}
        size="lg"
        className="rounded-[30px] border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
        footer={(
          <div className={buttonGroupClasses}>
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingUser(null);
                setPasswordError("");
              }}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
            >
              Cancel
            </button>
            {editingUser ? (
              <button
                type="submit"
                form="edit-user-form"
                disabled={processingUserId === editingUser.id}
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90 disabled:opacity-70"
              >
                {processingUserId === editingUser.id ? "Saving..." : "Save Changes"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const passwordValidationMessage = validatePassword(newUserForm.password);
                  if (passwordValidationMessage) {
                    setPasswordError(passwordValidationMessage);
                    return;
                  }
                  setPasswordError("");

                  const duplicate = findDuplicateUser();
                  if (duplicate) {
                    setDuplicateUser(duplicate);
                    return;
                  }

                  setConfirmCreateUser(true);
                }}
                disabled={
                  processingUserId === "create" || !isCreateFormValid
                }
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90 disabled:opacity-70"
              >
                {processingUserId === "create" ? "Creating..." : "Create User"}
              </button>
            )}
          </div>
        )}
      >
        <form
          id={editingUser ? "edit-user-form" : "create-user-form"}
          onSubmit={editingUser ? handleEditUser : handleCreateUser}
          className={formClasses}
        >
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Name
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newUserForm.name}
                  placeholder="Enter Name"
                  onChange={(event) =>
                    setNewUserForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={inputClasses}
                  aria-invalid={!editingUser && Boolean(nameValidationMessage)}
                />
                {!editingUser &&
                  newUserForm.name.trim().length > 0 &&
                  nameValidationMessage && (
                    <p className="mt-1 text-xs text-[var(--color-brand-danger)]">
                      {nameValidationMessage}
                    </p>
                  )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                  Email Address
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newUserForm.email}
                  placeholder="Enter email address"
                  name="new-user-email"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) =>
                    setNewUserForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className={inputClasses}
                  disabled={editingUser?.id === currentUser?.id}
                  aria-invalid={
                    !editingUser && Boolean(emailValidationMessage)
                  }
                />
                {!editingUser &&
                  newUserForm.email.trim().length > 0 &&
                  emailValidationMessage && (
                    <p className="mt-1 text-xs text-[var(--color-brand-danger)]">
                      {emailValidationMessage}
                    </p>
                  )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {editingUser && editingUser.id !== currentUser?.id ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newUserForm.password}
                      name="new-user-password"
                      autoComplete="new-password"
                      spellCheck={false}
                      placeholder="Leave blank to keep current password"
                      onChange={(event) => {
                        const nextPassword = event.target.value;
                        setNewUserForm((current) => ({
                          ...current,
                          password: nextPassword,
                        }));
                      }}
                      className={inputClasses}
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                    Role
                  </label>
                  <select
                    required
                    value={newUserForm.role}
                    onChange={(event) =>
                      setNewUserForm((current) => ({
                        ...current,
                        role: event.target.value as UserRole,
                      }))
                    }
                    className={inputClasses}
                    disabled={editingUser?.id === currentUser?.id}
                  >
                    <option value="" disabled>
                      Select role
                    </option>
                    {roleOptions.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>
                        {displayRole(roleOption)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
      </Modal>

      <Modal
        isOpen={Boolean(confirmUnlockUser)}
        title="Unlock user account"
        message={
          confirmUnlockUser
            ? `Unlock ${confirmUnlockUser.name} (${confirmUnlockUser.email})? Their failed login attempts will be reset.`
            : ""
        }
        confirmLabel="Unlock Account"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (confirmUnlockUser) {
            void performUnlockUser(confirmUnlockUser);
          }
        }}
        onClose={() => setConfirmUnlockUser(null)}
      />

      <Modal
        isOpen={confirmCreateUser}
        title="Create user account"
        message={`Create account for ${newUserForm.name || "this user"} (${newUserForm.email || "email"}) with the ${displayRole(newUserForm.role || "") || "selected"} role?`}
        confirmLabel="Create User"
        cancelLabel="Cancel"
        onConfirm={async () => {
          setConfirmCreateUser(false);
          await confirmCreateUserAccount();
        }}
        onClose={() => setConfirmCreateUser(false)}
      />

      {duplicateUser && (
        <div className={modalOverlayClasses}>
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-card">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              Existing User Account
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              An account already exists with a similar name or email:{" "}
              <span className="font-bold text-[var(--color-text-primary)]">
                {duplicateUser.name} ({duplicateUser.email})
              </span>
              .
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDuplicateUser(null);
                  setIsCreateModalOpen(false);
                }}
                disabled={processingUserId === "create"}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDuplicateUser(null)}
                disabled={processingUserId === "create"}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-card-bg-hover)] disabled:opacity-50"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => void confirmCreateUserAccount(duplicateUser)}
                disabled={
                  processingUserId === "create" ||
                  duplicateUser.id === currentUser?.id
                }
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90 disabled:opacity-50"
              >
                {processingUserId === "create" ? "Replacing..." : "Replace"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteUser && (
        <div className={modalOverlayClasses}>
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-card">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete the user
              <br />
              <span className="mt-2 block font-bold text-[var(--color-text-primary)]">{confirmDeleteUser.name} ({confirmDeleteUser.email})</span>
              <br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performDeleteUser(confirmDeleteUser)}
                className="rounded-xl bg-[var(--color-brand-danger)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] hover:bg-[var(--color-brand-danger)]/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {blockedDeleteUser && (
        <div className={modalOverlayClasses}>
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-card">
            <h3 className="mb-3 text-lg font-bold text-[var(--color-text-primary)]">
              User Cannot Be Deleted
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              <span className="font-semibold text-[var(--color-text-primary)]">
                {blockedDeleteUser.name}
              </span>{" "}
              is assigned to an existing maintenance schedule. Remove or
              reassign the schedule before deleting this user.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockedDeleteUser(null)}
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
