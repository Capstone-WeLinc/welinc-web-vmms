import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Circle, User } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  ActionButton,
  ConfirmationModal,
  ToastNotification,
} from "../../components/ui";
import { getCurrentUser, type UserRecord } from "../../lib/api/authService";
import { updateUser } from "../../lib/api/userService";
import { fetchJSON } from "../../lib/api/httpClient";

const roleLabelMap: Record<string, string> = {
  ADMIN: "Administrator",
  MECHANIC: "Mechanic",
  OPERATIONS: "Operations",
};

const getInitials = (name?: string) =>
  (name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const splitName = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const readString = (source: unknown, key: string, fallback = "") => {
  if (typeof source !== "object" || source === null) return fallback;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    username: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [toast, setToast] = useState<{
    type: "success" | "error" | "warning" | "info";
    message: string;
  } | null>(null);

  const hydrateProfile = (user: UserRecord | null) => {
    if (!user) return;
    const { firstName, lastName } = splitName(user.name);
    const username = user.username ?? "";

    setForm({
      firstName,
      lastName,
      email: readString(user, "email"),
      phone: readString(user, "phoneNumber", readString(user, "phone", "")),
      username,
    });
  };

  const loadProfile = () => {
    setIsLoading(true);
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        hydrateProfile(user);
      })
      .catch(() => {
        setCurrentUser(null);
        setToast({
          type: "error",
          message: "Unable to load profile from the backend.",
        });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const profile = useMemo(() => {
    const role = currentUser?.role ?? "ADMIN";
    const roleLabel = roleLabelMap[role] ?? role;
    const fullName = `${form.firstName} ${form.lastName}`.trim();

    return {
      initials: getInitials(fullName || currentUser?.name),
      name: fullName || currentUser?.name || "User",
      username: form.username || currentUser?.username || "username",
      roleLabel,
      email: form.email || "No email on record",
      phone: form.phone || "No phone on record",
      joined: readString(currentUser, "createdAt")
        ? `Joined ${new Date(readString(currentUser, "createdAt")).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}`
        : "Joined date unavailable",
    };
  }, [currentUser, form]);

  const isMechanic = currentUser?.role === "MECHANIC";

  const handleFormChange = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePasswordChange = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    const name = `${form.firstName} ${form.lastName}`.trim();
    if (!name || !form.username.trim()) {
      setToast({
        type: "warning",
        message: "Name and username are required.",
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedUser = await updateUser(currentUser.id, {
        name,
        username: form.username.trim(),
      });
      setCurrentUser(updatedUser);
      hydrateProfile(updatedUser);
      setToast({
        type: "success",
        message: "Profile changes saved successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save profile changes.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentUser) return;

    if (passwordForm.next.length < 8) {
      setToast({
        type: "warning",
        message: "New password must be at least 8 characters.",
      });
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      setToast({
        type: "warning",
        message: "Password confirmation does not match.",
      });
      return;
    }

    setIsSavingPassword(true);
    try {
      await fetchJSON(`/auth/users/${encodeURIComponent(currentUser.id)}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: passwordForm.next }),
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
      setToast({
        type: "success",
        message: "Password updated successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update password.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="fixed right-6 top-6 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>

      <PageHeader
        icon={User}
        title="PROFILE"
        subtitle="Manage your personal details"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#dce3ed] bg-white p-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#070b45] text-2xl font-extrabold text-white">
              {profile.initials}
            </div>
            <h2 className="mt-5 text-base font-extrabold text-[#141827]">
              {isLoading ? "Loading..." : profile.name}
            </h2>
            <span className="mt-3 rounded-full border border-[#070b45] px-5 py-1 text-[10px] font-bold uppercase text-[#070b45]">
              {profile.roleLabel}
            </span>
            <div className="mt-4 space-y-1 text-xs font-medium text-[#141827]">
              <p>{profile.email}</p>
              <p>{profile.phone}</p>
              {isMechanic ? <p>{profile.joined}</p> : null}
            </div>
          </div>

          {isMechanic ? (
            <div className="mt-8 border-t border-[#edf1f7] pt-6">
              <div className="grid grid-cols-2 gap-3 text-center">
                {[
                  ["38", "Total logs"],
                  ["11", "This month"],
                  ["2", "In progress"],
                  ["36", "Completed"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-[#f6f8fb] px-3 py-4">
                    <p className="text-xl font-extrabold text-[#141827]">{value}</p>
                    <p className="mt-1 text-xs text-[#667085]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="mt-8 h-10 w-full rounded-lg border border-[#ffb4b4] text-sm font-semibold text-[#b50000] transition hover:bg-[#fff1f1]"
            onClick={() =>
              setToast({
                type: "info",
                message: "Sign out request noted for this session.",
              })
            }
          >
            Sign out of all devices
          </button>
        </aside>

        <div className="space-y-6">
          <section className="rounded-xl border border-[#dce3ed] bg-white p-6">
            <h3 className="text-base font-extrabold text-[#141827]">
              Personal Details
            </h3>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  First Name
                </span>
                <input
                  value={form.firstName}
                  onChange={(event) => handleFormChange("firstName", event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Last Name
                </span>
                <input
                  value={form.lastName}
                  onChange={(event) => handleFormChange("lastName", event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Email Address
                </span>
                <input
                  value={form.email}
                  onChange={(event) => handleFormChange("email", event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Phone Number
                </span>
                <input
                  value={form.phone}
                  onChange={(event) => handleFormChange("phone", event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Username
                </span>
                <input
                  value={form.username}
                  onChange={(event) => handleFormChange("username", event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Role
                </span>
                <input
                  value={profile.roleLabel}
                  readOnly
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-[#f7f9fc] px-4 text-sm text-[#344158]"
                />
              </label>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <ActionButton variant="secondary" onClick={loadProfile}>
                Cancel
              </ActionButton>
              <ActionButton onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </ActionButton>
            </div>
          </section>

          <section className="rounded-xl border border-[#dce3ed] bg-white p-6">
            <h3 className="text-base font-extrabold text-[#141827]">Password</h3>
            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Current Password
                </span>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(event) => handlePasswordChange("current", event.target.value)}
                  placeholder="Enter current password"
                  className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm outline-none focus:border-[#070b45]"
                />
              </label>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase text-[#8a98ad]">
                    New Password
                  </span>
                  <input
                    type="password"
                    value={passwordForm.next}
                    onChange={(event) => handlePasswordChange("next", event.target.value)}
                    placeholder="At least 8 characters"
                    className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm outline-none focus:border-[#070b45]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase text-[#8a98ad]">
                    Confirm New Password
                  </span>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(event) => handlePasswordChange("confirm", event.target.value)}
                    placeholder="Re-enter new password"
                    className="mt-2 h-10 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm outline-none focus:border-[#070b45]"
                  />
                </label>
              </div>
              <p className="text-sm font-semibold text-[#b50000]">
                At least 8 characters
              </p>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <ActionButton
                variant="secondary"
                onClick={() => setPasswordForm({ current: "", next: "", confirm: "" })}
              >
                Cancel
              </ActionButton>
              <ActionButton onClick={handleUpdatePassword} disabled={isSavingPassword}>
                {isSavingPassword ? "Updating..." : "Update Password"}
              </ActionButton>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-xl border border-[#ffb4b4] bg-white p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-1 h-5 w-5 text-[#ff4040]" />
              <div>
                <h3 className="text-base font-extrabold text-[#141827]">
                  Account deletion
                </h3>
                <p className="mt-3 max-w-3xl text-sm text-[#667085]">
                  Requesting deletion notifies your administrator. Once approved,
                  your account and maintenance logs are permanently removed - this
                  cannot be undone.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="h-10 rounded-lg border border-[#ffb4b4] px-5 text-sm font-semibold text-[#b50000] transition hover:bg-[#fff1f1]"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Request Account Deletion
            </button>
          </section>

          <section className="rounded-xl border border-[#dce3ed] bg-white">
            <h3 className="border-b border-[#edf1f7] px-6 py-4 text-sm font-extrabold text-[#141827]">
              Recent account activity
            </h3>
            <div className="divide-y divide-[#edf1f7]">
              {[
                "Login - Chrome on Windows",
                "Password changed",
                "Login - Mobile Safari on iOS",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-4 px-6 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#070b45]">
                    {index === 2 ? <Circle className="h-3 w-3 fill-current" /> : <ArrowRight className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#141827]">{item}</p>
                    <p className="text-xs text-[#8a98ad]">
                      May 12, 2026 - Quezon City, PH
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        variant="danger"
        requirePassword
        passwordValue={deletePassword}
        onPasswordChange={setDeletePassword}
        message="Are you sure you want to request account deletion?"
        confirmLabel="Yes"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setDeletePassword("");
          setToast({
            type: "warning",
            message: "Account deletion request submitted.",
          });
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeletePassword("");
        }}
      />
    </div>
  );
}
