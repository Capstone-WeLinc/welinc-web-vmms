import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit2, Plus, Trash2, Unlock, UserRoundCheck, Users } from "lucide-react";
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
import { getCurrentUser } from "../../lib/api/authService";
import { getMaintenanceSchedules } from "../../lib/api/maintenanceService";
import {
  createUser,
  deleteUser,
  getManagedUsers,
  unlockUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  type UserCreateInput,
  type UserRecord,
  type UserRole,
} from "../../lib/api/userService";
import type { MaintenanceTask } from "../../types/maintenance";

type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole | "";
};

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "",
};

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "OPERATIONS", "MECHANIC"];

const normalizeIdentity = (value?: string | null) =>
  (value ?? "").trim().toLowerCase();

const validatePassword = (password: string) => {
  if (!password) return "";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password needs an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password needs a lowercase letter.";
  if (!/\d/.test(password)) return "Password needs a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password needs a special character.";
  return "";
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [schedules, setSchedules] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<UserRecord | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [loadedUsers, me, loadedSchedules] = await Promise.all([
        getManagedUsers(),
        getCurrentUser(),
        getMaintenanceSchedules(),
      ]);
      setUsers(loadedUsers);
      setCurrentUser(me);
      setSchedules(loadedSchedules);
    } catch (error) {
      console.error("Failed to load user management data", error);
      setToast({ type: "error", message: "Unable to load users." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

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
        [user.name, user.email, user.role, user.status]
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

  const isAssignedToSchedule = (user: UserRecord) =>
    schedules.some(
      (schedule) =>
        normalizeIdentity(schedule.assignedDriver) === normalizeIdentity(user.name),
    );

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.role });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (processing) return;
    setFormOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
  };

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const passwordError = validatePassword(form.password);

    if (!name || !email || !form.role) {
      setToast({ type: "warning", message: "Name, email, and role are required." });
      return;
    }
    if (!editingUser && !form.password) {
      setToast({ type: "warning", message: "Password is required for new users." });
      return;
    }
    if (passwordError) {
      setToast({ type: "warning", message: passwordError });
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

    setProcessing(true);
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, {
          name,
          email,
          ...(form.password ? { password: form.password } : {}),
        });
        const withRole =
          editingUser.role === form.role
            ? updated
            : await updateUserRole(editingUser.id, form.role);
        setUsers((current) =>
          current.map((user) =>
            user.id === editingUser.id
              ? { ...user, ...updated, role: withRole.role }
              : user,
          ),
        );
        setToast({ type: "success", message: "User updated successfully." });
      } else {
        const input: UserCreateInput = { name, email, password: form.password, role: form.role };
        const created = await createUser(input);
        setUsers((current) => [created, ...current]);
        setToast({ type: "success", message: "User created successfully." });
      }
      closeForm();
      setFormOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error("Failed to save user", error);
      setToast({ type: "error", message: "Unable to save the user." });
    } finally {
      setProcessing(false);
    }
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (isAssignedToSchedule(deleteTarget)) {
      setToast({ type: "warning", message: "Users assigned to maintenance schedules cannot be deleted." });
      setDeleteTarget(null);
      return;
    }
    try {
      await deleteUser(deleteTarget.id);
      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
      setToast({ type: "success", message: "User deleted successfully." });
    } catch (error) {
      console.error("Failed to delete user", error);
      setToast({ type: "error", message: "Unable to delete the user." });
    } finally {
      setDeleteTarget(null);
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
            { key: "role", header: "Role", width: "18%", render: (user) => user.role },
            {
              key: "status",
              header: "Status",
              width: "18%",
              render: (user) => <StatusBadge status={user.status} />,
            },
            {
              key: "lastActive",
              header: "Last Active",
              width: "24%",
              render: (user) =>
                user.lastActive ? new Date(user.lastActive).toLocaleString() : "Not available",
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
                      label: user.status === "Active" ? "Deactivate" : "Activate",
                      icon: UserRoundCheck,
                      onClick: () => void toggleStatus(user),
                    },
                    ...(user.isLocked
                      ? [{ label: "Unlock", icon: Unlock, onClick: () => setUnlockTarget(user) }]
                      : []),
                    {
                      label: "Delete",
                      icon: Trash2,
                      danger: true,
                      onClick: () => {
                        if (user.id === currentUser?.id) {
                          setToast({ type: "warning", message: "You cannot delete your own account." });
                          return;
                        }
                        setDeleteTarget(user);
                      },
                    },
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
            {editingUser ? "New Password (optional)" : "Password"}
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              autoComplete="new-password"
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
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Delete User"
        variant="danger"
        message={deleteTarget ? `Delete ${deleteTarget.name}? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(unlockTarget)}
        title="Unlock User"
        message={unlockTarget ? `Unlock ${unlockTarget.name}'s account?` : ""}
        confirmLabel="Unlock"
        onConfirm={() => void confirmUnlock()}
        onCancel={() => setUnlockTarget(null)}
      />
    </div>
  );
}
