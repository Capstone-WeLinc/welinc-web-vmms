import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CircleDollarSign, Download, Truck } from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import { printRowsAsPdf } from '../../lib/utils/frontendExport';
import {
  getMaintenanceCostPeriod,
  getPreviousMaintenanceCostPeriod,
  type MaintenanceCostHalf,
  type MaintenanceCostPeriodType,
} from '../../lib/utils/maintenanceCostingPeriod';
import { getMaintenanceCostBreakdown } from '../../lib/utils/maintenanceCostingAnalysis';
import { useAuthStore } from '../../store/authStore';
import {
  auditMaintenanceCostingPdfExport,
  exportMaintenanceCostingXlsx,
  getMaintenanceCostingDashboard,
  updateMaintenanceCostThreshold,
  type MaintenanceCostingDashboard,
} from '../../lib/api/costingService';

function currentMonthPeriod() {
  const now = new Date();
  return getMaintenanceCostPeriod(
    'monthly',
    now.getFullYear(),
    now.getMonth() + 1,
    now.getMonth() < 6 ? 'first' : 'second',
    '',
    '',
  )!;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2,
}).format(value);

function CostBreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof getMaintenanceCostBreakdown>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
      <div className="border-b border-[var(--color-divider)] px-5 py-4">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Selected-period eligible completed work.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-[var(--color-input-bg)] text-xs uppercase text-[var(--color-text-secondary)]">
            <tr><th className="px-5 py-3">Category</th><th className="px-5 py-3">Completed Cost</th><th className="px-5 py-3">Completed Records</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-[var(--color-divider)]">
                <td className="px-5 py-3">{row.label}</td>
                <td className="px-5 py-3 font-semibold">{formatCurrency(row.totalCost)}</td>
                <td className="px-5 py-3">{row.completedRecords}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="px-5 py-8 text-center text-[var(--color-text-secondary)]">No completed costs in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MaintenanceCosting() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === 'ADMIN';
  const initialPeriod = useMemo(() => currentMonthPeriod(), []);
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const now = new Date();
  const [periodType, setPeriodType] = useState<MaintenanceCostPeriodType>('monthly');
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [twoMonthBlock, setTwoMonthBlock] = useState(Math.floor(now.getMonth() / 2) + 1);
  const [periodHalf, setPeriodHalf] = useState<MaintenanceCostHalf>(now.getMonth() < 6 ? 'first' : 'second');
  const [appliedPeriod, setAppliedPeriod] = useState(initialPeriod);
  const [appliedPeriodType, setAppliedPeriodType] = useState<MaintenanceCostPeriodType>('monthly');
  const [data, setData] = useState<MaintenanceCostingDashboard | null>(null);
  const [comparisonData, setComparisonData] = useState<MaintenanceCostingDashboard | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (
    period: { from: string; to: string },
    type: MaintenanceCostPeriodType,
    showLoading = true,
  ) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const previousPeriod = getPreviousMaintenanceCostPeriod(type, period);
      const [result, comparison] = await Promise.all([
        getMaintenanceCostingDashboard(period.from, period.to),
        getMaintenanceCostingDashboard(previousPeriod.from, previousPeriod.to),
      ]);
      setData(result);
      setComparisonData(comparison);
      setThresholdInput(result.threshold == null ? '' : String(result.threshold));
      setAppliedPeriod(period);
      setAppliedPeriodType(type);
    } catch {
      setData(null);
      setComparisonData(null);
      setError('Unable to load maintenance costing. Please retry.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(initialPeriod, 'monthly'), 0);
    return () => window.clearTimeout(initialLoad);
  }, [initialPeriod, load]);

  useEffect(() => {
    const refresh = () => void load(appliedPeriod, appliedPeriodType, false);
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, [appliedPeriod, appliedPeriodType, load]);

  const selectedTruck = data?.trucks.find((truck) => truck.vehicleId === selectedTruckId) ?? null;
  const scopedTrucks = selectedTruck ? [selectedTruck] : data?.trucks ?? [];
  const typeBreakdown = getMaintenanceCostBreakdown(scopedTrucks, 'type');
  const garageBreakdown = getMaintenanceCostBreakdown(scopedTrucks, 'garage');
  const currentCost = selectedTruck?.totalCost ?? data?.totalMaintenanceCosts ?? 0;
  const previousTruck = selectedTruck
    ? comparisonData?.trucks.find((truck) => truck.vehicleId === selectedTruck.vehicleId)
    : null;
  const previousCost = selectedTruck
    ? previousTruck?.totalCost ?? 0
    : comparisonData?.totalMaintenanceCosts ?? 0;
  const costDifference = currentCost - previousCost;

  const saveThreshold = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(thresholdInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || Math.abs(parsed * 100 - Math.round(parsed * 100)) > 1e-8) {
      setError('Enter a positive threshold amount.');
      return;
    }
    setSavingThreshold(true);
    setError(null);
    setNotice(null);
    try {
      await updateMaintenanceCostThreshold(parsed);
      setNotice('High-cost threshold saved.');
      await load(appliedPeriod, appliedPeriodType);
    } catch {
      setError('Unable to save the threshold. Admin access and a positive amount are required.');
    } finally {
      setSavingThreshold(false);
    }
  };

  const applyPeriod = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const period = getMaintenanceCostPeriod(periodType, periodYear, periodMonth, periodHalf, from, to, twoMonthBlock);
    if (!period) {
      setError('Choose a valid date range.');
      return;
    }
    setSelectedTruckId(null);
    setFrom(period.from);
    setTo(period.to);
    void load(period, periodType);
  };

  const exportPdf = () => {
    if (!data) return;
    setError(null);
    const trucks = selectedTruck ? [selectedTruck] : data.trucks;
    const headers = ['Truck Plate', 'Make', 'Model', 'Current Garage', 'Completed Maintenance Cost', 'High-Cost Flag', 'Recurring High-Cost Candidate'];
    const rows = trucks.map((truck) => [
      truck.plateNumber,
      truck.make ?? '',
      truck.model,
      truck.garageName ?? 'Unclassified',
      formatCurrency(truck.totalCost),
      truck.flagged ? 'Yes' : 'No',
      truck.recurringHighCost ? 'Yes' : 'No',
    ]);
    printRowsAsPdf(
      `Maintenance Costing (${appliedPeriod.from} to ${appliedPeriod.to})`,
      headers,
      rows,
      () => {
        void auditMaintenanceCostingPdfExport(
          appliedPeriod.from,
          appliedPeriod.to,
          selectedTruck?.vehicleId,
        ).catch(() => {
          setError('The PDF was generated, but its audit record could not be saved.');
        });
      },
    );
  };

  const exportXlsx = async () => {
    if (!data) return;
    setExportingXlsx(true);
    setError(null);
    try {
      const blob = await exportMaintenanceCostingXlsx(
        appliedPeriod.from,
        appliedPeriod.to,
        selectedTruck?.vehicleId,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const truckSuffix = selectedTruck ? `-${selectedTruck.plateNumber}` : '';
      link.href = url;
      link.download = `maintenance-costing-${appliedPeriod.from}-to-${appliedPeriod.to}${truckSuffix}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Unable to export maintenance costing. Please retry.');
    } finally {
      setExportingXlsx(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CircleDollarSign}
        title="Maintenance Costing"
        subtitle="Read-only costs from Chief Mechanic-approved completed maintenance work orders."
      />

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={applyPeriod}>
          <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            Period
            <select aria-label="Maintenance cost period" value={periodType} onChange={(event) => setPeriodType(event.target.value as MaintenanceCostPeriodType)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              <option value="monthly">Monthly</option>
              <option value="bimonthly">Every 2 months</option>
              <option value="semiannual">Semi-annually</option>
              <option value="annual">Annually</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          {periodType === 'monthly' && (
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              Month
              <input aria-label="Cost month" type="month" value={`${periodYear}-${String(periodMonth).padStart(2, '0')}`} onChange={(event) => {
                const [year, month] = event.target.value.split('-').map(Number);
                if (year && month) { setPeriodYear(year); setPeriodMonth(month); }
              }} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
            </label>
          )}
          {periodType === 'semiannual' && (
            <>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Half-year
                <select aria-label="Cost half-year" value={periodHalf} onChange={(event) => setPeriodHalf(event.target.value as MaintenanceCostHalf)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  <option value="first">First half (Jan–Jun)</option>
                  <option value="second">Second half (Jul–Dec)</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Year
                <input aria-label="Cost year" type="number" min="1900" max="9999" value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
              </label>
            </>
          )}
          {periodType === 'bimonthly' && (
            <>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Two-month period
                <select aria-label="Cost two-month period" value={twoMonthBlock} onChange={(event) => setTwoMonthBlock(Number(event.target.value))} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  <option value={1}>Jan–Feb</option><option value={2}>Mar–Apr</option><option value={3}>May–Jun</option>
                  <option value={4}>Jul–Aug</option><option value={5}>Sep–Oct</option><option value={6}>Nov–Dec</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                Year
                <input aria-label="Cost year" type="number" min="1900" max="9999" value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
              </label>
            </>
          )}
          {periodType === 'annual' && (
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              Year
              <input aria-label="Cost year" type="number" min="1900" max="9999" value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
            </label>
          )}
          {periodType === 'custom' && (
            <>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                From
                <input aria-label="Cost period start" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                To
                <input aria-label="Cost period end" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
              </label>
            </>
          )}
          <button type="submit" className="rounded-lg bg-[#070b45] px-4 py-2 text-sm font-bold text-white">Apply Period</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPdf}
            disabled={!data || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-bold text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <Download size={16} /> Export PDF
          </button>
          <button
            type="button"
            onClick={() => void exportXlsx()}
            disabled={!data || loading || exportingXlsx}
            className="inline-flex items-center gap-2 rounded-lg bg-[#070b45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Download size={16} /> {exportingXlsx ? 'Preparing Excel…' : 'Export Excel (.xlsx)'}
          </button>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={saveThreshold} className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
          <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            High-cost threshold (PHP)
            <input
              aria-label="High-cost threshold in Philippine pesos"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={thresholdInput}
              onChange={(event) => setThresholdInput(event.target.value)}
              placeholder="Enter threshold"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>
          <button disabled={savingThreshold} type="submit" className="rounded-lg bg-[#070b45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {savingThreshold ? 'Saving…' : 'Save Threshold'}
          </button>
          <p className="text-xs text-[var(--color-text-secondary)]">Only Admin can change this threshold. Current: {data?.threshold == null ? 'Not configured' : formatCurrency(data.threshold)}.</p>
        </form>
      )}

      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      {loading && <p role="status" className="text-sm text-[var(--color-text-secondary)]">Loading maintenance costs…</p>}

      {!loading && data && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total Maintenance Costs" value={formatCurrency(data.totalMaintenanceCosts)} icon={<CircleDollarSign size={20} />} hint={`${appliedPeriod.from} to ${appliedPeriod.to}`} />
            <KpiCard label="Most Costly Truck" value={data.mostCostlyTruck?.plateNumber ?? 'No completed costs'} icon={<AlertTriangle size={20} />} hint={data.mostCostlyTruck ? formatCurrency(data.mostCostlyTruck.totalCost) : undefined} />
            <KpiCard label="Average Cost per Active Truck" value={formatCurrency(data.averageCostPerTruck)} icon={<CalendarDays size={20} />} />
            <KpiCard label="Total Active Trucks" value={String(data.totalActiveTrucks)} icon={<Truck size={20} />} hint={`${data.trucksWithCosts} with completed costs in this period`} />
          </div>

          <section className="grid gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 md:grid-cols-3">
            <div className="md:col-span-3">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Period Comparison</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {appliedPeriod.from} to {appliedPeriod.to} compared with {comparisonData?.period.from} to {comparisonData?.period.to}
                {selectedTruck ? ` for ${selectedTruck.plateNumber}` : ' for the fleet'}.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">Selected period</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{formatCurrency(currentCost)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">Previous equivalent period</p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{formatCurrency(previousCost)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                {costDifference > 0 ? 'Increase' : costDifference < 0 ? 'Decrease' : 'No change'}
              </p>
              <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">
                {formatCurrency(Math.abs(costDifference))}
                {previousCost > 0 && <span className="ml-2 text-sm font-medium">({(Math.abs(costDifference / previousCost) * 100).toFixed(1)}%)</span>}
              </p>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <CostBreakdownTable title="Cost by Maintenance Type" rows={typeBreakdown} />
            <div>
              <p className="mb-2 text-xs text-[var(--color-text-secondary)]">Garage groups use each truck’s current garage assignment, not a historical garage-at-completion record.</p>
              <CostBreakdownTable title="Cost by Current Garage Assignment" rows={garageBreakdown} />
            </div>
          </div>

          {data.threshold == null && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">High-cost flags are inactive until Admin configures a positive threshold.</p>
          )}

          <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
            <div className="border-b border-[var(--color-divider)] px-5 py-4">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Maintenance Costs by Truck</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Only completed records approved by the Chief Mechanic are included.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[var(--color-input-bg)] text-xs uppercase text-[var(--color-text-secondary)]">
                  <tr><th className="px-5 py-3">Truck Plate</th><th className="px-5 py-3">Make / Model</th><th className="px-5 py-3">Garage</th><th className="px-5 py-3">Completed Cost</th><th className="px-5 py-3">Management Flag</th></tr>
                </thead>
                <tbody>
                  {data.trucks.map((truck) => (
                    <tr key={truck.vehicleId} className={`border-t border-[var(--color-divider)] ${truck.flagged || truck.recurringHighCost ? 'bg-amber-50/70' : ''}`}>
                      <td className="px-5 py-3"><button type="button" onClick={() => setSelectedTruckId(truck.vehicleId)} className="font-bold text-[var(--color-brand-primary)] underline-offset-2 hover:underline">{truck.plateNumber}</button>{!truck.isActive && <span className="ml-2 text-xs text-[var(--color-text-secondary)]">Inactive</span>}</td>
                      <td className="px-5 py-3 text-[var(--color-text-primary)]">{[truck.make, truck.model].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-5 py-3 text-[var(--color-text-primary)]">{truck.garageName ?? '—'}</td>
                      <td className="px-5 py-3 font-semibold text-[var(--color-text-primary)]">{formatCurrency(truck.totalCost)}</td>
                      <td className="px-5 py-3">
                        {truck.flagged && <span className="mr-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">High cost</span>}
                        {truck.recurringHighCost && <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-900">Recurring candidate</span>}
                        {!truck.flagged && !truck.recurringHighCost && <span className="text-[var(--color-text-secondary)]">—</span>}
                      </td>
                    </tr>
                  ))}
                  {data.trucks.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--color-text-secondary)]">No vehicles found.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {selectedTruck && (
            <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-divider)] px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text-primary)]">Completed Maintenance — {selectedTruck.plateNumber}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatCurrency(selectedTruck.totalCost)} during the selected period</p>
                </div>
                <button type="button" onClick={() => setSelectedTruckId(null)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold">Close</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-[var(--color-input-bg)] text-xs uppercase text-[var(--color-text-secondary)]"><tr><th className="px-5 py-3">Completed</th><th className="px-5 py-3">Work Order</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Mechanic</th><th className="px-5 py-3">Cost</th></tr></thead>
                  <tbody>
                    {selectedTruck.records.map((record) => (
                      <tr key={record.id} className="border-t border-[var(--color-divider)]">
                        <td className="px-5 py-3">{new Date(record.completedAt).toLocaleDateString('en-PH')}</td>
                        <td className="px-5 py-3">{record.workOrderNumber}</td>
                        <td className="px-5 py-3">{record.type}</td>
                        <td className="px-5 py-3">{record.mechanicName}</td>
                        <td className="px-5 py-3 font-semibold">{formatCurrency(record.totalCost)}</td>
                      </tr>
                    ))}
                    {selectedTruck.records.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--color-text-secondary)]">No completed maintenance in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
