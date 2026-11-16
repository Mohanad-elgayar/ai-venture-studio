import { describe, it, expect } from 'vitest';
import { generateDemoDataset, DEMO_ANCHOR } from '../data/demo';
import {
  buildMatrix, clashKpis, filterClashes, MATRIX_VIEWS, normalisePair, isClosedAsOf, isOpenAsOf, scopeFor,
  complianceScores, complianceRows, modelStates, modelKpis, deliverableKpis, progressAsOf, bimHealth, weeklySeries, statusAsOf,
} from './metrics';
import { addDays } from './dates';
import type { GlobalFilters } from '../types';

const ds = generateDemoDataset(DEMO_ANCHOR);
const f: GlobalFilters = { projectId: ds.projects[0].id, periodId: '', disciplines: [], buildings: [], zones: [], levels: [], packages: [] };
const asOf = DEMO_ANCHOR;
const s = { asOf, periodStart: addDays(asOf, -6) };

describe('demo dataset', () => {
  it('is deterministic and labelled demo', () => {
    const again = generateDemoDataset(DEMO_ANCHOR);
    expect(again.clashes).toEqual(ds.clashes);
    expect(ds.isDemo).toBe(true);
    expect(ds.projects[0].name).toMatch(/DEMO/);
  });
  it('has at least 100 clashes with unique ids and normalised pairs', () => {
    expect(ds.clashes.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ds.clashes.map((c) => c.id)).size).toBe(ds.clashes.length);
    for (const c of ds.clashes) expect(normalisePair(c.disciplineA, c.disciplineB)).toEqual([c.disciplineA, c.disciplineB]);
  });
  it('covers every severity, status family, type, building and multiple companies', () => {
    expect(new Set(ds.clashes.map((c) => c.severity)).size).toBe(4);
    expect(new Set(ds.clashes.map((c) => c.type)).size).toBe(3);
    expect(new Set(ds.clashes.map((c) => c.status)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(ds.clashes.map((c) => c.building)).size).toBe(4);
    expect(new Set(ds.clashes.map((c) => c.responsibleCompanyId)).size).toBeGreaterThanOrEqual(5);
  });
  it('never has resolution before identification or future dates', () => {
    for (const c of ds.clashes) {
      if (c.dateResolved) expect(c.dateResolved >= c.dateIdentified).toBe(true);
      expect(c.dateIdentified <= DEMO_ANCHOR).toBe(true);
    }
  });
  it('shifts dates to the requested anchor without changing counts', () => {
    const shifted = generateDemoDataset(addDays(DEMO_ANCHOR, 30));
    const a = clashKpis(ds.clashes, s);
    const b = clashKpis(shifted.clashes, { asOf: addDays(asOf, 30), periodStart: addDays(asOf, 24) });
    expect(b).toEqual(a);
  });
});

describe('clash KPIs', () => {
  const k = clashKpis(ds.clashes, s);
  it('open + closed = total', () => expect(k.open + k.closed).toBe(k.total));
  it('resolution rate matches closed/total', () => expect(k.resolutionRate).toBeCloseTo((k.closed / k.total) * 100));
  it('earlier as-of never has more clashes', () => {
    const e = clashKpis(ds.clashes, { asOf: addDays(asOf, -60), periodStart: addDays(asOf, -66) });
    expect(e.total).toBeLessThan(k.total);
    expect(e.closed).toBeLessThanOrEqual(k.closed);
  });
  it('status as-of shows later-closed clashes as open', () => {
    const c = ds.clashes.find((x) => x.dateResolved)!;
    const before = addDays(c.dateResolved!, -1);
    if (before >= c.dateIdentified) {
      expect(isOpenAsOf(c, before)).toBe(true);
      expect(statusAsOf(c, before)).toBe('In Progress');
    }
    expect(isClosedAsOf(c, c.dateResolved!)).toBe(true);
  });
});

describe('clash matrix', () => {
  for (const v of MATRIX_VIEWS) {
    it(`${v.id}: cells sum to grand total without double counting`, () => {
      const m = buildMatrix(ds.clashes, v.id, asOf);
      const cellSum = [...m.cells.values()].reduce((a, c) => a + c.count, 0);
      expect(cellSum).toBe(m.grandTotal);
      const offDiag = [...m.cells.values()].filter((c) => c.a !== c.b).reduce((a, c) => a + c.count, 0);
      const discSum = Object.values(m.disciplineTotals).reduce((a, b) => a + b, 0);
      expect(discSum).toBe(m.grandTotal + offDiag);
      // each cell is keyed by a normalised pair
      for (const c of m.cells.values()) expect(normalisePair(c.a, c.b)).toEqual([c.a, c.b]);
      // severities & types partition the count
      for (const c of m.cells.values()) {
        expect(Object.values(c.bySeverity).reduce((a, b) => a + b, 0)).toBe(c.count);
        expect(Object.values(c.byType).reduce((a, b) => a + b, 0)).toBe(c.count);
      }
    });
  }
  it('matrix views agree with KPI cards', () => {
    const k = clashKpis(ds.clashes, s);
    expect(buildMatrix(ds.clashes, 'total', asOf).grandTotal).toBe(k.total);
    expect(buildMatrix(ds.clashes, 'open', asOf).grandTotal).toBe(k.open);
    expect(buildMatrix(ds.clashes, 'resolved', asOf).grandTotal).toBe(k.closed);
    expect(buildMatrix(ds.clashes, 'critical', asOf).grandTotal).toBe(k.critical);
    expect(buildMatrix(ds.clashes, 'overdue', asOf).grandTotal).toBe(k.overdue);
  });
  it('mixed-order input is normalised into one cell', () => {
    const c1 = { ...ds.clashes[0], id: 'X1', disciplineA: 'STR' as const, disciplineB: 'MEC' as const };
    const c2 = { ...ds.clashes[0], id: 'X2', disciplineA: 'MEC' as const, disciplineB: 'STR' as const };
    const m = buildMatrix([c1, c2], 'total', asOf);
    expect(m.cells.size).toBe(1);
    expect(m.cells.get('STR|MEC')!.count).toBe(2);
  });
  it('type filter restricts counts', () => {
    const all = buildMatrix(ds.clashes, 'total', asOf).grandTotal;
    const parts = (['Hard', 'Soft', 'Clearance'] as const).map((t) => buildMatrix(ds.clashes, 'total', asOf, [t]).grandTotal);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(all);
  });
});

describe('filters', () => {
  it('building filter produces subsets that partition the total', () => {
    const total = filterClashes(ds.clashes, f).length;
    const sum = ds.projects[0].buildings.reduce((a, b) => a + filterClashes(ds.clashes, { ...f, buildings: [b.code] }).length, 0);
    expect(sum).toBe(total);
  });
  it('discipline filter keeps clashes involving the discipline', () => {
    const r = filterClashes(ds.clashes, { ...f, disciplines: ['FF'] });
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) expect([c.disciplineA, c.disciplineB]).toContain('FF');
  });
});

describe('other modules', () => {
  it('model states reconstruct from submissions', () => {
    const st = modelStates(ds.models, ds.submissions, asOf);
    const k = modelKpis(st);
    expect(k.total).toBe(ds.models.length);
    expect(k.approved + k.rejected + k.pendingUpdate + k.underReview).toBe(k.received);
    const early = modelKpis(modelStates(ds.models, ds.submissions, '2026-04-01'));
    expect(early.received).toBeLessThan(k.received);
  });
  it('deliverable KPIs are consistent', () => {
    const k = deliverableKpis(ds.deliverables, asOf);
    expect(k.approved + k.rejected + k.pendingReview).toBe(k.submitted);
    expect(k.submitted).toBeLessThanOrEqual(k.total);
  });
  it('compliance marks categories without evidence as not verified', () => {
    const sc = complianceScores(complianceRows(ds.compliance, ds.models, asOf));
    const ifc = sc.find((x) => x.category === 'IFC Export')!;
    expect(ifc.verified).toBe(false);
    expect(ifc.score).toBeNull();
    const naming = sc.find((x) => x.category === 'Naming Convention')!;
    expect(naming.fail).toBeGreaterThan(0);
  });
  it('progress and health are bounded', () => {
    const p = progressAsOf(ds, f, asOf);
    for (const v of Object.values(p)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    const h = bimHealth(ds, f, scopeFor(ds.periods.find((x) => x.end === DEMO_ANCHOR), DEMO_ANCHOR));
    expect(h.score).not.toBeNull();
  });
  it('weekly series ends at the as-of KPIs', () => {
    const w = weeklySeries(ds, f, asOf, 8);
    expect(w[w.length - 1].open).toBe(clashKpis(ds.clashes, s).open);
  });
});
