import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Circle, User } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import {
  ActionButton,
  ConfirmationModal,
  ToastNotification,
} from "../../components/ui";
import { getCurrentUser, type UserRecord } from "../../lib/api/authService";
import { fetchJSON } from "../../lib/api/httpClient";

const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const internationalPhonePattern = /^\+\d{7,14}$/;
const philippineLocalPhonePattern = /^9\d{9}$/;

const countryCallingCodes = [
  { code: "+1", country: "United States / Canada" },
  { code: "+44", country: "United Kingdom" },
  { code: "+61", country: "Australia" },
  { code: "+63", country: "Philippines" },
  { code: "+65", country: "Singapore" },
  { code: "+81", country: "Japan" },
  { code: "+82", country: "South Korea" },
  { code: "+852", country: "Hong Kong" },
  { code: "+971", country: "United Arab Emirates" },
  { code: "+91", country: "India" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+39", country: "Italy" },
  { code: "+7", country: "Russia / Kazakhstan" },
];

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
  const trimmed = (name || "").trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length <= 2) {
    return {
      firstName: trimmed,
      lastName: "",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
};

const readString = (source: unknown, key: string, fallback = "") => {
  if (typeof source !== "object" || source === null) return fallback;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

type AccountActivityEntry = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
};

const createSessionLabel = () => {
  const userAgent = navigator.userAgent;
  if (/Windows/i.test(userAgent)) return "Windows";
  if (/Mac/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  return "Current device";
};

const formatActivityTimestamp = (date: Date) =>
  date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function Profile() {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [phoneVerification, setPhoneVerification] = useState<{
    phone: string;
    code: string;
    developmentCode?: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneCountryCode: "+63",
    phone: "",
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
  const [activityLog, setActivityLog] = useState<AccountActivityEntry[]>(() => {
    try {
      const stored = window.localStorage.getItem("vmms-account-activity");
      if (!stored) {
        return [
          {
            id: `session-${Date.now()}`,
            title: `Login - ${createSessionLabel()}`,
            detail: "Current session started",
            timestamp: formatActivityTimestamp(new Date()),
          },
        ];
      }

      const parsed = JSON.parse(stored) as AccountActivityEntry[];
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed.slice(0, 5)
        : [
            {
              id: `session-${Date.now()}`,
              title: `Login - ${createSessionLabel()}`,
              detail: "Current session started",
              timestamp: formatActivityTimestamp(new Date()),
            },
          ];
    } catch {
      return [
        {
          id: `session-${Date.now()}`,
          title: `Login - ${createSessionLabel()}`,
          detail: "Current session started",
          timestamp: formatActivityTimestamp(new Date()),
        },
      ];
    }
  });

  const addAccountActivity = (title: string, detail = "Current session") => {
    const nextEntry: AccountActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      detail,
      timestamp: formatActivityTimestamp(new Date()),
    };

    setActivityLog((current) => [nextEntry, ...current].slice(0, 5));
  };

  useEffect(() => {
    try {
      window.localStorage.setItem("vmms-account-activity", JSON.stringify(activityLog));
    } catch {
      // Ignore storage issues in restricted environments.
    }
  }, [activityLog]);

  const hydrateProfile = (user: UserRecord | null) => {
    if (!user) return;
    const { firstName, lastName } = splitName(user.name);
    const storedPhone = readString(
      user,
      "contact",
      readString(user, "phoneNumber", readString(user, "phone", "")),
    );
    const matchingCountry = [...countryCallingCodes]
      .sort((left, right) => right.code.length - left.code.length)
      .find(({ code }) => storedPhone.startsWith(code));
    const phoneCountryCode = matchingCountry?.code ?? "+63";
    const phone = matchingCountry
      ? storedPhone.slice(phoneCountryCode.length)
      : storedPhone.replace(/^\+/, "");

    setForm({
      firstName,
      lastName,
      email: readString(user, "email"),
      phoneCountryCode,
      phone,
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
      roleLabel,
      email: form.email || "No email on record",
      phone: form.phone
        ? `${form.phoneCountryCode}${form.phone}`
        : "No phone on record",
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
    if (!name) {
      setToast({
        type: "warning",
        message: "Name is required.",
      });
      return;
    }

    let phone = form.phone.replace(/\D/g, "");
    if (form.phoneCountryCode === "+63" && phone.startsWith("0")) {
      phone = phone.slice(1);
    }

    if (form.phoneCountryCode === "+63" && phone && !philippineLocalPhonePattern.test(phone)) {
      setToast({
        type: "warning",
        message: "Philippine numbers must be 9XXXXXXXXX or 09XXXXXXXXX.",
      });
      return;
    }

    const fullPhone = phone ? `${form.phoneCountryCode}${phone}` : "";
    if (fullPhone && !internationalPhonePattern.test(fullPhone)) {
      setToast({
        type: "warning",
        message: "Enter a valid phone number for the selected country code.",
      });
      return;
    }

    const savedPhone = readString(currentUser, "contact");
    if (fullPhone && fullPhone !== savedPhone) {
      try {
        const result = await fetchJSON<{ message: string; developmentCode?: string }>(
          "/auth/profile/phone/send-verification",
          {
            method: "POST",
            body: JSON.stringify({ phone: fullPhone }),
          },
        );
        setPhoneVerification({
          phone: fullPhone,
          code: "",
          developmentCode: result.developmentCode,
        });
        setToast({
          type: "info",
          message: result.developmentCode
            ? `Verification code sent. Development code: ${result.developmentCode}`
            : result.message,
        });
      } catch (error) {
        const serverMessage = error instanceof Error ? error.message : "Unable to send verification SMS.";
        const isMessagingUnavailable = /Semaphore|messaging|not configured|Unable to connect|rejected/i.test(serverMessage);
        setToast({
          type: isMessagingUnavailable ? "warning" : "error",
          message: isMessagingUnavailable
            ? "Phone verification SMS is unavailable right now. Please add messaging credits or enable the SMS provider to continue."
            : serverMessage,
        });
      }
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedUser = await fetchJSON<UserRecord>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email: form.email.trim(),
          contact: fullPhone,
        }),
      });
      setCurrentUser(updatedUser);
      hydrateProfile(updatedUser);
      addAccountActivity("Profile updated", "Changes were saved successfully");
      setToast({
        type: "success",
        message: "Profile changes saved successfully.",
      });
      setIsEditingProfile(false);
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

  const handleVerifyPhone = async () => {
    if (!phoneVerification) return;

    try {
      const verifiedUser = await fetchJSON<UserRecord>("/auth/profile/phone/verify", {
        method: "POST",
        body: JSON.stringify({
          phone: phoneVerification.phone,
          code: phoneVerification.code,
        }),
      });
      const name = `${form.firstName} ${form.lastName}`.trim();
      const updatedUser = await fetchJSON<UserRecord>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email: form.email.trim(),
          contact: phoneVerification.phone,
        }),
      });
      setCurrentUser(updatedUser ?? verifiedUser);
      hydrateProfile(updatedUser ?? verifiedUser);
      addAccountActivity("Phone verified", "Two-factor verification completed successfully");
      setPhoneVerification(null);
      setIsEditingProfile(false);
      setToast({ type: "success", message: "Phone number verified and profile saved." });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to verify phone number.",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentUser) return;

    if (!passwordForm.current) {
      setToast({ type: "warning", message: "Enter your current password." });
      return;
    }

    if (!strongPasswordPattern.test(passwordForm.next)) {
      setToast({
        type: "warning",
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
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
      await fetchJSON("/auth/profile/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
          confirmPassword: passwordForm.confirm,
        }),
      });
      setPasswordForm({ current: "", next: "", confirm: "" });
      addAccountActivity("Password changed", "Security credentials were updated successfully");
      setToast({
        type: "success",
        message: "Password updated successfully.",
      });
      setIsEditingPassword(false);
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
                  disabled={!isEditingProfile}
                  onChange={(event) => handleFormChange("firstName", event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Last Name
                </span>
                <input
                  value={form.lastName}
                  disabled={!isEditingProfile}
                  onChange={(event) => handleFormChange("lastName", event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Email Address
                </span>
                <input
                  value={form.email}
                  disabled={!isEditingProfile}
                  onChange={(event) => handleFormChange("email", event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Phone Number
                </span>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
                  <select
                    value={form.phoneCountryCode}
                    disabled={!isEditingProfile}
                    onChange={(event) => handleFormChange("phoneCountryCode", event.target.value)}
                    className="h-11 rounded-lg border border-[#dce3ed] bg-white px-3 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                    aria-label="Country calling code"
                  >
                    {countryCallingCodes.map(({ code, country }) => (
                      <option key={code} value={code}>
                        {code} ({country})
                      </option>
                    ))}
                  </select>
                  <input
                    value={form.phone}
                    disabled={!isEditingProfile}
                    onChange={(event) => handleFormChange("phone", event.target.value)}
                    placeholder={form.phoneCountryCode === "+63" ? "9XXXXXXXXX or 09XXXXXXXXX" : "Phone number"}
                    inputMode="tel"
                    className="h-11 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                  />
                </div>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase text-[#8a98ad]">
                  Role
                </span>
                <div
                  aria-label="Role"
                  className="mt-2 flex h-11 w-full items-center rounded-lg border border-[#dce3ed] bg-[#f7f9fc] px-4 text-sm text-[#344158]"
                >
                  {profile.roleLabel}
                </div>
              </label>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              {isEditingProfile ? (
                <>
                  <ActionButton variant="secondary" onClick={() => { loadProfile(); setPhoneVerification(null); setIsEditingProfile(false); }}>
                    Cancel
                  </ActionButton>
                  <ActionButton onClick={handleSaveProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? "Saving..." : "Save Changes"}
                  </ActionButton>
                </>
              ) : (
                <ActionButton onClick={() => setIsEditingProfile(true)}>Edit Details</ActionButton>
              )}
            </div>
            {phoneVerification ? (
              <div className="mt-5 rounded-lg border border-[#dce3ed] bg-[#f7f9fc] p-4">
                <p className="text-sm font-semibold text-[#141827]">
                  Enter the 6-digit code sent to {phoneVerification.phone}.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={phoneVerification.code}
                    onChange={(event) =>
                      setPhoneVerification((current) =>
                        current
                          ? { ...current, code: event.target.value.replace(/\D/g, "").slice(0, 6) }
                          : current,
                      )
                    }
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    className="h-11 flex-1 rounded-lg border border-[#dce3ed] bg-white px-4 text-sm text-[#344158] outline-none focus:border-[#070b45]"
                  />
                  <ActionButton onClick={handleVerifyPhone} disabled={phoneVerification.code.length !== 6}>
                    Verify Phone
                  </ActionButton>
                </div>
              </div>
            ) : null}
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
                  disabled={!isEditingPassword}
                  onChange={(event) => handlePasswordChange("current", event.target.value)}
                  placeholder="Enter current password"
                  className="mt-2 h-11 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm outline-none focus:border-[#070b45]"
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
                    disabled={!isEditingPassword}
                    onChange={(event) => handlePasswordChange("next", event.target.value)}
                    placeholder="At least 8 characters"
                    className="mt-2 h-11 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm outline-none focus:border-[#070b45]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase text-[#8a98ad]">
                    Confirm New Password
                  </span>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    disabled={!isEditingPassword}
                    onChange={(event) => handlePasswordChange("confirm", event.target.value)}
                    placeholder="Re-enter new password"
                    className="mt-2 h-11 w-full rounded-lg border border-[#dce3ed] bg-white px-4 text-sm outline-none focus:border-[#070b45]"
                  />
                </label>
              </div>
              <p className="text-sm font-semibold text-[#b50000]">
                At least 8 characters, including uppercase, lowercase, number, and special character
              </p>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              {isEditingPassword ? (
                <>
                  <ActionButton
                    variant="secondary"
                    onClick={() => {
                      setPasswordForm({ current: "", next: "", confirm: "" });
                      setIsEditingPassword(false);
                    }}
                  >
                    Cancel
                  </ActionButton>
                  <ActionButton onClick={handleUpdatePassword} disabled={isSavingPassword}>
                    {isSavingPassword ? "Updating..." : "Update Password"}
                  </ActionButton>
                </>
              ) : (
                <ActionButton onClick={() => setIsEditingPassword(true)}>Change Password</ActionButton>
              )}
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
              className="h-11 rounded-lg border border-[#ffb4b4] px-5 text-sm font-semibold text-[#b50000] transition hover:bg-[#fff1f1]"
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
              {activityLog.map((item, index) => (
                <div key={item.id} className="flex items-center gap-4 px-6 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#070b45]">
                    {index === 0 ? <Circle className="h-3 w-3 fill-current" /> : <ArrowRight className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#141827]">{item.title}</p>
                    <p className="text-xs text-[#8a98ad]">{item.detail}</p>
                    <p className="text-[11px] text-[#8a98ad]">{item.timestamp}</p>
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
          addAccountActivity("Account deletion requested", "Administrator review is pending");
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
