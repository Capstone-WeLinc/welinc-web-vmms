export type ExportCellValue = string | number | boolean | null | undefined;

function escapeHtml(value: ExportCellValue): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: ExportCellValue[][],
): void {
  if (!rows || rows.length === 0) {
    alert("No data to export");
    return;
  }

  const escapeCsvValue = (val: ExportCellValue): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];

  const csvContent = csvLines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRowsToExcel(
  filename: string,
  headers: string[],
  rows: ExportCellValue[][],
): void {
  if (!rows || rows.length === 0) {
    alert("No data to export");
    return;
  }

  let html = `<table border="1"><thead><tr>`;
  headers.forEach((header) => {
    html += `<th>${header}</th>`;
  });
  html += `</tr></thead><tbody>`;

  rows.forEach((row) => {
    html += `<tr>`;
    row.forEach((val) => {
      html += `<td>${val ?? ""}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".xls") ? filename : `${filename}.xls`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printRowsAsPdf(
  title: string,
  headers: string[],
  rows: ExportCellValue[][],
  onAfterPrint?: () => void,
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups to export to PDF");
    return;
  }

  const tableHeadersHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const tableRowsHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((val) => `<td>${escapeHtml(val)}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
      h1 { margin-bottom: 16px; font-size: 20px; text-transform: uppercase; color: #070b45; }
      table { border-collapse: collapse; width: 100%; margin-top: 12px; }
      th { background-color: #070b45; color: #ffffff; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
      td { border-bottom: 1px solid #dde4ef; padding: 10px; font-size: 13px; }
      tr:nth-child(even) { background-color: #f8fafc; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <table>
      <thead>
        <tr>${tableHeadersHtml}</tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>
  </body>
</html>`;

  let printStarted = false;
  const runPrint = () => {
    if (printStarted) return;
    printStarted = true;
    printWindow.focus();
    printWindow.print();
  };
  if (onAfterPrint) {
    printWindow.addEventListener("afterprint", onAfterPrint, { once: true });
  }
  printWindow.addEventListener("load", runPrint, { once: true });
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  if (printWindow.document.readyState === "complete") {
    window.setTimeout(runPrint, 0);
  }
}
