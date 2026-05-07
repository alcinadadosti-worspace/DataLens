import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  const csv = Papa.unparse(data, { delimiter: ';' });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename + '.csv');
}

export function exportToXLSX(data: Record<string, unknown>[], filename: string): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename + '.xlsx');
}

export function exportToPDF(element: HTMLElement, filename: string): void {
  // Simple print-based PDF export
  const originalTitle = document.title;
  document.title = filename;
  const style = document.createElement('style');
  style.textContent = `
    @media print {
      body > *:not(#print-root) { display: none !important; }
      #print-root { display: block !important; }
    }
  `;
  element.id = 'print-root';
  document.head.appendChild(style);
  window.print();
  document.title = originalTitle;
  document.head.removeChild(style);
  element.removeAttribute('id');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
