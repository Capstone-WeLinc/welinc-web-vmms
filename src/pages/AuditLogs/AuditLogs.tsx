import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import PageHeader from "../../components/PageHeader/PageHeader";
import { getAuditLogs, type AuditLogRecord, type AuditLogSource } from "../../lib/api/vmmsApi";

const sourceLabels: Record<AuditLogSource, string> = {
  all: "All activity",
  login: "Logins",
  vehicle: "Vehicles",
  "work-order": "Work orders",
  schedule: "Schedules",
  fuel: "Fuel",
};

const dateTime = (value: string) => new Date(value).toLocaleString("en-PH", {
  dateStyle: "medium", timeStyle: "short",
});

export default function AuditLogs() {
  const [source, setSource] = useState<AuditLogSource>("all");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRecords(await getAuditLogs(source));
    } catch {
      setError(true);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => { void load(); }, [load]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return records;
    return records.filter((record) => [record.actor, record.action, record.entity, record.details,
      record.previousValue, record.newValue, sourceLabels[record.source]]
      .some((value) => value?.toLocaleLowerCase().includes(query)));
  }, [records, search]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Audit Logs" subtitle="Review login and project activity across VMMS." icon={ScrollText} />

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="audit-source">Activity type</label>
            <select id="audit-source" value={source} onChange={(event) => setSource(event.target.value as AuditLogSource)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
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
                    <td className="px-4 py-3">{sourceLabels[record.source]}</td>
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
          Showing {filteredRecords.length} of {records.length} most recent matching entries (up to 500).
        </div>
      </section>
    </div>
  );
}
