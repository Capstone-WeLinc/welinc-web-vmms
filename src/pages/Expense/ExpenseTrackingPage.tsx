import { useEffect, useState, type ReactNode } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { getTransactions, getProfitabilitySummary, type Transaction } from '../../api/fleetService';
import type { ProfitabilitySummary } from '../../api/mockData';
import PageHeader from '../../components/PageHeader/PageHeader';
import AddIncomeModal from './AddIncomeModal';
import AddExpenseModal from './AddExpenseModal';

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
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 transition duration-200 ease-in-out">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: iconBgColor, color: iconColor }}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">{value}</div>
      <div className="mt-2 text-sm text-[var(--color-text-secondary)]">{label}</div>
      {subtitle && (
        <div className="mt-3 text-sm font-medium" style={{ color: iconColor }}>{subtitle}</div>
      )}
    </div>
  );
}

export default function ExpenseTrackingPage() {
  const [summary, setSummary] = useState<ProfitabilitySummary>({
    totalIncome: '$0',
    totalExpenses: '$0',
    netProfit: '$0',
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
    netProfit,
    profitMargin,
    flaggedVehicles,
    profitabilityRanking,
    incomeByClientType,
    topProfitableVehicles,
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
    { id: 'ranking', label: 'Profitability Ranking' },
    { id: 'history', label: 'Transaction History' },
    { id: 'breakdown', label: 'Expense Breakdown' },
  ];
  const [activeTab, setActiveTab] = useState('ranking');

  const [isIncomeOpen, setIsIncomeOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={DollarSign}
        title="Expense Tracking & Profitability"
        subtitle="Monitor expenses, costs, and profitability metrics"
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
          iconBgColor="rgba(34, 197, 94, 0.12)"
          iconColor="#22c55e"
        />
        <KPIStatCard
          icon={<TrendingDown className="w-4 h-4" />}
          value={totalExpenses}
          label="Total Fleet Expenses"
          iconBgColor="rgba(239, 68, 68, 0.12)"
          iconColor="#ef4444"
        />
        <KPIStatCard
          icon={<DollarSign className="w-4 h-4" />}
          value={netProfit}
          label="Net Fleet Profit"
          subtitle={`Margin: ${profitMargin}%`}
          iconBgColor="rgba(30, 58, 138, 0.12)"
          iconColor="#1e3a8a"
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
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === t.id ? 'bg-[var(--color-input-bg)] text-[var(--color-text-primary)] shadow-[0_8px_24px_rgba(26,31,110,0.12)]' : 'bg-[var(--color-input-bg)]/50 text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg)]'}`}
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
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/15 bg-[var(--color-card-bg)] p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 text-amber-200 font-semibold text-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">⚠️</span>
              <span>Flagged Vehicles — Require Immediate Attention</span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] md:ml-auto">Review and address high-priority fleet alerts immediately.</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {flaggedVehicles.map((v) => (
              <div key={v.id} className="rounded-2xl border border-amber-300/20 bg-[var(--color-card-bg)] px-4 py-5 transition hover:border-amber-300/40 hover:bg-[var(--color-input-bg-hover)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-[var(--color-text-primary)]">{v.name}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{v.plate} • {v.model}</div>
                  </div>
                  <div className="text-sm font-semibold text-rose-300">{v.netProfit}</div>
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
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${transactionTypeFilter === type ? 'bg-[var(--color-card-bg)] text-[var(--color-text-primary)]' : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg-hover)]'}`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="relative min-w-50">
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 py-2 text-sm text-[var(--color-text-primary)] outline-none appearance-none"
            >
              {vehicleOptions.map((vehicle) => (
                <option key={vehicle} value={vehicle} className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)]">
                  {vehicle}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--color-text-secondary)]">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none"><path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          <div className="ml-auto text-xs text-[var(--color-text-secondary)]">{filteredTransactions.length} entries</div>
        </section>
      )}

      {/* Main content: tabs */}
      {activeTab === 'ranking' && (
        <section className="mx-3 mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Vehicle Profitability Ranking</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]">
              <thead className="bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-2 font-semibold">Rank</th>
                  <th className="px-4 py-2 font-semibold">Vehicle</th>
                  <th className="px-4 py-2 font-semibold">Plate</th>
                  <th className="px-4 py-2 font-semibold">Total Income</th>
                  <th className="px-4 py-2 font-semibold">Individual</th>
                  <th className="px-4 py-2 font-semibold">Corporate</th>
                  <th className="px-4 py-2 font-semibold">Fuel</th>
                  <th className="px-4 py-2 font-semibold">Maint.</th>
                  <th className="px-4 py-2 font-semibold">Repairs</th>
                  <th className="px-4 py-2 font-semibold">Net Profit</th>
                  <th className="px-4 py-2 font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-divider)]">
                {profitabilityRanking.map((r, i) => (
                  <tr key={r.id} className="hover:bg-[var(--color-input-bg-hover)] transition-colors">
                    <td className="px-4 py-2">#{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">{r.vehicleName}</td>
                    <td className="px-4 py-2">{r.plate}</td>
                    <td className="px-4 py-2 text-sky-400 font-semibold">{r.income}</td>
                    <td className="px-4 py-2">{r.individual}</td>
                    <td className="px-4 py-2">{r.corporate}</td>
                    <td className="px-4 py-2">{r.fuel}</td>
                    <td className="px-4 py-2">{r.maint}</td>
                    <td className="px-4 py-2">{r.repairs}</td>
                    <td className="px-4 py-2 text-green-400 font-semibold">{r.netProfit}</td>
                    <td className="px-4 py-2"><span className="inline-block rounded-full bg-[var(--color-input-bg)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">{r.margin}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="mx-3 mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]">
            <thead className="bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
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
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${t.type === 'Income' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-[var(--color-text-primary)]">{t.vehicle}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{t.plate}</div>
                  </td>
                  <td className="px-4 py-4 text-[var(--color-text-primary)]">{t.description}</td>
                  <td className="px-4 py-4 text-[var(--color-text-primary)]">{t.client}</td>
                  <td className={`px-4 py-4 text-right font-semibold ${t.type === 'Income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === 'breakdown' && (
        <section className="mx-3 mt-3 overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)]">
          <div className="bg-[var(--color-input-bg)] px-5 py-4 text-sm font-semibold text-[var(--color-text-primary)]">Expense Breakdown by Vehicle</div>
          <div className="flex flex-wrap items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-input-bg)] px-5 py-3 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
              Fuel %
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
              Maintenance %
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              Repair %
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-[var(--color-text-secondary)]">
              <thead className="bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
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
                          <div className="bg-sky-500" style={{ width: `${fuelPct}%` }} />
                          <div className="bg-indigo-500" style={{ width: `${maintPct}%` }} />
                          <div className="bg-rose-500" style={{ width: `${repairPct}%` }} />
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
                          <span>{fuelPct}%</span>
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
                          <span>{maintPct}%</span>
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
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
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 transition duration-200 hover:border-[var(--color-border)]">
          <h3 className="font-semibold mb-2 text-sm text-[var(--color-text-primary)]">Income by Client Type</h3>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-[var(--color-text-secondary)]">Corporate</span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{incomeByClientType.corporate.percentage}%</span>
          </div>
          <div className="h-3 bg-[#2d3a8c] rounded-full" style={{ width: `${incomeByClientType.corporate.percentage}%` }}></div>
          <div className="flex items-center justify-between mt-2 mb-1">
            <span className="text-sm text-[var(--color-text-secondary)]">Individual</span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{incomeByClientType.individual.percentage}%</span>
          </div>
          <div className="h-3 bg-emerald-500 rounded-full" style={{ width: `${incomeByClientType.individual.percentage}%` }}></div>
        </div>
        {/* Top 3 Most Profitable */}
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 transition duration-200 hover:border-[var(--color-border)]">
          <h3 className="font-semibold mb-2 text-sm text-[var(--color-text-primary)]">Top 3 Most Profitable</h3>
          <ul className="space-y-2">
            {topProfitableVehicles.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">
                    {i + 1}
                  </div>
                  <span className="font-medium text-sm text-[var(--color-text-primary)]">{v.name}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{v.plate}</span>
                </div>
                <span className="text-sm font-semibold text-green-500">{v.netProfit}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
