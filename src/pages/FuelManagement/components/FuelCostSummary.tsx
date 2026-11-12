import type { FuelFillUp } from '../types';
import { Download, Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useMemo, useState, useRef, useEffect } from 'react';
import { exportRowsToPDF } from "../../../lib/utils/fuelExport";
import { exportRowsAsXlsx } from '../../../lib/utils/excelExport';
import { excludeVoidedFuelFillUps, summarizeFuelFillUps } from '../fuelReportData';

interface FuelCostSummaryProps {
  fillUps: FuelFillUp[];
  onExport?: (format: string) => void;
}

export default function FuelCostSummary({ fillUps = [], onExport }: FuelCostSummaryProps) {
  const [selectedVehicle, setSelectedVehicle] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
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

  const activeFillUps = useMemo(() => excludeVoidedFuelFillUps(fillUps), [fillUps]);
  const uniqueVehicles = useMemo(() => {
    const vehicles = new Map(activeFillUps.filter((fillUp) => fillUp.vehicleId).map((fillUp) => [fillUp.vehicleId, fillUp.vehicleName || fillUp.vehicleId]));
    return [{ id: 'All', label: 'All Vehicles' }, ...Array.from(vehicles, ([id, label]) => ({ id, label }))];
  }, [activeFillUps]);

  const filteredFillUps = useMemo(() => {
    return activeFillUps.filter(f => {
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
  }, [activeFillUps, selectedVehicle, startDate, endDate, searchQuery]);

  const summaryData = useMemo(() => summarizeFuelFillUps(filteredFillUps), [filteredFillUps]);

  const totalPages = Math.ceil(summaryData.length / itemsPerPage);

  const handleExportPDF = () => {
    onExport?.('pdf');
    exportRowsToPDF('fuel-cost-summary', 'Fuel Cost Summary', ['Vehicle', 'Model', 'Total Fill-Ups', 'Total Liters', 'Average Price per Liter (PHP)', 'Total Fuel Cost (PHP)', 'Average Efficiency (km/L)'], summaryData.map((item) => [
      item.vehicleName, item.model, item.fillUpsCount, item.totalLiters,
      item.totalLiters > 0 ? `₱${(item.totalCost / item.totalLiters).toFixed(2)}` : '₱0.00',
      `₱${item.totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
      item.averageEfficiency == null ? 'Insufficient Data' : `${item.averageEfficiency.toFixed(1)} km/L`,
    ]));
  };
  const handleExportExcel = () => {
    onExport?.('excel');
    if (summaryData.length === 0) return;
    const headers = ['Vehicle', 'Model', 'Total Fill-Ups', 'Total Liters', 'Average Price per Liter (PHP)', 'Total Fuel Cost (PHP)', 'Average Efficiency (km/L)'];
    const rows = summaryData.map((item) => [
      item.vehicleName || item.vehicleId,
      item.model,
      item.fillUpsCount,
      item.totalLiters,
      item.totalLiters > 0 ? item.totalCost / item.totalLiters : 0,
      item.totalCost,
      item.averageEfficiency ?? 'Insufficient Data',
    ]);
    exportRowsAsXlsx(`fuel_cost_summary_${new Date().toISOString().split('T')[0]}.xlsx`, 'Fuel Cost Summary', [headers, ...rows]);
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
        acc.efficiencySum += (item.averageEfficiency ?? 0) * item.efficiencyCount;
        acc.efficiencyCount += item.efficiencyCount;
        return acc;
      },
      { fillUps: 0, liters: 0, totalCost: 0, efficiencySum: 0, efficiencyCount: 0 }
    );

    return {
      ...totals,
      avgPricePerLiter: totals.liters > 0 ? totals.totalCost / totals.liters : 0,
      avgEfficiency: totals.efficiencyCount > 0 ? totals.efficiencySum / totals.efficiencyCount : 0,
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
            <span className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide select-none">
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
              {uniqueVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id} className="bg-[var(--color-input-bg)] text-[var(--color-text-primary)] text-sm">
                  {vehicle.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative" ref={datePickerRef}>
            <button type="button" onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="flex items-center gap-2.5 h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3.5 text-sm font-medium text-[var(--color-text-secondary)]">
              <Calendar size={16} className="text-[var(--color-brand-primary)]" strokeWidth={1.8} />
              <span>{startDate || 'From'} - {endDate || 'To'}</span>
            </button>
            {isDatePickerOpen && (
              <div className="absolute top-full left-0 z-50 mt-3 w-80 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-2xl">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">From
                    <input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-2 text-sm text-[var(--color-text-primary)]" />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">To
                    <input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setCurrentPage(1); }} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-2 text-sm text-[var(--color-text-primary)]" />
                  </label>
                </div>
                {startDate && endDate && startDate > endDate && <p role="alert" className="mt-2 text-xs text-red-600">End date must be on or after start date.</p>}
                <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
                  <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }} className="rounded-lg px-3 py-2 text-xs text-[var(--color-text-secondary)]">Reset</button>
                  <button type="button" disabled={!!(startDate && endDate && startDate > endDate)} onClick={() => setIsDatePickerOpen(false)} className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Apply range</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={handleExportExcel} className="rounded-xl bg-[var(--color-brand-success)]/15 border border-[var(--color-brand-success)]/20 px-4 h-11 text-sm font-medium text-[var(--color-brand-success)] hover:bg-[var(--color-brand-success)]/25 transition active:scale-95 cursor-pointer flex items-center gap-2">
            <Download size={16} />
            Export .xlsx
          </button>
          <button onClick={handleExportPDF} className="rounded-xl bg-[var(--color-brand-primary)]/15 border border-[var(--color-brand-primary)]/20 px-4 h-11 text-sm font-medium text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/25 transition active:scale-95 cursor-pointer flex items-center gap-2">
            <Download size={16} />
            Export PDF
          </button>
        </div>

      </div>

      <div id="fuel-cost-summary-table" className="overflow-auto overscroll-contain rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card-bg)] shadow-card lg:max-h-[min(40rem,calc(100vh-12rem))]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)]">
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
                const calculatedAvgEfficiency = item.averageEfficiency;

                return (
                  <tr key={item.vehicleId} className="hover:bg-[var(--color-card-bg-hover)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)] font-mono">{item.vehicleName || item.vehicleId}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.model}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] font-mono">{item.fillUpsCount}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] font-mono">{item.totalLiters.toLocaleString()}L</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-secondary)] font-mono">₱{calculatedAvgPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-primary)] font-semibold font-mono">₱{item.totalCost.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-semibold font-mono ${calculatedAvgEfficiency != null && calculatedAvgEfficiency >= 8.0 ? 'text-[var(--color-brand-success)]' : 'text-[var(--color-brand-danger)]'}`}>
                      {calculatedAvgEfficiency == null ? 'Insufficient Data' : `${calculatedAvgEfficiency.toFixed(1)} km/L`}
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
