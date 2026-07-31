type ExportRow = Array<string | number>;

const escapeCsvCell = (value: string | number) => {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadTextFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export const exportRowsToCsv = (
  filename: string,
  headers: ExportRow,
  rows: ExportRow[],
) => {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
};

export const exportRowsToExcel = (
  filename: string,
  headers: ExportRow,
  rows: ExportRow[],
) => {
  const headerHtml = headers.map((cell) => `<th>${cell}</th>`).join("");
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${String(cell ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
  downloadTextFile(filename, html, "application/vnd.ms-excel;charset=utf-8");
};

export const printRowsAsPdf = (
  title: string,
  headers: ExportRow,
  rows: ExportRow[],
) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const headerHtml = headers.map((cell) => `<th>${cell}</th>`).join("");
  const rowsHtml = rows.length
    ? rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${String(cell ?? "")}</td>`).join("")}</tr>`,
        )
        .join("")
    : `<tr><td colspan="${headers.length}">No records available</td></tr>`;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { margin: 0 0 18px; letter-spacing: .04em; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th { background: #070b45; color: white; text-align: left; padding: 10px; text-transform: uppercase; }
          td { border-bottom: 1px solid #dde4ef; padding: 10px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
      </body>
    </html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
};
