import { useState, type ReactNode } from 'react';
import { Droplet, TrendingUp, AlertTriangle, BarChart3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader/PageHeader';
import FuelLog from './components/FuelLog';
import EfficiencyTrendsWithFilters from './components/EfficiencyTrendsWithFilters';
import AnomalyDetection from './components/AnomalyDetection';
import LogFuelFillUp from './components/LogFuelFillUp';
import FuelCostSummary from './components/FuelCostSummary';
import AnomalyDetectionLog from './components/AnomalyDetectionLog';
import FleetWideFuelReport from './components/FleetWideFuelReport';
import EditFuelFillUpModal from './components/EditFuelFillUpModal';
import {
  mockFuelFillUps,
  mockVehicleEfficiency,
  mockAnomalies,
  mockAnomalyLogs,
} from "../../lib/mocks/fuelMocks";
import type { FuelFillUp } from './types';

type KPIStatCardProps = {
  icon: ReactNode;
  value: string | number;
  label: string;
  subtitle?: string;
  iconBgColor: string;
  iconColor: string;
};

function KPIStatCard({ icon, value, label, subtitle, iconBgColor, iconColor }: KPIStatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card transition-theme">
      <div className="mb-4 flex items-center justify-between">
        <div
          style={{
            display: 'flex',
            height: '2.5rem',
            width: '2.5rem',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '1rem',
            background: iconBgColor,
            color: iconColor,
          }}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{value}</div>
      <div className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{label}</div>
      {subtitle && (
        <div className="mt-2 text-sm font-medium" style={{ color: iconColor }}>{subtitle}</div>
      )}
    </div>
  );
}

type Tab = 'fuel-log' | 'efficiency-trends' | 'anomaly-detection';
type ReportTab = 'fleet-wide' | 'per-vehicle' | 'anomaly-log';

export default function FuelManagement() {
  const [activeTab, setActiveTab] = useState<Tab>('fuel-log');
  const [activeReport, setActiveReport] = useState<ReportTab>('fleet-wide');
  const [showLogForm, setShowLogForm] = useState(false);
  const [fillUps, setFillUps] = useState<FuelFillUp[]>(mockFuelFillUps);
  const [editingFillUp, setEditingFillUp] = useState<FuelFillUp | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Confirmed filter ranges used by KPIs
  const [appliedFrom, setAppliedFrom] = useState<string>('2026-05-26');
  const [appliedTo, setAppliedTo] = useState<string>('2026-05-30');

  // Hardcoded matrix values 
  const mayDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const mayStartOffset = 5;

  const juneDays = Array.from({ length: 30 }, (_, i) => i + 1);
  const juneStartOffset = 1;

  const tabs = [
    { id: 'fuel-log' as const, label: 'Fuel Log', icon: Droplet },
    { id: 'efficiency-trends' as const, label: 'Efficiency Trends', icon: TrendingUp },
    { id: 'anomaly-detection' as const, label: 'Anomaly Detection', icon: AlertTriangle }
  ];

  // Layout className constants (interaction/layout only)
  const containerClasses = 'space-y-6 relative';
  const bannerLayoutClasses = 'flex justify-between items-center';
  const pickerButtonClasses = 'flex items-center gap-4 rounded-xl border px-3 py-2 text-xs font-medium transition cursor-pointer';
  const calendarGridClasses = 'grid grid-cols-2 gap-8 relative';
  const monthHeaderClasses = 'flex items-center justify-between mb-4 px-1';
  const monthDaysGridClasses = 'grid grid-cols-7 text-center text-[11px] font-medium gap-y-2';
  const pickerPanelLayoutClasses = 'absolute top-full right-0 mt-3 z-50';
  const kpiGridClasses = 'grid gap-4 xl:grid-cols-4 lg:grid-cols-2';
  const tabsLayoutClasses = 'border-b border-[var(--color-border)]';
  const tabButtonBaseClasses = 'flex items-center gap-2 border-b-2 px-4 py-3 font-medium transition-colors cursor-pointer text-sm';
  const reportsHeaderClasses = 'flex flex-col sm:flex-row sm:items-center justify-between gap-4';
  const reportSwitcherClasses = 'flex flex-wrap gap-1 rounded-xl p-1 border';
  const reportPanelClasses = 'bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-2xl p-4 shadow-card transition-all duration-200 min-h-62.5';

  // Layout class constants for calendar buttons
  const dayButtonBaseClasses = 'h-8 w-8 text-xs font-medium relative mx-auto flex items-center justify-center transition-all';

  const handleDayClick = (year: number, month: number, day: number) => {
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!appliedFrom || (appliedFrom && appliedTo)) {
      setAppliedFrom(formattedDate);
      setAppliedTo('');
    } else {
      if (new Date(formattedDate) < new Date(appliedFrom)) {
        setAppliedFrom(formattedDate);
      } else {
        setAppliedTo(formattedDate);
      }
    }
  };

  const getDateState = (year: number, month: number, day: number) => {
    const currentStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (currentStr === appliedFrom || currentStr === appliedTo) return 'endpoint';
    if (appliedFrom && appliedTo && currentStr > appliedFrom && currentStr < appliedTo) return 'range';
    return 'idle';
  };

  const kpiFilteredFillUps = fillUps.filter(item => {
    if (appliedFrom && item.date < appliedFrom) return false;
    if (appliedTo && item.date > appliedTo) return false;
    return true;
  });

  const totalFillUps = kpiFilteredFillUps.length;
  const totalLiters = kpiFilteredFillUps.reduce((sum, item) => sum + item.liters, 0);
  const totalCost = kpiFilteredFillUps.reduce((sum, item) => sum + item.totalCost, 0);
  const avgEfficiency = parseFloat(
    (kpiFilteredFillUps.reduce((sum, item) => sum + item.efficiency, 0) / kpiFilteredFillUps.length || 0).toFixed(1)
  );

  // Standard modal functions
  const handleEditTrigger = (fillUp: FuelFillUp) => {
    setEditingFillUp(fillUp);
    setIsEditModalOpen(true);
  };

  const handleEditSave = (updated: FuelFillUp) => {
    setFillUps(prev => prev.map(f => f.id === updated.id ? updated : f));
    setIsEditModalOpen(false);
    setEditingFillUp(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this fuel record?')) {
      setFillUps(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleAdd = (newEntry: FuelFillUp) => {
    setFillUps(prev => [newEntry, ...prev]);
  };

  return (
    <div className={containerClasses}>
      <PageHeader
        icon={Droplet}
        title="Fuel Management"
        subtitle="Consumption tracking, efficiency analysis, and anomaly detection"
      />
      <div className={`${bannerLayoutClasses} rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-3 shadow-card` }>
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
          Dashboard Stats Timeframe:
        </span>

        <div className="relative">
          <button
            onClick={() => setIsPickerOpen(!isPickerOpen)}
            className={`${pickerButtonClasses} ${isPickerOpen ? 'active-filter' : 'bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}
          >
            <Calendar size={14} className="text-[var(--color-brand-primary)]" />
            <span className="font-mono text-xs">
              {appliedFrom ? `${appliedFrom}${appliedTo ? ` — ${appliedTo}` : ''}` : 'Select Timeline'}
            </span>
          </button>

          {isPickerOpen && (
            <div className={`${pickerPanelLayoutClasses} w-[40rem] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-lg`}>

              <div className="flex justify-end mb-4">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] px-3 py-1 text-xs text-[var(--color-text-secondary)] font-mono">
                  <Calendar size={13} className="text-[var(--color-brand-primary)]" />
                  <span>{appliedFrom || 'YYYY-MM-DD'} — {appliedTo || 'YYYY-MM-DD'}</span>
                </div>
              </div>

              <div className={calendarGridClasses}>
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--color-divider)] -translate-x-1/2" />

                <div>
                  <div className={monthHeaderClasses}>
                    <button className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"><ChevronLeft size={16} /></button>
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-tight">May 2026</h4>
                    <div style={{ width: 16 }} />
                  </div>
                  <div className={monthDaysGridClasses + ' text-[var(--color-text-secondary)]'}>
                    <span className="text-[var(--color-brand-danger)] font-bold">Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    {Array.from({ length: mayStartOffset }).map((_, i) => <div key={`empty-may-${i}`} />)}
                    {mayDays.map((day) => {
                      const state = getDateState(2026, 5, day);
                      const isSunday = (day + mayStartOffset - 1) % 7 === 0;
                      const stateClass = state === 'endpoint' ? 'bg-[var(--color-brand-warning)] text-[var(--color-brand-black)] font-extrabold rounded-full scale-105 shadow-lg' : state === 'range' ? 'bg-[var(--color-card-bg)] text-[var(--color-brand-primary)] font-semibold w-full' : isSunday ? 'text-[var(--color-brand-danger)]' : 'text-[var(--color-text-secondary)]';
                      return (
                        <button
                          key={`may-${day}`}
                          onClick={() => handleDayClick(2026, 5, day)}
                          className={`${dayButtonBaseClasses} ${stateClass}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className={monthHeaderClasses}>
                    <div style={{ width: 16 }} />
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-tight">June 2026</h4>
                    <button className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"><ChevronRight size={16} /></button>
                  </div>
                  <div className={monthDaysGridClasses + ' text-[var(--color-text-secondary)]'}>
                    <span className="text-[var(--color-brand-danger)] font-bold">Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    {Array.from({ length: juneStartOffset }).map((_, i) => <div key={`empty-june-${i}`} />)}
                    {juneDays.map((day) => {
                      const state = getDateState(2026, 6, day);
                      const isSunday = (day + juneStartOffset - 1) % 7 === 0;
                      const stateClass = state === 'endpoint' ? 'bg-[var(--color-brand-warning)] text-[var(--color-brand-black)] font-extrabold rounded-full scale-105 shadow-lg' : state === 'range' ? 'bg-[var(--color-card-bg)] text-[var(--color-brand-primary)] font-semibold w-full' : isSunday ? 'text-[var(--color-brand-danger)]' : 'text-[var(--color-text-secondary)]';
                      return (
                        <button
                          key={`june-${day}`}
                          onClick={() => handleDayClick(2026, 6, day)}
                          className={`${dayButtonBaseClasses} ${stateClass}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[var(--color-border)] mt-5 pt-4">
                <button
                  onClick={() => { setAppliedFrom(''); setAppliedTo(''); }}
                  className="h-9 px-4 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
                >
                  Reset
                </button>
                <button
                  onClick={() => setIsPickerOpen(false)}
                  className="h-9 px-5 rounded-xl bg-[var(--color-brand-primary)] text-xs font-semibold text-white hover:bg-[var(--color-brand-primary)]/90 transition shadow-lg"
                >
                  Select dates
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className={kpiGridClasses}>
        <KPIStatCard
          icon={<Droplet size={20} strokeWidth={1.8} />}
          value={totalFillUps.toString()}
          label="Total Fill-ups"
          subtitle={`${appliedFrom} to ${appliedTo || '...'}`}
          iconBgColor="rgba(59, 130, 246, 0.12)"
          iconColor="#3b82f6"
        />
        <KPIStatCard
          icon={<BarChart3 size={20} strokeWidth={1.8} />}
          value={`${totalLiters.toLocaleString()}L`}
          label="Total Liters"
          subtitle="Filtered range metrics"
          iconBgColor="rgba(16, 185, 129, 0.12)"
          iconColor="#10b981"
        />
        <KPIStatCard
          icon={<AlertTriangle size={20} strokeWidth={1.8} />}
          value={`₱${totalCost.toLocaleString()}`}
          label="Total Fuel Cost"
          subtitle="Filtered range spent"
          iconBgColor="rgba(239, 68, 68, 0.12)"
          iconColor="#ef4444"
        />
        <KPIStatCard
          icon={<TrendingUp size={20} strokeWidth={1.8} />}
          value={`${avgEfficiency} km/L`}
          label="Avg Efficiency"
          subtitle="Filtered range avg"
          iconBgColor="rgba(16, 185, 129, 0.12)"
          iconColor="#10b981"
        />
      </div>

      {/* Tabs Layout */}
      <div className={tabsLayoutClasses}>
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${tabButtonBaseClasses} ${activeTab === tab.id ? 'border-b-2 border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]' : 'text-[var(--color-text-secondary)]'}`}
              >
                <Icon size={16} strokeWidth={1.8} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Panels */}
      <div className="space-y-6">
        {activeTab === 'fuel-log' && (
          <FuelLog
            fillUps={fillUps}
            onEdit={handleEditTrigger}
            onDelete={handleDelete}
            onLogFillUp={() => setShowLogForm(true)}
          />
        )}
        {activeTab === 'efficiency-trends' && (
          <EfficiencyTrendsWithFilters vehicles={mockVehicleEfficiency} fleetAvg={avgEfficiency} />
        )}
        {activeTab === 'anomaly-detection' && <AnomalyDetection anomalies={mockAnomalies} />}
      </div>

      {/* Switcher Reports Section */}
      <div className="space-y-6 border-t border-[var(--color-border)] pt-8">
        <div className={reportsHeaderClasses}>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Reports</h2>

          <div className={`${reportSwitcherClasses} bg-[var(--color-input-bg)] border-[var(--color-border)]`}>
            <button
              onClick={() => setActiveReport('fleet-wide')}
              className={`${activeReport === 'fleet-wide' ? 'bg-[var(--color-brand-primary)] text-white shadow-[0_8px_24px_rgba(26,31,110,0.12)]' : 'text-[var(--color-text-secondary)]'} px-3 py-2 rounded-md`}
            >
              Fleet-Wide Cost
            </button>
            <button
              onClick={() => setActiveReport('per-vehicle')}
              className={`${activeReport === 'per-vehicle' ? 'bg-[var(--color-brand-primary)] text-white shadow-[0_8px_24px_rgba(26,31,110,0.12)]' : 'text-[var(--color-text-secondary)]'} px-3 py-2 rounded-md`}
            >
              Per-Vehicle Summary
            </button>
            <button
              onClick={() => setActiveReport('anomaly-log')}
              className={`${activeReport === 'anomaly-log' ? 'bg-[var(--color-brand-primary)] text-white shadow-[0_8px_24px_rgba(26,31,110,0.12)]' : 'text-[var(--color-text-secondary)]'} px-3 py-2 rounded-md`}
            >
              Anomaly Logs
            </button>
          </div>
        </div>

        <div className={reportPanelClasses}>
          {activeReport === 'fleet-wide' && (
            <div className="space-y-3">
              <div className="text-xs text-[var(--color-text-secondary)] font-mono tracking-wider uppercase">Active View · Fleet-Wide Fuel Cost Report</div>
              <FleetWideFuelReport />
            </div>
          )}

          {activeReport === 'per-vehicle' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--color-text-secondary)] font-mono tracking-wider uppercase">Active View · Fuel Cost Summary — Per Vehicle</div>
                <div className="text-xs text-[var(--color-text-secondary)] font-mono bg-[var(--color-card-bg-hover)] px-2 py-0.5 rounded">
                  {appliedFrom} — {appliedTo || '...'}
                </div>
              </div>
              <FuelCostSummary fillUps={fillUps} />
            </div>
          )}

          {activeReport === 'anomaly-log' && (
              <div className="space-y-3">
              <div className="text-xs text-[var(--color-text-secondary)] font-mono tracking-wider uppercase">Active View · Anomaly Detection Log</div>
              <AnomalyDetectionLog logs={mockAnomalyLogs} />
            </div>
          )}
        </div>
      </div>

      {/* Action Modals */}
      {showLogForm && (
        <LogFuelFillUp
          onClose={() => setShowLogForm(false)}
          onAdd={handleAdd}
        />
      )}

      <EditFuelFillUpModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingFillUp(null);
        }}
        fillUp={editingFillUp}
        onSave={handleEditSave}
      />
    </div>
  );
}
