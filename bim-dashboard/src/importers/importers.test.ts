import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCSV, parseNavisworksXml, parseHtmlTable } from './parse';
import { autoMap, disciplinesFromTestName, toDiscipline, toEnum } from './fields';
import { buildClashes, buildIssues, type ImportOptions } from './validate';
import { generateDemoDataset, DEMO_ANCHOR } from '../data/demo';
import { CLASH_STATUSES } from '../lib/constants';

const ds = generateDemoDataset(DEMO_ANCHOR);
const pid = ds.projects[0].id;
const opt: ImportOptions = { duplicatePolicy: 'skip', defaults: { building: 'T1', zone: 'Core', level: 'GF', package: 'Fit-out', severity: 'Medium' }, inferDisciplines: true, severityFromDistance: true, source: 'Import' };

describe('field helpers', () => {
  it('normalises disciplines', () => {
    expect(toDiscipline('Mechanical')).toBe('MEC');
    expect(toDiscipline('Fire Fighting')).toBe('FF');
    expect(toDiscipline('HMD-DMC-T1-ZZ-M3-M-0003.nwc')).toBe(null);
    expect(toDiscipline('Structural Framing')).toBe('STR');
    expect(disciplinesFromTestName('MEC vs STR')).toEqual(['MEC', 'STR']);
    expect(disciplinesFromTestName('HVAC_vs_Architecture')).toEqual(['HVAC', 'ARC']);
  });
  it('maps Navisworks statuses', () => {
    expect(toEnum('Reviewed', CLASH_STATUSES, 'status')).toBe('Pending Review');
    expect(toEnum('Approved', CLASH_STATUSES, 'status')).toBe('Closed');
    expect(toEnum('new', CLASH_STATUSES, 'status')).toBe('New');
  });
});

describe('CSV import', () => {
  const p = parseCSV(readFileSync('public/samples/sample-clash-register.csv', 'utf8'));
  const map = autoMap('clashes', p.headers);
  it('auto-maps all template headers', () => {
    expect(Object.keys(map).length).toBe(p.headers.length);
    expect(map['Clash ID']).toBe('id');
    expect(map['Date Identified']).toBe('dateIdentified');
  });
  it('validates rows: duplicates and bad dates are rejected, valid rows normalised', () => {
    const r = buildClashes(p.rows, map, opt, ds, pid);
    expect(r.counts.new).toBe(3);
    expect(r.counts.error).toBe(2);
    const dup = r.rows.find((x) => x.errors.some((e) => e.includes('Duplicate')));
    expect(dup?.index).toBe(3);
    const ff = r.records.find((c) => c.id === 'IMP-0001')!;
    expect([ff.disciplineA, ff.disciplineB]).toEqual(['ELE', 'FF']); // normalised order
    expect(ff.dateIdentified).toBe('2026-11-05'); // day-first parsing
    expect(ff.assignedTo).toBe('u-ff');
    expect(ff.responsibleCompanyId).toBe('c-ffsc');
    const res = r.records.find((c) => c.id === 'IMP-0002')!;
    expect(res.dateResolved).toBe('2026-11-02');
  });
  it('skips or updates existing IDs by policy', () => {
    const csv = 'Clash ID,Status,Discipline A,Discipline B,Date Identified,Resolution Notes\nCLH-0001,Closed,MEC,STR,2026-05-06,fixed';
    const q = parseCSV(csv);
    const m = autoMap('clashes', q.headers);
    expect(buildClashes(q.rows, m, opt, ds, pid).counts.skip).toBe(1);
    const u = buildClashes(q.rows, m, { ...opt, duplicatePolicy: 'update' }, ds, pid);
    expect(u.counts.update).toBe(1);
    expect(u.records[0].status).toBe('Closed');
    expect(u.records[0].building).toBe(ds.clashes[0].building); // unmapped fields preserved
  });
});

describe('Navisworks XML import', () => {
  const p = parseNavisworksXml(readFileSync('public/samples/sample-navisworks-clash-report.xml', 'utf8'));
  it('reads all clash results across tests', () => {
    expect(p.rows.length).toBe(4);
    expect(p.rows[0]['Clash ID']).toBe('MECVSSTR-Clash1');
    expect(p.rows[0]['Grid Reference']).toBe('C-4');
    expect(p.rows[0]['Level']).toBe('L03');
    expect(p.rows[0]['Date Identified']).toBe('2026-11-04');
  });
  it('maps and infers disciplines, statuses and severity from penetration', () => {
    const map = autoMap('clashes', p.headers);
    const r = buildClashes(p.rows, map, opt, ds, pid);
    expect(r.counts.error).toBe(0);
    const c1 = r.records[0];
    expect([c1.disciplineA, c1.disciplineB]).toEqual(['STR', 'MEC']);
    expect(c1.severity).toBe('High'); // 142mm penetration
    expect(c1.description).toContain('Chilled water pipe');
    expect(r.records[2].status).toBe('Closed');
    expect(r.records[2].dateResolved).toBe('2026-10-30');
    expect(r.records[3].type).toBe('Clearance');
    expect(r.records[3].status).toBe('Pending Review');
    expect([r.records[3].disciplineA, r.records[3].disciplineB]).toEqual(['ARC', 'HVAC']);
  });
});

describe('Navisworks HTML (tabular) import', () => {
  it('expands grouped Item 1 / Item 2 headers', () => {
    const html = `<table><tr><th rowspan="2">Clash Name</th><th rowspan="2">Status</th><th rowspan="2">Distance</th><th rowspan="2">Grid Location</th><th rowspan="2">Date Found</th><th colspan="2">Item 1</th><th colspan="2">Item 2</th></tr>
      <tr><th>Layer</th><th>Item Name</th><th>Layer</th><th>Item Name</th></tr>
      <tr><td>Clash1</td><td>New</td><td>-0.05</td><td>A-1 : L02</td><td>2026/11/02</td><td>L02</td><td>Duct</td><td>L02</td><td>Beam</td></tr></table>`;
    const p = parseHtmlTable(html);
    expect(p.headers).toEqual(['Clash Name', 'Status', 'Distance', 'Grid Location', 'Date Found', 'Item 1 Layer', 'Item 1 Item Name', 'Item 2 Layer', 'Item 2 Item Name']);
    const map = autoMap('clashes', p.headers);
    expect(map['Clash Name']).toBe('id');
    expect(map['Date Found']).toBe('dateIdentified');
    expect(p.rows[0]['Status']).toBe('New');
  });
});

describe('Issues import', () => {
  it('imports coordination issues', () => {
    const p = parseCSV(readFileSync('public/samples/sample-coordination-issues.csv', 'utf8'));
    const r = buildIssues(p.rows, autoMap('issues', p.headers), opt, ds, pid);
    expect(r.counts.new).toBe(2);
    expect(r.records[0].linkedClashIds).toEqual(['CLH-0001']);
    expect(r.records[0].ownerCompanyId).toBe('c-lead');
  });
});
