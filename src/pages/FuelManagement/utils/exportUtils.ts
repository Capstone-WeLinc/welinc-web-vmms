import type { FuelFillUp } from '../types';

type ExportableRow = Record<string, string | number | boolean | null | undefined>;

type CostSummaryExportRow = {
  vehicleId: string;
  model: string;
  fillUps: number;
  liters: number;
  avgPricePerLiter: number;
  totalCost: number;
  avgEfficiency: number;
};

// CSV Export - works in all browsers, can be opened in Excel
export function exportToCSV(data: ExportableRow[], filename: string) {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values that might contain commas
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Excel Export using simple HTML table method
export function exportToExcel(data: ExportableRow[], filename: string, sheetName = 'Sheet1') {
  void sheetName;

  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);

  // Create HTML table
  let html = `<table border="1"><tr>`;
  headers.forEach(header => {
    html += `<th>${header}</th>`;
  });
  html += `</tr>`;

  data.forEach(row => {
    html += `<tr>`;
    headers.forEach(header => {
      html += `<td>${row[header]}</td>`;
    });
    html += `</tr>`;
  });
  html += `</table>`;

  // Create Excel file using MIME type
  const element = document.createElement('a');
  element.setAttribute('href', 'data:application/vnd.ms-excel,' + encodeURIComponent(html));
  element.setAttribute('download', `${filename}.xls`);
  element.style.display = 'none';

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// PDF Export - print-to-PDF via browser print dialog
export function exportToPDF(title: string, content: string, filename: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to export to PDF');
    return;
  }

  const formattedContent = content
    .split('\n')
    .map(line => `<p style="margin:0 0 10px;">${line}</p>`)
    .join('');

  const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${filename}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; background: #fff; margin: 24px; }
          h1 { margin-bottom: 16px; }
          p { line-height: 1.5; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${formattedContent}
        <script>
          function runPrint() {
            window.focus();
            window.print();
          }
          window.onload = runPrint;
        </script>
      </body>
    </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const interval = setInterval(() => {
    if (printWindow.document.readyState === 'complete') {
      clearInterval(interval);
      printWindow.focus();
      printWindow.print();
    }
  }, 100);
}

// Format fuel fill-up data for export
export function formatFuelLogsForExport(fillUps: FuelFillUp[]) {
  return fillUps.map(fillUp => ({
    'Vehicle': fillUp.vehicleName,
    'Model': fillUp.vehicleModel,
    'Date': fillUp.date,
    'Liters': fillUp.liters,
    'Price per Liter': `₱${fillUp.pricePerLiter.toFixed(2)}`,
    'Total Cost': `₱${fillUp.totalCost.toLocaleString()}`,
    'Odometer (km)': fillUp.odometer,
    'Efficiency (km/L)': fillUp.efficiency,
    'Station': fillUp.station,
    'Filled By': fillUp.filledBy
  }));
}

// Format cost summary for export
export function formatCostSummaryForExport(summary: CostSummaryExportRow[]) {
  return summary.map(item => ({
    'Vehicle': item.vehicleId,
    'Model': item.model,
    'Fill-Ups': item.fillUps,
    'Total Liters': item.liters,
    'Avg Price/L': `₱${item.avgPricePerLiter.toFixed(2)}`,
    'Total Cost': `₱${item.totalCost.toLocaleString()}`,
    'Avg Efficiency': `${item.avgEfficiency.toFixed(1)} km/L`
  }));
}

// Print-friendly PDF export (uses browser print to PDF)
export function printToPDF(elementId: string, filename: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to export to PDF');
    return;
  }

  const element = document.getElementById(elementId);
  if (!element) {
    alert('Element not found');
    return;
  }

  const content = element.innerHTML;

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        body { font-family: Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        @media print {
          body { margin: 0; padding: 0; }
        }
      </style>
    </head>
    <body>
      ${content}
      <script>
        function runPrint() {
          window.focus();
          window.print();
        }
        window.onload = runPrint;
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();

  const interval = setInterval(() => {
    if (printWindow.document.readyState === 'complete') {
      clearInterval(interval);
      printWindow.focus();
      printWindow.print();
    }
  }, 100);
}
