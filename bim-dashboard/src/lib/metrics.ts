/**
 * METRICS ENGINE
 * All KPIs, charts and matrices are derived here from the underlying records.
 * Every function is pure: (records, filters, as-of date) -> numbers. Nothing is hardcoded.
 *
 * "As-of" semantics: a reporting period selects an as-of date (period end, capped at today).
 *  - A record is in scope if it existed on or before the as-of date (date identified / planned / first upload).
 *  - A clash counts as closed only if it is Resolved/Closed AND its resolution date is on/before as-of.
 *  - Overdue = not closed as-of and due date is before as-of.
 */
import type {
  BimModel, Clash, ClashStatus, ComplianceCategory, ComplianceCheck, CoordinationIssue, Dataset, Deliverable,
  DisciplineCode, GlobalFilters, ISODate, ModelStatus, ModelSubmission, ReportingPeriod, Risk, Severity,
} from '../types';
import { CLOSED_STATUSES, COMPLIANCE_CATEGORIES, DISCIPLINES, SEVERITIES, SEVERITY_WEIGHT } from './constants';
import { addDays, diffDays, todayISO } from './dates';
import { ratio } from './format';

// ---------------------------------------------------------------- scope & filters
export interface Scope {
  asOf: ISODate;
  periodStart: ISODate;
  period?: ReportingPeriod;
}
export function scopeFor(period: ReportingPeriod | undefined, today: ISODate = todayISO()): Scope {
  if (!period) return { asOf: today, periodStart: addDays(today, -6) };
  const asOf = diffDays(period.end, today) > 0 ? today : period.end;
  return { asOf, periodStart: period.start, period };
}

export const pairKey = (a: DisciplineCode, b: DisciplineCode) => {
  const [x, y] = normalisePair(a, b);
  return `${x}|${y}`;
};
const ORDER = Object.fromEntries(DISCIPLINES.map((d) => [d.code, d.order])) as Record<string, number>;
export function normalisePair(a: DisciplineCode, b: DisciplineCode): [DisciplineCode, DisciplineCode] {
  return (ORDER[a] ?? 99) <= (ORDER[b] ?? 99) ? [a, b] : [b, a];
}

const inList = <T,>(list: T[], v: T) => list.length === 0 || list.includes(v);

export function filterClashes(clashes: Clash[], f: GlobalFilters): Clash[] {
  return clashes.filter((c) =>
    c.projectId === f.projectId &&
    (f.disciplines.length === 0 || f.disciplines.includes(c.disciplineA) || f.disciplines.includes(c.disciplineB)) &&
    inList(f.buildings, c.building) && inList(f.zones, c.zone) && inList(f.levels, c.level) && inList(f.packages, c.package));
}
export const filterModels = (models: BimModel[], f: GlobalFilters) =>
  models.filter((m) => m.projectId === f.projectId && inList(f.disciplines, m.discipline) && inList(f.buildings, m.building));
export const filterDeliverables = (ds: Deliverable[], f: GlobalFilters) =>
  ds.filter((d) => d.projectId === f.projectId && (f.disciplines.length === 0 || d.discipline === 'ALL' || f.disciplines.includes(d.discipline)));
export const filterIssues = (is: CoordinationIssue[], f: GlobalFilters) =>
  is.filter((i) => i.projectId === f.projectId && inList(f.disciplines, i.discipline) && inList(f.buildings, i.building));
export const filterCompliance = (cs: ComplianceCheck[], f: GlobalFilters) =>
  cs.filter((c) => c.projectId === f.projectId && (f.disciplines.length === 0 || c.discipline === 'ALL' || f.disciplines.includes(c.discipline)));
export const filterRisks = (rs: Risk[], f: GlobalFilters) => rs.filter((r) => r.projectId === f.projectId);

// ---------------------------------------------------------------- clash state as-of
export const isInScope = (c: Clash, asOf: ISODate) => c.dateIdentified <= asOf;
export const isClosedAsOf = (c: Clash, asOf: ISODate) =>
  CLOSED_STATUSES.includes(c.status) && (c.dateResolved ?? c.dateIdentified) <= asOf;
export const isOpenAsOf = (c: Clash, asOf: ISODate) => isInScope(c, asOf) && !isClosedAsOf(c, asOf);
export const isOverdueAsOf = (c: Clash, asOf: ISODate) => isOpenAsOf(c, asOf) && c.dueDate < asOf;
export const daysOpen = (c: Clash, asOf: ISODate) =>
  Math.max(0, diffDays(isClosedAsOf(c, asOf) ? (c.dateResolved ?? asOf) : asOf, c.dateIdentified));
/** Status as it would have been reported on the as-of date (closure after as-of is shown as In Progress). */
export const statusAsOf = (c: Clash, asOf: ISODate): ClashStatus =>
  isClosedAsOf(c, asOf) ? c.status : CLOSED_STATUSES.includes(c.status) ? 'In Progress' : c.status;
export const isHighPriority = (c: Clash) => c.priority === 'P1' || c.priority === 'P2';

export interface ClashKpis {
  total: number; open: number; closed: number; critical: number; criticalTotal: number; high: number; overdue: number;
  resolutionRate: number; newInPeriod: number; resolvedInPeriod: number; avgDaysToResolve: number; repeated: number;
}
export function clashKpis(clashes: Clash[], s: Scope): ClashKpis {
  const scope = clashes.filter((c) => isInScope(c, s.asOf));
  const open = scope.filter((c) => !isClosedAsOf(c, s.asOf));
  const closed = scope.filter((c) => isClosedAsOf(c, s.asOf));
  const resolvedDurations = closed.map((c) => diffDays(c.dateResolved ?? c.dateIdentified, c.dateIdentified));
  return {
    total: scope.length,
    open: open.length,
    closed: closed.length,
    critical: open.filter((c) => c.severity === 'Critical').length,
    criticalTotal: scope.filter((c) => c.severity === 'Critical').length,
    high: open.filter(isHighPriority).length,
    overdue: open.filter((c) => c.dueDate < s.asOf).length,
    resolutionRate: ratio(closed.length, scope.length),
    newInPeriod: scope.filter((c) => c.dateIdentified >= s.periodStart).length,
    resolvedInPeriod: closed.filter((c) => (c.dateResolved ?? '') >= s.periodStart).length,
    avgDaysToResolve: resolvedDurations.length ? resolvedDurations.reduce((a, b) => a + b, 0) / resolvedDurations.length : 0,
    repeated: open.filter((c) => c.occurrences > 1).length,
  };
}

export function countBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const it of items) { const k = key(it); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

export function severityDistribution(clashes: Clash[], s: Scope, onlyOpen = true) {
  const set = clashes.filter((c) => (onlyOpen ? isOpenAsOf(c, s.asOf) : isInScope(c, s.asOf)));
  const by = countBy(set, (c) => c.severity);
  return SEVERITIES.map((sev) => ({ name: sev, value: by[sev] ?? 0 }));
}

/** Clash involvement per discipline: a clash between A and B counts once for A and once for B (intra-discipline once). */
export function disciplineContribution(clashes: Clash[], s: Scope) {
  return DISCIPLINES.map((d) => {
    const inv = clashes.filter((c) => isInScope(c, s.asOf) && (c.disciplineA === d.code || c.disciplineB === d.code));
    const open = inv.filter((c) => !isClosedAsOf(c, s.asOf));
    const responsible = clashes.filter((c) => isOpenAsOf(c, s.asOf) && c.assignedDiscipline === d.code);
    return {
      code: d.code, name: d.name, color: d.color,
      involved: inv.length, open: open.length, closed: inv.length - open.length,
      responsibleOpen: responsible.length,
      critical: open.filter((c) => c.severity === 'Critical').length,
      resolutionRate: ratio(inv.length - open.length, inv.length),
    };
  });
}

// ---------------------------------------------------------------- matrix
export type MatrixView = 'total' | 'open' | 'critical' | 'resolved' | 'overdue';
export const MATRIX_VIEWS: { id: MatrixView; label: string; help: string }[] = [
  { id: 'total', label: 'Total', help: 'All clashes identified up to the reporting date' },
  { id: 'open', label: 'Open', help: 'Clashes not resolved/closed as of the reporting date' },
  { id: 'critical', label: 'Critical', help: 'Open clashes with Critical severity' },
  { id: 'resolved', label: 'Resolved', help: 'Clashes resolved or closed on/before the reporting date' },
  { id: 'overdue', label: 'Overdue', help: 'Open clashes past their due date' },
];
export function matrixPredicate(view: MatrixView, asOf: ISODate): (c: Clash) => boolean {
  switch (view) {
    case 'total': return (c) => isInScope(c, asOf);
    case 'open': return (c) => isOpenAsOf(c, asOf);
    case 'critical': return (c) => isOpenAsOf(c, asOf) && c.severity === 'Critical';
    case 'resolved': return (c) => isInScope(c, asOf) && isClosedAsOf(c, asOf);
    case 'overdue': return (c) => isOverdueAsOf(c, asOf);
  }
}
export interface MatrixCell {
  key: string; a: DisciplineCode; b: DisciplineCode; count: number;
  bySeverity: Record<Severity, number>; byType: Record<'Hard' | 'Soft' | 'Clearance', number>;
  score: number; worst?: Severity; ids: string[];
}
export interface ClashMatrix {
  cells: Map<string, MatrixCell>;
  disciplineTotals: Record<string, number>; // involvement (each clash counts for both disciplines)
  grandTotal: number; // unique clashes — never double counted
  maxCount: number;
}
export function buildMatrix(clashes: Clash[], view: MatrixView, asOf: ISODate, types: ('Hard' | 'Soft' | 'Clearance')[] = []): ClashMatrix {
  const pred = matrixPredicate(view, asOf);
  const cells = new Map<string, MatrixCell>();
  const disciplineTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const c of clashes) {
    if (!pred(c) || (types.length && !types.includes(c.type))) continue;
    const [a, b] = normalisePair(c.disciplineA, c.disciplineB);
    const key = `${a}|${b}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { key, a, b, count: 0, bySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 }, byType: { Hard: 0, Soft: 0, Clearance: 0 }, score: 0, ids: [] };
      cells.set(key, cell);
    }
    cell.count++;
    cell.bySeverity[c.severity]++;
    cell.byType[c.type]++;
    cell.score += SEVERITY_WEIGHT[c.severity];
    cell.ids.push(c.id);
    grandTotal++;
    disciplineTotals[a] = (disciplineTotals[a] ?? 0) + 1;
    if (b !== a) disciplineTotals[b] = (disciplineTotals[b] ?? 0) + 1;
  }
  let maxCount = 0;
  for (const cell of cells.values()) {
    cell.worst = SEVERITIES.find((s) => cell.bySeverity[s] > 0);
    maxCount = Math.max(maxCount, cell.count);
  }
  return { cells, disciplineTotals, grandTotal, maxCount };
}

// ---------------------------------------------------------------- models
export interface ModelState { model: BimModel; status: ModelStatus | null; revision: string; lastUpload?: ISODate; progress: number; submissions: ModelSubmission[] }
/** Reconstruct each model's state on the as-of date from its submission history. */
export function modelStates(models: BimModel[], submissions: ModelSubmission[], asOf: ISODate): ModelState[] {
  const byModel = new Map<string, ModelSubmission[]>();
  for (const s of submissions) { if (!byModel.has(s.modelId)) byModel.set(s.modelId, []); byModel.get(s.modelId)!.push(s); }
  return models.map((m) => {
    const subs = (byModel.get(m.id) ?? []).filter((s) => s.submittedDate <= asOf).sort((a, b) => a.submittedDate.localeCompare(b.submittedDate));
    const last = subs[subs.length - 1];
    if (!last) {
      // models with no submission history (e.g. manually added) use their own fields if uploaded before as-of
      const has = m.lastUpload <= asOf;
      return { model: m, status: has ? m.status : null, revision: has ? m.revision : '—', lastUpload: has ? m.lastUpload : undefined, progress: has ? m.developmentProgress : 0, submissions: [] };
    }
    const reviewed = last.reviewedDate && last.reviewedDate <= asOf;
    const status: ModelStatus = reviewed || last.status === 'Received' ? last.status : 'Under Review';
    return { model: m, status, revision: last.revision, lastUpload: last.submittedDate, progress: last.progressReported, submissions: subs };
  });
}
export function modelKpis(states: ModelState[]) {
  const received = states.filter((s) => s.status !== null);
  const by = countBy(received, (s) => s.status as ModelStatus);
  return {
    total: states.length,
    received: received.length,
    underReview: (by['Under Review'] ?? 0) + (by['Received'] ?? 0),
    approved: by['Approved'] ?? 0,
    rejected: by['Rejected'] ?? 0,
    pendingUpdate: by['Pending Update'] ?? 0,
    federated: received.filter((s) => s.model.federated).length,
    coordinationProgress: ratio(by['Approved'] ?? 0, states.length),
    avgDevelopment: states.length ? states.reduce((a, s) => a + s.progress, 0) / states.length : 0,
  };
}

// ---------------------------------------------------------------- deliverables
export const isSubmittedAsOf = (d: Deliverable, asOf: ISODate) => !!d.actualDate && d.actualDate <= asOf;
export const isApprovedAsOf = (d: Deliverable, asOf: ISODate) =>
  isSubmittedAsOf(d, asOf) && (d.approvalStatus === 'Approved' || d.approvalStatus === 'Approved with Comments') && (d.reviewedDate ?? d.actualDate!) <= asOf;
export const isDeliverableOverdue = (d: Deliverable, asOf: ISODate) => !isSubmittedAsOf(d, asOf) && d.plannedDate < asOf;
export function deliverableKpis(ds: Deliverable[], asOf: ISODate) {
  const due = ds.filter((d) => d.plannedDate <= asOf);
  const submitted = ds.filter((d) => isSubmittedAsOf(d, asOf));
  const onTime = submitted.filter((d) => d.actualDate! <= d.plannedDate);
  const approved = ds.filter((d) => isApprovedAsOf(d, asOf));
  const rejected = submitted.filter((d) => d.approvalStatus === 'Rejected' && (d.reviewedDate ?? d.actualDate!) <= asOf);
  const late = submitted.filter((d) => d.actualDate! > d.plannedDate);
  const avgDelay = late.length ? late.reduce((a, d) => a + diffDays(d.actualDate!, d.plannedDate), 0) / late.length : 0;
  return {
    total: ds.length, due: due.length, submitted: submitted.length, approved: approved.length, rejected: rejected.length,
    overdue: ds.filter((d) => isDeliverableOverdue(d, asOf)).length,
    pendingReview: submitted.length - approved.length - rejected.length,
    onTimeRate: ratio(onTime.length, submitted.length),
    submissionRate: ratio(due.filter((d) => isSubmittedAsOf(d, asOf)).length, due.length),
    progress: ratio(approved.length, ds.length),
    avgDelayDays: avgDelay,
  };
}

// ---------------------------------------------------------------- issues
export const isIssueOpenAsOf = (i: CoordinationIssue, asOf: ISODate) => i.raisedDate <= asOf && !(i.status === 'Closed' && (i.closedDate ?? i.raisedDate) <= asOf);
export const isIssueOverdueAsOf = (i: CoordinationIssue, asOf: ISODate) => isIssueOpenAsOf(i, asOf) && i.dueDate < asOf;

// ---------------------------------------------------------------- compliance
export const NAMING_PATTERN = /^[A-Z0-9]{2,6}-[A-Z0-9]{2,6}-[A-Z0-9]{1,3}-[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z]{1,2}-\d{4}\.(rvt|ifc|nwc|nwd|dwg|dgn)$/i;
export const NAMING_PATTERN_LABEL = 'Project-Originator-Volume-Level-Type-Role-Number.ext  (e.g. HMD-DLA-T1-ZZ-M3-A-0001.rvt)';

export interface ComplianceRow { id: string; category: ComplianceCategory; checkName: string; discipline: string; modelId?: string; result: 'Pass' | 'Fail' | 'Observation'; date: ISODate; evidence: string; observation: string; observationClosed: boolean; automated: boolean }
/** Recorded checks (latest per check+model) plus automated checks the dashboard can verify itself (naming). */
export function complianceRows(checks: ComplianceCheck[], models: BimModel[], asOf: ISODate): ComplianceRow[] {
  const latest = new Map<string, ComplianceCheck>();
  for (const c of checks) {
    if (c.checkedDate > asOf) continue;
    const k = `${c.category}|${c.checkName}|${c.modelId ?? c.discipline}`;
    const prev = latest.get(k);
    if (!prev || prev.checkedDate < c.checkedDate) latest.set(k, c);
  }
  const rows: ComplianceRow[] = [...latest.values()].map((c) => ({
    id: c.id, category: c.category, checkName: c.checkName, discipline: c.discipline, modelId: c.modelId, result: c.result,
    date: c.checkedDate, evidence: c.evidence, observation: c.observation, observationClosed: c.observationClosed, automated: false,
  }));
  for (const m of models) {
    if (m.lastUpload > asOf) continue;
    const ok = NAMING_PATTERN.test(m.name);
    rows.push({
      id: `AUTO-NAME-${m.id}`, category: 'Naming Convention', checkName: 'File name matches ISO 19650 naming pattern', discipline: m.discipline,
      modelId: m.id, result: ok ? 'Pass' : 'Fail', date: m.lastUpload, evidence: 'Automated check by dashboard on model file name',
      observation: ok ? '' : `"${m.name}" does not follow ${NAMING_PATTERN_LABEL}`, observationClosed: ok, automated: true,
    });
  }
  return rows;
}
export interface CategoryScore { category: ComplianceCategory; checks: number; pass: number; fail: number; observation: number; score: number | null; openObservations: number; verified: boolean }
/** Score = (Pass + 0.5 × Observation) / checks. Categories without evidence are reported as NOT VERIFIED (score null). */
export function complianceScores(rows: ComplianceRow[]): CategoryScore[] {
  return COMPLIANCE_CATEGORIES.map((category) => {
    const r = rows.filter((x) => x.category === category);
    const pass = r.filter((x) => x.result === 'Pass').length;
    const fail = r.filter((x) => x.result === 'Fail').length;
    const observation = r.filter((x) => x.result === 'Observation').length;
    return {
      category, checks: r.length, pass, fail, observation,
      score: r.length ? ((pass + 0.5 * observation) / r.length) * 100 : null,
      openObservations: r.filter((x) => x.result !== 'Pass' && !x.observationClosed).length,
      verified: r.length > 0,
    };
  });
}
export function overallCompliance(scores: CategoryScore[]) {
  const v = scores.filter((s) => s.verified);
  return { score: v.length ? v.reduce((a, s) => a + (s.score ?? 0), 0) / v.length : null, verified: v.length, total: scores.length };
}

// ---------------------------------------------------------------- risks
export const riskScore = (r: Risk) => r.likelihood * r.impact;
export const riskSeverity = (r: Risk): Severity => {
  const s = riskScore(r);
  return s >= 15 ? 'Critical' : s >= 10 ? 'High' : s >= 5 ? 'Medium' : 'Low';
};
export const isRiskOpenAsOf = (r: Risk, asOf: ISODate) => r.raisedDate <= asOf && r.status !== 'Closed';

// ---------------------------------------------------------------- composite progress & health
export const PROGRESS_WEIGHTS = { model: 0.3, coordination: 0.25, clash: 0.25, deliverables: 0.2 };
export interface ProgressBreakdown { model: number; coordination: number; clash: number; deliverables: number; overall: number }
export function progressAsOf(ds: Dataset, f: GlobalFilters, asOf: ISODate): ProgressBreakdown {
  const states = modelStates(filterModels(ds.models, f), ds.submissions, asOf);
  const mk = modelKpis(states);
  const ck = clashKpis(filterClashes(ds.clashes, f), { asOf, periodStart: asOf });
  const dk = deliverableKpis(filterDeliverables(ds.deliverables, f), asOf);
  const parts = { model: mk.avgDevelopment, coordination: mk.coordinationProgress, clash: ck.resolutionRate, deliverables: dk.progress };
  // Only weight components that have data, so an empty module does not drag the score to zero.
  const has = { model: states.length > 0, coordination: states.length > 0, clash: ck.total > 0, deliverables: dk.total > 0 };
  let wsum = 0, sum = 0;
  for (const k of Object.keys(parts) as (keyof typeof parts)[]) if (has[k]) { wsum += PROGRESS_WEIGHTS[k]; sum += PROGRESS_WEIGHTS[k] * parts[k]; }
  return { ...parts, overall: wsum ? sum / wsum : 0 };
}

export interface HealthComponent { label: string; value: number; weight: number; detail: string }
export function bimHealth(ds: Dataset, f: GlobalFilters, s: Scope) {
  const ck = clashKpis(filterClashes(ds.clashes, f), s);
  const dk = deliverableKpis(filterDeliverables(ds.deliverables, f), s.asOf);
  const comp = overallCompliance(complianceScores(complianceRows(filterCompliance(ds.compliance, f), filterModels(ds.models, f), s.asOf)));
  const comps: HealthComponent[] = [];
  if (ck.total) {
    comps.push({ label: 'Clash resolution', value: ck.resolutionRate, weight: 0.3, detail: `${ck.closed}/${ck.total} resolved` });
    comps.push({ label: 'Open clashes within due date', value: ck.open ? 100 - ratio(ck.overdue, ck.open) : 100, weight: 0.2, detail: `${ck.overdue} of ${ck.open} open are overdue` });
    comps.push({ label: 'Critical exposure', value: Math.max(0, 100 - ck.critical * 5), weight: 0.15, detail: `${ck.critical} open critical (−5 pts each)` });
  }
  if (dk.submitted) comps.push({ label: 'Deliverables on time', value: dk.onTimeRate, weight: 0.2, detail: `${dk.overdue} deliverables overdue` });
  if (comp.score !== null) comps.push({ label: 'Compliance (verified categories)', value: comp.score, weight: 0.15, detail: `${comp.verified}/${comp.total} categories verified` });
  const wsum = comps.reduce((a, c) => a + c.weight, 0);
  const score = wsum ? comps.reduce((a, c) => a + c.value * c.weight, 0) / wsum : null;
  const rating = score === null ? 'No data' : score >= 75 ? 'On Track' : score >= 55 ? 'Needs Attention' : 'At Risk';
  return { score, rating, components: comps };
}

// ---------------------------------------------------------------- time series
export function weeklySeries(ds: Dataset, f: GlobalFilters, asOf: ISODate, weeks = 12) {
  const clashes = filterClashes(ds.clashes, f);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = addDays(asOf, -7 * i);
    const start = addDays(end, -6);
    const k = clashKpis(clashes, { asOf: end, periodStart: start });
    const p = progressAsOf(ds, f, end);
    out.push({
      label: end.slice(5).split('-').reverse().join('/'), end,
      newClashes: k.newInPeriod, resolved: k.resolvedInPeriod, open: k.open, closed: k.closed, overdue: k.overdue, critical: k.critical,
      resolutionRate: +k.resolutionRate.toFixed(1), overall: +p.overall.toFixed(1), model: +p.model.toFixed(1),
      coordination: +p.coordination.toFixed(1), clash: +p.clash.toFixed(1), deliverables: +p.deliverables.toFixed(1),
    });
  }
  return out;
}
export function monthlySeries(ds: Dataset, f: GlobalFilters, asOf: ISODate, months = 6) {
  const clashes = filterClashes(ds.clashes, f);
  const out = [];
  const d = new Date(asOf + 'T00:00:00Z');
  for (let i = months - 1; i >= 0; i--) {
    const ms = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    const me = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() + 1, 0));
    const start = ms.toISOString().slice(0, 10);
    const end = me.toISOString().slice(0, 10) > asOf ? asOf : me.toISOString().slice(0, 10);
    const k = clashKpis(clashes, { asOf: end, periodStart: start });
    const p = progressAsOf(ds, f, end);
    const dk = deliverableKpis(filterDeliverables(ds.deliverables, f), end);
    out.push({
      label: ms.toLocaleString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), end,
      newClashes: k.newInPeriod, resolved: k.resolvedInPeriod, open: k.open, resolutionRate: +k.resolutionRate.toFixed(1),
      overall: +p.overall.toFixed(1), deliverablesSubmitted: dk.submitted, deliverablesApproved: dk.approved,
    });
  }
  return out;
}

// ---------------------------------------------------------------- observations
/** Auto-generated, data-driven observations for reports (editable by the user before export). */
export function keyObservations(ds: Dataset, f: GlobalFilters, s: Scope): string[] {
  const clashes = filterClashes(ds.clashes, f);
  const k = clashKpis(clashes, s);
  const prev = clashKpis(clashes, { asOf: addDays(s.periodStart, -1), periodStart: addDays(s.periodStart, -7) });
  const out: string[] = [];
  if (!k.total) return ['No clash data in the selected scope.'];
  out.push(`${k.open} clashes remain open of ${k.total} identified (resolution rate ${k.resolutionRate.toFixed(1)}%).`);
  out.push(`${k.newInPeriod} new clashes were identified and ${k.resolvedInPeriod} resolved during the reporting period.`);
  if (prev.total) {
    const delta = k.open - prev.open;
    out.push(`Open clash count ${delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'was unchanged'}${delta ? ` by ${Math.abs(delta)}` : ''} compared to the start of the period.`);
  }
  if (k.critical) out.push(`${k.critical} critical clashes remain open and require priority resolution.`);
  if (k.overdue) out.push(`${k.overdue} open clashes (${ratio(k.overdue, k.open).toFixed(0)}% of open) are past their due date.`);
  const m = buildMatrix(clashes, 'open', s.asOf);
  const top = [...m.cells.values()].sort((a, b) => b.score - a.score)[0];
  if (top) out.push(`Highest coordination hotspot: ${top.a} vs ${top.b} with ${top.count} open clashes (${top.bySeverity.Critical} critical).`);
  const byBld = countBy(clashes.filter((c) => isOpenAsOf(c, s.asOf)), (c) => c.building);
  const bTop = Object.entries(byBld).sort((a, b) => b[1] - a[1])[0];
  if (bTop) out.push(`Building ${bTop[0]} carries the most open clashes (${bTop[1]}).`);
  if (k.repeated) out.push(`${k.repeated} open clash${k.repeated === 1 ? ' is a repeat detection' : 'es are repeat detections'}, indicating models not being updated between runs.`);
  return out;
}
