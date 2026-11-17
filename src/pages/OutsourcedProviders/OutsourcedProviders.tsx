import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { canManageSchedules } from "../../lib/utils/permissions";
import { createOutsourcedProvider, getOutsourcedProviders, updateOutsourcedProvider, type OutsourcedProviderRecord } from "../../lib/api/vmmsApi";

export default function OutsourcedProviders() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const canManage = canManageSchedules(currentUser);
  const [providers, setProviders] = useState<OutsourcedProviderRecord[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setProviders(await getOutsourcedProviders()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load providers."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    getOutsourcedProviders()
      .then((records) => { if (active) setProviders(records); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "Unable to load providers."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function addProvider(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError("");
    try { await createOutsourcedProvider(name.trim()); setName(""); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save provider."); }
    finally { setSaving(false); }
  }

  async function toggle(provider: OutsourcedProviderRecord) {
    setError("");
    try { await updateOutsourcedProvider(provider.id, { isActive: !provider.isActive }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update provider."); }
  }

  return <main className="mx-auto w-full max-w-5xl p-6">
    <div className="mb-6 flex items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Outsourced Providers</h1><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Registered providers available for outsourced maintenance schedules.</p></div>
      <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"><RefreshCw size={16} />Refresh</button>
    </div>
    {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {canManage && <form onSubmit={addProvider} className="mb-6 flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <input aria-label="Provider name" maxLength={150} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Provider name" className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm" />
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} />Add provider</button>
    </form>}
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
      {loading ? <p className="p-5 text-sm">Loading providers…</p> : providers.length === 0 ? <p className="p-5 text-sm text-[var(--color-text-secondary)]">No providers registered.</p> : <table className="w-full text-left text-sm">
        <thead className="bg-[var(--color-surface)] text-xs uppercase text-[var(--color-text-secondary)]"><tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Status</th>{canManage && <th className="px-4 py-3 text-right">Action</th>}</tr></thead>
        <tbody>{providers.map((provider) => <tr key={provider.id} className="border-t border-[var(--color-border)]"><td className="px-4 py-3 font-medium">{provider.name}</td><td className="px-4 py-3">{provider.isActive ? "Active" : "Inactive"}</td>{canManage && <td className="px-4 py-3 text-right"><button onClick={() => void toggle(provider)} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs">{provider.isActive ? "Deactivate" : "Activate"}</button></td>}</tr>)}</tbody>
      </table>}
    </div>
  </main>;
}
