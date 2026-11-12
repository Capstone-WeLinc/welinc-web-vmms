export function exportRowsToPDF(filename: string, title: string, headers: string[], rows: Array<Array<string | number>>) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert('Allow pop-ups to export this report as PDF.');
    return;
  }

  const escapeHtml = (value: string | number) => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const table = `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title>
    <style>body{font-family:Arial,sans-serif;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f2f2f2}@media print{body{margin:0;padding:0}}</style>
    </head><body><h1>${escapeHtml(title)}</h1>${table}<script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);
  printWindow.document.close();
}
