import type { Clash, Dataset, GlobalFilters } from '../types';
import {
  bimHealth, buildMatrix, clashKpis, complianceRows, complianceScores, daysOpen, deliverableKpis, filterClashes, filterCompliance, filterDeliverables,
  filterIssues, filterModels, filterRisks, isIssueOverdueAsOf, isOpenAsOf, isOverdueAsOf, isRiskOpenAsOf, keyObservations, modelKpis, modelStates,
  monthlySeries, overallCompliance, progressAsOf, riskScore, riskSeverity, severityDistribution, statusAsOf, weeklySeries, type Scope,
} from './metrics';
import { addDays, fmtDate } from './dates';
import { DISCIPLINES, SEVERITIES } from './constants';

export type ReportType = 'executive' | 'matrix' | 'weekly' | 'monthly';
export const REPORT_TYPES: { id: ReportType; title: string; desc: string }[] = [
  { id: 'executive', title: 'Executive BIM Report', desc: 'KPI summary, health, trends, critical issues, observations and actions — for Client / PMC meetings.' },
  { id: 'matrix', title: 'Clash Matrix Report', desc: 'Discipline-to-discipline matrices (open, critical, overdue), hotspots and the open clash list.' },
  { id: 'weekly', title: 'Weekly BIM Progress Report', desc: 'Week-on-week movement: new vs resolved, progress components, deliverables and outstanding items.' },
  { id: 'monthly', title: 'Monthly BIM Performance Report', desc: 'Six-month performance trend, deliverables, compliance, risks and model coordination.' },
];

export interface ReportSettings { preparedBy: string; issueDate: string; observations: string; actions: string; }

export function defaultActions(ds: Dataset, f: GlobalFilters, s: Scope, companyName: (id: string) => string): string[] {
  const clashes = filterClashes(ds.clashes, f).filter((c) => isOpenAsOf(c, s.asOf) && (c.severity === 'Critical' || isOverdueAsOf(c, s.asOf)));
  const byCompany = new Map<string, Clash[]>();
  for (const c of clashes) { const k = c.responsibleCompanyId; if (!byCompany.has(k)) byCompany.set(k, []); byCompany.get(k)!.push(c); }
  const out = [...byCompany.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 5).map(([k, list]) => {
    const crit = list.filter((c) => c.severity === 'Critical').length;
    return `${companyName(k) || 'Unassigned'}: resolve ${list.length} priority clash${list.length > 1 ? 'es' : ''}${crit ? ` (${crit} critical)` : ''} — target ${fmtDate(addDays(s.asOf, 7))}.`;
  });
  const risks = filterRisks(ds.risks, f).filter((r) => isRiskOpenAsOf(r, s.asOf) && riskScore(r) >= 12).sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 3);
  for (const r of risks) out.push(`${companyName(r.ownerCompanyId)}: ${r.mitigation} (risk ${r.id}, target ${fmtDate(r.targetDate)}).`);
  const dl = filterDeliverables(ds.deliverables, f).filter((d) => !d.actualDate || d.actualDate > s.asOf).filter((d) => d.plannedDate < s.asOf).slice(0, 3);
  for (const d of dl) out.push(`${companyName(d.responsibleCompanyId)}: submit overdue deliverable ${d.id} “${d.name}”.`);
  return out.length ? out : ['No outstanding priority actions.'];
}

export function buildReport(ds: Dataset, f: GlobalFilters, s: Scope) {
  const clashes = filterClashes(ds.clashes, f);
  const models = filterModels(ds.models, f);
  const states = modelStates(models, ds.submissions, s.asOf);
  const deliverables = filterDeliverables(ds.deliverables, f);
  const issues = filterIssues(ds.issues, f);
  const ck = clashKpis(clashes, s);
  const prevAsOf = addDays(s.periodStart, -1);
  const pk = clashKpis(clashes, { asOf: prevAsOf, periodStart: addDays(prevAsOf, -6) });
  const mk = modelKpis(states);
  const dk = deliverableKpis(deliverables, s.asOf);
  const prog = progressAsOf(ds, f, s.asOf);
  const health = bimHealth(ds, f, s);
  const comp = complianceScores(complianceRows(filterCompliance(ds.compliance, f), models, s.asOf));
  const overdueIssues = issues.filter((i) => isIssueOverdueAsOf(i, s.asOf)).length;
  const kpis: { label: string; value: string; prev?: string }[] = [
    { label: 'Total models', value: String(mk.received) },
    { label: 'Total clashes', value: String(ck.total), prev: String(pk.total) },
    { label: 'Open clashes', value: String(ck.open), prev: String(pk.open) },
    { label: 'Closed clashes', value: String(ck.closed), prev: String(pk.closed) },
    { label: 'Critical clashes (open)', value: String(ck.critical), prev: String(pk.critical) },
    { label: 'High priority (open P1/P2)', value: String(ck.high), prev: String(pk.high) },
    { label: 'Clash resolution rate', value: `${ck.resolutionRate.toFixed(1)}%`, prev: `${pk.resolutionRate.toFixed(1)}%` },
    { label: 'Overdue issues (all)', value: String(ck.overdue + overdueIssues) },
    { label: 'BIM deliverables submitted', value: `${dk.submitted} of ${dk.due} due` },
    { label: 'BIM deliverables approved', value: `${dk.approved} of ${dk.total}` },
    { label: 'Overall BIM progress', value: `${prog.overall.toFixed(1)}%` },
    { label: 'Model coordination progress', value: `${mk.coordinationProgress.toFixed(1)}%` },
  ];
  const openList = clashes.filter((c) => isOpenAsOf(c, s.asOf))
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || a.dueDate.localeCompare(b.dueDate));
  const outstanding = openList.filter((c) => c.severity === 'Critical' || c.severity === 'High' || isOverdueAsOf(c, s.asOf)).slice(0, 25).map((c) => ({
    id: c.id, description: c.description, pair: `${c.disciplineA}/${c.disciplineB}`, location: `${c.building} ${c.zone} ${c.level}`,
    severity: c.severity, status: statusAsOf(c, s.asOf), responsible: c.responsibleCompanyId, due: c.dueDate, overdue: isOverdueAsOf(c, s.asOf), days: daysOpen(c, s.asOf),
  }));
  const risks = filterRisks(ds.risks, f).filter((r) => isRiskOpenAsOf(r, s.asOf)).sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 10)
    .map((r) => ({ id: r.id, title: r.title, severity: riskSeverity(r), score: riskScore(r), owner: r.ownerCompanyId, mitigation: r.mitigation, target: r.targetDate }));
  const discProgress = DISCIPLINES.map((d) => {
    const st = states.filter((x) => x.model.discipline === d.code);
    return { code: d.code, models: st.length, approved: st.filter((x) => x.status === 'Approved').length, progress: st.length ? st.reduce((a, x) => a + x.progress, 0) / st.length : null };
  }).filter((x) => x.models);
  return {
    kpis, ck, pk, mk, dk, prog, health, comp, compOverall: overallCompliance(comp),
    weekly: weeklySeries(ds, f, s.asOf, 8), monthly: monthlySeries(ds, f, s.asOf, 6),
    severity: severityDistribution(clashes, s),
    matrices: { open: buildMatrix(clashes, 'open', s.asOf), critical: buildMatrix(clashes, 'critical', s.asOf), overdue: buildMatrix(clashes, 'overdue', s.asOf), total: buildMatrix(clashes, 'total', s.asOf) },
    outstanding, risks, discProgress, observations: keyObservations(ds, f, s), openCount: openList.length,
  };
}
export type ReportData = ReturnType<typeof buildReport>;
