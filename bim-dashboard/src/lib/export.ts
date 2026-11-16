import type { Clash } from '../types';
import { daysOpen, statusAsOf } from './metrics';

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Row = Record<string, string | number | boolean | null | undefined>;

/** Neutralise spreadsheet formula injection for values that will be opened in Excel. */
const safe = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
};

export function toCSV(rows: Row[], headers?: string[]): string {
  const cols = headers ?? (rows[0] ? Object.keys(rows[0]) : []);
  const esc = (v: unknown) => {
    const s = safe(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(esc).join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}
export function downloadCSV(rows: Row[], fileName: string, headers?: string[]) {
  downloadBlob(new Blob(['﻿' + toCSV(rows, headers)], { type: 'text/csv;charset=utf-8' }), fileName);
}

export interface Sheet { name: string; rows: Row[]; headers?: string[] }
export async function downloadXlsx(sheets: Sheet[], fileName: string, meta?: Record<string, string>) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BIM Coordination Center';
  wb.created = new Date();
  if (meta) {
    const ws = wb.addWorksheet('Report Info');
    ws.columns = [{ header: 'Field', key: 'k', width: 26 }, { header: 'Value', key: 'v', width: 80 }];
    for (const [k, v] of Object.entries(meta)) ws.addRow({ k, v });
    styleHeader(ws.getRow(1));
  }
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
    const cols = s.headers ?? (s.rows[0] ? Object.keys(s.rows[0]) : ['(no records)']);
    ws.columns = cols.map((c) => ({
      header: c, key: c,
      width: Math.min(60, Math.max(10, c.length + 2, ...s.rows.slice(0, 200).map((r) => String(r[c] ?? '').length + 2))),
    }));
    for (const r of s.rows) ws.addRow(Object.fromEntries(cols.map((c) => [c, typeof r[c] === 'string' ? safe(r[c]) : r[c]])));
    styleHeader(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (s.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styleHeader(row: any) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1728' } };
  row.alignment = { vertical: 'middle' };
}

/** Column names here double as the import template headers (round-trip safe). */
export function clashRows(clashes: Clash[], asOf: string, lk: { userName: (id?: string) => string; companyName: (id?: string) => string }): Row[] {
  return clashes.map((c) => ({
    'Clash ID': c.id, 'Clash Description': c.description, 'Clash Type': c.type, 'Discipline A': c.disciplineA, 'Discipline B': c.disciplineB,
    Building: c.building, Zone: c.zone, Level: c.level, Package: c.package, 'Grid Reference': c.gridRef, 'Model Reference': c.modelRef,
    'Clash Position': c.position, Severity: c.severity, Priority: c.priority, Status: c.status, 'Status at Reporting Date': statusAsOf(c, asOf),
    'Assigned To': lk.userName(c.assignedTo), 'Assigned Discipline': c.assignedDiscipline, 'Responsible Company': lk.companyName(c.responsibleCompanyId),
    'Date Identified': c.dateIdentified, 'Due Date': c.dueDate, 'Date Resolved': c.dateResolved ?? '', 'Days Open': daysOpen(c, asOf),
    'Repeat Count': c.occurrences, 'Resolution Notes': c.resolutionNotes, Source: c.source,
  }));
}

export const stamp = () => new Date().toISOString().slice(0, 10);
