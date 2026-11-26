// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportFuelStatement from './ImportFuelStatement';
import {
  createFuelImportDraft,
  deleteFuelImportDraft,
  getFuelImportDraft,
  listFuelImportDrafts,
  previewFuelImport,
  saveFuelImport,
  updateFuelImportDraft,
} from '../../../lib/api/fuelService';
import type { FuelImportDraft, FuelImportRow } from '../../../lib/api/fuelService';

const api = vi.hoisted(() => ({
  createFuelImportDraft: vi.fn(),
  deleteFuelImportDraft: vi.fn(),
  getFuelImportDraft: vi.fn(),
  listFuelImportDrafts: vi.fn(),
  previewFuelImport: vi.fn(),
  saveFuelImport: vi.fn(),
  updateFuelImportDraft: vi.fn(),
}));

vi.mock('../../../lib/api/fuelService', () => api);
vi.mock('../../../lib/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

const savedDraft: FuelImportDraft = {
  id: 'draft-id',
  sourceName: 'fuel.xlsx',
  rows: [
    {
      key: 'saved-row',
      sheetName: 'Fuel',
      worksheetRow: 2,
      plateNumber: 'ABC 123',
      date: '2026-11-20',
      odometer: 1000,
      poNumber: '',
      siNumber: 'SI-1',
      product: 'Diesel',
      liters: 10,
      pricePerLiter: 60,
      vehicleId: 'vehicle-id',
      stationId: 'station-id',
      filledBy: '',
      isFullTank: true,
      errors: [],
      status: 'SAVED',
      fillUpId: 'fill-up-id',
    },
  ],
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
};

const makeReadyRow = (
  key: string,
  sheetName: string,
  worksheetRow: number,
  stationId: string,
  liters: number,
  pricePerLiter: number,
): FuelImportRow => ({
  key,
  sheetName,
  worksheetRow,
  plateNumber: 'ABC 123',
  date: '2026-11-20',
  odometer: 1000 + worksheetRow,
  poNumber: '',
  siNumber: `SI-${worksheetRow}`,
  product: 'Diesel',
  liters,
  pricePerLiter,
  vehicleId: 'vehicle-id',
  stationId,
  filledBy: '',
  isFullTank: true,
  errors: [],
  status: 'READY',
});

const stations = [
  { id: 'station-id', name: 'Station A' },
  { id: 'other-station-id', name: 'Station B' },
];

const renderImport = () =>
  render(
    <ImportFuelStatement
      stations={stations}
      vehicles={[]}
      onClose={vi.fn()}
      onImported={vi.fn()}
    />,
  );

describe('Fuel import row removal confirmation', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listFuelImportDrafts).mockResolvedValue([]);
    vi.mocked(createFuelImportDraft).mockResolvedValue(savedDraft);
    vi.mocked(deleteFuelImportDraft).mockResolvedValue({ deleted: true });
    vi.mocked(getFuelImportDraft).mockResolvedValue(savedDraft);
    vi.mocked(previewFuelImport).mockResolvedValue({
      rows: [],
      sheets: [],
      skippedSheets: [],
    });
    vi.mocked(saveFuelImport).mockResolvedValue({
      saved: 0,
      failed: 0,
      rows: [],
    });
    vi.mocked(updateFuelImportDraft).mockResolvedValue(savedDraft);
  });

  it('keeps an unsaved row when cancelled and removes it only after confirmation', async () => {
    const user = userEvent.setup();
    renderImport();

    await waitFor(() =>
      expect(screen.queryByText('Loading saved drafts…')).toBeNull(),
    );
    await user.click(screen.getByRole('button', { name: 'Add manual row' }));
    expect(screen.getByText('Manually added · row 1')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove row' }));
    expect(screen.getByText(/Remove Manually added row 1 from this unsaved import/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Manually added · row 1')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove row' }));
    const removeButtons = screen.getAllByRole('button', { name: 'Remove row' });
    await user.click(removeButtons[removeButtons.length - 1]);
    await waitFor(() =>
      expect(screen.queryByText('Manually added · row 1')).toBeNull(),
    );
  });

  it('does not expose removal for a saved fill-up row', async () => {
    const user = userEvent.setup();
    vi.mocked(listFuelImportDrafts).mockResolvedValue([
      {
        id: savedDraft.id,
        sourceName: savedDraft.sourceName,
        rowCount: savedDraft.rows.length,
        sheetNames: ['Fuel'],
        updatedAt: savedDraft.updatedAt,
      },
    ]);
    vi.mocked(getFuelImportDraft).mockResolvedValue(savedDraft);
    renderImport();

    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    await screen.findByText('Fuel · row 2');
    expect(screen.queryByRole('button', { name: 'Remove row' })).toBeNull();
  });

  it('reconciles all successful import rows by worksheet and station', async () => {
    const rows = [
      makeReadyRow('fuel-2', 'Fuel', 2, 'station-id', 10, 60),
      makeReadyRow('other-2', 'Other', 2, 'other-station-id', 2, 50),
    ];
    const draft = { ...savedDraft, rows };
    vi.mocked(listFuelImportDrafts).mockResolvedValue([
      {
        id: draft.id,
        sourceName: draft.sourceName,
        rowCount: rows.length,
        sheetNames: ['Fuel', 'Other'],
        updatedAt: draft.updatedAt,
      },
    ]);
    vi.mocked(getFuelImportDraft).mockResolvedValue(draft);
    vi.mocked(saveFuelImport).mockResolvedValue({
      saved: 2,
      failed: 0,
      rows: [
        { ...rows[0], status: 'SAVED', errors: [], fillUpId: 'fill-2', totalCost: 635.88 },
        { ...rows[1], status: 'SAVED', errors: [], fillUpId: 'other-fill', totalCost: 100 },
      ],
    });

    const user = userEvent.setup();
    renderImport();
    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    await user.click(await screen.findByRole('button', { name: 'Save ready rows (2)' }));

    const summary = await screen.findByRole('region', {
      name: 'Import reconciliation summary',
    });
    expect(summary.textContent).toContain('Submitted rows2');
    expect(summary.textContent).toContain('Saved rows2');
    expect(summary.textContent).toContain('Failed rows0');
    expect(summary.textContent).toContain('12 L');
    expect(summary.textContent).toContain('₱735.88');
    expect(summary.textContent).toContain('Fuel · Station A: 1 saved, 0 failed · 10 L · ₱635.88');
    expect(summary.textContent).toContain('Other · Station B: 1 saved, 0 failed · 2 L · ₱100.00');
    expect(screen.queryByText(/Failed rows excluded from totals/)).toBeNull();
  });

  it('excludes failed rows from persisted totals while retaining their row errors', async () => {
    const rows = [
      makeReadyRow('fuel-2', 'Fuel', 2, 'station-id', 10, 60),
      makeReadyRow('fuel-3', 'Fuel', 3, 'station-id', 9000, 70),
      makeReadyRow('other-2', 'Other', 2, 'other-station-id', 2, 50),
    ];
    const draft = { ...savedDraft, rows };
    vi.mocked(listFuelImportDrafts).mockResolvedValue([
      {
        id: draft.id,
        sourceName: draft.sourceName,
        rowCount: rows.length,
        sheetNames: ['Fuel', 'Other'],
        updatedAt: draft.updatedAt,
      },
    ]);
    vi.mocked(getFuelImportDraft).mockResolvedValue(draft);
    vi.mocked(saveFuelImport).mockResolvedValue({
      saved: 2,
      failed: 1,
      rows: [
        { ...rows[0], status: 'SAVED', errors: [], fillUpId: 'fill-2', totalCost: 635.88 },
        { ...rows[1], status: 'ERROR', errors: ['Invalid odometer reading.'] },
        { ...rows[2], status: 'SAVED', errors: [], fillUpId: 'other-fill', totalCost: 100 },
      ],
    });

    const user = userEvent.setup();
    renderImport();
    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    await user.click(await screen.findByRole('button', { name: 'Save ready rows (3)' }));

    const summary = await screen.findByRole('region', {
      name: 'Import reconciliation summary',
    });
    expect(summary.textContent).toContain('Submitted rows3');
    expect(summary.textContent).toContain('Saved rows2');
    expect(summary.textContent).toContain('Failed rows1');
    expect(summary.textContent).toContain('12 L');
    expect(summary.textContent).toContain('₱735.88');
    expect(summary.textContent).toContain('Fuel · Station A: 1 saved, 1 failed · 10 L · ₱635.88');
    expect(summary.textContent).toContain('Fuel · row 3: Invalid odometer reading.');
    expect(summary.textContent).not.toContain('9000 L');
    expect(summary.textContent).not.toContain('₱630,000.00');
    expect(screen.getByText('Invalid odometer reading.')).toBeTruthy();
    await waitFor(() => expect(updateFuelImportDraft).toHaveBeenCalled());
    const persistedRows = vi.mocked(updateFuelImportDraft).mock.calls.at(-1)?.[2];
    expect(persistedRows?.every((row) => !('totalCost' in row))).toBe(true);
  });
});
