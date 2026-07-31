import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit2, KeyRound, Plus, Unlock, UserRoundCheck, Users } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  ActionButton,
  ActionMenu,
  ConfirmationModal,
  DataTable,
  DropdownSelect,
  FilterDropdown,
  Modal,
  Pagination,
  SearchInput,
  SortSelect,
  StatusBadge,
  TableToolbar,
  ToastNotification,
} from "../../components/ui";
import {
  createUser,
  getManagedUsers,
  resetUserPassword,
  unlockUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  type UserCreateInput,
  type UserRecord,
  type UserRole,
} from "../../lib/api/userService";

type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};
type UserSortField = "name" | "email" | "role" | "status" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

type UserForm = {
  name: string;
  email: string;
  role: UserRole | "";
  isActive: boolean;
};

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  role: "",
  isActive: true,
};

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; title?: string }> = [
  { value: "ADMIN", label: "Admin" },
  {
    value: "OPERATIONS",
    label: "Operations",
    title:
      "Web-based role for monitoring vehicle availability and status, scheduling maintenance, assigning work orders, and coordinating vehicle usage.",
  },
  { value: "CHIEF_MECHANIC", label: "Chief Mechanic" },
  { value: "MECHANIC", label: "Mechanic" },
];

const roleLabelMap: Record<UserRole, string> = {
  ADMIN: "Admin",
  OPERATIONS: "Operations",
  CHIEF_MECHANIC: "Chief Mechanic",
  MECHANIC: "Mechanic",
};

const normalizeIdentity = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

const formatUserDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : "Not available";

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<UserSortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [roleFilters, setRoleFilters] = useState<UserRole[]>([]);
  const [createdDateFrom, setCreatedDateFrom] = useState("");
  const [createdDateTo, setCreatedDateTo] = useState("");
  const [unlockTarget, setUnlockTarget] = useState<UserRecord | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null);
  const [activateTarget, setActivateTarget] = useState<UserRecord | null>(null);
  const [editConfirmationOpen, setEditConfirmationOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const loadedUsers = await getManagedUsers();
      setUsers(loadedUsers);
    } catch (error) {
      console.error("Failed to load user management data", error);
      if (showLoading) {
        setToast({ type: "error", message: "Unable to load users." });
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);

    const refreshUsers = () => void loadData();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshUsers();
    };
    const refreshInterval = window.setInterval(refreshUsers, 10_000);

    window.addEventListener("focus", refreshUsers);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshUsers);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredUsers = useMemo(() => {
    const query = normalizeIdentity(search);
    return users
      .filter((user) => {
        const displayStatus = user.isLocked ? "Locked" : user.status;
        const createdDate = user.createdAt?.slice(0, 10) ?? "";
        const matchesSearch = [user.name, user.email, user.role, displayStatus]
          .join(" ")
          .toLowerCase()
          .includes(query);
        const matchesStatus = statusFilters.length === 0 || statusFilters.includes(displayStatus);
        const matchesRole = roleFilters.length === 0 || roleFilters.includes(user.role);
        const matchesDateFrom = !createdDateFrom || createdDate >= createdDateFrom;
        const matchesDateTo = !createdDateTo || createdDate <= createdDateTo;

        return matchesSearch && matchesStatus && matchesRole && matchesDateFrom && matchesDateTo;
      })
      .sort((left, right) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        if (sortField === "name") return left.name.localeCompare(right.name) * direction;
        if (sortField === "email") return left.email.localeCompare(right.email) * direction;
        if (sortField === "role") return left.role.localeCompare(right.role) * direction;
        if (sortField === "status") {
          const leftStatus = left.isLocked ? "Locked" : left.status;
          const rightStatus = right.isLocked ? "Locked" : right.status;
          return leftStatus.localeCompare(rightStatus) * direction;
        }
        if (sortField === "createdAt") {
          return (new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime()) * direction;
        }
        return (new Date(left.updatedAt ?? 0).getTime() - new Date(right.updatedAt ?? 0).getTime()) * direction;
      });
  }, [createdDateFrom, createdDateTo, roleFilters, search, sortDirection, sortField, statusFilters, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleUsers = filteredUsers.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setOpenMenuId(null);
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.status === "Active",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (processing) return;
    setFormOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
  };

  const persistUser = async (name: string, email: string, role: UserRole) => {
    setProcessing(true);
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, {
          name,
          email,
        });
        const withRole =
          editingUser.role === form.role
            ? updated
            : await updateUserRole(editingUser.id, role);
        setUsers((current) =>
          current.map((user) =>
            user.id === editingUser.id
              ? { ...user, ...updated, role: withRole.role }
              : user,
          ),
        );
        setToast({ type: "success", message: "User updated successfully." });
      } else {
        const input: UserCreateInput = {
          name,
          email,
          role,
          isActive: form.isActive,
        };
        const created = await createUser(input);
        setUsers((current) => [created, ...current]);
        setToast({
          type: "success",
          message: `User created. A password setup code was sent to ${email}.`,
        });
      }
      closeForm();
      setFormOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error("Failed to save user", error);
      setToast({ type: "error", message: "Unable to save the user." });
      if (editingUser) setFormOpen(true);
    } finally {
      setProcessing(false);
    }
  };

  const saveUser = (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();

    if (!name || !email || !form.role) {
      setToast({ type: "warning", message: "Name, email, and role are required." });
      return;
    }
    const duplicate = users.find(
      (user) =>
        user.id !== editingUser?.id &&
        (normalizeIdentity(user.name) === normalizeIdentity(name) ||
          normalizeIdentity(user.email) === normalizeIdentity(email)),
    );
    if (duplicate) {
      setToast({ type: "warning", message: "A user with this name or email already exists." });
      return;
    }

    if (editingUser) {
      setFormOpen(false);
      setEditConfirmationOpen(true);
      return;
    }

    void persistUser(name, email, form.role);
  };

  const confirmEdit = () => {
    if (!form.role) return;
    setEditConfirmationOpen(false);
    void persistUser(form.name.trim(), form.email.trim(), form.role);
  };

  const toggleStatus = async (user: UserRecord) => {
    const nextStatus = user.status === "Active" ? "Inactive" : "Active";
    try {
      const updated = await updateUserStatus(user.id, nextStatus);
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, ...updated } : item)),
      );
      setToast({ type: "success", message: `User marked ${nextStatus.toLowerCase()}.` });
    } catch (error) {
      console.error("Failed to update user status", error);
      setToast({ type: "error", message: "Unable to update user status." });
    }
  };

  const confirmDeactivation = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    void toggleStatus(target);
  };

  const confirmActivation = () => {
    if (!activateTarget) return;
    const target = activateTarget;
    setActivateTarget(null);
    void toggleStatus(target);
  };

  const toggleRoleFilter = (role: UserRole) => {
    setRoleFilters((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
    setPage(1);
  };

  const confirmUnlock = async () => {
    if (!unlockTarget) return;
    try {
      const updated = await unlockUser(unlockTarget.id);
      setUsers((current) =>
        current.map((user) => (user.id === updated.id ? { ...user, ...updated } : user)),
      );
      setToast({ type: "success", message: "User account unlocked." });
    } catch (error) {
      console.error("Failed to unlock user", error);
      setToast({ type: "error", message: "Unable to unlock the user." });
    } finally {
      setUnlockTarget(null);
    }
  };

  const confirmPasswordReset = async () => {
    if (!resetPasswordTarget) return;
    const target = resetPasswordTarget;
    try {
      const updated = await resetUserPassword(target.id);
      setUsers((current) =>
        current.map((user) => (user.id === target.id ? { ...user, ...updated } : user)),
      );
      setToast({ type: "success", message: `Password reset successfully for ${target.name}.` });
    } catch (error) {
      console.error("Failed to reset user password", error);
      setToast({ type: "error", message: "Unable to reset the user's password." });
    } finally {
      setResetPasswordTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="fixed right-6 top-6 z-[80] w-[340px] max-w-[calc(100vw-2rem)]">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>

      <PageHeader
        icon={Users}
        title="USER MANAGEMENT"
        subtitle="Manage system users, roles, and account access"
        action={
          <ActionButton onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add User
          </ActionButton>
        }
      />

      <section>
        <TableToolbar
          search={
            <SearchInput
              className="w-full sm:w-96"
              value={search}
              placeholder="Search users..."
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          }
          sort={
            <SortSelect
              className="w-full sm:w-60"
              value={`${sortField}-${sortDirection}`}
              onChange={(value) => {
                const [field, direction] = value.split("-") as [UserSortField, SortDirection];
                setSortField(field);
                setSortDirection(direction);
                setPage(1);
              }}
              options={[
                { value: "name-asc", label: "Name - A to Z" },
                { value: "name-desc", label: "Name - Z to A" },
                { value: "email-asc", label: "Email - A to Z" },
                { value: "email-desc", label: "Email - Z to A" },
                { value: "role-asc", label: "Role - A to Z" },
                { value: "role-desc", label: "Role - Z to A" },
                { value: "status-asc", label: "Status - A to Z" },
                { value: "status-desc", label: "Status - Z to A" },
                { value: "createdAt-desc", label: "Created - Newest" },
                { value: "createdAt-asc", label: "Created - Oldest" },
                { value: "updatedAt-desc", label: "Updated - Newest" },
                { value: "updatedAt-asc", label: "Updated - Oldest" },
              ]}
            />
          }
          actions={
            <div className="flex items-center gap-2">
              <FilterDropdown
                open={filterOpen}
                onToggle={() => setFilterOpen((current) => !current)}
                statuses={["Active", "Inactive", "Locked"]}
                selectedStatuses={statusFilters}
                onStatusChange={(statuses) => {
                  setStatusFilters(statuses);
                  setPage(1);
                }}
                dateFrom={createdDateFrom}
                dateTo={createdDateTo}
                onDateFromChange={(value) => {
                  setCreatedDateFrom(value);
                  setPage(1);
                }}
                onDateToChange={(value) => {
                  setCreatedDateTo(value);
                  setPage(1);
                }}
                onApply={() => setFilterOpen(false)}
                onClear={() => {
                  setStatusFilters([]);
                  setRoleFilters([]);
                  setCreatedDateFrom("");
                  setCreatedDateTo("");
                  setPage(1);
                  setFilterOpen(false);
                }}
                legendTitle="User Table Legend"
                legendItems={[
                  { label: "Active", description: "User can sign in and access allowed modules.", tone: "#059669" },
                  { label: "Inactive", description: "User account is disabled but kept in the table.", tone: "#64748b" },
                  { label: "Locked", description: "User access is blocked until unlocked from the action menu.", tone: "#dc2626" },
                  { label: "Role", description: "Controls which modules and actions the user can access.", tone: "#2563eb" },
                ]}
              >
                <div>
                  <p className="text-sm font-semibold text-black">Role</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {ROLE_OPTIONS.map((role) => {
                      const checked = roleFilters.includes(role.value);
                      return (
                        <label key={role.value} className="flex cursor-pointer items-center gap-2 text-sm text-[#141827]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRoleFilter(role.value)}
                            className="h-4 w-4 rounded border-[#cbd3df] accent-[#070b45]"
                          />
                          {role.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </FilterDropdown>
            </div>
          }
        />

        <DataTable
          data={visibleUsers}
          getRowKey={(user) => user.id}
          minWidth="760px"
          maxHeight="min(34rem, calc(100vh - 18rem))"
          emptyMessage={loading ? "Loading users..." : "No users found."}
          columns={[
            {
              key: "user",
              header: "User",
              width: "30%",
              render: (user) => (
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-xs text-[#70747c]">{user.email}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              width: "18%",
              render: (user) => (
                <span title={user.role === "OPERATIONS" ? ROLE_OPTIONS[1].title : undefined}>
                  {roleLabelMap[user.role] ?? user.role}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              width: "15%",
              render: (user) => (
                <StatusBadge status={user.isLocked ? "Locked" : user.status} />
              ),
            },
            {
              key: "createdAt",
              header: "Date Created",
              width: "18%",
              render: (user) => formatUserDate(user.createdAt),
            },
            {
              key: "updatedAt",
              header: "Last Updated",
              width: "18%",
              render: (user) => formatUserDate(user.updatedAt),
            },
            {
              key: "actions",
              header: "",
              width: "7%",
              align: "center",
              render: (user) => (
                <ActionMenu
                  open={openMenuId === user.id}
                  onToggle={(event) => {
                    event.stopPropagation();
                    setOpenMenuId((current) => (current === user.id ? null : user.id));
                  }}
                  items={[
                    { label: "Edit", icon: Edit2, onClick: () => openEdit(user) },
                    {
                      label: "Reset Password",
                      icon: KeyRound,
                      onClick: () => {
                        setOpenMenuId(null);
                        setResetPasswordTarget(user);
                      },
                    },
                    {
                      label: user.status === "Active" ? "Deactivate" : "Activate",
                      icon: UserRoundCheck,
                      onClick: () => {
                        setOpenMenuId(null);
                        if (user.status === "Active") {
                          setDeactivateTarget(user);
                        } else {
                          setActivateTarget(user);
                        }
                      },
                    },
                    ...(user.isLocked
                      ? [{
                          label: "Unlock",
                          icon: Unlock,
                          onClick: () => {
                            setOpenMenuId(null);
                            setUnlockTarget(user);
                          },
                        }]
                      : []),
                  ]}
                />
              ),
            },
          ]}
        />

        <Pagination
          page={activePage}
          totalPages={totalPages}
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>

      <Modal
        isOpen={formOpen}
        title={editingUser ? "Edit User" : "Create User"}
        size="lg"
        onClose={closeForm}
        footer={
          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" onClick={closeForm} disabled={processing}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" form="user-management-form" disabled={processing}>
              {processing ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
            </ActionButton>
          </div>
        }
      >
        <form id="user-management-form" className="grid gap-4" onSubmit={saveUser}>
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Name
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
            Role
            <DropdownSelect
              value={form.role}
              onChange={(value) => setForm((current) => ({ ...current, role: value as UserRole }))}
              label="Role"
              buttonClassName="rounded-lg border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)]"
              options={[
                { value: "", label: "Select role", disabled: true },
                ...ROLE_OPTIONS.map((role) => ({
                  value: role.value,
                  label: role.label,
                })),
              ]}
            />
          </label>
          {!editingUser ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm font-medium text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand-primary)]"
              />
              Active user
            </label>
          ) : null}
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={editConfirmationOpen}
        title="Confirm User Changes"
        message={editingUser ? `Save changes to ${editingUser.name}'s account?` : ""}
        confirmLabel="Save Changes"
        onConfirm={confirmEdit}
        onCancel={() => {
          setEditConfirmationOpen(false);
          setFormOpen(true);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(deactivateTarget)}
        title="Deactivate User"
        message={
          deactivateTarget
            ? `Are you sure you want to deactivate ${deactivateTarget.name}'s account?`
            : ""
        }
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={confirmDeactivation}
        onCancel={() => setDeactivateTarget(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(activateTarget)}
        title="Activate User"
        message={
          activateTarget
            ? `Are you sure you want to activate ${activateTarget.name}'s account?`
            : ""
        }
        confirmLabel="Activate"
        onConfirm={confirmActivation}
        onCancel={() => setActivateTarget(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(unlockTarget)}
        title="Unlock User"
        message={unlockTarget ? `Unlock ${unlockTarget.name}'s account?` : ""}
        confirmLabel="Unlock"
        onConfirm={() => void confirmUnlock()}
        onCancel={() => setUnlockTarget(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(resetPasswordTarget)}
        title="Reset Password"
        message={
          resetPasswordTarget
            ? `Are you sure you want to reset the password for ${resetPasswordTarget.name}? The new password will be handled securely and will not be displayed here.`
            : ""
        }
        confirmLabel="Reset Password"
        variant="danger"
        onConfirm={() => void confirmPasswordReset()}
        onCancel={() => setResetPasswordTarget(null)}
      />

    </div>
  );
}
