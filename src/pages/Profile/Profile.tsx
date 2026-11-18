import { useEffect, useState } from 'react';
import { CircleUserRound } from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';
import { apiRequest, fetchJSON } from '../../lib/api/httpClient';
import { PORTAL_URL } from '../../lib/session/session';
import { useAuthStore } from '../../store/authStore';

type DeletionRequest = {
  id: string;
  status: string;
  reason: string | null;
  requestedAt: string;
  decisionNote: string | null;
  eraseAfter: string | null;
};

type SharedProfile = {
  name: string;
  contact: string | null;
  profilePicture: string | null;
};

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

function pictureUrl(picture: string | null | undefined): string | null {
  return picture?.startsWith('/uploads/') ? `${API_BASE_URL}${picture}` : null;
}

export default function Profile() {
  const user = useAuthStore((state) => state.currentUser);
  const [name, setName] = useState(user?.name ?? '');
  const [contact, setContact] = useState(user?.contact ?? '');
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchJSON<SharedProfile>('/auth/me'),
      fetchJSON<{ request: DeletionRequest | null }>('/auth/profile/deletion-request'),
    ]).then(([profile, deletion]) => {
      if (!active) return;
      setName(profile.name);
      setContact(profile.contact ?? '');
      const currentUser = useAuthStore.getState().currentUser;
      if (currentUser) useAuthStore.setState({ currentUser: { ...currentUser, name: profile.name, contact: profile.contact, profilePicture: profile.profilePicture } });
      setRequest(deletion.request ?? null);
    }).catch(() => {
      if (active) setMessage('Some account details could not be loaded.');
    });
    return () => { active = false; };
  }, []);

  async function saveProfile() {
    setBusy(true);
    setMessage('');
    try {
      await fetchJSON('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, contact }),
      });
      if (user) useAuthStore.setState({ currentUser: { ...user, name, contact } });
      setMessage('Profile saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the profile.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadPicture(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const profile = await apiRequest<SharedProfile>('/auth/profile/picture', {
        method: 'POST',
        body,
      });
      if (user) useAuthStore.setState({ currentUser: { ...user, profilePicture: profile.profilePicture } });
      setMessage('Profile picture updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update the profile picture.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    setBusy(true);
    setMessage('');
    try {
      await fetchJSON('/auth/profile/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: password, newPassword }),
      });
      setPassword('');
      setNewPassword('');
      setMessage('Password updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update the password.');
    } finally {
      setBusy(false);
    }
  }

  async function requestDeletion() {
    setBusy(true);
    setMessage('');
    try {
      const verified = await fetchJSON<{ reauthToken: string }>('/auth/profile/verify-password', {
        method: 'POST',
        body: JSON.stringify({ password, purpose: 'ACCOUNT_DELETION' }),
      });
      const result = await fetchJSON<{ id: string; status: string; reason: string | null; requestedAt: string; decisionNote: string | null; eraseAfter: string | null }>('/auth/profile/deletion-request', {
        method: 'POST',
        body: JSON.stringify({ reauthToken: verified.reauthToken, reason }),
      });
      setRequest(result);
      setPassword('');
      setReason('');
      setMessage('Account deletion request submitted. Your account stays available while it is reviewed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request account deletion.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletion() {
    setBusy(true);
    try {
      await fetchJSON('/auth/profile/deletion-request', { method: 'DELETE' });
      setRequest(null);
      setMessage('Account deletion request cancelled.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to cancel the request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Profile" subtitle="Manage your shared WeLinc account." icon={CircleUserRound} />
      {message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6">
        <h2 className="text-lg font-semibold">Your details</h2>
        {pictureUrl(user?.profilePicture) && <img src={pictureUrl(user?.profilePicture) ?? undefined} alt="Your profile" className="h-20 w-20 rounded-full object-cover" />}
        <label className="block text-sm">Profile picture<input className="mt-1 block w-full" type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={busy} onChange={(event) => { void uploadPicture(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /><span className="mt-1 block text-xs text-[var(--color-text-secondary)]">PNG, JPEG, GIF, or WebP; up to 5 MB.</span></label>
        <label className="block text-sm">Name<input className="mt-1 block w-full rounded border p-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="block text-sm">Email<input className="mt-1 block w-full rounded border p-2" value={user?.email ?? ''} readOnly /></label>
        <label className="block text-sm">Phone<input className="mt-1 block w-full rounded border p-2" value={contact} onChange={(event) => setContact(event.target.value)} /></label>
        <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy} onClick={() => void saveProfile()}>Save profile</button>
      </section>
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6">
        <h2 className="text-lg font-semibold">Change password</h2>
        <label className="block text-sm">Current password<input type="password" className="mt-1 block w-full rounded border p-2" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="block text-sm">New password<input type="password" className="mt-1 block w-full rounded border p-2" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !password || !newPassword} onClick={() => void changePassword()}>Update password</button>
      </section>
      {user?.role === 'ADMIN' && <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6">
        <h2 className="mb-2 text-lg font-semibold">Sign-in activity</h2>
        <p className="mb-3 text-sm text-[var(--color-text-secondary)]">Review account sign-ins and changes in the WeLinc portal.</p>
        <a className="font-semibold text-[var(--color-brand-primary)] underline underline-offset-4" href={`${PORTAL_URL}/admin/activity?system=VMMS`} target="_blank" rel="noreferrer">
          Open portal activity
        </a>
      </section>}
      <section className="space-y-4 rounded-xl border border-red-200 bg-[var(--color-card-bg)] p-6">
        <h2 className="text-lg font-semibold">Delete account</h2>
        {request?.status === 'PENDING' ? <>
          <p className="text-sm">Your request is pending review. Your account remains active.</p>
          <button className="rounded border border-red-700 px-4 py-2 text-red-700" disabled={busy} onClick={() => void cancelDeletion()}>Cancel request</button>
        </> : request?.status === 'REJECTED' ? <p className="text-sm">Request rejected: {request.decisionNote ?? 'No note provided.'}</p> : <>
          <p className="text-sm">Confirm your password to ask an administrator to delete your account.</p>
          <label className="block text-sm">Reason (optional)<textarea className="mt-1 block w-full rounded border p-2" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !password} onClick={() => void requestDeletion()}>Request account deletion</button>
        </>}
      </section>
    </div>
  );
}
