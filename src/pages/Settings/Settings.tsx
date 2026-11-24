import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Settings2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import {
  getSettingsCatalog,
  updateSettingsCatalog,
  type SettingsCatalogEntry,
} from '../../lib/api/settingsService';

const formatValue = (entry: SettingsCatalogEntry) => {
  if (entry.effectiveValue == null) return 'Not set';
  if (entry.unit === 'PHP') {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(entry.effectiveValue);
  }
  return `${entry.effectiveValue.toFixed(2)}%`;
};

export default function Settings() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [entries, setEntries] = useState<SettingsCatalogEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    void getSettingsCatalog()
      .then((catalog) => {
        if (!active) return;
        setEntries(catalog);
        setDrafts(
          Object.fromEntries(
            catalog.map((entry) => [
              entry.key,
              entry.effectiveValue == null ? '' : String(entry.effectiveValue),
            ]),
          ),
        );
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load settings.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>, entry: SettingsCatalogEntry) => {
    event.preventDefault();
    if (!isAdmin) return;

    const raw = drafts[entry.key]?.trim() ?? '';
    const value = Number(raw);
    if (
      !raw ||
      !Number.isFinite(value) ||
      value < entry.constraints.min ||
      value > entry.constraints.max ||
      Math.abs(value * 100 - Math.round(value * 100)) > 1e-8
    ) {
      setError(
        entry.unit === 'PHP'
          ? 'Enter a positive PHP amount with at most two decimal places.'
          : 'Enter a percentage from 1 to 99 with at most two decimal places.',
      );
      return;
    }

    setSavingKey(entry.key);
    setError('');
    setNotice('');
    try {
      const catalog = await updateSettingsCatalog(entry.key, value);
      setEntries(catalog);
      setDrafts(
        Object.fromEntries(
          catalog.map((item) => [
            item.key,
            item.effectiveValue == null ? '' : String(item.effectiveValue),
          ]),
        ),
      );
      setNotice(`${entry.label} saved.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `Unable to save ${entry.label}.`,
      );
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="Settings"
        subtitle={
          isAdmin
            ? 'Review and update VMMS system thresholds.'
            : 'View VMMS system thresholds. Settings are read-only for Operations.'
        }
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-danger)]/25 bg-[var(--color-brand-danger)]/5 px-4 py-3 text-sm">
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-[var(--color-brand-danger)]" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-[var(--color-brand-success)]/25 bg-[var(--color-brand-success)]/5 px-4 py-3 text-sm">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--color-brand-success)]" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          Loading settings…
        </div>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
          No configurable settings are available.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
          {entries.map((entry, index) => (
            <section
              key={entry.key}
              className={`grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] lg:items-end ${
                index > 0 ? 'border-t border-[var(--color-divider)]' : ''
              }`}
            >
              <div>
                <h2 className="font-semibold text-[var(--color-text-primary)]">{entry.label}</h2>
                <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">{entry.description}</p>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Effective value: <span className="font-semibold text-[var(--color-text-primary)]">{formatValue(entry)}</span>
                  {entry.updatedAt
                    ? ` · Updated ${new Date(entry.updatedAt).toLocaleString()}`
                    : ' · Using default or unset state'}
                </p>
              </div>

              {isAdmin && entry.editable ? (
                <form onSubmit={(event) => void save(event, entry)} className="flex items-end gap-2">
                  <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {entry.unit === 'PHP' ? 'Amount (PHP)' : 'Percentage'}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={entry.constraints.min}
                      max={entry.constraints.max}
                      step="0.01"
                      value={drafts[entry.key] ?? ''}
                      onChange={(event) => {
                        setDrafts((current) => ({ ...current, [entry.key]: event.target.value }));
                        setError('');
                        setNotice('');
                      }}
                      disabled={savingKey === entry.key}
                      className="min-h-11 w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={savingKey === entry.key}
                    icon={
                      savingKey === entry.key
                        ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                        : undefined
                    }
                    className="min-h-11"
                  >
                    {savingKey === entry.key ? 'Saving…' : 'Save'}
                  </Button>
                </form>
              ) : (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Read only</span>
                  <p className="mt-0.5 font-semibold tabular-nums text-[var(--color-text-primary)]">{formatValue(entry)}</p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
