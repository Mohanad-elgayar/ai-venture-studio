import type { Clash, CoordinationIssue, Dataset, Deliverable, DisciplineCode, Severity } from '../types';
import { addDays, isValidISODate, parseLooseDate, todayISO } from '../lib/dates';
import { CLASH_STATUSES, CLASH_TYPES, CLOSED_STATUSES, DELIVERABLE_TYPES, ISSUE_STATUSES, ISSUE_TYPES, PRIORITIES, SEVERITIES, SEVERITY_SLA, APPROVAL_STATUSES } from '../lib/constants';
import { normalisePair } from '../lib/metrics';
import { FIELDS, disciplinesFromTestName, norm, toDiscipline, toEnum, type Target } from './fields';
import type { Cell } from './parse';

export type DuplicatePolicy = 'skip' | 'update';
export interface ImportOptions {
  duplicatePolicy: DuplicatePolicy;
  defaults: {
    building: string; zone: string; level: string; package: string; severity: Severity; disciplineA?: DisciplineCode; disciplineB?: DisciplineCode;
  };
  inferDisciplines: boolean;
  severityFromDistance: boolean;
  source: Clash['source'];
}
export type RowState = 'new' | 'update' | 'skip' | 'error';
export interface RowResult { index: number; id: string; state: RowState; errors: string[]; warnings: string[] }
export interface ImportResult<T> { records: T[]; rows: RowResult[]; counts: Record<RowState, number> }

const str = (v: Cell | undefined) => (v === null || v === undefined ? '' : String(v).trim());

/** Pick mapped value for a target field from a source row. mapping: sourceHeader -> fieldKey */
function getter(mapping: Record<string, string>) {
  const inv: Record<string, string> = {};
  for (const [h, k] of Object.entries(mapping)) if (k) inv[k] = h;
  return { get: (row: Record<string, Cell>, key: string) => (inv[key] ? row[inv[key]] : undefined), has: (key: string) => !!inv[key] };
}

function matchCompany(ds: Dataset, v: string) {
  if (!v) return '';
  const n = norm(v);
  return ds.companies.find((c) => norm(c.name) === n || norm(c.shortName) === n || c.id === v)?.id
    ?? ds.companies.find((c) => n.length > 3 && (norm(c.name).includes(n) || n.includes(norm(c.name))))?.id ?? '';
}
function matchUser(ds: Dataset, v: string) {
  if (!v) return '';
  const n = norm(v);
  return ds.users.find((u) => u.id === v || norm(u.name) === n || norm(u.email) === n || norm(u.name.replace(/\(demo\)/i, '')) === n)?.id ?? '';
}

function finish<T>(records: T[], rows: RowResult[]): ImportResult<T> {
  const counts: Record<RowState, number> = { new: 0, update: 0, skip: 0, error: 0 };
  for (const r of rows) counts[r.state]++;
  return { records, rows, counts };
}

export function buildClashes(raw: Record<string, Cell>[], mapping: Record<string, string>, opt: ImportOptions, ds: Dataset, projectId: string): ImportResult<Clash> {
  const { get, has } = getter(mapping);
  const project = ds.projects.find((p) => p.id === projectId)!;
  const existing = new Map(ds.clashes.filter((c) => c.projectId === projectId).map((c) => [c.id, c]));
  const seen = new Set<string>();
  const records: Clash[] = [];
  const rows: RowResult[] = [];
  const today = todayISO();

  raw.forEach((row, index) => {
    const errors: string[] = [], warnings: string[] = [];
    const id = str(get(row, 'id'));
    if (!id) errors.push('Missing Clash ID');
    else if (seen.has(id)) errors.push(`Duplicate Clash ID "${id}" within the file`);
    if (id) seen.add(id);
    const prev = existing.get(id);
    if (prev && opt.duplicatePolicy === 'skip') { rows.push({ index, id, state: errors.length ? 'error' : 'skip', errors, warnings: ['Clash ID already exists — skipped'] }); return; }

    // disciplines: mapped columns -> test name -> Item 1/2 source/layer -> defaults
    let a = has('disciplineA') ? toDiscipline(get(row, 'disciplineA')) : null;
    let b = has('disciplineB') ? toDiscipline(get(row, 'disciplineB')) : null;
    if ((!a || !b) && opt.inferDisciplines) {
      const fromTest = disciplinesFromTestName(str(get(row, 'testName')) || str(row['Clash Test Name']) || str(row['Test']));
      if (fromTest) { a = a ?? fromTest[0]; b = b ?? fromTest[1]; }
      a = a ?? toDiscipline(row['Item 1 Source']) ?? toDiscipline(row['Item 1 Layer']);
      b = b ?? toDiscipline(row['Item 2 Source']) ?? toDiscipline(row['Item 2 Layer']);
      if (a && b && !has('disciplineA')) warnings.push(`Disciplines inferred as ${a} / ${b}`);
    }
    a = a ?? opt.defaults.disciplineA ?? prev?.disciplineA ?? null;
    b = b ?? opt.defaults.disciplineB ?? prev?.disciplineB ?? null;
    if (!a || !b) errors.push('Discipline A/B could not be determined — map the columns or set defaults');

    const typeRaw = get(row, 'type');
    let type = toEnum(typeRaw, CLASH_TYPES, 'type') as Clash['type'] | null;
    if (!type) { if (str(typeRaw)) warnings.push(`Clash type "${str(typeRaw)}" not recognised — Hard used`); type = prev?.type ?? 'Hard'; }

    const sevRaw = get(row, 'severity');
    let severity = toEnum(sevRaw, SEVERITIES, 'severity') as Severity | null;
    if (!severity && opt.severityFromDistance) {
      const dist = Number(get(row, 'distance') ?? row['Distance (m)'] ?? row['Distance']);
      if (Number.isFinite(dist) && dist < 0) severity = Math.abs(dist) >= 0.1 ? 'High' : Math.abs(dist) >= 0.03 ? 'Medium' : 'Low';
    }
    if (!severity) { if (str(sevRaw)) warnings.push(`Severity "${str(sevRaw)}" not recognised — default used`); severity = prev?.severity ?? opt.defaults.severity; }
    const priority = (toEnum(get(row, 'priority'), PRIORITIES, 'priority') as Clash['priority'] | null) ?? prev?.priority ?? (['P1', 'P2', 'P3', 'P4'] as const)[SEVERITIES.indexOf(severity)];

    const stRaw = get(row, 'status');
    let status = toEnum(stRaw, CLASH_STATUSES, 'status') as Clash['status'] | null;
    if (!status) { if (str(stRaw)) warnings.push(`Status "${str(stRaw)}" not recognised — New used`); status = prev?.status ?? 'New'; }

    const dRaw = get(row, 'dateIdentified');
    let dateIdentified = parseLooseDate(dRaw);
    if (str(dRaw) && !dateIdentified) errors.push(`Invalid Date Identified "${str(dRaw)}"`);
    if (!dateIdentified) { dateIdentified = prev?.dateIdentified ?? today; if (!str(dRaw)) warnings.push('No Date Identified — import date used'); }
    if (dateIdentified > today) errors.push('Date Identified is in the future');
    const dueRaw = get(row, 'dueDate');
    let dueDate = parseLooseDate(dueRaw);
    if (str(dueRaw) && !dueDate) errors.push(`Invalid Due Date "${str(dueRaw)}"`);
    dueDate = dueDate ?? prev?.dueDate ?? addDays(dateIdentified, SEVERITY_SLA[severity]);
    if (dueDate < dateIdentified) errors.push('Due Date is before Date Identified');
    const resRaw = get(row, 'dateResolved');
    let dateResolved = parseLooseDate(resRaw) ?? undefined;
    if (str(resRaw) && !dateResolved) errors.push(`Invalid Date Resolved "${str(resRaw)}"`);
    if (CLOSED_STATUSES.includes(status) && !dateResolved) { dateResolved = prev?.dateResolved ?? today; warnings.push('Closed without resolution date — import date used'); }
    if (!CLOSED_STATUSES.includes(status)) dateResolved = undefined;
    if (dateResolved && dateResolved < dateIdentified) errors.push('Date Resolved is before Date Identified');

    // location
    const bRaw = str(get(row, 'building'));
    let building = project.buildings.find((x) => norm(x.code) === norm(bRaw) || norm(x.name) === norm(bRaw))?.code;
    if (!building) { if (bRaw) warnings.push(`Building "${bRaw}" not in project — default used`); building = prev?.building ?? opt.defaults.building; }
    const bld = project.buildings.find((x) => x.code === building);
    const level = str(get(row, 'level')) || prev?.level || opt.defaults.level;
    if (bld && level && !bld.levels.some((l) => norm(l) === norm(level))) warnings.push(`Level "${level}" not defined for ${building}`);
    const zone = str(get(row, 'zone')) || prev?.zone || opt.defaults.zone;
    const pkgRaw = str(get(row, 'package'));
    const pkg = project.packages.find((p) => norm(p) === norm(pkgRaw)) ?? (pkgRaw ? pkgRaw : prev?.package ?? opt.defaults.package);

    const [da, db] = a && b ? normalisePair(a, b) : [a ?? 'ARC', b ?? 'ARC'];
    const assignedRaw = str(get(row, 'assignedTo'));
    const assignedTo = matchUser(ds, assignedRaw) || prev?.assignedTo || '';
    if (assignedRaw && !matchUser(ds, assignedRaw)) warnings.push(`Assignee "${assignedRaw}" not a project user — left unassigned`);
    const compRaw = str(get(row, 'responsibleCompany'));
    const responsibleCompanyId = matchCompany(ds, compRaw) || ds.users.find((u) => u.id === assignedTo)?.companyId || prev?.responsibleCompanyId || '';
    if (compRaw && !matchCompany(ds, compRaw)) warnings.push(`Company "${compRaw}" not found`);
    const assignedDiscipline = toDiscipline(get(row, 'assignedDiscipline')) ?? prev?.assignedDiscipline ?? (ds.users.find((u) => u.id === assignedTo)?.discipline) ?? da;

    const description = str(get(row, 'description')) || prev?.description || `${da} vs ${db} clash ${id}`;
    const rec: Clash = {
      ...(prev ?? {}),
      id, projectId, description, type, disciplineA: da, disciplineB: db, building, zone, level, package: pkg,
      gridRef: str(get(row, 'gridRef')) || prev?.gridRef || '', modelRef: str(get(row, 'modelRef')) || prev?.modelRef || '',
      position: str(get(row, 'position')) || prev?.position || '', severity, priority, status, assignedTo, assignedDiscipline,
      responsibleCompanyId, dateIdentified, dueDate, dateResolved, resolutionNotes: str(get(row, 'resolutionNotes')) || prev?.resolutionNotes || '',
      occurrences: prev ? prev.occurrences + (prev.status === 'Closed' || prev.status === 'Resolved' ? 0 : 1) : 1,
      testName: str(get(row, 'testName')) || str(row['Clash Test Name']) || prev?.testName, source: opt.source,
    };
    if (!errors.length) records.push(rec);
    rows.push({ index, id, state: errors.length ? 'error' : prev ? 'update' : 'new', errors, warnings });
  });
  return finish(records, rows);
}

export function buildIssues(raw: Record<string, Cell>[], mapping: Record<string, string>, opt: ImportOptions, ds: Dataset, projectId: string): ImportResult<CoordinationIssue> {
  const { get } = getter(mapping);
  const existing = new Map(ds.issues.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const records: CoordinationIssue[] = [], rows: RowResult[] = [];
  const today = todayISO();
  raw.forEach((row, index) => {
    const errors: string[] = [], warnings: string[] = [];
    const id = str(get(row, 'id'));
    const title = str(get(row, 'title'));
    if (!id) errors.push('Missing Issue ID'); else if (seen.has(id)) errors.push(`Duplicate Issue ID "${id}" within the file`);
    seen.add(id);
    if (!title) errors.push('Missing Title');
    const prev = existing.get(id);
    if (prev && opt.duplicatePolicy === 'skip') { rows.push({ index, id, state: 'skip', errors, warnings: ['Issue ID already exists — skipped'] }); return; }
    const discipline = toDiscipline(get(row, 'discipline')) ?? prev?.discipline ?? opt.defaults.disciplineA ?? null;
    if (!discipline) errors.push('Discipline could not be determined');
    const raised = parseLooseDate(get(row, 'raisedDate')) ?? prev?.raisedDate ?? today;
    const due = parseLooseDate(get(row, 'dueDate')) ?? prev?.dueDate ?? addDays(raised, 14);
    if (str(get(row, 'raisedDate')) && !parseLooseDate(get(row, 'raisedDate'))) errors.push('Invalid Raised Date');
    if (due < raised) errors.push('Due Date before Raised Date');
    const status = (toEnum(get(row, 'status'), ISSUE_STATUSES, 'issueStatus') as CoordinationIssue['status'] | null) ?? prev?.status ?? 'Open';
    const closed = parseLooseDate(get(row, 'closedDate')) ?? (status === 'Closed' ? prev?.closedDate ?? today : undefined);
    const type = (toEnum(get(row, 'type'), ISSUE_TYPES) as CoordinationIssue['type'] | null) ?? prev?.type ?? 'Design Coordination';
    if (str(get(row, 'type')) && !toEnum(get(row, 'type'), ISSUE_TYPES)) warnings.push(`Type "${str(get(row, 'type'))}" not recognised — Design Coordination used`);
    const links = str(get(row, 'linkedClashIds')).split(/[,;\s]+/).filter(Boolean);
    const unknown = links.filter((l) => !ds.clashes.some((c) => c.id === l));
    if (unknown.length) warnings.push(`Unknown clash IDs ignored: ${unknown.join(', ')}`);
    const rec: CoordinationIssue = {
      id, projectId, title, type, discipline: discipline ?? 'ARC', building: str(get(row, 'building')) || prev?.building || opt.defaults.building,
      priority: (toEnum(get(row, 'priority'), SEVERITIES, 'severity') as Severity | null) ?? prev?.priority ?? 'Medium', status,
      raisedBy: matchCompany(ds, str(get(row, 'raisedBy'))) || prev?.raisedBy || '', ownerCompanyId: matchCompany(ds, str(get(row, 'owner'))) || prev?.ownerCompanyId || '',
      raisedDate: raised, dueDate: due, closedDate: status === 'Closed' ? closed : undefined, linkedClashIds: links.filter((l) => !unknown.includes(l)),
    };
    if (!errors.length) records.push(rec);
    rows.push({ index, id, state: errors.length ? 'error' : prev ? 'update' : 'new', errors, warnings });
  });
  return finish(records, rows);
}

export function buildDeliverables(raw: Record<string, Cell>[], mapping: Record<string, string>, opt: ImportOptions, ds: Dataset, projectId: string): ImportResult<Deliverable> {
  const { get } = getter(mapping);
  const existing = new Map(ds.deliverables.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const records: Deliverable[] = [], rows: RowResult[] = [];
  const today = todayISO();
  raw.forEach((row, index) => {
    const errors: string[] = [], warnings: string[] = [];
    const id = str(get(row, 'id'));
    if (!id) errors.push('Missing Deliverable ID'); else if (seen.has(id)) errors.push(`Duplicate ID "${id}" within the file`);
    seen.add(id);
    const name = str(get(row, 'name'));
    if (!name) errors.push('Missing Deliverable Name');
    const prev = existing.get(id);
    if (prev && opt.duplicatePolicy === 'skip') { rows.push({ index, id, state: 'skip', errors, warnings: ['Deliverable ID already exists — skipped'] }); return; }
    const planned = parseLooseDate(get(row, 'plannedDate')) ?? prev?.plannedDate;
    if (!planned || !isValidISODate(planned)) errors.push('Missing or invalid Planned Submission Date');
    const actual = parseLooseDate(get(row, 'actualDate')) ?? prev?.actualDate;
    if (str(get(row, 'actualDate')) && !parseLooseDate(get(row, 'actualDate'))) errors.push('Invalid Actual Submission Date');
    if (actual && actual > today) errors.push('Actual Submission Date is in the future');
    const type = (toEnum(get(row, 'type'), DELIVERABLE_TYPES) as Deliverable['type'] | null) ?? prev?.type ?? 'Model Delivery';
    if (str(get(row, 'type')) && !toEnum(get(row, 'type'), DELIVERABLE_TYPES)) warnings.push(`Type "${str(get(row, 'type'))}" not recognised — Model Delivery used`);
    let approval = (toEnum(get(row, 'approvalStatus'), APPROVAL_STATUSES, 'approval') as Deliverable['approvalStatus'] | null) ?? prev?.approvalStatus ?? 'Pending';
    if (!actual && approval !== 'Pending' && approval !== 'N/A') { warnings.push('Approval set without submission — reset to Pending'); approval = 'Pending'; }
    const discRaw = str(get(row, 'discipline'));
    const discipline = /^(all|project|general|multi)/i.test(discRaw) || !discRaw ? 'ALL' : toDiscipline(discRaw) ?? 'ALL';
    const revision = str(get(row, 'revision')) || prev?.revision || 'P01';
    const rec: Deliverable = {
      id, projectId, name, type, discipline, responsibleCompanyId: matchCompany(ds, str(get(row, 'responsible'))) || prev?.responsibleCompanyId || '',
      plannedDate: planned ?? today, actualDate: actual, revision,
      status: actual ? (revision !== 'C01' && revision.startsWith('C') ? 'Resubmitted' : 'Submitted') : (planned ?? today) < today ? 'Overdue' : 'In Progress',
      approvalStatus: approval, reviewedDate: approval !== 'Pending' ? parseLooseDate(get(row, 'reviewedDate')) ?? actual : undefined,
      reviewComments: str(get(row, 'reviewComments')) || prev?.reviewComments || '',
    };
    if (!errors.length) records.push(rec);
    rows.push({ index, id, state: errors.length ? 'error' : prev ? 'update' : 'new', errors, warnings });
  });
  return finish(records, rows);
}

export function buildRecords(target: Target, raw: Record<string, Cell>[], mapping: Record<string, string>, opt: ImportOptions, ds: Dataset, projectId: string) {
  if (target === 'clashes') return buildClashes(raw, mapping, opt, ds, projectId);
  if (target === 'issues') return buildIssues(raw, mapping, opt, ds, projectId);
  return buildDeliverables(raw, mapping, opt, ds, projectId);
}
export const requiredMissing = (target: Target, mapping: Record<string, string>) =>
  FIELDS[target].filter((f) => f.required && !Object.values(mapping).includes(f.key)).map((f) => f.label);
