import type {
  FuelFillUp,
  VehicleEfficiency,
  FuelAnomaly,
  AnomalyLog,
} from "../../pages/FuelManagement/types";

export const mockFuelFillUps: FuelFillUp[] = [
  {
    id: '1',
    vehicleId: 'TRK-0011',
    vehicleName: 'TRK-0011',
    vehicleModel: 'Isuzu NPR75',
    date: '2026-03-28',
    liters: 65,
    pricePerLiter: 65.5,
    totalCost: 4258,
    odometer: 85420,
    station: 'Petron EDSA',
    filledBy: 'Juan Dela Cruz',
    efficiency: 8.2,
    trend: 'above'
  },
  {
    id: '2',
    vehicleId: 'TRK-0011',
    vehicleName: 'TRK-0011',
    vehicleModel: 'Isuzu NPR75',
    date: '2026-03-14',
    liters: 61.5,
    pricePerLiter: 65.5,
    totalCost: 4028,
    odometer: 84120,
    station: 'Shell CS',
    filledBy: 'Juan Dela Cruz',
    efficiency: 8.1,
    trend: 'above'
  },
  {
    id: '3',
    vehicleId: 'TRK-0022',
    vehicleName: 'TRK-0022',
    vehicleModel: 'Hino 300 Series',
    date: '2026-03-26',
    liters: 55,
    pricePerLiter: 66.2,
    totalCost: 3641,
    odometer: 62300,
    station: 'Caltex Makati',
    filledBy: 'Pedro Santos',
    efficiency: 9.4,
    trend: 'above'
  },
  {
    id: '4',
    vehicleId: 'TRK-0022',
    vehicleName: 'TRK-0022',
    vehicleModel: 'Hino 300 Series',
    date: '2026-03-12',
    liters: 53,
    pricePerLiter: 66,
    totalCost: 3498,
    odometer: 61080,
    station: 'Petron Quezon',
    filledBy: 'Pedro Santos',
    efficiency: 9.2,
    trend: 'above'
  },
];

export const mockVehicleEfficiency: VehicleEfficiency[] = [
  { vehicleId: 'TRK-0055', vehicleName: 'TRK-0055', model: 'Ford Transit Van', avgEfficiency: 11.5, fillUps: 1, trend: 'above' },
  { vehicleId: 'TRK-0044', vehicleName: 'TRK-0044', model: 'Isuzu ELF 350', avgEfficiency: 10.2, fillUps: 1, trend: 'above' },
  { vehicleId: 'TRK-0022', vehicleName: 'TRK-0022', model: 'Hino 300 Series', avgEfficiency: 9.3, fillUps: 2, trend: 'above' },
  { vehicleId: 'TRK-0077', vehicleName: 'TRK-0077', model: 'Mitsubishi L300', avgEfficiency: 9.1, fillUps: 1, trend: 'above' },
  { vehicleId: 'TRK-0011', vehicleName: 'TRK-0011', model: 'Isuzu NPR75', avgEfficiency: 8.1, fillUps: 3, trend: 'above' },
  { vehicleId: 'TRK-0088', vehicleName: 'TRK-0088', model: 'Isuzu NQR 75', avgEfficiency: 7.6, fillUps: 1, trend: 'above' },
  { vehicleId: 'TRK-0033', vehicleName: 'TRK-0033', model: 'Mitsubishi Fuso Center', avgEfficiency: 6.8, fillUps: 1, trend: 'below' },
  { vehicleId: 'TRK-0066', vehicleName: 'TRK-0066', model: 'Hino 500 Series', avgEfficiency: 5.8, fillUps: 2, trend: 'below' }
];

export const mockAnomalies: FuelAnomaly[] = [
  { vehicleId: 'TRK-0011', vehicleName: 'TRK-0011', model: 'Isuzu NPR75', efficiency: 8.1, status: 'Normal', fleetAvg: 8.3, recommendation: '' },
  { vehicleId: 'TRK-0022', vehicleName: 'TRK-0022', model: 'Hino 300 Series', efficiency: 9.3, status: 'Normal', fleetAvg: 8.3, recommendation: '' },
  { vehicleId: 'TRK-0033', vehicleName: 'TRK-0033', model: 'Mitsubishi Fuso Center', efficiency: 6.8, status: 'Anomaly', fleetAvg: 8.3, recommendation: 'Significantly different from fleet average. Recommend mechanical inspection.' },
  { vehicleId: 'TRK-0044', vehicleName: 'TRK-0044', model: 'Isuzu ELF 350', efficiency: 10.2, status: 'Normal', fleetAvg: 8.3, recommendation: '' },
  { vehicleId: 'TRK-0055', vehicleName: 'TRK-0055', model: 'Ford Transit Van', efficiency: 11.5, status: 'Anomaly', fleetAvg: 8.3, recommendation: 'Significantly different from fleet average. Recommend mechanical inspection.' },
  { vehicleId: 'TRK-0066', vehicleName: 'TRK-0066', model: 'Hino 500 Series', efficiency: 5.8, status: 'Anomaly', fleetAvg: 8.3, recommendation: 'Significantly different from fleet average. Recommend mechanical inspection.' },
  { vehicleId: 'TRK-0077', vehicleName: 'TRK-0077', model: 'Mitsubishi L300', efficiency: 9.1, status: 'Normal', fleetAvg: 8.3, recommendation: '' },
  { vehicleId: 'TRK-0088', vehicleName: 'TRK-0088', model: 'Isuzu NQR 75', efficiency: 7.6, status: 'Below Avg', fleetAvg: 8.3, recommendation: 'Below fleet average. Monitor for potential issues.' }
];

export const mockAnomalyLogs: AnomalyLog[] = [
  { id: '1', timestamp: '2026-03-26 14:32', vehicleId: 'TRK-0066', vehicleName: 'TRK-0066', model: 'Hino 500 Series', vehicleEfficiency: 5.9, fleetAverage: 8.3, alertType: 'Anomaly', detectedBy: 'System' },
  { id: '2', timestamp: '2026-03-20 09:15', vehicleId: 'TRK-0033', vehicleName: 'TRK-0033', model: 'Mitsubishi Fuso Center', vehicleEfficiency: 6.8, fleetAverage: 8.3, alertType: 'Below Avg', detectedBy: 'System' },
  { id: '3', timestamp: '2026-03-18 11:44', vehicleId: 'TRK-0055', vehicleName: 'TRK-0055', model: 'Ford Transit Van', vehicleEfficiency: 11.5, fleetAverage: 8.3, alertType: 'Anomaly', detectedBy: 'System' }
];
