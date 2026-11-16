/** Target field definitions, header synonyms (incl. Navisworks Clash Detective) and value normalisers. */
import type { DisciplineCode } from '../types';
import { APPROVAL_STATUSES, CLASH_STATUSES, CLASH_TYPES, DELIVERABLE_TYPES, ISSUE_STATUSES, ISSUE_TYPES, PRIORITIES, SEVERITIES } from '../lib/constants';

export type Target = 'clashes' | 'issues' | 'deliverables';
export type FieldType = 'string' | 'date' | 'enum' | 'discipline' | 'number' | 'list';
export interface FieldDef { key: string; label: string; required?: boolean; type: FieldType; values?: readonly string[]; synonyms: string[]; help?: string }

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const FIELDS: Record<Target, FieldDef[]> = {
  clashes: [
    { key: 'id', label: 'Clash ID', required: true, type: 'string', synonyms: ['clashid', 'id', 'clash', 'clashname', 'name', 'clashno', 'issueid', 'guid'] },
    { key: 'description', label: 'Clash Description', type: 'string', synonyms: ['clashdescription', 'description', 'title', 'summary', 'comments'] , help: 'Defaults to "<Item 1> vs <Item 2>" for Navisworks' },
    { key: 'type', label: 'Clash Type', type: 'enum', values: CLASH_TYPES, synonyms: ['clashtype', 'type', 'testtype', 'navisworksdescription'] },
    { key: 'disciplineA', label: 'Discipline A', type: 'discipline', synonyms: ['disciplinea', 'discipline1', 'item1discipline', 'item1layer', 'modela', 'selectiona', 'item1'] },
    { key: 'disciplineB', label: 'Discipline B', type: 'discipline', synonyms: ['disciplineb', 'discipline2', 'item2discipline', 'item2layer', 'modelb', 'selectionb', 'item2'] },
    { key: 'testName', label: 'Clash Test Name', type: 'string', synonyms: ['testname', 'clashtest', 'test', 'clashtestname'], help: 'Used to infer disciplines, e.g. "MEC vs STR"' },
    { key: 'building', label: 'Building', type: 'string', synonyms: ['building', 'block', 'bldg', 'volume', 'asset'] },
    { key: 'zone', label: 'Zone', type: 'string', synonyms: ['zone', 'area', 'sector'] },
    { key: 'level', label: 'Level', type: 'string', synonyms: ['level', 'floor', 'storey', 'gridlevel'] },
    { key: 'package', label: 'Package', type: 'string', synonyms: ['package', 'workpackage', 'trade'] },
    { key: 'gridRef', label: 'Grid Reference', type: 'string', synonyms: ['gridreference', 'grid', 'gridlocation', 'gridref', 'gridintersection'] },
    { key: 'modelRef', label: 'Model Reference', type: 'string', synonyms: ['modelreference', 'model', 'item1source', 'sourcefile', 'file', 'item1path'] },
    { key: 'position', label: 'Clash Position', type: 'string', synonyms: ['clashposition', 'clashpoint', 'position', 'location', 'coordinates', 'xyz'] },
    { key: 'distance', label: 'Distance (m)', type: 'number', synonyms: ['distance', 'penetration', 'overlap'], help: 'Negative = penetration depth (Navisworks)' },
    { key: 'severity', label: 'Severity', type: 'enum', values: SEVERITIES, synonyms: ['severity', 'criticality', 'impact'] },
    { key: 'priority', label: 'Priority', type: 'enum', values: PRIORITIES, synonyms: ['priority', 'prio'] },
    { key: 'status', label: 'Status', type: 'enum', values: CLASH_STATUSES, synonyms: ['status', 'clashstatus', 'resultstatus', 'state'] },
    { key: 'assignedTo', label: 'Assigned To', type: 'string', synonyms: ['assignedto', 'assignee', 'owner', 'responsibleperson'] },
    { key: 'assignedDiscipline', label: 'Assigned Discipline', type: 'discipline', synonyms: ['assigneddiscipline', 'responsiblediscipline'] },
    { key: 'responsibleCompany', label: 'Responsible Company', type: 'string', synonyms: ['responsiblecompany', 'company', 'responsibleparty', 'contractor', 'organisation', 'organization'] },
    { key: 'dateIdentified', label: 'Date Identified', type: 'date', synonyms: ['dateidentified', 'datefound', 'found', 'created', 'datecreated', 'createddate', 'detected'] },
    { key: 'dueDate', label: 'Due Date', type: 'date', synonyms: ['duedate', 'due', 'targetdate', 'deadline'] },
    { key: 'dateResolved', label: 'Date Resolved', type: 'date', synonyms: ['dateresolved', 'resolved', 'resolveddate', 'closeddate', 'dateapproved', 'approveddate'] },
    { key: 'resolutionNotes', label: 'Resolution Notes', type: 'string', synonyms: ['resolutionnotes', 'resolution', 'notes', 'comment', 'remarks'] },
  ],
  issues: [
    { key: 'id', label: 'Issue ID', required: true, type: 'string', synonyms: ['issueid', 'id', 'number', 'ref', 'reference', 'issueno'] },
    { key: 'title', label: 'Title', required: true, type: 'string', synonyms: ['title', 'name', 'subject', 'description', 'summary'] },
    { key: 'type', label: 'Issue Type', type: 'enum', values: ISSUE_TYPES, synonyms: ['type', 'issuetype', 'category', 'rootcause'] },
    { key: 'discipline', label: 'Discipline', type: 'discipline', synonyms: ['discipline', 'trade'] },
    { key: 'building', label: 'Building', type: 'string', synonyms: ['building', 'location', 'block'] },
    { key: 'priority', label: 'Priority', type: 'enum', values: SEVERITIES, synonyms: ['priority', 'severity'] },
    { key: 'status', label: 'Status', type: 'enum', values: ISSUE_STATUSES, synonyms: ['status', 'state'] },
    { key: 'owner', label: 'Owner Company', type: 'string', synonyms: ['owner', 'assignedto', 'assignee', 'company', 'responsible'] },
    { key: 'raisedBy', label: 'Raised By', type: 'string', synonyms: ['raisedby', 'createdby', 'author'] },
    { key: 'raisedDate', label: 'Raised Date', type: 'date', synonyms: ['raiseddate', 'created', 'createdon', 'datecreated', 'opened'] },
    { key: 'dueDate', label: 'Due Date', type: 'date', synonyms: ['duedate', 'due', 'deadline'] },
    { key: 'closedDate', label: 'Closed Date', type: 'date', synonyms: ['closeddate', 'closed', 'closedon', 'resolved'] },
    { key: 'linkedClashIds', label: 'Linked Clash IDs', type: 'list', synonyms: ['linkedclashids', 'clashes', 'linkedclashes', 'clashid'] },
  ],
  deliverables: [
    { key: 'id', label: 'Deliverable ID', required: true, type: 'string', synonyms: ['deliverableid', 'id', 'documentnumber', 'docno', 'ref'] },
    { key: 'name', label: 'Deliverable Name', required: true, type: 'string', synonyms: ['deliverablename', 'name', 'title', 'description'] },
    { key: 'type', label: 'Type', type: 'enum', values: DELIVERABLE_TYPES, synonyms: ['type', 'deliverabletype', 'category'] },
    { key: 'discipline', label: 'Discipline', type: 'discipline', synonyms: ['discipline'] },
    { key: 'responsible', label: 'Responsible Party', type: 'string', synonyms: ['responsibleparty', 'responsible', 'company', 'originator'] },
    { key: 'plannedDate', label: 'Planned Submission Date', required: true, type: 'date', synonyms: ['plannedsubmissiondate', 'planneddate', 'planned', 'baseline', 'duedate'] },
    { key: 'actualDate', label: 'Actual Submission Date', type: 'date', synonyms: ['actualsubmissiondate', 'actualdate', 'actual', 'submitted', 'submissiondate'] },
    { key: 'revision', label: 'Revision', type: 'string', synonyms: ['revision', 'rev'] },
    { key: 'approvalStatus', label: 'Approval Status', type: 'enum', values: APPROVAL_STATUSES, synonyms: ['approvalstatus', 'approval', 'reviewstatus', 'reviewcode'] },
    { key: 'reviewedDate', label: 'Review Date', type: 'date', synonyms: ['reviewdate', 'revieweddate', 'approvaldate'] },
    { key: 'reviewComments', label: 'Review Comments', type: 'string', synonyms: ['reviewcomments', 'comments', 'remarks'] },
  ],
};

/** Suggest a target field for each source header (exact synonym first, then contains). */
export function autoMap(target: Target, headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  const fields = FIELDS[target];
  const pass = (pred: (h: string, f: FieldDef) => boolean) => {
    for (const f of fields) {
      if (used.has(f.key)) continue;
      const h = headers.find((x) => !map[x] && pred(norm(x), f));
      if (h) { map[h] = f.key; used.add(f.key); }
    }
  };
  pass((h, f) => norm(f.label) === h);
  pass((h, f) => f.synonyms.includes(h));
  pass((h, f) => f.synonyms.some((s) => s.length > 4 && h.includes(s)));
  return map;
}

// ---------------------------------------------------------------- value normalisers
const DISC_TOKENS: [RegExp, DisciplineCode][] = [
  [/\b(hvac|duct|ductwork|ventilation|ac)\b/i, 'HVAC'],
  [/\b(ff|fp|fire|sprinkler|sprinklers|firefighting|fire\s*fighting|fire\s*protection)\b/i, 'FF'],
  [/\b(plb|plumb|plumbing|ph|public\s*health|drainage|drain|sanitary)\b/i, 'PLB'],
  [/\b(ele|elec|electrical|el|cable|lighting)\b/i, 'ELE'],
  [/\b(mec|mech|mechanical|me)\b/i, 'MEC'],
  [/\b(str|struct|structure|structural|st)\b/i, 'STR'],
  [/\b(arc|arch|architecture|architectural|ar)\b/i, 'ARC'],
  [/\b(inf|infra|infrastructure|utilities|utility)\b/i, 'INF'],
  [/\b(lnd|land|landscape|landscaping|hardscape)\b/i, 'LND'],
  [/\b(civ|civil|civils|roads|earthworks)\b/i, 'CIV'],
];
export function toDiscipline(v: unknown): DisciplineCode | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (['ARC', 'STR', 'MEC', 'ELE', 'PLB', 'FF', 'HVAC', 'INF', 'LND', 'CIV'].includes(up)) return up as DisciplineCode;
  const spaced = s.replace(/[_\-.]/g, ' ');
  for (const [re, code] of DISC_TOKENS) if (re.test(spaced)) return code;
  return null;
}
/** "MEC vs STR", "M-S", "HVAC_x_Structure" -> [A, B] */
export function disciplinesFromTestName(name: string): [DisciplineCode, DisciplineCode] | null {
  const parts = name.split(/\s+(?:vs\.?|v|x|against|versus)\s+|\s*[-_/|]\s*(?:vs\.?|v|x)?\s*/i).filter(Boolean);
  const codes = parts.map(toDiscipline).filter(Boolean) as DisciplineCode[];
  if (codes.length >= 2) return [codes[0], codes[1]];
  if (codes.length === 1 && /self|internal|itself/i.test(name)) return [codes[0], codes[0]];
  return null;
}

const ENUM_ALIASES: Record<string, Record<string, string>> = {
  status: { // clash statuses incl. Navisworks: New, Active, Reviewed, Approved, Resolved
    new: 'New', active: 'Active', open: 'Active', assigned: 'Assigned', inprogress: 'In Progress', wip: 'In Progress', ongoing: 'In Progress',
    reviewed: 'Pending Review', pendingreview: 'Pending Review', review: 'Pending Review', forreview: 'Pending Review',
    resolved: 'Resolved', fixed: 'Resolved', approved: 'Closed', closed: 'Closed', done: 'Closed', reopened: 'Reopened', reopen: 'Reopened',
  },
  type: { hard: 'Hard', hardconservative: 'Hard', soft: 'Soft', clearance: 'Clearance', duplicates: 'Hard', duplicate: 'Hard', tolerance: 'Clearance' },
  severity: { critical: 'Critical', crit: 'Critical', veryhigh: 'Critical', high: 'High', major: 'High', medium: 'Medium', med: 'Medium', moderate: 'Medium', minor: 'Low', low: 'Low', '1': 'Critical', '2': 'High', '3': 'Medium', '4': 'Low' },
  priority: { p1: 'P1', p2: 'P2', p3: 'P3', p4: 'P4', '1': 'P1', '2': 'P2', '3': 'P3', '4': 'P4', critical: 'P1', urgent: 'P1', high: 'P2', medium: 'P3', normal: 'P3', low: 'P4' },
  issueStatus: { open: 'Open', new: 'Open', draft: 'Open', inprogress: 'In Progress', active: 'In Progress', answered: 'Awaiting Response', inreview: 'Awaiting Response', awaitingresponse: 'Awaiting Response', pending: 'Awaiting Response', closed: 'Closed', resolved: 'Closed', void: 'Closed' },
  approval: { a: 'Approved', approved: 'Approved', b: 'Approved with Comments', approvedwithcomments: 'Approved with Comments', approvedascommented: 'Approved with Comments', c: 'Rejected', rejected: 'Rejected', reviseandresubmit: 'Rejected', pending: 'Pending', underreview: 'Pending', na: 'N/A' },
};
export function toEnum(v: unknown, values: readonly string[], alias?: keyof typeof ENUM_ALIASES): string | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const s = String(v).trim();
  const exact = values.find((x) => x.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  const n = norm(s);
  const byNorm = values.find((x) => norm(x) === n);
  if (byNorm) return byNorm;
  if (alias && ENUM_ALIASES[alias][n] && values.includes(ENUM_ALIASES[alias][n])) return ENUM_ALIASES[alias][n];
  return null;
}
