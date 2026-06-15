import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBackend } from "../../lib/api/httpClient";
import {
  ShieldCheck,
  Search,
  Filter,
  Shield,
  UserCheck,
  Plus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import {
  createUser,
  deleteUser,
  getManagedUsers,
  getUsers,
  unlockUser,
  updateUser,
  updateUserRole,
  type UserCreateInput,
  type UserRecord,
  type UserRole,
} from "../../lib/api/userService";
import { getCurrentUser } from "../../lib/api/authService";
import {
  getMaintenanceSchedules,
  updateMaintenanceSchedule,
} from "../../lib/api/maintenanceService";
import type { MaintenanceTask } from "../../types/maintenance";

const roleOptions: UserRole[] = ["ADMIN", "OPERATIONS", "MECHANIC"];

const statusStyles: Record<UserRecord["status"], string> = {
  Active: "text-[#047857] bg-[var(--color-status-success)]/15 border border-[var(--color-status-success)]/30 dark:text-[#a7f3d0]",
  Inactive: "text-[#92400e] bg-[var(--color-status-warning)]/15 border border-[var(--color-status-warning)]/30 dark:text-[#fed7aa]",
  Suspended: "text-[#c41c3b] bg-[var(--color-status-error)]/15 border border-[var(--color-status-error)]/30 dark:text-[#fca5ac]",
};

const roleStyles: Record<string, string> = {
  ADMIN: "text-[#0369a1] bg-[var(--color-status-info)]/15 border border-[var(--color-status-info)]/30 dark:text-[#7dd3fc]",
  OPERATIONS: "text-[#92400e] bg-[var(--color-status-warning)]/15 border border-[var(--color-status-warning)]/30 dark:text-[#fed7aa]",
  MECHANIC: "text-[#047857] bg-[var(--color-status-success)]/15 border border-[var(--color-status-success)]/30 dark:text-[#a7f3d0]",
};

function normalizeRole(role?: string | null) {
  return (role ?? "").trim().toUpperCase();
}

function normalizeUserIdentity(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function displayRole(role: string) {
  switch (normalizeRole(role)) {
    case "ADMIN":
      return "Admin";
    case "MECHANIC":
      return "Mechanic";
    case "OPERATIONS":
      return "Operations";

    default:
      return role;
  }
}

function validateUserField(value: string, label: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return `${label} is required.`;
  }

  if (trimmedValue.length < 3) {
    return `${label} must be 3 characters minimum.`;
  }

  return "";
}

function validatePassword(password: string) {
  const trimmedPassword = password.trim();

  if (!trimmedPassword) {
    return "Password is required when creating a user.";
  }

  if (trimmedPassword.length < 12) {
    return "Password must be at least 12 characters long.";
  }

  if (!/[A-Z]/.test(trimmedPassword)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[a-z]/.test(trimmedPassword)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/\d/.test(trimmedPassword)) {
    return "Password must include at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(trimmedPassword)) {
    return "Password must include at least one special character.";
  }

  return "";
}

// Layout & interaction classes
const containerClasses = 'space-y-6';
const statsGridClasses = 'grid gap-4 md:grid-cols-3';
const cardClasses = 'rounded-[26px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card';
const headerSectionClasses = 'mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between';
const filtersGridClasses = 'grid gap-3 md:grid-cols-[1.8fr_1fr_1fr] mb-6';
const searchInputClasses = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none';
const selectInputClasses = 'w-full appearance-none rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none';
const loadingStateClasses = 'rounded-2xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]';
const emptyStateClasses = 'rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]';
const tableWrapperClasses = 'overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-card';
const tableClasses = 'min-w-full text-left text-sm text-[var(--color-text-primary)]';
const theadClasses = 'sticky top-0 z-10 bg-[var(--color-card-bg)] text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]';
const tbodyClasses = 'divide-y divide-[var(--color-divider)]';
const sortButtonClasses = 'inline-flex items-center gap-2 text-left uppercase tracking-[0.16em] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]';
const actionButtonsGroupClasses = 'flex flex-wrap gap-2';
const badgeClasses = 'rounded-full border px-2.5 py-1 text-xs font-semibold';
const modalOverlayClasses = 'fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.5)] px-4 backdrop-blur-sm';
const formClasses = 'space-y-4';
const inputClasses = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none';
const buttonGroupClasses = 'flex justify-end gap-2 pt-2';

export default function UserManagement() {
  const usersPerPage = 8;
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
  const [passwordError, setPasswordError] = useState("");
  const [newUserForm, setNewUserForm] = useState<{
    name: string;
    username: string;
    password: string;
    role: UserRole | "";
  }>({
    name: "",
    username: "",
    password: "",
    role: "",
  });
  const isCreateFormComplete =
    newUserForm.name.trim().length > 0 &&
    newUserForm.username.trim().length > 0 &&
    newUserForm.password.trim().length > 0 &&
    newUserForm.role !== "";
  const nameValidationMessage = validateUserField(
    newUserForm.name,
    "Name",
  );
  const usernameValidationMessage = validateUserField(
    newUserForm.username,
    "Username",
  );
  const isCreatePasswordValid =
    validatePassword(newUserForm.password) === "";
  const isCreateFormValid =
    isCreateFormComplete &&
    !nameValidationMessage &&
    !usernameValidationMessage &&
    isCreatePasswordValid;
  const userHasMaintenanceSchedule = (user: UserRecord) =>
    maintenanceSchedules.some(
      (schedule) =>
        schedule.assignedDriver.trim().toLowerCase() ===
        user.name.trim().toLowerCase(),
    );
  const findDuplicateUser = () => {
    const normalizedName = normalizeUserIdentity(newUserForm.name);
    const normalizedUsername = normalizeUserIdentity(newUserForm.username);

    return users.find(
      (user) =>
        normalizeUserIdentity(user.name) === normalizedName ||
        normalizeUserIdentity(user.username) === normalizedUsername,
    );
  };

  useEffect(() => {
    let isMounted = true;

    // If the app is configured to use the backend but no JWT is present,
    // avoid calling protected endpoints (they will respond 401).
    const token = window.localStorage.getItem("accessToken");
    if (useBackend && !token) {
      // redirect to login so the user can sign in and obtain a token
      navigate("/login", { replace: true });
      return;
    }

    const refreshUsers = async () => {
      try {
        const [resultUsers, me, schedules] = await Promise.all([
          getUsers(),
          getCurrentUser(),
          getMaintenanceSchedules(),
        ]);
        if (!isMounted) return;

        let usersWithLockState = resultUsers;
        if (normalizeRole(me.role) === "ADMIN") {
          const managedUsers = await getManagedUsers();
          const managedUsersById = new Map(
            managedUsers.map((user) => [user.id, user]),
          );
          usersWithLockState = resultUsers.map((user) => {
            const managedUser = managedUsersById.get(user.id);
            return managedUser
              ? {
                  ...user,
                  isLocked: managedUser.isLocked,
                  lockedAt: managedUser.lockedAt,
                }
              : user;
          });
        }

        if (!isMounted) return;
        setUsers(usersWithLockState);
        setCurrentUser(me);
        setMaintenanceSchedules(schedules);
      } catch (error) {
        console.error("Failed to load users or current user", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    refreshUsers();

    const onLoginActivity = () => {
      refreshUsers();
    };
    window.addEventListener("user-login-activity-updated", onLoginActivity);

    return () => {
      isMounted = false;
      window.removeEventListener(
        "user-login-activity-updated",
        onLoginActivity,
      );
    };
  }, [navigate]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase();

    return users
      .filter((user) => {
        const matchesSearch = [user.name, user.username, normalizeRole(user.role)]
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
    if (!canPerform(currentUser.role, "delete")) {
      alert("You do not have permission to delete users.");
      return;
    }
    if (userHasMaintenanceSchedule(user)) {
      setBlockedDeleteUser(user);
      return;
    }
    setConfirmDeleteUser(user);
  };

  const performDeleteUser = async (user: UserRecord) => {
    if (userHasMaintenanceSchedule(user)) {
      setConfirmDeleteUser(null);
      return;
    }

    setProcessingUserId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((currentUsers) =>
        currentUsers.filter((currentUser) => currentUser.id !== user.id),
      );
    } catch (error) {
      console.error("Failed to delete user", error);
    } finally {
      setProcessingUserId(null);
      setConfirmDeleteUser(null);
    }
  };

  const performUnlockUser = async (user: UserRecord) => {
    setProcessingUserId(user.id);
    try {
      const unlockedUser = await unlockUser(user.id);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? {
                ...currentUser,
                isLocked: unlockedUser.isLocked,
                lockedAt: unlockedUser.lockedAt,
              }
            : currentUser,
        ),
      );
    } catch (error) {
      console.error("Failed to unlock user", error);
    } finally {
      setProcessingUserId(null);
      setConfirmUnlockUser(null);
    }
  };

  const updateScheduledMechanicName = async (
    previousName: string,
    nextName: string,
  ) => {
    const normalizedPreviousName = previousName.trim().toLowerCase();
    const matchingSchedules = maintenanceSchedules.filter(
      (schedule) =>
        schedule.assignedDriver.trim().toLowerCase() ===
        normalizedPreviousName,
    );

    if (matchingSchedules.length === 0) return;

    const updatedSchedules = await Promise.all(
      matchingSchedules.map((schedule) =>
        updateMaintenanceSchedule({
          ...schedule,
          assignedDriver: nextName.trim(),
        }),
      ),
    );
    const updatedSchedulesById = new Map(
      updatedSchedules.map((schedule) => [schedule.id, schedule]),
    );

    setMaintenanceSchedules((currentSchedules) =>
      currentSchedules.map(
        (schedule) => updatedSchedulesById.get(schedule.id) ?? schedule,
      ),
    );
  };

  const confirmCreateUserAccount = async (userToReplace?: UserRecord) => {
    if (!isCreateFormValid) return;

    if (!userToReplace) {
      const duplicate = findDuplicateUser();
      if (duplicate) {
        setConfirmCreateUser(false);
        setDuplicateUser(duplicate);
        return;
      }
    }

    setProcessingUserId("create");

    if (!currentUser) {
      alert("Current user unknown");
      setProcessingUserId(null);
      return;
    }
    if (!canPerform(currentUser.role, "create")) {
      alert("You do not have permission to create users.");
      setProcessingUserId(null);
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
        username: newUserForm.username.trim(),
        password: newUserForm.password,
        role: selectedRole,
      };

      if (userToReplace) {
        if (userToReplace.id === currentUser.id) {
          alert("You cannot replace your own account.");
          return;
        }

        const updatedUser = await updateUser(userToReplace.id, {
          name: userInput.name,
          username: userInput.username,
          password: userInput.password,
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
        username: "",
        password: "",
        role: "",
      });

      getUsers()
        .then((freshUsers) => setUsers(freshUsers))
        .catch((error) => console.error("Failed to refresh users", error));
    } catch (error) {
      console.error("Failed to create user", error);
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await confirmCreateUserAccount();
  };

  const handleEditUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !editingUser) return;
    const isSelf = editingUser.id === currentUser.id;

    // Only ADMINs can edit users at all
    if (!canPerform(currentUser.role, "edit")) {
      alert("You do not have permission to edit users.");
      return;
    }

    // Handle self-edit: allow only display name change
    if (isSelf) {
      const nameChanged = editingUser.name !== newUserForm.name;
      const usernameChanged = editingUser.username !== newUserForm.username;
      const roleChanged = editingUser.role !== newUserForm.role;

      if (usernameChanged || roleChanged) {
        alert("You cannot change your username or role for your own account.");
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
      const usernameChanged = editingUser.username !== newUserForm.username;
      const roleChanged = editingUser.role !== newUserForm.role;

      // Persist name/username changes
      if (nameChanged || usernameChanged) {
        const nextName = newUserForm.name.trim();
        await updateUser(editingUser.id, {
          name: nextName,
          username: newUserForm.username.trim(),
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
                  <p className="mt-3 text-3xl font-semibold text-[var(--color-text-primary)]">
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
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
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
                username: "",
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
              placeholder="Search name, username, role..."
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
                    <th className="px-4 py-2.5 font-medium">
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
                    <th className="px-4 py-2.5 font-medium">
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
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Last Active</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className={tbodyClasses}>
                  {paginatedUsers.map((user) => (
                    <tr key={user.id} className="bg-transparent align-top">
                      <td className="px-4 py-2.5">
                        <div className="space-y-0.5">
                          <p className="font-medium text-[var(--color-text-primary)]">
                            {user.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {user.username}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`${badgeClasses} ${roleStyles[user.role] ?? "border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]"}`}
                        >
                          {displayRole(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
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
                      <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">
                        {user.lastActive
                          ? new Date(user.lastActive).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className={actionButtonsGroupClasses}>
                          {normalizeRole(currentUser?.role) === "ADMIN" &&
                          user.isLocked ? (
                            <button
                              type="button"
                              onClick={() => setConfirmUnlockUser(user)}
                              disabled={processingUserId === user.id}
                              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-200"
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
                                  username: user.username,
                                  password: "",
                                  role: user.role,
                                });
                                setIsCreateModalOpen(true);
                              }}
                              className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] ${processingUserId === user.id ? "cursor-not-allowed opacity-50" : ""}`}
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
                            className={`table-delete-button ${
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
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
            >
              Cancel
            </button>
            {editingUser ? (
              <button
                type="submit"
                form="edit-user-form"
                disabled={processingUserId === editingUser.id}
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90 disabled:opacity-70"
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
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90 disabled:opacity-70"
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
                  Username
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newUserForm.username}
                  placeholder="Enter username"
                  name="new-user-username"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) =>
                    setNewUserForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  className={inputClasses}
                  disabled={editingUser?.id === currentUser?.id}
                  aria-invalid={
                    !editingUser && Boolean(usernameValidationMessage)
                  }
                />
                {!editingUser &&
                  newUserForm.username.trim().length > 0 &&
                  usernameValidationMessage && (
                    <p className="mt-1 text-xs text-[var(--color-brand-danger)]">
                      {usernameValidationMessage}
                    </p>
                  )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                    Password
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={newUserForm.password}
                    name="new-user-password"
                    autoComplete="new-password"
                    spellCheck={false}
                    placeholder={
                      editingUser
                        ? editingUser.id === currentUser?.id
                          ? "You can only change your display name here"
                          : "Leave blank to keep current password"
                        : "Enter Password"
                    }
                    disabled={editingUser?.id === currentUser?.id}
                    onChange={(event) => {
                      const nextPassword = event.target.value;

                      setNewUserForm((current) => ({
                        ...current,
                        password: nextPassword,
                      }));

                      if (!editingUser) {
                        setPasswordError(validatePassword(nextPassword));
                      }
                    }}
                    className={inputClasses}
                    aria-disabled={editingUser?.id === currentUser?.id}
                  />
                  {!editingUser && (
                    <p className={`mt-1 text-xs ${passwordError ? "text-[var(--color-brand-danger)]" : "text-[var(--color-text-secondary)]"}`}>
                      {newUserForm.password.trim().length > 0
                        ? passwordError || "Password looks good."
                        : ""}
                    </p>
                  )}
                </div>

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
            ? `Unlock ${confirmUnlockUser.name} (${confirmUnlockUser.username})? Their failed login attempts will be reset.`
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
        message={`Create account for ${newUserForm.name || "this user"} (${newUserForm.username || "username"}) with the ${displayRole(newUserForm.role || "") || "selected"} role?`}
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
            <h3 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
              Existing User Account
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              An account already exists with a similar name or username:{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">
                {duplicateUser.name} ({duplicateUser.username})
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
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setDuplicateUser(null)}
                disabled={processingUserId === "create"}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-card-bg-hover)] disabled:opacity-50"
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
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90 disabled:opacity-50"
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
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete the user
              <br />
              <span className="mt-2 block font-semibold text-[var(--color-text-primary)]">{confirmDeleteUser.name} ({confirmDeleteUser.username})</span>
              <br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-card-bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performDeleteUser(confirmDeleteUser)}
                className="rounded-xl bg-[var(--color-brand-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-surface)] hover:bg-[var(--color-brand-danger)]/90"
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
            <h3 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
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
                className="rounded-xl bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-surface)] transition hover:bg-[var(--color-brand-primary)]/90"
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
