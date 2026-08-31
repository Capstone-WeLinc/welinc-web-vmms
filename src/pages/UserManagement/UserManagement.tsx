import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit2, KeyRound, Plus, Unlock, UserRoundCheck, Users } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  ActionButton,
  ActionMenu,
  ConfirmationModal,
  DataTable,
  Modal,
  Pagination,
  SearchInput,
  StatusBadge,
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

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "OPERATIONS", "MECHANIC", "CHIEF_MECHANIC"];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  OPERATIONS: "Operations",
  MECHANIC: "Mechanic",
  CHIEF_MECHANIC: "Chief Mechanic",
};

const normalizeIdentity = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

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
  const [unlockTarget, setUnlockTarget] = useState<UserRecord | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null);
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
      .filter((user) =>
        [user.name, user.email, user.role, user.isLocked ? "Locked" : user.status]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [search, users]);

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
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="w-full sm:max-w-md"
            value={search}
            placeholder="Search users..."
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {users.filter((user) => user.status === "Active").length} active of {users.length} users
          </span>
        </div>

        <DataTable
          data={visibleUsers}
          getRowKey={(user) => user.id}
          minWidth="760px"
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
            { key: "role", header: "Role", width: "18%", render: (user) => ROLE_LABELS[user.role as UserRole] ?? user.role },
            {
              key: "status",
              header: "Status",
              width: "18%",
              render: (user) => (
                <StatusBadge status={user.isLocked ? "Locked" : user.status} />
              ),
            },
            {
              key: "updatedAt",
              header: "Last Updated",
              width: "24%",
              render: (user) =>
                user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "Not available",
            },
            {
              key: "actions",
              header: "Actions",
              width: "10%",
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
                          void toggleStatus(user);
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
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            >
              <option value="" disabled>Select role</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role] ?? role}
                </option>
              ))}
            </select>
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
            ? `Are you sure you want to reset the password for ${resetPasswordTarget.name} to the system default (Password123!)? They will be required to change it on their next login.`
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
