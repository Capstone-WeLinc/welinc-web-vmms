import { apiRequest, fetchJSON } from './httpClient';
import type { FuelFillUp } from '../../pages/FuelManagement/types';

export type FuelStation = { id: string; name: string };
export type FuelAnomalyThreshold = { thresholdPercent: number; updatedAt: string | null; updatedByEmail: string | null };
export type FuelVehicle = { id: string; value: string; plateNumber?: string; label: string; model?: string };
export type FuelAnomalyRecord = { id: string; vehicle: { plateNumber: string; model: string }; efficiency: number; rollingAverage: number; status: string; severity: string; note: string | null; acknowledgedAt: string | null; createdAt: string; attachments?: Array<{ id: string; name: string; contentType: string; createdAt: string }>; fillUp: { date: string; station: { name: string } } };
export type FuelReport = { entries: FuelFillUp[]; summaries: Array<{ vehicleId: string; vehicleName: string; model: string; totalFillUps: number; totalLiters: number; totalCost: number; averageEfficiency: number | null; anomalyCount: number }>; totals: { totalFillUps: number; totalLiters: number; totalCost: number; anomalyCount: number } };

export const getFuelEntries = (from?: string, to?: string) => {
  const query = new URLSearchParams(); if (from) query.set('from', from); if (to) query.set('to', to);
  return fetchJSON<FuelFillUp[]>(`/fuel${query.size ? `?${query}` : ''}`);
};
export const getFuelStations = () => fetchJSON<FuelStation[]>('/fuel/stations');
export const getFuelAnomalyThreshold = () => fetchJSON<FuelAnomalyThreshold>('/fuel/anomaly-threshold');
export const updateFuelAnomalyThreshold = (thresholdPercent: number) => fetchJSON<FuelAnomalyThreshold>('/fuel/anomaly-threshold', { method: 'PATCH', body: JSON.stringify({ thresholdPercent }) });
export const createFuelStation = (name: string) => fetchJSON<FuelStation>('/fuel/stations', { method: 'POST', body: JSON.stringify({ name }) });
export const createFuelEntry = (input: unknown) => fetchJSON<FuelFillUp>('/fuel', { method: 'POST', body: JSON.stringify(input) });
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
