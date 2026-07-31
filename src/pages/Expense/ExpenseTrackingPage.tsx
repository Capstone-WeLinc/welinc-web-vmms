import { useEffect, useState, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, PhilippinePeso } from 'lucide-react';
import {
  getTransactions,
  getProfitabilitySummary,
  type ProfitabilitySummary,
  type Transaction,
} from "../../lib/api/financeService";
import PageHeader from '../../components/PageHeader/PageHeader';
import AddIncomeModal from './AddIncomeModal';
import AddExpenseModal from './AddExpenseModal';
import { DropdownSelect } from '../../components/ui';

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
    <div className="enterprise-kpi-card">
      <div className="relative ml-2 flex items-start justify-between gap-3">
        <div>
          <div className="enterprise-kpi-label">{label}</div>
          <div className="enterprise-kpi-value">{value}</div>
          {subtitle && (
            <div className="mt-2 text-sm font-semibold" style={{ color: iconColor }}>{subtitle}</div>
          )}
        </div>
        <div className="enterprise-icon-box" style={{ background: iconBgColor, color: iconColor }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ExpenseTrackingPage() {
  const [summary, setSummary] = useState<ProfitabilitySummary>({
    totalIncome: '₱0',
    totalExpenses: '₱0',
    netProfit: '₱0',
    profitMargin: 0,
    flaggedVehicles: [],
    profitabilityRanking: [],
    incomeByClientType: {
      corporate: { percentage: 0 },
      individual: { percentage: 0 },
    },
    topProfitableVehicles: [],
  });

  const {
    totalIncome,
    totalExpenses,
    profitMargin,
    flaggedVehicles,
    incomeByClientType,
  } = summary;

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    getTransactions().then(setTransactions).catch(() => setTransactions([]));
  }, []);

  useEffect(() => {
    getProfitabilitySummary().then(setSummary).catch(() => {
      // fallback to default summary on API failure
    });
  }, []);

  const breakdownRows = [
    { vehicle: 'Truck Echo', plate: 'MNO-7890', fuel: '₱48,000', maintenance: '₱6,500', repairs: '₱1,000' },
    { vehicle: 'Truck Alpha', plate: 'ABC-1234', fuel: '₱42,000', maintenance: '₱8,500', repairs: '₱3,000' },
    { vehicle: 'Truck Foxtrot', plate: 'PQR-2345', fuel: '₱44,500', maintenance: '₱7,800', repairs: '₱2,500' },
    { vehicle: 'Truck India', plate: 'YZA-4567', fuel: '₱38,500', maintenance: '₱7,000', repairs: '₱1,500' },
    { vehicle: 'Truck Kilo', plate: 'EFG-2345', fuel: '₱32,000', maintenance: '₱5,500', repairs: '₱800' },
    { vehicle: 'Truck Bravo', plate: 'DEF-5678', fuel: '₱51,000', maintenance: '₱12,000', repairs: '₱8,500' },
  ];

  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [vehicleFilter, setVehicleFilter] = useState('All Vehicles');
  const vehicleOptions = ['All Vehicles', ...Array.from(new Set(transactions.map((t) => t.vehicle)))];

  const filteredTransactions = transactions.filter((t) => {
    return (
      (transactionTypeFilter === 'All' || t.type === transactionTypeFilter) &&
      (vehicleFilter === 'All Vehicles' || t.vehicle === vehicleFilter)
    );
  });

  const tabs = [
    { id: 'monitoring', label: 'Cost Monitoring' },
    { id: 'history', label: 'Transaction History' },
    { id: 'breakdown', label: 'Expense Breakdown' },
  ];
  const [activeTab, setActiveTab] = useState('monitoring');

  const [isIncomeOpen, setIsIncomeOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={PhilippinePeso}
        title="Expense Tracking"
        subtitle="Finance view for fleet expenses, transactions, cost breakdowns, and flagged vehicle costs"
      />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setIsIncomeOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          + Add Income
        </button>
        <button
          type="button"
          onClick={() => setIsExpenseOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          + Add Expense
        </button>
      </div>

      <AddIncomeModal isOpen={isIncomeOpen} onClose={() => setIsIncomeOpen(false)} />
      <AddExpenseModal isOpen={isExpenseOpen} onClose={() => setIsExpenseOpen(false)} />

      {/* KPI Cards Row */}
      <section className="grid gap-4 xl:grid-cols-4 lg:grid-cols-2">
        <KPIStatCard
          icon={<TrendingUp className="w-4 h-4" />}
          value={totalIncome}
          label="Total Fleet Income"
          iconBgColor="rgba(16, 185, 129, 0.12)"
          iconColor="#10b981"
        />
        <KPIStatCard
          icon={<TrendingDown className="w-4 h-4" />}
          value={totalExpenses}
          label="Total Fleet Expenses"
          iconBgColor="rgba(239, 68, 68, 0.12)"
          iconColor="#ef4444"
        />
        <KPIStatCard
          icon={<PhilippinePeso className="w-4 h-4" />}
          value={`${profitMargin}%`}
          label="Budget Variance"
          subtitle="Mock finance indicator"
          iconBgColor="rgba(26, 31, 110, 0.12)"
          iconColor="#1a1f6e"
        />
        <KPIStatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          value={flaggedVehicles.length}
          label="Flagged Vehicles"
          iconBgColor="rgba(245, 158, 11, 0.12)"
          iconColor="#f59e0b"
        />
      </section>

      {/* Tabs */}
      <div className="px-3 mb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === t.id ? 'bg-[var(--color-input-bg)] text-[var(--color-text-primary)] shadow-[0_8px_24px_rgba(26,31,110,0.12)]' : 'bg-[var(--color-input-bg)]/50 text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg)]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">{activeTab === 'history' ? `${filteredTransactions.length} entries` : ''}</div>
        </div>
      </div>

      {/* Flagged vehicles banner */}
      {flaggedVehicles.length > 0 && (
        <div className="mx-3 mb-4 rounded-3xl border border-amber-400/20 bg-[var(--color-input-bg)]/80 p-4 shadow-[0_0_24px_rgba(26,31,110,0.12)]">
          <div className="flex flex-col gap-3 rounded-xl border border-amber-300/15 bg-[var(--color-card-bg)] p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-amber-800 font-semibold text-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10 text-amber-700">⚠️</span>
              <span>Flagged Vehicles — Require Immediate Attention</span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] md:ml-auto">Review and address high-priority fleet alerts immediately.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {flaggedVehicles.map((v) => (
              <div key={v.id} className="rounded-xl border border-amber-300/20 bg-[var(--color-card-bg)] px-4 py-5 transition hover:border-amber-300/40 hover:bg-[var(--color-input-bg-hover)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
            <div className="text-base font-bold text-[var(--color-text-primary)]">{v.name}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{v.plate} • {v.model}</div>
                  </div>
                  <div className="text-sm font-bold text-[#c41c3b]">Review</div>
                </div>
                <div className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">{v.flagReason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <section className="flex flex-wrap items-center gap-3 px-3 mb-4">
          <div className="flex items-center gap-2 rounded-full bg-[var(--color-input-bg)] p-1">
            {['All', 'Income', 'Expense'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTransactionTypeFilter(type as 'All' | 'Income' | 'Expense')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${transactionTypeFilter === type ? 'bg-[var(--color-card-bg)] text-[var(--color-text-primary)]' : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg-hover)]'}`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="min-w-50">
            <DropdownSelect
              value={vehicleFilter}
              onChange={setVehicleFilter}
              label="Vehicle"
              buttonClassName="rounded-full px-4"
              options={vehicleOptions.map((vehicle) => ({
                value: vehicle,
                label: vehicle,
              }))}
            />
          </div>

          <div className="ml-auto text-xs text-[var(--color-text-secondary)]">{filteredTransactions.length} entries</div>
        </section>
      )}

      {/* Main content: tabs */}
      {activeTab === 'monitoring' && (
        <section className="mx-3 mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Vehicle Cost Monitoring</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]">
              <thead className="sticky top-0 z-10 bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-2 text-xs font-semibold uppercase">Vehicle</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase">Plate</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase">Fuel</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase">Maint.</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase">Repairs</th>
                  <th className="px-4 py-2 text-xs font-semibold uppercase">Finance Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {breakdownRows.map((row) => (
                  <tr key={row.vehicle} className="hover:bg-[var(--color-input-bg-hover)] transition-colors">
                    <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">{row.vehicle}</td>
                    <td className="px-4 py-2">{row.plate}</td>
                    <td className="px-4 py-2">{row.fuel}</td>
                    <td className="px-4 py-2">{row.maintenance}</td>
                    <td className="px-4 py-2">{row.repairs}</td>
                    <td className="px-4 py-2"><span className="inline-block rounded-full bg-[var(--color-input-bg)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)]">Monitor cost trend</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="mx-3 mt-3 overflow-auto overscroll-contain rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 lg:max-h-[min(40rem,calc(100vh-12rem))]">
          <table className="w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]">
            <thead className="sticky top-0 z-10 bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase">Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase">Vehicle</th>
                <th className="px-4 py-3 font-semibold">Reference / Description</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-divider)]">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-[var(--color-input-bg-hover)] transition-colors">
                  <td className="px-4 py-4 text-[var(--color-text-primary)]">{t.date}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${t.type === 'Income' ? 'bg-[var(--color-status-success)]/10 text-[#047857]' : 'bg-[var(--color-status-error)]/10 text-[#c41c3b]'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-[var(--color-text-primary)]">{t.vehicle}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{t.plate}</div>
                  </td>
                  <td className="px-4 py-4 text-[var(--color-text-primary)]">{t.description}</td>
                  <td className="px-4 py-4 text-[var(--color-text-primary)]">{t.client}</td>
                  <td className={`px-4 py-4 text-right font-semibold ${t.type === 'Income' ? 'text-[#047857]' : 'text-[#c41c3b]'}`}>
                    {t.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'breakdown' && (
        <section className="mx-3 mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)]">
          <div className="bg-[var(--color-input-bg)] px-5 py-4 text-sm font-medium text-[var(--color-text-primary)]">Expense Breakdown by Vehicle</div>
          <div className="flex flex-wrap items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-input-bg)] px-5 py-3 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{background: 'var(--color-status-info)'}} />
              Fuel %
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{background: 'var(--color-status-secondary)'}} />
              Maintenance %
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{background: 'var(--color-status-error)'}} />
              Repair %
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <table className="w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]">
              <thead className="sticky top-0 z-10 bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-4 font-semibold">Vehicle</th>
                  <th className="px-4 py-4 font-semibold">Fuel Cost</th>
                  <th className="px-4 py-4 font-semibold">Maintenance</th>
                  <th className="px-4 py-4 font-semibold">Repair</th>
                  <th className="px-4 py-4 font-semibold">Total Expenses</th>
                  <th className="px-4 py-4 font-semibold">Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {breakdownRows.map((row) => {
                  const fuel = Number(row.fuel.replace(/[^0-9]/g, ''));
                  const maintenance = Number(row.maintenance.replace(/[^0-9]/g, ''));
                  const repairs = Number(row.repairs.replace(/[^0-9]/g, ''));
                  const total = fuel + maintenance + repairs;
                  const fuelPct = Math.round((fuel / total) * 100);
                  const maintPct = Math.round((maintenance / total) * 100);
                  const repairPct = 100 - fuelPct - maintPct;
                  return (
                    <tr key={row.vehicle} className="border-b border-[var(--color-divider)] hover:bg-[var(--color-input-bg-hover)] transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[var(--color-text-primary)]">{row.vehicle}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{row.plate}</div>
                      </td>
                      <td className="px-4 py-4 text-[var(--color-text-primary)]">{row.fuel}</td>
                      <td className="px-4 py-4 text-[var(--color-text-primary)]">{row.maintenance}</td>
                      <td className="px-4 py-4 text-[var(--color-text-primary)]">{row.repairs}</td>
                      <td className="px-4 py-4 font-semibold text-[var(--color-text-primary)]">₱{total.toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex h-3 overflow-hidden rounded-full bg-[var(--color-input-bg)]">
                          <div style={{ width: `${fuelPct}%`, background: 'var(--color-status-info)' }} />
                          <div style={{ width: `${maintPct}%`, background: 'var(--color-status-secondary)' }} />
                          <div style={{ width: `${repairPct}%`, background: 'var(--color-status-error)' }} />
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{background: 'var(--color-status-info)'}} />
                          <span>{fuelPct}%</span>
                          <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{background: 'var(--color-status-secondary)'}} />
                          <span>{maintPct}%</span>
                          <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{background: 'var(--color-status-error)'}} />
                          <span>{repairPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bottom panels – keep existing */}
      <section className="grid grid-cols-2 gap-3 mx-3 mt-3 mb-6">
        {/* Income by Client Type */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 transition duration-200 hover:border-[var(--color-border)]">
          <h3 className="font-semibold mb-2 text-sm text-[var(--color-text-primary)]">Income by Client Type</h3>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[var(--color-text-secondary)]">Corporate</span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{incomeByClientType.corporate.percentage}%</span>
          </div>
          <div className="h-3 bg-[var(--color-brand-primary)] rounded-full" style={{ width: `${incomeByClientType.corporate.percentage}%` }}></div>
          <div className="flex items-center justify-between mt-2 mb-1">
            <span className="text-sm text-[var(--color-text-secondary)]">Individual</span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{incomeByClientType.individual.percentage}%</span>
          </div>
          <div className="h-3 bg-[var(--color-brand-success)] rounded-full" style={{ width: `${incomeByClientType.individual.percentage}%` }}></div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 transition duration-200 hover:border-[var(--color-border)]">
          <h3 className="font-semibold mb-2 text-sm text-[var(--color-text-primary)]">Finance Review Queue</h3>
          <ul className="space-y-2">
            {flaggedVehicles.slice(0, 3).map((v, i) => (
              <li key={v.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#1a1f6e] text-white rounded-full flex items-center justify-center text-xs">
                    {i + 1}
                  </div>
                  <span className="font-medium text-sm text-[var(--color-text-primary)]">{v.name}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{v.plate}</span>
                </div>
                <span className="text-sm font-medium text-[#c41c3b]">Flagged</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
