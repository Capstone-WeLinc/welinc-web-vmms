import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, Calendar } from 'lucide-react';
import { printToPDF } from "../../../lib/utils/fuelExport";

const branchData = [
  { name: 'Main Branch', vehicles: 6, fillUps: 8, liters: 520, cost: 34321, efficiency: 8.5 },
  { name: 'North Branch', vehicles: 2, fillUps: 4, liters: 236, cost: 15474, efficiency: 7.2 }
];

export default function FleetWideReport() {
  const [dateFrom, setDateFrom] = useState('2026-05-26');
  const [dateTo, setDateTo] = useState('2026-05-30');
  const [branchSearch, setBranchSearch] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [tempFrom, setTempFrom] = useState('2026-05-26');
  const [tempTo, setTempTo] = useState('2026-05-30');

  const [currentLeftMonth, setCurrentLeftMonth] = useState(new Date(2026, 4, 1));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleBranchSearchChange = (value: string) => {
    setBranchSearch(value);
    setCurrentPage(1);
  };

  const handleToggleCalendar = () => {
    const nextOpen = !isCalendarOpen;
    setIsCalendarOpen(nextOpen);

    if (nextOpen) {
      setTempFrom(dateFrom);
      setTempTo(dateTo);

      const currentDate = new Date(dateFrom);
      setCurrentLeftMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    }
  };

  const filteredBranches = useMemo(() => {
    return branchData.filter(b =>
      b.name.toLowerCase().includes(branchSearch.toLowerCase())
    );
  }, [branchSearch]);

  const totalPages = Math.ceil(filteredBranches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBranches = useMemo(() => {
    return filteredBranches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBranches, startIndex]);

  const totals = useMemo(() => {
    return {
      vehicles: filteredBranches.reduce((sum, b) => sum + b.vehicles, 0),
      fillUps: filteredBranches.reduce((sum, b) => sum + b.fillUps, 0),
      liters: filteredBranches.reduce((sum, b) => sum + b.liters, 0),
      cost: filteredBranches.reduce((sum, b) => sum + b.cost, 0),
      efficiency: filteredBranches.length > 0
        ? (filteredBranches.reduce((sum, b) => sum + b.efficiency, 0) / filteredBranches.length).toFixed(1)
        : '0.0'
    };
  }, [filteredBranches]);

  const leftMonthYear = currentLeftMonth.getFullYear();
  const leftMonthIdx = currentLeftMonth.getMonth();

  const rightMonthDate = new Date(leftMonthYear, leftMonthIdx + 1, 1);
  const rightMonthYear = rightMonthDate.getFullYear();
  const rightMonthIdx = rightMonthDate.getMonth();

  const changeMonthsView = (direction: number) => {
    setCurrentLeftMonth(new Date(leftMonthYear, leftMonthIdx + direction, 1));
  };

  // Days range calculations
  const generateMonthDays = (year: number, month: number) => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = new Date(year, month, 1).getDay();
    const sequence = [];

    for (let i = 0; i < startOffset; i++) {
      sequence.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      sequence.push(new Date(year, month, d));
    }
    return sequence;
  };

  const leftMonthDays = useMemo(() => generateMonthDays(leftMonthYear, leftMonthIdx), [leftMonthYear, leftMonthIdx]);
  const rightMonthDays = useMemo(() => generateMonthDays(rightMonthYear, rightMonthIdx), [rightMonthYear, rightMonthIdx]);

  const handleDaySelection = (date: Date) => {
    const pad = (num: number) => String(num).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    if (!tempFrom || (tempFrom && tempTo)) {
      setTempFrom(dateStr);
      setTempTo('');
    } else {
      if (dateStr < tempFrom) {
        setTempFrom(dateStr);
      } else {
        setTempTo(dateStr);
      }
    }
  };

  const getDayClassName = (date: Date | null) => {
    if (!date) return 'p-2';

    const pad = (num: number) => String(num).padStart(2, '0');
    const dStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const isSunday = date.getDay() === 0;

    let styles = "p-2 text-center text-sm relative transition-all select-none cursor-pointer font-medium h-9 w-9 flex items-center justify-center mx-auto rounded-lg ";

    if (dStr === tempFrom || dStr === tempTo) {
      styles += "bg-[var(--color-brand-warning)] text-[var(--color-brand-black)] font-bold !rounded-full shadow-md z-10 scale-105";
    } else if (tempFrom && tempTo && dStr > tempFrom && dStr < tempTo) {
      styles += "bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary)] !rounded-none";
    } else if (isSunday) {
      styles += "text-[var(--color-brand-danger)] hover:bg-[var(--color-input-bg-hover)]";
    } else {
      styles += "text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg-hover)]";
    }

    return styles;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatLabel = (from: string, to: string) => {
    if (!from) return 'Select date range';
    return to ? `${from} — ${to}` : `${from} — Select End`;
  };

  const handleApply = () => {
    if (tempFrom && tempTo) {
      setDateFrom(tempFrom);
      setDateTo(tempTo);
    } else if (tempFrom) {
      setDateFrom(tempFrom);
      setDateTo(tempFrom);
    }
    setIsCalendarOpen(false);
  };

  const handleReset = () => {
    setTempFrom('');
    setTempTo('');
  };

  const handleExportExcel = () => {
    const headers = ['Branch', 'Vehicles', 'Total Fill-Ups', 'Total Liters', 'Total Cost (₱)', 'Avg Efficiency (km/L)'];
    const rows = filteredBranches.map(b => [b.name, b.vehicles, b.fillUps, b.liters, b.cost, b.efficiency.toFixed(1)]);
    const totalRow = ['Fleet Total', totals.vehicles, totals.fillUps, totals.liters, totals.cost, totals.efficiency];
    const csv = [headers, ...rows, totalRow].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-fuel-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    printToPDF('fleet-wide-fuel-report', `fleet-fuel-report-${dateFrom}-to-${dateTo}`);
  };

  return (
    <div id="fleet-wide-fuel-report" className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Fleet-Wide Fuel Cost Report</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{formatLabel(formatDisplayDate(dateFrom), formatDisplayDate(dateTo))}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="rounded-xl bg-[var(--color-brand-success)]/15 border border-[var(--color-brand-success)]/20 px-4 h-10 text-sm font-medium text-[var(--color-brand-success)] hover:bg-[var(--color-brand-success)]/25 transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Download size={16} />
              Export .xlsx
            </button>
            <button
              onClick={handleExportPDF}
              className="rounded-xl bg-[var(--color-brand-primary)]/15 border border-[var(--color-brand-primary)]/20 px-4 h-10 text-sm font-medium text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/25 transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={branchSearch}
              onChange={(e) => handleBranchSearchChange(e.target.value)}
              placeholder="Search branch..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]/30 h-10"
            />
          </div>

          <div className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={handleToggleCalendar}
              className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 rounded-xl border border-[var(--color-brand-primary)]/30 bg-[var(--color-input-bg)] px-4 text-sm text-[var(--color-brand-primary)] hover:bg-[var(--color-input-bg-hover)] transition focus:outline-none h-10 cursor-pointer font-mono font-medium tracking-wide"
            >
              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-[var(--color-brand-primary)]" />
                <span>{formatLabel(dateFrom, dateTo)}</span>
              </div>
            </button>

            {isCalendarOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsCalendarOpen(false)} />

                <div className="absolute left-0 mt-2 z-50 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in-50 slide-in-from-top-1 duration-150 max-w-[95vw] w-160">

                  <div className="flex justify-end">
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-input-bg)]/50 px-3 h-8 text-xs font-mono font-medium text-[var(--color-brand-primary)]">
                      <Calendar size={13} />
                      <span>{formatLabel(tempFrom, tempTo)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 relative">

                    <button
                      type="button"
                      onClick={() => changeMonthsView(-1)}
                      className="absolute left-0 top-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition p-1"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeMonthsView(1)}
                      className="absolute right-0 top-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition p-1"
                    >
                      <ChevronRight size={18} />
                    </button>

                    <div>
                      <h4 className="text-center text-sm font-medium text-[var(--color-text-primary)] mb-4 capitalize">
                        {currentLeftMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h4>
                      <div className="grid grid-cols-7 text-center gap-y-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                            <span key={d} className={`text-xs font-semibold pb-2 ${i === 0 ? 'text-[var(--color-brand-danger)]' : 'text-[var(--color-text-secondary)]'}`}>{d}</span>
                        ))}
                        {leftMonthDays.map((day, idx) => (
                          <div key={idx} className="h-9 flex items-center justify-center">
                            {day ? (
                              <button
                                type="button"
                                onClick={() => handleDaySelection(day)}
                                className={getDayClassName(day)}
                              >
                                {day.getDate()}
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-center text-sm font-medium text-[var(--color-text-primary)] mb-4 capitalize">
                        {rightMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h4>
                      <div className="grid grid-cols-7 text-center gap-y-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                            <span key={d} className={`text-xs font-semibold pb-2 ${i === 0 ? 'text-[var(--color-brand-danger)]' : 'text-[var(--color-text-secondary)]'}`}>{d}</span>
                        ))}
                        {rightMonthDays.map((day, idx) => (
                          <div key={idx} className="h-9 flex items-center justify-center">
                            {day ? (
                              <button
                                type="button"
                                onClick={() => handleDaySelection(day)}
                                className={getDayClassName(day)}
                              >
                                {day.getDate()}
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-4 pt-2 border-t border-[var(--color-divider)] mt-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition px-3 py-2 cursor-pointer"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="rounded-xl bg-[var(--color-brand-primary)] px-5 h-9 text-xs font-semibold text-white hover:bg-[var(--color-brand-primary-dark)] transition active:scale-95 cursor-pointer shadow-md"
                    >
                      Select dates
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card">
          <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Total Fleet Fuel Cost</div>
          <div className="text-3xl font-bold text-[var(--color-text-primary)] font-mono">₱{totals.cost.toLocaleString()}</div>
        </div>
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card">
          <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Total Liters Consumed</div>
          <div className="text-3xl font-bold text-[var(--color-text-primary)] font-mono">{totals.liters}L</div>
        </div>
        <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-card">
          <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Avg Fleet Efficiency</div>
          <div className="text-3xl font-bold text-[var(--color-brand-primary)] font-mono">{totals.efficiency} km/L</div>
        </div>
      </div>

      <div className="overflow-auto overscroll-contain rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card lg:max-h-[min(40rem,calc(100vh-12rem))]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[var(--color-divider)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)]">
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Branch</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Vehicles</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Total Fill-Ups</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Total Liters</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Total Cost</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Avg Efficiency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-divider)]">
            {paginatedBranches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  No branches found.
                </td>
              </tr>
            ) : (
              paginatedBranches.map((item) => (
                <tr key={item.name} className="hover:bg-[var(--color-input-bg-hover)] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{item.name}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)] font-mono">{item.vehicles}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)] font-mono">{item.fillUps}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)] font-mono">{item.liters}L</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-primary)] font-semibold font-mono">₱{item.cost.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-semibold font-mono ${item.efficiency >= 8.3 ? 'text-[var(--color-brand-success)]' : 'text-[var(--color-brand-danger)]'}`}>
                    {item.efficiency.toFixed(1)} km/L
                  </td>
                </tr>
              ))
            )}

            {filteredBranches.length > 0 && (
              <tr className="border-t border-[var(--color-divider)] bg-[var(--color-input-bg)] font-semibold">
                <td className="px-4 py-4 text-[var(--color-text-primary)]">Fleet Total</td>
                <td className="px-4 py-4 text-right text-[var(--color-text-primary)] font-mono">{totals.vehicles}</td>
                <td className="px-4 py-4 text-right text-[var(--color-text-primary)] font-mono">{totals.fillUps}</td>
                <td className="px-4 py-4 text-right text-[var(--color-text-primary)] font-mono">{totals.liters}L</td>
                <td className="px-4 py-4 text-right text-[var(--color-text-primary)] font-mono">₱{totals.cost.toLocaleString()}</td>
                <td className="px-4 py-4 text-right text-[var(--color-brand-primary)] font-mono">{totals.efficiency} km/L</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <div>
          Showing <span className="text-[var(--color-text-primary)] font-semibold">{paginatedBranches.length}</span> of{' '}
          <span className="text-[var(--color-text-primary)] font-semibold">{filteredBranches.length}</span> matching entries
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-20 transition cursor-pointer disabled:cursor-not-allowed"
            aria-label="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-xs text-[var(--color-text-secondary)] select-none font-medium">
            Page {currentPage} of {totalPages || 1}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-20 transition cursor-pointer disabled:cursor-not-allowed"
            aria-label="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
