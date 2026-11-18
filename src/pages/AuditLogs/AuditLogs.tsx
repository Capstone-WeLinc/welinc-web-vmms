import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { getAuditLogs, type AuditLogRecord } from "../../lib/api/vmmsApi";

const dateTime = (value: string) => new Date(value).toLocaleString("en-PH", {
  dateStyle: "medium", timeStyle: "short",
});

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRecords(await getAuditLogs());
    } catch {
      setError(true);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return records;
    return records.filter((record) => [record.actor, record.action, record.entity, record.details,
      record.previousValue, record.newValue, "Business"]
      .some((value) => value?.toLocaleLowerCase().includes(query)));
  }, [records, search]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Audit Logs" subtitle="Review VMMS business activity." icon={ScrollText} />

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="audit-search">Search audit logs</label>
            <input id="audit-search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actor, action, or record…"
              className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] sm:w-80" />
          </div>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-page-bg)] disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <p className="font-medium text-red-700">Could not load audit logs.</p>
            <button type="button" onClick={() => void load()} className="mt-2 text-sm font-semibold text-[var(--color-brand-primary)]">Try again</button>
          </div>
        ) : loading ? (
          <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading audit logs…</p>
        ) : filteredRecords.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">No audit entries match this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[var(--color-page-bg)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                <tr>{["Date and time", "Type", "Actor", "Action", "Record", "Change / details"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="align-top text-[var(--color-text-primary)]">
                    <td className="whitespace-nowrap px-4 py-3">{dateTime(record.createdAt)}</td>
                    <td className="px-4 py-3">Business</td>
                    <td className="px-4 py-3">{record.actor}</td>
                    <td className="px-4 py-3 font-medium">{record.action.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">{record.entity}</td>
                    <td className="max-w-sm px-4 py-3">
                      {record.previousValue !== null || record.newValue !== null ? (
                        <span>{record.details}: {record.previousValue ?? "—"} → {record.newValue ?? "—"}</span>
                      ) : record.details ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
          {filteredRecords.length} business events loaded.
        </div>
      </section>
    </div>
  );
}
