/**
 * File parsers. Everything runs locally in the browser — no file is uploaded anywhere.
 *  - CSV                      (PapaParse)
 *  - Excel .xlsx              (ExcelJS; first row with ≥2 non-empty cells is the header)
 *  - Navisworks XML report    (Clash Detective → Report → XML)
 *  - Navisworks HTML (Tabular)(Clash Detective → Report → HTML (Tabular)) and other HTML tables
 */
import Papa from 'papaparse';
import { parseLooseDate } from '../lib/dates';

export type Cell = string | number | null;
export interface ParsedFile {
  fileName: string;
  format: 'csv' | 'xlsx' | 'navisworks-xml' | 'html';
  sheets?: string[];
  sheet?: string;
  headers: string[];
  rows: Record<string, Cell>[];
  notes: string[];
}

export async function parseFile(file: File, sheet?: string): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (file.size > 25 * 1024 * 1024) throw new Error('File is larger than 25 MB. Split the report and import in parts.');
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCSV(await file.text(), file.name);
  if (name.endsWith('.xlsx')) return parseXlsx(await file.arrayBuffer(), file.name, sheet);
  if (name.endsWith('.xls')) throw new Error('Legacy .xls is not supported. Save the file as .xlsx or .csv and try again.');
  if (name.endsWith('.xml')) return parseNavisworksXml(await file.text(), file.name);
  if (name.endsWith('.html') || name.endsWith('.htm')) return parseHtmlTable(await file.text(), file.name);
  throw new Error('Unsupported file type. Use .xlsx, .csv, Navisworks .xml or Navisworks HTML (Tabular).');
}

export function parseCSV(text: string, fileName = 'data.csv'): ParsedFile {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
  const headers = (res.meta.fields ?? []).filter((h) => h !== '');
  if (!headers.length) throw new Error('No header row found in CSV.');
  const notes = res.errors.slice(0, 5).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  return { fileName, format: 'csv', headers, rows: res.data.map((r) => Object.fromEntries(headers.map((h) => [h, r[h] ?? null]))), notes };
}

export async function parseXlsx(buf: ArrayBuffer, fileName: string, sheetName?: string): Promise<ParsedFile> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheets = wb.worksheets.map((w) => w.name);
  const ws = (sheetName && wb.getWorksheet(sheetName)) || wb.worksheets.find((w) => w.actualRowCount > 1) || wb.worksheets[0];
  if (!ws) throw new Error('Workbook contains no worksheets.');
  const values: Cell[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const out: Cell[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { out[col - 1] = cellValue(cell.value); });
    values.push(out);
  });
  const hi = values.findIndex((r) => r.filter((v) => v !== null && v !== '').length >= 2);
  if (hi < 0) throw new Error(`Sheet "${ws.name}" has no header row.`);
  const raw = values[hi].map((v, i) => (v === null || v === '' ? `Column ${i + 1}` : String(v).trim()));
  const headers = dedupeHeaders(raw);
  const rows = values.slice(hi + 1).filter((r) => r.some((v) => v !== null && v !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
  return { fileName, format: 'xlsx', sheets, sheet: ws.name, headers, rows, notes: hi > 0 ? [`Header row detected on row ${hi + 1}.`] : [] };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cellValue(v: any): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return parseLooseDate(v);
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('richText' in v) return v.richText.map((t: { text: string }) => t.text).join('');
    if ('text' in v) return String(v.text);
    return null;
  }
  return typeof v === 'number' ? v : String(v);
}
const dedupeHeaders = (h: string[]) => { const seen: Record<string, number> = {}; return h.map((x) => (seen[x] = (seen[x] ?? 0) + 1) > 1 ? `${x} (${seen[x]})` : x); };

/**
 * Navisworks Clash Detective XML (<exchange><batchtest><clashtests><clashtest name=… test_type=…>
 *   <clashresults><clashresult name="Clash1" guid=… status="new" distance="-0.123">
 *     <description>Hard</description><resultstatus>New</resultstatus>
 *     <clashpoint><pos3f x y z/></clashpoint><gridlocation>C-4 : Level 2</gridlocation>
 *     <createddate><date year month day …/></createddate>
 *     <clashobjects><clashobject><layer/>…<smarttags><smarttag><name>Item Name</name><value/>…</smarttag></smarttags>
 *       <pathlink><node>Root</node><node>file.nwc</node>…</pathlink></clashobject>…
 * Rows are produced with canonical column names so auto-mapping lines up with the dashboard fields.
 */
export function parseNavisworksXml(text: string, fileName = 'report.xml'): ParsedFile {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The XML file could not be read (malformed XML).');
  const tests = Array.from(doc.getElementsByTagName('clashtest'));
  if (!tests.length) throw new Error('No <clashtest> elements found — is this a Navisworks Clash Detective XML report?');
  const rows: Record<string, Cell>[] = [];
  const notes: string[] = [];
  for (const t of tests) {
    const testName = t.getAttribute('name') ?? 'Clash Test';
    const testType = t.getAttribute('test_type') ?? '';
    const results = Array.from(t.getElementsByTagName('clashresult'));
    notes.push(`Test "${testName}" (${testType || 'type n/a'}): ${results.length} results`);
    for (const r of results) {
      const child = (tag: string) => r.getElementsByTagName(tag)[0];
      const pos = child('pos3f');
      const created = child('createddate')?.getElementsByTagName('date')[0];
      const approved = child('approveddate')?.getElementsByTagName('date')[0];
      const objs = Array.from(r.getElementsByTagName('clashobject'));
      const obj = (i: number) => {
        const o = objs[i];
        if (!o) return { layer: '', name: '', type: '', file: '' };
        const tags = Array.from(o.getElementsByTagName('smarttag'));
        const tag = (n: string) => tags.find((x) => x.getElementsByTagName('name')[0]?.textContent?.trim() === n)?.getElementsByTagName('value')[0]?.textContent?.trim() ?? '';
        const path = Array.from(o.getElementsByTagName('node')).map((n) => n.textContent?.trim() ?? '');
        return { layer: o.getElementsByTagName('layer')[0]?.textContent?.trim() || tag('Item Layer'), name: tag('Item Name'), type: tag('Item Type'), file: path.find((p) => /\.(nwc|nwd|rvt|ifc|dwg|dgn)$/i.test(p)) ?? path[1] ?? '' };
      };
      const a = obj(0), b = obj(1);
      const grid = child('gridlocation')?.textContent?.trim() ?? '';
      const [gridRef, level] = grid.includes(':') ? grid.split(':').map((s) => s.trim()) : [grid, ''];
      const date = (el?: Element) => el ? `${el.getAttribute('year')}-${(el.getAttribute('month') ?? '1').padStart(2, '0')}-${(el.getAttribute('day') ?? '1').padStart(2, '0')}` : null;
      const desc = child('description')?.textContent?.trim() ?? testType;
      const clashName = r.getAttribute('name') ?? '';
      rows.push({
        'Clash ID': `${testName.replace(/[^A-Za-z0-9]+/g, '').slice(0, 16).toUpperCase()}-${clashName.replace(/\s+/g, '')}`,
        'Clash GUID': r.getAttribute('guid'),
        'Clash Test Name': testName,
        'Clash Description': a.name || b.name ? `${a.name || a.type || 'Item 1'} vs ${b.name || b.type || 'Item 2'}` : `${testName} — ${clashName}`,
        'Clash Type': desc,
        Status: child('resultstatus')?.textContent?.trim() || r.getAttribute('status'),
        'Distance (m)': r.getAttribute('distance') ? Number(r.getAttribute('distance')) : null,
        'Grid Reference': gridRef || null,
        Level: level || a.layer || null,
        'Clash Position': pos ? `${(+pos.getAttribute('x')!).toFixed(3)}, ${(+pos.getAttribute('y')!).toFixed(3)}, ${(+pos.getAttribute('z')!).toFixed(3)}` : null,
        'Date Identified': date(created),
        'Date Resolved': date(approved),
        'Item 1 Layer': a.layer, 'Item 1 Name': a.name, 'Item 1 Source': a.file,
        'Item 2 Layer': b.layer, 'Item 2 Name': b.name, 'Item 2 Source': b.file,
        'Model Reference': a.file || null,
        'Assigned To': child('assignedto')?.textContent?.trim() || r.getAttribute('assignedto'),
        'Resolution Notes': Array.from(r.getElementsByTagName('comment')).map((c) => c.getElementsByTagName('body')[0]?.textContent?.trim() ?? c.textContent?.trim()).filter(Boolean).join(' | ') || null,
      });
    }
  }
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { fileName, format: 'navisworks-xml', headers, rows, notes };
}

/** Generic HTML table parser — handles Navisworks "HTML (Tabular)" exports and other HTML tables. Picks the largest table. */
export function parseHtmlTable(text: string, fileName = 'report.html'): ParsedFile {
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  if (!tables.length) throw new Error('No table found in the HTML file.');
  const table = tables.sort((a, b) => b.rows.length - a.rows.length)[0];
  const rowEls = Array.from(table.rows);
  const trs = rowEls.map((tr) => Array.from(tr.cells).map((c) => c.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
  let hi = trs.findIndex((r) => r.filter(Boolean).length >= 3);
  if (hi < 0) throw new Error('Could not detect a header row in the HTML table.');
  let headerRow = trs[hi];
  // Navisworks "HTML (Tabular)": grouped header cells (colspan, e.g. "Item 1" / "Item 2") with their
  // sub-headers on the next row; non-grouped cells use rowspan=2. Expand groups into "Item 1 Layer" etc.
  const cells = Array.from(rowEls[hi].cells);
  if (cells.some((c) => c.colSpan > 1) && rowEls[hi + 1]) {
    const sub = trs[hi + 1];
    let k = 0;
    headerRow = cells.flatMap((c) => {
      const label = c.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (c.colSpan > 1) return Array.from({ length: c.colSpan }, () => `${label} ${sub[k++] ?? ''}`.trim());
      return [label];
    });
    hi += 1;
  }
  const headers = dedupeHeaders(headerRow.map((h, i) => h || `Column ${i + 1}`));
  const rows = trs.slice(hi + 1).filter((r) => r.some(Boolean) && r.length >= Math.min(3, headers.length)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
  return { fileName, format: 'html', headers, rows, notes: [`Read table with ${rows.length} rows (${tables.length} table(s) in file).`] };
}
