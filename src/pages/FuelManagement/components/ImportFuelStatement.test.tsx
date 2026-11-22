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
import type { FuelImportDraft } from '../../../lib/api/fuelService';

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

const renderImport = () =>
  render(
    <ImportFuelStatement
      stations={[]}
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
});
