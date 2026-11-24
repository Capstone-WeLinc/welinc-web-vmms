// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FuelManagement from './FuelManagement';
import type { FuelFillUp } from './types';
import {
  getFuelAnomalyAttachment,
  getFuelAnomalies,
  getFuelAnomalyThreshold,
  getFuelEntries,
  getFuelStations,
  recordFuelReportExport,
  uploadFuelAnomalyAttachment,
  voidFuelEntry,
} from '../../lib/api/fuelService';
import { getVehicles } from '../../lib/api/vmmsApi';
import { exportRowsAsXlsx } from '../../lib/utils/excelExport';
import { exportRowsToPDF } from '../../lib/utils/fuelExport';

const authMock = vi.hoisted(() => ({ role: 'ADMIN' }));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { currentUser: { role: string } }) => unknown) => selector({ currentUser: { role: authMock.role } }),
}));
vi.mock('../../lib/api/httpClient', () => ({ useBackend: true }));
vi.mock('../../lib/api/fuelService', () => ({
  getFuelEntries: vi.fn(),
  getFuelStations: vi.fn(),
  getFuelAnomalies: vi.fn(),
  getFuelAnomalyThreshold: vi.fn(),
  recordFuelReportExport: vi.fn(),
  acknowledgeFuelAnomaly: vi.fn(),
  createFuelEntry: vi.fn(),
  createFuelStation: vi.fn(),
  getFuelAnomalyAttachment: vi.fn(),
  updateFuelAnomaly: vi.fn(),
  updateFuelAnomalyThreshold: vi.fn(),
  uploadFuelAnomalyAttachment: vi.fn(),
  voidFuelEntry: vi.fn(),
}));
vi.mock('../../lib/api/vmmsApi', () => ({ getVehicles: vi.fn() }));
vi.mock('../../lib/utils/excelExport', () => ({ exportRowsAsXlsx: vi.fn() }));
vi.mock('../../lib/utils/fuelExport', () => ({ exportRowsToPDF: vi.fn() }));

const fillUps: FuelFillUp[] = [
  { id: 'fill-1', vehicleId: 'truck-a', vehicleName: 'NDG 5821', vehicleModel: 'Truck A', date: '2026-11-10', liters: 100, pricePerLiter: 60, totalCost: 6000, odometer: 1000, station: 'Petron', filledBy: 'Driver A', efficiency: 10, trend: 'normal', isFullTank: true, isVoided: false },
  { id: 'fill-2', vehicleId: 'truck-a', vehicleName: 'NDG 5821', vehicleModel: 'Truck A', date: '2026-11-10', liters: 30, pricePerLiter: 60, totalCost: 1800, odometer: 1200, station: 'Shell', filledBy: 'Driver A', efficiency: null, trend: 'normal', isFullTank: false, isVoided: false },
  { id: 'fill-3', vehicleId: 'truck-b', vehicleName: 'CAK 9043', vehicleModel: 'Truck B', date: '2026-11-11', liters: 80, pricePerLiter: 62.5, totalCost: 5000, odometer: 2000, station: 'Petron', filledBy: 'Driver B', efficiency: 5, trend: 'below', isFullTank: true, isVoided: false },
  { id: 'fill-voided', vehicleId: 'truck-a', vehicleName: 'NDG 5821', vehicleModel: 'Truck A', date: '2026-11-10', liters: 500, pricePerLiter: 60, totalCost: 30000, odometer: 1100, station: 'Petron', filledBy: 'Driver A', efficiency: 1, trend: 'below', isFullTank: true, isVoided: true, voidReason: 'Duplicate entry' },
];
let currentFillUps: FuelFillUp[] = [];

const kpiValue = (label: string) => {
  const labelNode = screen.getAllByText(label, { exact: true })[0];
  return labelNode.parentElement?.querySelector('.text-2xl')?.textContent ?? '';
};
const visibleText = (text: string) => screen.getAllByText(text).filter((node) => !node.closest('[hidden]'));

describe('Fuel Management period and log filters', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.role = 'ADMIN';
    currentFillUps = fillUps.map((item) => ({ ...item }));
    vi.mocked(getFuelEntries).mockImplementation(async (from, to) => currentFillUps.filter((item) => Boolean(from && to && item.date >= from && item.date <= to)));
    vi.mocked(getFuelStations).mockResolvedValue([{ id: 'petron', name: 'Petron' }, { id: 'shell', name: 'Shell' }]);
    vi.mocked(getFuelAnomalies).mockResolvedValue([]);
    vi.mocked(getFuelAnomalyThreshold).mockResolvedValue({ thresholdPercent: 20, updatedAt: null, updatedByEmail: null });
    vi.mocked(getVehicles).mockResolvedValue([]);
    vi.mocked(recordFuelReportExport).mockResolvedValue(undefined);
    vi.mocked(voidFuelEntry).mockImplementation(async (id) => {
      const entry = currentFillUps.find((item) => item.id === id);
      if (entry) entry.isVoided = true;
      return entry as FuelFillUp;
    });
    vi.mocked(exportRowsAsXlsx).mockReset();
    vi.mocked(exportRowsToPDF).mockReset();
  });

  it('keeps KPIs and fuel log exports aligned when log filters change after a period is applied', async () => {
    const user = userEvent.setup();
    render(<FuelManagement />);

    await waitFor(() => expect(getFuelEntries).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('Fuel period'), 'monthly');
    fireEvent.change(screen.getByLabelText('Fuel month'), { target: { value: '2026-11' } });
    await user.click(screen.getByRole('button', { name: 'Apply Period' }));
    await waitFor(() => expect(getFuelEntries).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30'));
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Vehicle'), 'truck-a');
    await user.type(screen.getByLabelText('Date'), '2026-11-10');
    await user.type(screen.getByLabelText('Station'), 'Petron');
    await waitFor(() => {
      expect(kpiValue('Total Fill-ups')).toBe('1');
      expect(kpiValue('Total Liters')).toBe('100L');
      expect(kpiValue('Total Fuel Cost')).toContain('6,000');
    });

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(recordFuelReportExport).toHaveBeenCalledWith('excel', '2026-11-01', '2026-11-30'));
    expect(exportRowsAsXlsx).toHaveBeenCalledTimes(1);
    const exportedTable = vi.mocked(exportRowsAsXlsx).mock.calls[0][2];
    expect(exportedTable).toHaveLength(2);
    expect(exportedTable[1]).toEqual(expect.arrayContaining(['NDG 5821', '2026-11-10', 'Petron']));
    expect(exportedTable[1]).not.toEqual(expect.arrayContaining(['CAK 9043', 'Shell']));

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => expect(recordFuelReportExport).toHaveBeenCalledWith('pdf', '2026-11-01', '2026-11-30'));
    expect(exportRowsToPDF).toHaveBeenCalledTimes(1);
    const [pdfFilename, pdfTitle, pdfHeaders, pdfRows] = vi.mocked(exportRowsToPDF).mock.calls[0];
    expect(pdfFilename).toBe('fuel-log');
    expect(pdfTitle).toBe('Fuel Log');
    expect(pdfHeaders).toContain('Date');
    expect(pdfRows).toHaveLength(1);
    expect(pdfRows[0]).toEqual(expect.arrayContaining(['NDG 5821', '2026-11-10', 'Petron']));
    expect(pdfRows[0]).not.toEqual(expect.arrayContaining(['CAK 9043', 'Shell']));

    await user.click(screen.getByRole('button', { name: 'Efficiency Trends' }));
    expect(visibleText('NDG 5821').length).toBeGreaterThan(0);
    expect(visibleText('CAK 9043')).toHaveLength(0);
    expect(visibleText('10.0 km/L').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Fuel Log' }));
    await user.click(screen.getByRole('button', { name: /Clear all active filters/ }));
    await waitFor(() => {
      expect(kpiValue('Total Fill-ups')).toBe('3');
      expect(kpiValue('Total Liters')).toBe('210L');
    });
    expect(screen.getByText('Showing 2026-11-01 to 2026-11-30')).toBeTruthy();
  });

  it('voids a fill-up, refreshes totals, and excludes it from later exports', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.selectOptions(screen.getByLabelText('Fuel period'), 'monthly');
    fireEvent.change(screen.getByLabelText('Fuel month'), { target: { value: '2026-11' } });
    await user.click(screen.getByRole('button', { name: 'Apply Period' }));
    await waitFor(() => expect(getFuelEntries).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30'));

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Vehicle'), 'truck-a');
    await user.type(screen.getByLabelText('Date'), '2026-11-10');
    await waitFor(() => {
      expect(kpiValue('Total Fill-ups')).toBe('2');
      expect(kpiValue('Total Liters')).toBe('130L');
    });

    await user.click(screen.getAllByRole('button', { name: 'Open row actions' })[0]);
    await user.click(screen.getByRole('button', { name: /^Void$/ }));
    await user.type(screen.getByLabelText('Void reason (required)'), 'Duplicate fill-up');
    await user.click(screen.getByRole('button', { name: 'Void 1 Entry' }));

    await waitFor(() => {
      expect(voidFuelEntry).toHaveBeenCalledWith('fill-1', 'Duplicate fill-up');
      expect(kpiValue('Total Fill-ups')).toBe('1');
      expect(kpiValue('Total Liters')).toBe('30L');
      expect(kpiValue('Total Fuel Cost')).toContain('1,800');
    });

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => expect(exportRowsToPDF).toHaveBeenCalledTimes(1));
    expect(vi.mocked(exportRowsToPDF).mock.calls[0][3]).toHaveLength(1);
    expect(vi.mocked(exportRowsToPDF).mock.calls[0][3][0]).toEqual(expect.arrayContaining(['NDG 5821', '2026-11-10', 30, 'Shell']));
    expect(vi.mocked(exportRowsToPDF).mock.calls[0][3][0]).not.toEqual(expect.arrayContaining([100, 6000, 'Petron']));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(exportRowsAsXlsx).toHaveBeenCalledTimes(1));
    expect(vi.mocked(exportRowsAsXlsx).mock.calls[0][2]).toHaveLength(2);
    expect(vi.mocked(exportRowsAsXlsx).mock.calls[0][2][1]).toEqual(expect.arrayContaining(['NDG 5821', '2026-11-10', 30, 'Shell']));
    expect(vi.mocked(exportRowsAsXlsx).mock.calls[0][2][1]).not.toEqual(expect.arrayContaining([100, 6000, 'Petron']));

    expect(screen.getByText('Showing 2026-11-01 to 2026-11-30')).toBeTruthy();
  });

  it('keeps the fill-up active and reports the failure when a void request is rejected', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    vi.mocked(voidFuelEntry).mockRejectedValueOnce(new Error('Void service unavailable.'));
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.selectOptions(screen.getByLabelText('Fuel period'), 'monthly');
    fireEvent.change(screen.getByLabelText('Fuel month'), { target: { value: '2026-11' } });
    await user.click(screen.getByRole('button', { name: 'Apply Period' }));
    await waitFor(() => expect(getFuelEntries).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30'));

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.selectOptions(screen.getByLabelText('Vehicle'), 'truck-a');
    await user.type(screen.getByLabelText('Date'), '2026-11-10');
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('2'));
    const fuelEntryRequestCount = vi.mocked(getFuelEntries).mock.calls.length;

    await user.click(screen.getAllByRole('button', { name: 'Open row actions' })[0]);
    await user.click(screen.getByRole('button', { name: /^Void$/ }));
    await user.type(screen.getByLabelText('Void reason (required)'), 'Duplicate fill-up');
    await user.click(screen.getByRole('button', { name: 'Void 1 Entry' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Void service unavailable.'));
    expect(voidFuelEntry).toHaveBeenCalledWith('fill-1', 'Duplicate fill-up');
    expect(vi.mocked(getFuelEntries).mock.calls).toHaveLength(fuelEntryRequestCount);
    expect(kpiValue('Total Fill-ups')).toBe('2');
    expect(kpiValue('Total Liters')).toBe('130L');
    expect(kpiValue('Total Fuel Cost')).toContain('7,800');
  });

  it('blocks void confirmation without a reason and does not call the API', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.click(screen.getAllByRole('button', { name: 'Open row actions' })[0]);
    await user.click(screen.getByRole('button', { name: /^Void$/ }));

    const confirmButton = screen.getByRole('button', { name: 'Void 1 Entry' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    await user.click(confirmButton);

    expect(voidFuelEntry).not.toHaveBeenCalled();
    expect(kpiValue('Total Fill-ups')).toBe('3');
    expect((screen.getByLabelText('Void reason (required)') as HTMLTextAreaElement).value).toBe('');
  });

  it('bulk voids selected fill-ups with one reason and refreshes reports and exports', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.selectOptions(screen.getByLabelText('Fuel period'), 'monthly');
    fireEvent.change(screen.getByLabelText('Fuel month'), { target: { value: '2026-11' } });
    await user.click(screen.getByRole('button', { name: 'Apply Period' }));
    await waitFor(() => expect(getFuelEntries).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30'));

    const rowCheckboxes = screen.getAllByRole('checkbox');
    await user.click(rowCheckboxes[1]);
    await user.click(rowCheckboxes[2]);
    await user.click(screen.getByRole('button', { name: 'Void selected' }));
    await user.type(screen.getByLabelText('Void reason (required)'), 'Duplicate batch entry');
    await user.click(screen.getByRole('button', { name: 'Void 2 Entries' }));

    await waitFor(() => expect(voidFuelEntry).toHaveBeenCalledTimes(2));
    expect(voidFuelEntry).toHaveBeenNthCalledWith(1, 'fill-1', 'Duplicate batch entry');
    expect(voidFuelEntry).toHaveBeenNthCalledWith(2, 'fill-2', 'Duplicate batch entry');
    await waitFor(() => {
      expect(kpiValue('Total Fill-ups')).toBe('1');
      expect(kpiValue('Total Liters')).toBe('80L');
      expect(kpiValue('Total Fuel Cost')).toContain('5,000');
    });
    expect(screen.getAllByText('VOID')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(exportRowsAsXlsx).toHaveBeenCalledTimes(1));
    expect(vi.mocked(exportRowsAsXlsx).mock.calls[0][2]).toHaveLength(2);
    expect(vi.mocked(exportRowsAsXlsx).mock.calls[0][2][1]).toEqual(expect.arrayContaining(['CAK 9043', '2026-11-11', 80, 'Petron']));
  });

  it('preserves a successful first void and the remaining active data when the next bulk void fails', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    vi.mocked(voidFuelEntry).mockImplementationOnce(async (id) => {
      const entry = currentFillUps.find((item) => item.id === id)!;
      entry.isVoided = true;
      return entry;
    }).mockRejectedValueOnce(new Error('Void service unavailable for fill-2.'));
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.selectOptions(screen.getByLabelText('Fuel period'), 'monthly');
    fireEvent.change(screen.getByLabelText('Fuel month'), { target: { value: '2026-11' } });
    await user.click(screen.getByRole('button', { name: 'Apply Period' }));
    await waitFor(() => expect(getFuelEntries).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30'));

    const rowCheckboxes = screen.getAllByRole('checkbox');
    await user.click(rowCheckboxes[1]);
    await user.click(rowCheckboxes[2]);
    await user.click(screen.getByRole('button', { name: 'Void selected' }));
    await user.type(screen.getByLabelText('Void reason (required)'), 'Duplicate batch entry');
    await user.click(screen.getByRole('button', { name: 'Void 2 Entries' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Void service unavailable for fill-2.'));
    expect(voidFuelEntry).toHaveBeenNthCalledWith(1, 'fill-1', 'Duplicate batch entry');
    expect(voidFuelEntry).toHaveBeenNthCalledWith(2, 'fill-2', 'Duplicate batch entry');
    await waitFor(() => {
      expect(kpiValue('Total Fill-ups')).toBe('2');
      expect(kpiValue('Total Liters')).toBe('110L');
      expect(kpiValue('Total Fuel Cost')).toContain('6,800');
    });
    expect(screen.getByText('Showing 2026-11-01 to 2026-11-30')).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);
    expect(screen.queryByRole('heading', { name: 'Void Fuel Entry' })).toBeNull();
    expect(kpiValue('Total Fill-ups')).toBe('2');
    expect(kpiValue('Total Liters')).toBe('110L');
    expect(screen.getAllByText('VOID')).toHaveLength(2);
    const shellRow = screen.getByText('Shell').closest('tr');
    expect(shellRow?.textContent).not.toContain('VOID');
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(exportRowsAsXlsx).toHaveBeenCalledTimes(1));
    const remainingRows = vi.mocked(exportRowsAsXlsx).mock.calls[0][2];
    expect(remainingRows).toHaveLength(3);
    expect(remainingRows[1]).toEqual(expect.arrayContaining(['NDG 5821', '2026-11-10', 30, 'Shell']));
    expect(remainingRows[2]).toEqual(expect.arrayContaining(['CAK 9043', '2026-11-11', 80, 'Petron']));
    expect(remainingRows.flat()).not.toContain(100);
    expect(remainingRows.flat()).not.toContain(6000);
  });

  it('retries only the remaining fill-up after a partial bulk-void failure', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    const markVoided = async (id: string) => {
      const entry = currentFillUps.find((item) => item.id === id)!;
      entry.isVoided = true;
      return entry;
    };
    vi.mocked(voidFuelEntry)
      .mockImplementationOnce(markVoided)
      .mockRejectedValueOnce(new Error('Temporary failure on the second entry.'))
      .mockImplementationOnce(markVoided);
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.selectOptions(screen.getByLabelText('Fuel period'), 'monthly');
    fireEvent.change(screen.getByLabelText('Fuel month'), { target: { value: '2026-11' } });
    await user.click(screen.getByRole('button', { name: 'Apply Period' }));
    await waitFor(() => expect(getFuelEntries).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30'));

    const rowCheckboxes = screen.getAllByRole('checkbox');
    await user.click(rowCheckboxes[1]);
    await user.click(rowCheckboxes[2]);
    await user.click(screen.getByRole('button', { name: 'Void selected' }));
    await user.type(screen.getByLabelText('Void reason (required)'), 'Duplicate batch entry');
    await user.click(screen.getByRole('button', { name: 'Void 2 Entries' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Temporary failure on the second entry.'));
    expect(voidFuelEntry).toHaveBeenCalledTimes(2);
    expect(kpiValue('Total Fill-ups')).toBe('2');
    expect(kpiValue('Total Liters')).toBe('110L');
    expect(screen.getByRole('button', { name: 'Void 1 Entry' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Void 1 Entry' }));
    await waitFor(() => {
      expect(voidFuelEntry).toHaveBeenCalledTimes(3);
      expect(kpiValue('Total Fill-ups')).toBe('1');
      expect(kpiValue('Total Liters')).toBe('80L');
      expect(kpiValue('Total Fuel Cost')).toContain('5,000');
    });
    expect(voidFuelEntry).toHaveBeenNthCalledWith(1, 'fill-1', 'Duplicate batch entry');
    expect(voidFuelEntry).toHaveBeenNthCalledWith(2, 'fill-2', 'Duplicate batch entry');
    expect(voidFuelEntry).toHaveBeenNthCalledWith(3, 'fill-2', 'Duplicate batch entry');
  });

  it('cancels bulk-void confirmation without changing entries or calling the API', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    const requestCount = vi.mocked(getFuelEntries).mock.calls.length;
    const rowCheckboxes = screen.getAllByRole('checkbox');
    await user.click(rowCheckboxes[1]);
    await user.click(rowCheckboxes[2]);
    await user.click(screen.getByRole('button', { name: 'Void selected' }));
    expect(screen.getByRole('heading', { name: 'Void Fuel Entry' })).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!);

    expect(screen.queryByRole('heading', { name: 'Void Fuel Entry' })).toBeNull();
    expect(voidFuelEntry).not.toHaveBeenCalled();
    expect(vi.mocked(getFuelEntries).mock.calls).toHaveLength(requestCount);
    expect(kpiValue('Total Fill-ups')).toBe('3');
    expect(kpiValue('Total Liters')).toBe('210L');
    expect(screen.getByRole('button', { name: 'Void selected' })).toBeTruthy();
  });

  it('disables voided-row selection and excludes voided entries from select-all', async () => {
    const user = userEvent.setup();
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    const rowCheckboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(rowCheckboxes).toHaveLength(5);
    expect(rowCheckboxes[4].disabled).toBe(true);
    expect(rowCheckboxes[4].checked).toBe(false);

    await user.click(rowCheckboxes[0]);
    expect(rowCheckboxes.slice(1, 4).every((checkbox) => checkbox.checked)).toBe(true);
    expect(rowCheckboxes[4].checked).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Void selected' }));
    expect(screen.getByText(/Void 3 selected records/)).toBeTruthy();
    await user.type(screen.getByLabelText('Void reason (required)'), 'Approved bulk cleanup');
    await user.click(screen.getByRole('button', { name: 'Void 3 Entries' }));

    await waitFor(() => expect(voidFuelEntry).toHaveBeenCalledTimes(3));
    expect(voidFuelEntry).toHaveBeenNthCalledWith(1, 'fill-1', 'Approved bulk cleanup');
    expect(voidFuelEntry).toHaveBeenNthCalledWith(2, 'fill-2', 'Approved bulk cleanup');
    expect(voidFuelEntry).toHaveBeenNthCalledWith(3, 'fill-3', 'Approved bulk cleanup');
    expect(voidFuelEntry).not.toHaveBeenCalledWith('fill-voided', 'Approved bulk cleanup');
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('0'));
  });

  it('does not expose single-row or bulk void controls to Admin users', async () => {
    const user = userEvent.setup();
    authMock.role = 'ADMIN';
    render(<FuelManagement />);

    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    expect(document.querySelectorAll('#fuel-log-table input[type="checkbox"]')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Void selected' })).toBeNull();
    await user.click(screen.getAllByRole('button', { name: 'Open row actions' })[0]);
    expect(screen.queryByRole('button', { name: /^Void$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
  });

  it('keeps Admin and Operations fuel controls within their outline permissions', async () => {
    const anomaly = {
      id: 'anomaly-critical',
      vehicle: { plateNumber: 'NDG 5821', model: 'Truck A' },
      efficiency: 5,
      rollingAverage: 10,
      status: 'OPEN',
      severity: 'CRITICAL',
      note: null,
      acknowledgedAt: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      fillUp: { date: '2026-11-01', station: { name: 'Petron' } },
    };
    vi.mocked(getFuelAnomalies).mockResolvedValue([anomaly]);
    authMock.role = 'ADMIN';
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));

    expect(screen.getByRole('button', { name: 'Save threshold' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Configure fuel stations' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log Fill-up' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Anomaly Detection' }));
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();

    cleanup();
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    expect(screen.queryByRole('button', { name: 'Save threshold' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure fuel stations' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log Fill-up' })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Anomaly Detection' }));
    expect(screen.getByRole('button', { name: 'Save note' })).toBeTruthy();
    expect(screen.getByText(/Attach report.*max 10 MB/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();

    vi.mocked(getFuelAnomalies).mockResolvedValue([{ ...anomaly, acknowledgedAt: '2026-11-10T00:00:00.000Z' }]);
    cleanup();
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Anomaly Detection' }));
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).toBeNull();
  });

  it('shows the 10 MB upload limit and handles oversized report selections and server responses', async () => {
    const user = userEvent.setup();
    const anomaly = {
      id: 'anomaly-escalated',
      vehicle: { plateNumber: 'NDG 5821', model: 'Truck A' },
      efficiency: 5,
      rollingAverage: 10,
      status: 'OPEN',
      severity: 'ESCALATED',
      note: null,
      acknowledgedAt: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      fillUp: { date: '2026-11-01', station: { name: 'Petron' } },
    };
    authMock.role = 'OPERATIONS';
    vi.mocked(getFuelAnomalies).mockResolvedValue([anomaly]);
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.click(screen.getByRole('button', { name: 'Anomaly Detection' }));

    expect(screen.getByText(/Attach report \(PDF, JPG, PNG; max 10 MB\)/)).toBeTruthy();
    const fileInput = screen.getByLabelText('Attach fuel anomaly report (PDF, JPG, or PNG, max 10 MB)');
    const exactLimitFile = new File(['pdf'], 'maximum-size.pdf', { type: 'application/pdf' });
    Object.defineProperty(exactLimitFile, 'size', { value: 10 * 1024 * 1024 });
    vi.mocked(uploadFuelAnomalyAttachment).mockResolvedValueOnce({} as never);
    await user.upload(fileInput, exactLimitFile);

    await waitFor(() => expect(uploadFuelAnomalyAttachment).toHaveBeenCalledWith('anomaly-escalated', exactLimitFile));
    expect(screen.queryByRole('alert')).toBeNull();

    const oversizedFile = new File(['pdf'], 'too-large.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: 10 * 1024 * 1024 + 1 });
    await user.upload(fileInput, oversizedFile);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Fuel anomaly reports must be 10 MB or smaller.'));
    expect(uploadFuelAnomalyAttachment).toHaveBeenCalledTimes(1);

    vi.mocked(uploadFuelAnomalyAttachment).mockRejectedValueOnce(Object.assign(new Error('File too large'), { status: 413 }));
    const smallFile = new File(['pdf'], 'server-rejected.pdf', { type: 'application/pdf' });
    await user.upload(fileInput, smallFile);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Fuel anomaly reports must be 10 MB or smaller.'));
    expect(uploadFuelAnomalyAttachment).toHaveBeenCalledTimes(2);
    expect(uploadFuelAnomalyAttachment).toHaveBeenLastCalledWith('anomaly-escalated', smallFile);
  });

  it('refreshes an anomaly after report upload and exposes the attachment for download', async () => {
    const user = userEvent.setup();
    const anomaly = {
      id: 'anomaly-report',
      vehicle: { plateNumber: 'NDG 5821', model: 'Truck A' },
      efficiency: 5,
      rollingAverage: 10,
      status: 'OPEN',
      severity: 'ESCALATED',
      note: 'Reviewing high fuel consumption.',
      acknowledgedAt: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      fillUp: { date: '2026-11-01', station: { name: 'Petron' } },
    };
    let attachments: Array<{ id: string; name: string; contentType: string; createdAt: string }> = [];
    vi.mocked(getFuelAnomalies).mockImplementation(async () => [{ ...anomaly, attachments }]);
    vi.mocked(uploadFuelAnomalyAttachment).mockImplementation(async (_anomalyId, file) => {
      attachments = [{ id: 'attachment-report', name: file.name, contentType: file.type, createdAt: '2026-11-13T00:00:00.000Z' }];
      return { ...anomaly, attachments };
    });
    vi.mocked(getFuelAnomalyAttachment).mockResolvedValue(new Blob(['report contents'], { type: 'application/pdf' }));
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    const anomalyLoadCount = vi.mocked(getFuelAnomalies).mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Anomaly Detection' }));

    const file = new File(['report contents'], 'inspection-report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Attach fuel anomaly report (PDF, JPG, or PNG, max 10 MB)'), file);

    await waitFor(() => {
      expect(uploadFuelAnomalyAttachment).toHaveBeenCalledWith('anomaly-report', file);
      expect(vi.mocked(getFuelAnomalies).mock.calls.length).toBeGreaterThan(anomalyLoadCount);
      expect(screen.getByRole('button', { name: 'inspection-report.pdf' })).toBeTruthy();
    });

    const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const createObjectURL = vi.fn(() => 'blob:inspection-report');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await user.click(screen.getByRole('button', { name: 'inspection-report.pdf' }));

    expect(getFuelAnomalyAttachment).toHaveBeenCalledWith('anomaly-report', 'attachment-report');
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:inspection-report');
    if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
    else delete (URL as Partial<typeof URL>).createObjectURL;
    if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    else delete (URL as Partial<typeof URL>).revokeObjectURL;
    anchorClick.mockRestore();
  });

  it('keeps existing attachments visible and shows the server error when report upload fails', async () => {
    const user = userEvent.setup();
    const anomaly = {
      id: 'anomaly-failed-report',
      vehicle: { plateNumber: 'NDG 5821', model: 'Truck A' },
      efficiency: 5,
      rollingAverage: 10,
      status: 'OPEN',
      severity: 'ESCALATED',
      note: 'Reviewing high fuel consumption.',
      acknowledgedAt: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      attachments: [{ id: 'existing-report', name: 'existing-report.pdf', contentType: 'application/pdf', createdAt: '2026-11-02T00:00:00.000Z' }],
      fillUp: { date: '2026-11-01', station: { name: 'Petron' } },
    };
    vi.mocked(getFuelAnomalies).mockResolvedValue([anomaly]);
    vi.mocked(uploadFuelAnomalyAttachment).mockRejectedValueOnce(new Error('Storage temporarily unavailable.'));
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.click(screen.getByRole('button', { name: 'Anomaly Detection' }));
    expect(screen.getByRole('button', { name: 'existing-report.pdf' })).toBeTruthy();
    const anomalyLoadCount = vi.mocked(getFuelAnomalies).mock.calls.length;

    const file = new File(['new report'], 'new-report.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Attach fuel anomaly report (PDF, JPG, or PNG, max 10 MB)'), file);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Storage temporarily unavailable.'));
    expect(uploadFuelAnomalyAttachment).toHaveBeenCalledWith('anomaly-failed-report', file);
    expect(vi.mocked(getFuelAnomalies).mock.calls).toHaveLength(anomalyLoadCount);
    expect(screen.getByRole('button', { name: 'existing-report.pdf' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'new-report.pdf' })).toBeNull();
  });

  it('rejects unsupported report extensions and MIME types before calling the API', async () => {
    const anomaly = {
      id: 'anomaly-unsupported-report',
      vehicle: { plateNumber: 'NDG 5821', model: 'Truck A' },
      efficiency: 5,
      rollingAverage: 10,
      status: 'OPEN',
      severity: 'ESCALATED',
      note: null,
      acknowledgedAt: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      attachments: [{ id: 'existing-report', name: 'existing-report.pdf', contentType: 'application/pdf', createdAt: '2026-11-02T00:00:00.000Z' }],
      fillUp: { date: '2026-11-01', station: { name: 'Petron' } },
    };
    vi.mocked(getFuelAnomalies).mockResolvedValue([anomaly]);
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Anomaly Detection' }));
    const anomalyLoadCount = vi.mocked(getFuelAnomalies).mock.calls.length;
    const fileInput = screen.getByLabelText('Attach fuel anomaly report (PDF, JPG, or PNG, max 10 MB)');
    const unsupportedExtension = new File(['unsupported report'], 'report.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    fireEvent.change(fileInput, { target: { files: [unsupportedExtension] } });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Choose a PDF, JPG, or PNG report.'));
    expect(uploadFuelAnomalyAttachment).not.toHaveBeenCalled();

    const invalidMimeType = new File(['not a pdf'], 'report.pdf', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [invalidMimeType] } });

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Choose a PDF, JPG, or PNG report.'));
    expect(uploadFuelAnomalyAttachment).not.toHaveBeenCalled();
    expect(vi.mocked(getFuelAnomalies).mock.calls).toHaveLength(anomalyLoadCount);
    expect(screen.getByRole('button', { name: 'existing-report.pdf' })).toBeTruthy();
  });

  it.each([
    ['report.pdf', 'application/pdf'],
    ['report.jpg', 'image/jpeg'],
    ['report.jpeg', 'image/jpeg'],
    ['report.png', 'image/png'],
  ])('allows valid report file %s through client validation', async (filename, mimeType) => {
    const user = userEvent.setup();
    const anomaly = {
      id: `anomaly-${filename}`,
      vehicle: { plateNumber: 'NDG 5821', model: 'Truck A' },
      efficiency: 5,
      rollingAverage: 10,
      status: 'OPEN',
      severity: 'ESCALATED',
      note: null,
      acknowledgedAt: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      fillUp: { date: '2026-11-01', station: { name: 'Petron' } },
    };
    vi.mocked(getFuelAnomalies).mockResolvedValue([anomaly]);
    vi.mocked(uploadFuelAnomalyAttachment).mockResolvedValue({} as never);
    authMock.role = 'OPERATIONS';
    render(<FuelManagement />);
    await waitFor(() => expect(kpiValue('Total Fill-ups')).toBe('3'));
    await user.click(screen.getByRole('button', { name: 'Anomaly Detection' }));
    const file = new File(['valid report'], filename, { type: mimeType });

    await user.upload(screen.getByLabelText('Attach fuel anomaly report (PDF, JPG, or PNG, max 10 MB)'), file);

    await waitFor(() => expect(uploadFuelAnomalyAttachment).toHaveBeenCalledWith(anomaly.id, file));
  });
});
