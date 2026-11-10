export function printToPDF(elementId: string, filename: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert('Allow pop-ups to export this report as PDF.');
    return;
  }

  const element = document.getElementById(elementId);
  if (!element) {
    printWindow.close();
    window.alert('The report is not available for export.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>${filename}</title>
    <style>body{font-family:Arial,sans-serif;color:#111}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f2f2f2}@media print{body{margin:0;padding:0}}</style>
    </head><body>${element.innerHTML}<script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);
  printWindow.document.close();
}
