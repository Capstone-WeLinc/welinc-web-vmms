import type { FuelFillUp } from '../types';
import { Download } from 'lucide-react';
import { exportRowsAsXlsx } from '../../../lib/utils/excelExport';
import { printToPDF } from '../../../lib/utils/fuelExport';

export default function FleetWideReport({ fillUps, onExport }: { fillUps: FuelFillUp[]; onExport?: (format: string) => void }) {
  const vehicles = [...new Set(fillUps.map((entry) => entry.vehicleId))];
  const rows = vehicles.map((vehicleId) => {
    const entries = fillUps.filter((entry) => entry.vehicleId === vehicleId);
    const efficiencies = entries.map((entry) => entry.efficiency).filter((value): value is number => value != null);
    return {
      plate: entries[0]?.vehicleName || vehicleId,
      model: entries[0]?.vehicleModel || '',
      count: entries.length,
      liters: entries.reduce((sum, entry) => sum + entry.liters, 0),
      cost: entries.reduce((sum, entry) => sum + entry.totalCost, 0),
      efficiency: efficiencies.length ? efficiencies.reduce((sum, value) => sum + value, 0) / efficiencies.length : null,
    };
  });
  const exportExcel = () => {
    onExport?.('excel');
    const headers = ['Vehicle', 'Model', 'Fill-ups', 'Total Liters', 'Total Fuel Cost (PHP)', 'Average Efficiency (km/L)'];
    const data = rows.map((row) => [row.plate, row.model, row.count, row.liters, row.cost, row.efficiency ?? 'Insufficient Data']);
    exportRowsAsXlsx(`fleet_fuel_cost_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Fleet Fuel Cost', [headers, ...data]);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Download size={15} />Export Excel</button>
        <button type="button" onClick={() => { onExport?.('pdf'); printToPDF('fuel-fleet-report-table', 'fleet-fuel-cost'); }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Download size={15} />Export PDF</button>
      </div>
      <div id="fuel-fleet-report-table" className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2">Vehicle</th><th className="p-2">Model</th><th className="p-2">Fill-ups</th><th className="p-2">Liters</th><th className="p-2">Fuel cost</th><th className="p-2">Average km/L</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.plate} className="border-t"><td className="p-2">{row.plate}</td><td className="p-2">{row.model}</td><td className="p-2">{row.count}</td><td className="p-2">{row.liters.toFixed(2)} L</td><td className="p-2">₱{row.cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td className="p-2">{row.efficiency == null ? 'Insufficient Data' : `${row.efficiency.toFixed(1)} km/L`}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-center">No fuel records for this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
