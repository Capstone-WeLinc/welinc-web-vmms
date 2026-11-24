import { fetchJSON } from './httpClient';

export type SettingsCatalogEntry = {
  key: 'fuel_anomaly_threshold_percent' | 'maintenance_cost_threshold';
  label: string;
  description: string;
  unit: 'percent' | 'PHP';
  valueType: 'decimal';
  defaultValue: number | null;
  currentValue: number | null;
  effectiveValue: number | null;
  updatedAt: string | null;
  constraints: {
    min: number;
    max: number;
    maxDecimalPlaces: number;
    nullableBeforeFirstSet?: boolean;
  };
  editable: boolean;
};

export const getSettingsCatalog = () =>
  fetchJSON<SettingsCatalogEntry[]>('/settings/catalog');

export const updateSettingsCatalog = (key: string, value: number) =>
  fetchJSON<SettingsCatalogEntry[]>(`/settings/catalog/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
