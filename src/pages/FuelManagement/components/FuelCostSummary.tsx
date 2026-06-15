import type { FuelFillUp } from '../types';
import { Download, Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useMemo, useState, useRef, useEffect } from 'react';
import { printToPDF } from "../../../lib/utils/fuelExport";

interface FuelCostSummaryProps {
  fillUps: FuelFillUp[];
}

interface VehicleSummary {
  vehicleId: string;
  vehicleName: string;
  model: string;
  fillUpsCount: number;
  totalLiters: number;
  totalCost: number;
  totalEfficiencyPoints: number;
}

export default function FuelCostSummary({ fillUps = [] }: FuelCostSummaryProps) {
  const [selectedVehicle, setSelectedVehicle] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>('2026-05-26');
  const [endDate, setEndDate] = useState<string>('2026-05-30');
  const datePickerRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueVehicles = useMemo(() => {
    const vehicles = new Set(fillUps.map(f => f.vehicleId).filter(Boolean));
    return ['All', ...Array.from(vehicles)];
  }, [fillUps]);

  const mayDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const mayStartOffset = 5;

  const juneDays = Array.from({ length: 30 }, (_, i) => i + 1);
  const juneStartOffset = 1;

  const handleDayClick = (year: number, month: number, day: number) => {
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    setCurrentPage(1);

    if (!startDate || (startDate && endDate)) {
      setStartDate(formattedDate);
      setEndDate('');
    } else {
      if (new Date(formattedDate) < new Date(startDate)) {
        setStartDate(formattedDate);
      } else {
        setEndDate(formattedDate);
      }
    }
  };

  const getDateState = (year: number, month: number, day: number) => {
    const currentStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (currentStr === startDate || currentStr === endDate) return 'endpoint';
    if (startDate && endDate && currentStr > startDate && currentStr < endDate) return 'range';
    return 'idle';
  };

  const filteredFillUps = useMemo(() => {
    return fillUps.filter(f => {
      const matchesVehicle = selectedVehicle === 'All' || f.vehicleId === selectedVehicle;

      const cleanQuery = searchQuery.trim().toLowerCase();
      const matchesSearch = !cleanQuery ? true : (
        (f.vehicleId?.toLowerCase().includes(cleanQuery)) ||
        (f.vehicleName?.toLowerCase().includes(cleanQuery)) ||
        (f.vehicleModel?.toLowerCase().includes(cleanQuery))
      );

      if (!f.date) return matchesVehicle && matchesSearch;

      const fitsTimeline = (!startDate || f.date >= startDate) && (!endDate || f.date <= endDate);
      return matchesVehicle && fitsTimeline && matchesSearch;
    });
  }, [fillUps, selectedVehicle, startDate, endDate, searchQuery]);

  const summaryData = useMemo(() => {
    const vehicleMap = filteredFillUps.reduce<Record<string, VehicleSummary>>((acc, fillUp) => {
      const id = fillUp.vehicleId;
      if (!acc[id]) {
        acc[id] = {
          vehicleId: id,
          vehicleName: fillUp.vehicleName ?? 'N/A',
          model: fillUp.vehicleModel ?? 'N/A',
          fillUpsCount: 0,
          totalLiters: 0,
          totalCost: 0,
          totalEfficiencyPoints: 0,
        };
      }

      acc[id].fillUpsCount += 1;
      acc[id].totalLiters += fillUp.liters ?? 0;
      acc[id].totalCost += fillUp.totalCost ?? 0;
      acc[id].totalEfficiencyPoints += fillUp.efficiency ?? 0;

      return acc;
    }, {});

    return Object.values(vehicleMap);
  }, [filteredFillUps]);

  const totalPages = Math.ceil(summaryData.length / itemsPerPage);

  const handleExportPDF = () => {
    printToPDF('fuel-cost-summary-table', 'fuel-cost-summary');
  };
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSummaryData = useMemo(() => {
    return summaryData.slice(startIndex, startIndex + itemsPerPage);
  }, [summaryData, startIndex]);

  // Calculate fleet-wide totals based on filtered dataset
  const fleetTotals = useMemo(() => {
    const totals = summaryData.reduce(
      (acc, item) => {
        acc.fillUps += item.fillUpsCount;
        acc.liters += item.totalLiters;
        acc.totalCost += item.totalCost;
        acc.efficiencySum += item.totalEfficiencyPoints;
        return acc;
      },
      { fillUps: 0, liters: 0, totalCost: 0, efficiencySum: 0 }
    );

    return {
      ...totals,
      avgPricePerLiter: totals.liters > 0 ? totals.totalCost / totals.liters : 0,
      avgEfficiency: filteredFillUps.length > 0 ? totals.efficiencySum / filteredFillUps.length : 0,
    };
  }, [summaryData, filteredFillUps]);

  return (
    <div className="space-y-6">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div className="flex flex-wrap items-center gap-3">

          <div className="relative flex items-center h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 focus-within:border-[var(--color-brand-primary)]/50 focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]/30 transition-all duration-200 w-full sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search vehicle or model..."
              className="bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none w-full font-medium"
            />
          </div>

          <div className="relative flex items-center h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-4 hover:bg-[var(--color-card-bg-hover)] transition-all duration-200 cursor-pointer">
            <Filter size={16} className="text-[var(--color-text-secondary)] mr-2 shrink-0" strokeWidth={1.8} />
            <span className="text-sm font-semibold text-[var(--color-text-primary)] tracking-wide select-none">
              Filters
            </span>
            <select
              value={selectedVehicle}
              onChange={(e) => {
                setSelectedVehicle(e.target.value);
                setCurrentPage(1);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
            >
              {uniqueVehicles.map((vId) => (
                <option key={vId} value={vId} className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)] text-sm">
                  {vId === 'All' ? 'All Vehicles' : vId}
                </option>
              ))}
            </select>
          </div>

          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className={`flex items-center gap-2.5 h-11 rounded-xl border px-3.5 text-sm font-medium transition active:scale-[0.98] cursor-pointer whitespace-nowrap ${isDatePickerOpen
                ? 'active-filter text-[var(--color-text-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)]'
                }`}
            >
              <Calendar size={16} className="text-[var(--color-brand-primary)]" strokeWidth={1.8} />
              <span className="font-mono text-sm text-[var(--color-text-secondary)]">
                {startDate ? `${startDate}${endDate ? ` — ${endDate}` : ''}` : 'Select Timeline'}
              </span>
            </button>

            {isDatePickerOpen && (
              <div className="absolute top-full left-0 mt-3 z-50 w-160 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-5 shadow-2xl space-y-4">
                <div className="flex justify-end">
                  <div className="flex items-center gap-2 h-7 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 font-mono text-[11px] text-cyan-400">
                    <Calendar size={13} />
                    <span>{startDate || 'YYYY-MM-DD'} — {endDate || 'YYYY-MM-DD'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 relative">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--color-divider)] -translate-x-1/2" />

                  <div>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <button type="button" className="flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] transition active:scale-95">
                        <ChevronLeft size={14} />
                      </button>
                      <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide">May 2026</h4>
                      <div className="w-7 h-7" />
                    </div>
                    <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[var(--color-text-secondary)] gap-y-2">
                      <span className="text-[var(--color-brand-danger)] font-bold">Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                      {Array.from({ length: mayStartOffset }).map((_, i) => <div key={`empty-may-${i}`} />)}
                      {mayDays.map((day) => {
                        const state = getDateState(2026, 5, day);
                        const isSunday = (day + mayStartOffset - 1) % 7 === 0;
                        return (
                          <button
                            key={`may-${day}`}
                            type="button"
                            onClick={() => handleDayClick(2026, 5, day)}
                            className={`h-8 w-8 text-xs font-medium relative mx-auto flex items-center justify-center transition-all ${state === 'endpoint'
                                  ? 'bg-[var(--color-brand-warning)] text-[var(--color-brand-black)] font-extrabold rounded-full shadow-md z-10 scale-105'
                                  : state === 'range'
                                    ? 'bg-[var(--color-card-bg)] text-[var(--color-brand-primary)] w-full font-semibold'
                                    : isSunday
                                      ? 'text-[var(--color-brand-danger)] hover:bg-[var(--color-card-bg-hover)] rounded-lg'
                                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] rounded-lg'
                                  }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                      <div className="flex items-center justify-between mb-4 px-1">
                      <div className="w-7 h-7" />
                      <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide">June 2026</h4>
                      <button type="button" className="flex items-center justify-center h-7 w-7 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-card-bg-hover)] transition active:scale-95">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-[var(--color-text-secondary)] gap-y-2">
                      <span className="text-[var(--color-brand-danger)] font-bold">Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                      {Array.from({ length: juneStartOffset }).map((_, i) => <div key={`empty-june-${i}`} />)}
                      {juneDays.map((day) => {
                        const state = getDateState(2026, 6, day);
                        const isSunday = (day + juneStartOffset - 1) % 7 === 0;
                        return (
                          <button
                            key={`june-${day}`}
                            type="button"
                            onClick={() => handleDayClick(2026, 6, day)}
                            className={`h-8 w-8 text-xs font-medium relative mx-auto flex items-center justify-center transition-all ${state === 'endpoint'
                              ? 'bg-[var(--color-brand-warning)] text-[var(--color-brand-black)] font-extrabold rounded-full shadow-md z-10 scale-105'
                              : state === 'range'
                                ? 'bg-[var(--color-card-bg)] text-[var(--color-brand-primary)] w-full font-semibold'
                                : isSunday
                                  ? 'text-[var(--color-brand-danger)] hover:bg-[var(--color-card-bg-hover)] rounded-lg'
                                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card-bg-hover)] rounded-lg'
                              }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-2 border-t border-[var(--color-border)] mt-5 pt-4">
                  <button
                    type="button"
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="h-9 px-4 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition active:scale-[0.98]"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="h-9 px-5 rounded-xl bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/80 text-xs font-semibold text-white transition active:scale-[0.98] shadow-lg flex items-center justify-center"
                  >
                    Select dates
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button className="rounded-xl bg-[var(--color-brand-success)]/15 border border-[var(--color-brand-success)]/20 px-4 h-11 text-sm font-semibold text-[var(--color-brand-success)] hover:bg-[var(--color-brand-success)]/25 transition active:scale-95 cursor-pointer flex items-center gap-2">
            <Download size={16} />
            Export .xlsx
          </button>
          <button onClick={handleExportPDF} className="rounded-xl bg-[var(--color-brand-primary)]/15 border border-[var(--color-brand-primary)]/20 px-4 h-11 text-sm font-semibold text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/25 transition active:scale-95 cursor-pointer flex items-center gap-2">
            <Download size={16} />
            Export PDF
          </button>
        </div>

      </div>

      <div id="fuel-cost-summary-table" className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]">
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Vehicle</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider">Model</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-center">Total Fill-Ups</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-center">Total Liters</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-center">Avg Price/L</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-center">Total Fuel Cost</th>
              <th className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-right">Avg Efficiency</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--color-divider)]">
            {paginatedSummaryData.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  No operational records parsed for this timeline.
                </td>
              </tr>
            ) : (
              paginatedSummaryData.map((item) => {
                const calculatedAvgPrice = item.totalLiters > 0 ? item.totalCost / item.totalLiters : 0;
                const calculatedAvgEfficiency = item.fillUpsCount > 0 ? item.totalEfficiencyPoints / item.fillUpsCount : 0;

                return (
                  <tr key={item.vehicleId} className="hover:bg-[var(--color-card-bg-hover)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)] font-mono">{item.vehicleId}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.model}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] font-mono">{item.fillUpsCount}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] font-mono">{item.totalLiters.toLocaleString()}L</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] font-mono">₱{calculatedAvgPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-primary)] font-semibold font-mono">₱{item.totalCost.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-semibold font-mono ${calculatedAvgEfficiency >= 8.0 ? 'text-[var(--color-brand-success)]' : 'text-[var(--color-brand-danger)]'}`}>
                      {calculatedAvgEfficiency.toFixed(1)} km/L
                    </td>
                  </tr>
                );
              })
            )}

            {summaryData.length > 0 && (
              <tr className="border-t border-[var(--color-border)] bg-[var(--color-card-bg)]/50 font-semibold">
                <td colSpan={2} className="px-4 py-4 text-[var(--color-text-primary)]">Fleet Total</td>
                <td className="px-4 py-4 text-center text-[var(--color-text-primary)] font-mono">{fleetTotals.fillUps}</td>
                <td className="px-4 py-4 text-center text-[var(--color-text-primary)] font-mono">{fleetTotals.liters.toLocaleString()}L</td>
                <td className="px-4 py-4 text-center text-[var(--color-text-secondary)] font-mono">₱{fleetTotals.avgPricePerLiter.toFixed(2)}</td>
                <td className="px-4 py-4 text-center text-[var(--color-text-primary)] font-mono">₱{fleetTotals.totalCost.toLocaleString()}</td>
                <td className="px-4 py-4 text-right text-[var(--color-brand-primary)] font-mono">{fleetTotals.avgEfficiency.toFixed(1)} km/L</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-2 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <div>
          Showing <span className="text-[var(--color-text-primary)] font-semibold">{paginatedSummaryData.length}</span> of{' '}
          <span className="text-[var(--color-text-primary)] font-semibold">{summaryData.length}</span> matching entries
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
