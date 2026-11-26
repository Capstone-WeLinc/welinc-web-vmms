import { apiRequest, fetchJSON } from './httpClient';
import type { FuelFillUp } from '../../pages/FuelManagement/types';

export type FuelStation = { id: string; name: string };
export type FuelStationManagement = FuelStation & { isActive: boolean };
export type FuelStationUpdate = Partial<
  Pick<FuelStationManagement, 'name' | 'isActive'>
>;
export type FuelFillUpInput = {
  vehicleId: string;
  stationId: string;
  date: string;
  liters: number;
  pricePerLiter: number;
  odometer: number;
  filledBy: string;
  isFullTank: boolean;
  poNumber?: string;
  siNumber?: string;
  product?: string;
};
export type FuelImportRow = {
  key: string;
  sheetName: string;
  worksheetRow: number;
  plateNumber: string;
  date: string;
  odometer: number | null;
  poNumber: string;
  siNumber: string;
  product: string;
  liters: number | null;
  pricePerLiter: number | null;
  vehicleId: string | null;
  stationId: string;
  filledBy: string;
  isFullTank: boolean | null;
  errors: string[];
  status: 'READY' | 'SAVED' | 'ERROR';
  fillUpId?: string;
  totalCost?: number;
};
export type FuelImportResult = {
  saved: number;
  failed: number;
  rows: FuelImportRow[];
};
export type FuelImportDraft = {
  id: string;
  sourceName: string;
  rows: FuelImportRow[];
  createdAt: string;
  updatedAt: string;
};
export type FuelImportDraftSummary = Pick<
  FuelImportDraft,
  'id' | 'sourceName' | 'updatedAt'
> & {
  rowCount: number;
  sheetNames: string[];
};
export type FuelReceiptSuggestion<T> = {
  value: T | null;
  confidence: number | null;
  needsReview: boolean;
};
export type FuelReceiptScanResult = {
  merchantName: FuelReceiptSuggestion<string>;
  date: FuelReceiptSuggestion<string>;
  liters: FuelReceiptSuggestion<number>;
  pricePerLiter: FuelReceiptSuggestion<number>;
  printedTotal: FuelReceiptSuggestion<number>;
  product: FuelReceiptSuggestion<string>;
  siNumber: FuelReceiptSuggestion<string>;
};
export type FuelAnomalyThreshold = { thresholdPercent: number; updatedAt: string | null; updatedByEmail: string | null };
export type FuelVehicle = { id: string; value: string; plateNumber?: string; label: string; model?: string };
export type FuelAnomalyRecord = { id: string; vehicle: { plateNumber: string; model: string }; efficiency: number; rollingAverage: number; status: string; severity: string; note: string | null; acknowledgedAt: string | null; createdAt: string; attachments?: Array<{ id: string; name: string; contentType: string; createdAt: string }>; fillUp: { date: string; station: { name: string } } };
export type FuelReport = { entries: FuelFillUp[]; summaries: Array<{ vehicleId: string; vehicleName: string; model: string; totalFillUps: number; totalLiters: number; totalCost: number; averageEfficiency: number | null; anomalyCount: number }>; totals: { totalFillUps: number; totalLiters: number; totalCost: number; anomalyCount: number } };

export const getFuelEntries = (from?: string, to?: string) => {
  const query = new URLSearchParams(); if (from) query.set('from', from); if (to) query.set('to', to);
  return fetchJSON<FuelFillUp[]>(`/fuel${query.size ? `?${query}` : ''}`);
};
export const getFuelStations = () => fetchJSON<FuelStation[]>('/fuel/stations');
export const getFuelStationManagement = () =>
  fetchJSON<FuelStationManagement[]>('/fuel/stations/management');
export const getFuelAnomalyThreshold = () => fetchJSON<FuelAnomalyThreshold>('/fuel/anomaly-threshold');
export const updateFuelAnomalyThreshold = (thresholdPercent: number) => fetchJSON<FuelAnomalyThreshold>('/fuel/anomaly-threshold', { method: 'PATCH', body: JSON.stringify({ thresholdPercent }) });
export const createFuelStation = (name: string) => fetchJSON<FuelStationManagement>('/fuel/stations', { method: 'POST', body: JSON.stringify({ name }) });
export const updateFuelStation = (id: string, update: FuelStationUpdate) =>
  fetchJSON<FuelStationManagement>(`/fuel/stations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
export const previewFuelImport = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<{ rows: FuelImportRow[]; sheets: string[]; skippedSheets: string[] }>(
    '/fuel/import/preview',
    { method: 'POST', body: form },
  );
};
export const listFuelImportDrafts = () =>
  fetchJSON<FuelImportDraftSummary[]>('/fuel/import/drafts');
export const getFuelImportDraft = (id: string) =>
  fetchJSON<FuelImportDraft>(
    `/fuel/import/drafts/${encodeURIComponent(id)}`,
  );
export const createFuelImportDraft = (
  sourceName: string,
  rows: FuelImportRow[],
) =>
  fetchJSON<FuelImportDraft>('/fuel/import/drafts', {
    method: 'POST',
    body: JSON.stringify({ sourceName, rows }),
  });
export const updateFuelImportDraft = (
  id: string,
  sourceName: string,
  rows: FuelImportRow[],
) =>
  fetchJSON<FuelImportDraft>(
    `/fuel/import/drafts/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sourceName, rows }),
    },
  );
export const deleteFuelImportDraft = (id: string) =>
  fetchJSON<{ deleted: boolean }>(
    `/fuel/import/drafts/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
export const saveFuelImport = (rows: FuelImportRow[]) =>
  fetchJSON<FuelImportResult>('/fuel/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
export const scanFuelReceipt = (file: File, signal?: AbortSignal) => {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<FuelReceiptScanResult>('/fuel/receipt/scan', { method: 'POST', body: form, signal });
};
export const createFuelEntry = (input: FuelFillUpInput, receipt?: File) => {
  if (!receipt) return fetchJSON<FuelFillUp>('/fuel', { method: 'POST', body: JSON.stringify(input) });
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => form.append(key, String(value)));
  form.append('file', receipt);
  return apiRequest<FuelFillUp>('/fuel/with-receipt', { method: 'POST', body: form });
};
export const getFuelReceiptAttachment = (fillUpId: string) => apiRequest<Blob>(`/fuel/${fillUpId}/receipt`);
export const voidFuelEntry = (id: string, reason: string) => fetchJSON<FuelFillUp>(`/fuel/${id}/void`, { method: 'POST', body: { reason } as unknown as BodyInit });
export const getFuelAnomalies = () => fetchJSON<FuelAnomalyRecord[]>('/fuel/anomalies');
export const updateFuelAnomaly = (id: string, note?: string) => fetchJSON<FuelAnomalyRecord>(`/fuel/anomalies/${id}`, { method: 'PATCH', body: JSON.stringify(note === undefined ? {} : { note }) });
export const acknowledgeFuelAnomaly = (id: string, remark?: string) => fetchJSON<FuelAnomalyRecord>(`/fuel/anomalies/${id}/acknowledge`, { method: 'POST', body: JSON.stringify({ remark }) });
export const uploadFuelAnomalyAttachment = (id: string, file: File) => { const form = new FormData(); form.append('file', file); return apiRequest<FuelAnomalyRecord>(`/fuel/anomalies/${id}/attachments`, { method: 'POST', body: form }); };
export const getFuelAnomalyAttachment = (id: string, attachmentId: string) => apiRequest<Blob>(`/fuel/anomalies/${id}/attachments/${attachmentId}`);
export const getFuelReport = (from?: string, to?: string) => {
  const query = new URLSearchParams(); if (from) query.set('from', from); if (to) query.set('to', to);
  return fetchJSON<FuelReport>(`/fuel/report${query.size ? `?${query}` : ''}`);
};
export const recordFuelReportExport = (format: string, from?: string, to?: string) => fetchJSON<void>('/fuel/report/export', { method: 'POST', body: JSON.stringify({ format, from, to }) });
