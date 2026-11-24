import { useCallback, useEffect, useMemo, useState } from 'react';
import { Droplet, TrendingUp, AlertTriangle, BarChart3, Settings2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import KpiCard from '../../components/ui/KpiCard';
import PageHeader from '../../components/PageHeader/PageHeader';
import FuelLog from './components/FuelLog';
import EfficiencyTrendsWithFilters from './components/EfficiencyTrendsWithFilters';
import LogFuelFillUp from './components/LogFuelFillUp';
import ConfigureFuelStations from './components/ConfigureFuelStations';
import { useAuthStore } from '../../store/authStore';
import { useBackend } from '../../lib/api/httpClient';
import { getMaintenanceCostPeriod, type MaintenanceCostHalf, type MaintenanceCostPeriodType } from '../../lib/utils/maintenanceCostingPeriod';
import { getVehicles } from '../../lib/api/vmmsApi';
import { acknowledgeFuelAnomaly, createFuelEntry, createFuelStation, getFuelAnomalies, getFuelAnomalyAttachment, getFuelAnomalyThreshold, getFuelEntries, getFuelReceiptAttachment, getFuelStations, recordFuelReportExport, updateFuelAnomaly, updateFuelAnomalyThreshold, updateFuelStation, uploadFuelAnomalyAttachment, voidFuelEntry, type FuelAnomalyRecord, type FuelFillUpInput, type FuelStation, type FuelStationManagement, type FuelStationUpdate, type FuelVehicle } from '../../lib/api/fuelService';
import type { FuelFillUp } from './types';
import { excludeVoidedFuelFillUps } from './fuelReportData';

type Tab = 'fuel-log' | 'efficiency-trends' | 'anomaly-detection';
const MAX_FUEL_ANOMALY_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const FUEL_ANOMALY_ATTACHMENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function currentMonthPeriod() {
  const now = new Date();
  return getMaintenanceCostPeriod('monthly', now.getFullYear(), now.getMonth() + 1, now.getMonth() < 6 ? 'first' : 'second', '', '')!;
}

export default function FuelManagement() {
  const role = useAuthStore((state) => state.currentUser?.role);
  const canView = role === 'ADMIN' || role === 'OPERATIONS';
  const canWrite = role === 'OPERATIONS';
  const canAcknowledge = role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<Tab>('fuel-log');
  const [showLogForm, setShowLogForm] = useState(false);
  const [showStationConfig, setShowStationConfig] = useState(false);
  const [fillUps, setFillUps] = useState<FuelFillUp[]>([]);
  const [fuelLogFilteredFillUps, setFuelLogFilteredFillUps] = useState<FuelFillUp[]>([]);
  const [hasFuelLogFilterSnapshot, setHasFuelLogFilterSnapshot] = useState(false);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [vehicles, setVehicles] = useState<FuelVehicle[]>([]);
  const [anomalies, setAnomalies] = useState<FuelAnomalyRecord[]>([]);
  const [anomalyThreshold, setAnomalyThreshold] = useState(20);
  const [thresholdDraft, setThresholdDraft] = useState('20');
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [pageError, setPageError] = useState('');
  const [loading, setLoading] = useState(canView);

  const initialPeriod = useMemo(() => currentMonthPeriod(), []);
  const now = new Date();
  const [periodType, setPeriodType] = useState<MaintenanceCostPeriodType>('monthly');
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [twoMonthBlock, setTwoMonthBlock] = useState(Math.floor(now.getMonth() / 2) + 1);
  const [periodHalf, setPeriodHalf] = useState<MaintenanceCostHalf>(now.getMonth() < 6 ? 'first' : 'second');
  const [from, setFrom] = useState(initialPeriod.from);
  const [to, setTo] = useState(initialPeriod.to);
  const [appliedPeriod, setAppliedPeriod] = useState(initialPeriod);
  const appliedFrom = appliedPeriod.from;
  const appliedTo = appliedPeriod.to;

  const tabs = [
    { id: 'fuel-log' as const, label: 'Fuel Log', icon: Droplet },
    { id: 'efficiency-trends' as const, label: 'Efficiency Trends', icon: TrendingUp },
    { id: 'anomaly-detection' as const, label: 'Anomaly Detection', icon: AlertTriangle }
  ];

  const load = useCallback(async (period: { from: string; to: string }, showLoading = true) => {
    if (!canView) { setPageError('Fuel Management is available to Admin and Operations on the web.'); setLoading(false); return; }
    if (!useBackend) { setPageError('Fuel management requires the VMMS backend. Configure VITE_API_BASE_URL to use persisted fuel records.'); setLoading(false); return; }
    if (showLoading) setLoading(true);
    setPageError('');
    try {
      const [entries, stationRows, vehicleRows, anomalyRows, threshold] = await Promise.all([getFuelEntries(period.from, period.to), getFuelStations(), getVehicles(), getFuelAnomalies(), getFuelAnomalyThreshold()]);
      setFillUps(entries); setStations(stationRows); setVehicles(vehicleRows as FuelVehicle[]); setAnomalies(anomalyRows); setAnomalyThreshold(threshold.thresholdPercent); setThresholdDraft(String(threshold.thresholdPercent));
      setAppliedPeriod(period);
    } catch (error) { setPageError(error instanceof Error ? error.message : 'Unable to load fuel records.'); }
    finally { if (showLoading) setLoading(false); }
  }, [canView]);
  const refresh = useCallback((showLoading = false) => load(appliedPeriod, showLoading), [appliedPeriod, load]);
  useEffect(() => {
    if (!canView) {
      return;
    }
    // The initial fetch owns the loading state for this page.
    const initialLoad = window.setTimeout(() => void load(initialPeriod), 0);
    return () => window.clearTimeout(initialLoad);
  }, [canView, initialPeriod, load]);
  useEffect(() => {
    if (!canView) return undefined;
    const intervalId = window.setInterval(() => { void load(appliedPeriod, false); }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [appliedPeriod, canView, load]);

  // Layout className constants (interaction/layout only)
  const containerClasses = 'space-y-6 relative';
  const kpiGridClasses = 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-4';

  const handleFilteredFillUpsChange = useCallback((filtered: FuelFillUp[]) => {
    setFuelLogFilteredFillUps(filtered);
    setHasFuelLogFilterSnapshot(true);
  }, []);
  const filteredFuelData = hasFuelLogFilterSnapshot ? fuelLogFilteredFillUps : fillUps;
  const kpiFilteredFillUps = useMemo(() => excludeVoidedFuelFillUps(filteredFuelData), [filteredFuelData]);

  const totalFillUps = kpiFilteredFillUps.length;
  const totalLiters = kpiFilteredFillUps.reduce((sum, item) => sum + item.liters, 0);
  const totalCost = kpiFilteredFillUps.reduce((sum, item) => sum + item.totalCost, 0);
  const efficiencyValues = kpiFilteredFillUps.map((item) => item.efficiency).filter((value): value is number => value != null && Number.isFinite(value));
  const avgEfficiency = efficiencyValues.length ? Number((efficiencyValues.reduce((sum, value) => sum + value, 0) / efficiencyValues.length).toFixed(1)) : 0;

  const handleVoid = async (id: string, reason: string) => {
    await voidFuelEntry(id, reason); await refresh();
  };

  const handleAdd = async (input: FuelFillUpInput, receipt?: File) => {
    await createFuelEntry(input, receipt); await refresh();
  };
  const handleAddStation = async (name: string): Promise<FuelStationManagement> => {
    const station = await createFuelStation(name);
    setStations((current) =>
      [...current, station].sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    );
    return station;
  };
  const handleUpdateStation = async (
    id: string,
    update: FuelStationUpdate,
  ): Promise<FuelStationManagement> => {
    const station = await updateFuelStation(id, update);
    setStations((current) => {
      const activeStations = current.filter((item) => item.id !== station.id);
      if (station.isActive)
        activeStations.push({ id: station.id, name: station.name });
      return activeStations.sort((first, second) =>
        first.name.localeCompare(second.name),
      );
    });
    return station;
  };
  const handleImportComplete = async () => {
    await refresh();
  };

  const handleDownloadReceipt = async (fillUpId: string, name: string) => {
    setPageError('');
    try {
      const blob = await getFuelReceiptAttachment(fillUpId);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to download receipt.');
    }
  };

  const handleSaveThreshold = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(thresholdDraft);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99) { setPageError('Choose a threshold from 1% to 99%.'); return; }
    setSavingThreshold(true); setPageError('');
    try { const saved = await updateFuelAnomalyThreshold(parsed); setAnomalyThreshold(saved.thresholdPercent); setThresholdDraft(String(saved.thresholdPercent)); }
    catch (error) { setPageError(error instanceof Error ? error.message : 'Only Admin can change the anomaly threshold.'); }
    finally { setSavingThreshold(false); }
  };

  const handleAnomalyReportUpload = async (anomalyId: string, file: File) => {
    setPageError('');
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!FUEL_ANOMALY_ATTACHMENT_TYPES[extension] || file.type.toLowerCase() !== FUEL_ANOMALY_ATTACHMENT_TYPES[extension]) {
      setPageError('Choose a PDF, JPG, or PNG report.');
      return;
    }
    if (file.size > MAX_FUEL_ANOMALY_ATTACHMENT_BYTES) {
      setPageError('Fuel anomaly reports must be 10 MB or smaller.');
      return;
    }
    try {
      await uploadFuelAnomalyAttachment(anomalyId, file);
      await refresh();
    } catch (error) {
      const isPayloadTooLarge = typeof error === 'object' && error !== null && 'status' in error && error.status === 413;
      setPageError(isPayloadTooLarge
        ? 'Fuel anomaly reports must be 10 MB or smaller.'
        : error instanceof Error ? error.message : 'Unable to upload report.');
    }
  };

  const applyPeriod = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const period = getMaintenanceCostPeriod(periodType, periodYear, periodMonth, periodHalf, from, to, twoMonthBlock);
    if (!period) { setPageError('Choose a valid date range.'); return; }
    void load(period);
  };

  const efficiencyByVehicle = useMemo(() => [...new Set(kpiFilteredFillUps.filter((entry) => entry.vehicleId).map((entry) => entry.vehicleId))].map((vehicleId) => {
    const rows = kpiFilteredFillUps.filter((entry) => entry.vehicleId === vehicleId && entry.efficiency != null);
    const first = kpiFilteredFillUps.find((entry) => entry.vehicleId === vehicleId)!;
    return { vehicleId, vehicleName: first.vehicleName, model: first.vehicleModel, avgEfficiency: rows.length ? rows.reduce((sum, row) => sum + (row.efficiency ?? 0), 0) / rows.length : 0, fillUps: rows.length, trend: 'normal' as const };
  }), [kpiFilteredFillUps]);
  const anomalyCards = useMemo(() => anomalies.filter((item) => item.status === 'OPEN').map((item) => ({ vehicleId: item.vehicle.plateNumber, vehicleName: item.vehicle.plateNumber, model: item.vehicle.model, efficiency: item.efficiency, status: 'Anomaly' as const, fleetAvg: item.rollingAverage, recommendation: item.note ?? 'Review the fuel entry and add an operations resolution note.' })), [anomalies]);

  if (!canView) {
    return <div className="space-y-6"><PageHeader icon={Droplet} title="Fuel Management" subtitle="Fuel tracking and reports" /><p role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 text-sm text-[var(--color-text-secondary)]">Fuel Management on the web is available to Admin and Operations.</p></div>;
  }

  return (
    <div className={containerClasses}>
      <PageHeader
        icon={Droplet}
        title="Fuel Management"
        subtitle="Consumption tracking, efficiency analysis, and anomaly detection"
        action={canWrite ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={<Settings2 size={16} aria-hidden="true" />}
            onClick={() => setShowStationConfig(true)}
            className="min-h-11 w-full sm:w-auto"
          >
            Configure fuel stations
          </Button>
        ) : undefined}
      />
      {pageError && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{pageError}</div>}
      {loading && <div className="text-sm text-[var(--color-text-secondary)]">Loading fuel records...</div>}
      <form onSubmit={handleSaveThreshold} className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
        <div><div className="text-sm font-semibold">Fuel anomaly threshold</div><p className="text-xs text-[var(--color-text-secondary)]">Flag efficiency when it falls this far below the truck's rolling average.</p></div>
        {role === 'ADMIN' ? <label className="text-sm">Percent<input required type="number" min="1" max="99" step="0.01" value={thresholdDraft} onChange={(event) => setThresholdDraft(event.target.value)} className="ml-2 w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1.5" /></label> : <strong>{anomalyThreshold}%</strong>}
        {role === 'ADMIN' && <button disabled={savingThreshold} className="rounded-lg bg-[var(--color-brand-primary)] px-3 py-2 text-sm text-white">{savingThreshold ? 'Saving...' : 'Save threshold'}</button>}
      </form>
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={applyPeriod}>
          <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">Period
            <select aria-label="Fuel period" value={periodType} onChange={(event) => setPeriodType(event.target.value as MaintenanceCostPeriodType)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              <option value="monthly">Monthly</option><option value="bimonthly">Every 2 months</option><option value="semiannual">Semi-annually</option><option value="annual">Annually</option><option value="custom">Custom range</option>
            </select>
          </label>
          {periodType === 'monthly' && <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">Month
            <input aria-label="Fuel month" type="month" value={`${periodYear}-${String(periodMonth).padStart(2, '0')}`} onChange={(event) => { const [year, month] = event.target.value.split('-').map(Number); if (year && month) { setPeriodYear(year); setPeriodMonth(month); } }} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
          </label>}
          {periodType === 'bimonthly' && <>
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">Two-month period
              <select aria-label="Fuel two-month period" value={twoMonthBlock} onChange={(event) => setTwoMonthBlock(Number(event.target.value))} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                <option value={1}>Jan-Feb</option><option value={2}>Mar-Apr</option><option value={3}>May-Jun</option><option value={4}>Jul-Aug</option><option value={5}>Sep-Oct</option><option value={6}>Nov-Dec</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">Year<input aria-label="Fuel year" type="number" min="1900" max="9999" value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
          </>}
          {periodType === 'semiannual' && <>
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">Half-year
              <select aria-label="Fuel half-year" value={periodHalf} onChange={(event) => setPeriodHalf(event.target.value as MaintenanceCostHalf)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"><option value="first">First half (Jan-Jun)</option><option value="second">Second half (Jul-Dec)</option></select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">Year<input aria-label="Fuel year" type="number" min="1900" max="9999" value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
          </>}
          {periodType === 'annual' && <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">Year<input aria-label="Fuel year" type="number" min="1900" max="9999" value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>}
          {periodType === 'custom' && <>
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">From<input aria-label="Fuel period start" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
            <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">To<input aria-label="Fuel period end" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" /></label>
          </>}
          <button type="submit" disabled={loading} className="rounded-lg bg-[#070b45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Apply Period</button>
        </form>
        <div className="text-sm text-[var(--color-text-secondary)]">Showing {appliedFrom} to {appliedTo}</div>
      </div>
      {/* KPI Cards */}
      <div className={kpiGridClasses}>
        <KpiCard
          icon={<Droplet size={20} strokeWidth={1.8} />}
          value={totalFillUps.toString()}
          label="Total Fill-ups"
          hint={`${appliedFrom} to ${appliedTo}`}
          color="#3b82f6"
          iconBackgroundColor="rgba(59, 130, 246, 0.12)"
        />
        <KpiCard
          icon={<BarChart3 size={20} strokeWidth={1.8} />}
          value={`${totalLiters.toLocaleString()}L`}
          label="Total Liters"
          hint="Filtered range metrics"
          color="#10b981"
          iconBackgroundColor="rgba(16, 185, 129, 0.12)"
        />
        <KpiCard
          icon={<AlertTriangle size={20} strokeWidth={1.8} />}
          value={`₱${totalCost.toLocaleString()}`}
          label="Total Fuel Cost"
          hint="Filtered range spent"
          color="#ef4444"
          iconBackgroundColor="rgba(239, 68, 68, 0.12)"
        />
        <KpiCard
          icon={<TrendingUp size={20} strokeWidth={1.8} />}
          value={`${avgEfficiency} km/L`}
          label="Avg Efficiency"
          hint="Filtered range avg"
          color="#10b981"
          iconBackgroundColor="rgba(16, 185, 129, 0.12)"
        />
      </div>
      {!loading && !pageError && kpiFilteredFillUps.length === 0 && <div role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 text-sm text-[var(--color-text-secondary)]">No fuel records for {appliedFrom} to {appliedTo}. Choose another period or have Operations log a fill-up.</div>}

      {/* Tabs Layout */}
      <div className="flex flex-wrap items-center">
        <div
          className="inline-flex max-w-full overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] p-1"
          role="group"
          aria-label="Fuel management views"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-warning)] ${
                  isActive
                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                    : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Icon className="mr-2 h-4 w-4" strokeWidth={1.8} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Panels */}
      <div className="space-y-6">
        <div hidden={activeTab !== 'fuel-log'}>
          <FuelLog
            fillUps={fillUps}
            onDelete={canWrite ? handleVoid : undefined}
            onDownloadReceipt={canWrite ? handleDownloadReceipt : undefined}
            onLogFillUp={canWrite ? () => setShowLogForm(true) : undefined}
            stations={stations}
            vehicles={vehicles}
            onImportComplete={canWrite ? handleImportComplete : undefined}
            onFilteredFillUpsChange={handleFilteredFillUpsChange}
            onExport={(format) => { void recordFuelReportExport(format, appliedFrom || undefined, appliedTo || undefined).catch((error) => setPageError(error instanceof Error ? error.message : 'Unable to record export.')); }}
          />
        </div>
        {activeTab === 'efficiency-trends' && (
          <div>
            <EfficiencyTrendsWithFilters vehicles={efficiencyByVehicle} fleetAvg={avgEfficiency} />
          </div>
        )}
        {activeTab === 'anomaly-detection' && <div className="space-y-3">{anomalyCards.length === 0 ? <p className="text-sm text-[var(--color-text-secondary)]">No open fuel anomalies.</p> : anomalyCards.map((anomaly) => {
          const record = anomalies.find((item) => item.vehicle.plateNumber === anomaly.vehicleId && item.status === 'OPEN')!;
          return (
            <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
              <div>
                <strong>{anomaly.vehicleName} - {anomaly.efficiency.toFixed(1)} km/L</strong>
                <div className="text-sm">Rolling average {anomaly.fleetAvg.toFixed(1)} km/L - {record.severity}</div>
                <div className="text-sm">{record.note || 'No resolution note recorded'}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {record.attachments?.map((attachment) => (
                    <button key={attachment.id} className="text-xs underline" onClick={async () => {
                      const file = await getFuelAnomalyAttachment(record.id, attachment.id);
                      const url = URL.createObjectURL(file);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = attachment.name;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}>{attachment.name}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canWrite && <>
                  <button onClick={async () => {
                    const note = window.prompt('Add or update resolution note');
                    if (note !== null) {
                      try { await updateFuelAnomaly(record.id, note); await refresh(); }
                      catch (error) { setPageError(error instanceof Error ? error.message : 'Unable to save note.'); }
                    }
                  }} className="rounded-lg border px-3 py-2 text-sm">Save note</button>
                  {(record.severity === 'ESCALATED' || record.severity === 'CRITICAL') && (
                    <label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">Attach report (PDF, JPG, PNG; max 10 MB)
                      <input aria-label="Attach fuel anomaly report (PDF, JPG, or PNG, max 10 MB)" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = '';
                        if (file) void handleAnomalyReportUpload(record.id, file);
                      }} />
                    </label>
                  )}
                  {(record.severity !== 'CRITICAL' || record.acknowledgedAt) && (
                    <button onClick={async () => {
                      try { await updateFuelAnomaly(record.id); await refresh(); }
                      catch (error) { setPageError(error instanceof Error ? error.message : 'Unable to resolve anomaly.'); }
                    }} className="rounded-lg border px-3 py-2 text-sm">Resolve</button>
                  )}
                </>}
                {canAcknowledge && record.severity === 'CRITICAL' && !record.acknowledgedAt && (
                  <button onClick={async () => {
                    const remark = window.prompt('Optional acknowledgment remark') ?? '';
                    try { await acknowledgeFuelAnomaly(record.id, remark); await refresh(); }
                    catch (error) { setPageError(error instanceof Error ? error.message : 'Unable to acknowledge anomaly.'); }
                  }} className="rounded-lg border px-3 py-2 text-sm">Acknowledge</button>
                )}
              </div>
            </div>
          );
        })}</div>}
      </div>

      {/* Action Modals */}
      {showLogForm && (
        <LogFuelFillUp
          onClose={() => setShowLogForm(false)}
          onAdd={handleAdd}
          vehicles={vehicles}
          stations={stations}
        />
      )}
      {showStationConfig && (
        <ConfigureFuelStations
          onClose={() => setShowStationConfig(false)}
          onAddStation={handleAddStation}
          onUpdateStation={handleUpdateStation}
        />
      )}

    </div>
  );
}
