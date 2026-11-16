/**
 * DEMO DATA GENERATOR
 * -------------------
 * Produces a realistic but entirely FICTIONAL dataset for demonstration purposes.
 * Every company, person, model and clash below is invented. Nothing here represents
 * real project performance. Data is generated with a fixed seed so it is identical
 * on every load, and all dashboard metrics are calculated from it at runtime.
 */
import type {
  BimModel, Building, Clash, ClashHistory, ClashStatus, ClashType, Company, ComplianceCheck, ComplianceCategory,
  CoordinationIssue, Dataset, Deliverable, DeliverableType, DisciplineCode, IssueStatus, IssueType, ModelStatus,
  ModelSubmission, Project, ReportingPeriod, Risk, Severity, User,
} from '../types';
import { createRng, type Rng } from '../lib/prng';
import { addDays, diffDays, monthEnd, monthStart, weekStart, toDate } from '../lib/dates';
import { DISCIPLINES, SEVERITY_SLA } from '../lib/constants';

export const DATA_VERSION = 4;
export const DEMO_ANCHOR = '2026-11-15'; // "data cut-off" of the demo dataset
const PROJECT_ID = 'prj-demo-hmd';

const LV = (n: number) => Array.from({ length: n }, (_, i) => `L${String(i + 1).padStart(2, '0')}`);
const BUILDINGS: Building[] = [
  { code: 'T1', name: 'Tower 1 — Office', zones: ['North', 'South', 'Core'], levels: ['B2', 'B1', 'GF', ...LV(12), 'RF'] },
  { code: 'T2', name: 'Tower 2 — Residential', zones: ['East', 'West', 'Core'], levels: ['B2', 'B1', 'GF', ...LV(10), 'RF'] },
  { code: 'PD', name: 'Retail Podium', zones: ['Z1', 'Z2', 'Z3', 'Z4'], levels: ['B2', 'B1', 'GF', 'L01', 'L02', 'RF'] },
  { code: 'SW', name: 'Site Works & Infrastructure', zones: ['North Plot', 'South Plot', 'Utility Corridor'], levels: ['Below Ground', 'External'] },
];
const PACKAGES = ['Substructure', 'Superstructure', 'MEP Package A (T1)', 'MEP Package B (T2/PD)', 'Façade', 'Fit-out', 'External Works'];

const COMPANIES: Company[] = [
  { id: 'c-client', name: 'Demo Client Holdings', shortName: 'DCH', role: 'Client', disciplines: [] },
  { id: 'c-pmc', name: 'Demo PMC Partners', shortName: 'DPP', role: 'PMC', disciplines: [] },
  { id: 'c-lead', name: 'Demo Lead Architects', shortName: 'DLA', role: 'Lead Consultant', disciplines: ['ARC'] },
  { id: 'c-str', name: 'Demo Structural Engineers', shortName: 'DSE', role: 'Design Consultant', disciplines: ['STR'] },
  { id: 'c-mep', name: 'Demo MEP Consultants', shortName: 'DMC', role: 'Design Consultant', disciplines: ['MEC', 'ELE', 'PLB', 'FF', 'HVAC'] },
  { id: 'c-inf', name: 'Demo Infrastructure Engineers', shortName: 'DIE', role: 'Design Consultant', disciplines: ['INF', 'CIV'] },
  { id: 'c-lnd', name: 'Demo Landscape Studio', shortName: 'DLS', role: 'Design Consultant', disciplines: ['LND'] },
  { id: 'c-mc', name: 'Demo Main Contractor JV', shortName: 'DMJ', role: 'Main Contractor', disciplines: ['ARC', 'STR', 'CIV'] },
  { id: 'c-mepsc', name: 'Demo MEP Contractors', shortName: 'DMX', role: 'Subcontractor', disciplines: ['MEC', 'ELE', 'PLB', 'HVAC'] },
  { id: 'c-ffsc', name: 'Demo Fire Protection Co.', shortName: 'DFP', role: 'Subcontractor', disciplines: ['FF'] },
  { id: 'c-bim', name: 'Demo BIM Management', shortName: 'DBM', role: 'BIM Management', disciplines: [] },
];

const USERS: User[] = [
  { id: 'u-admin', name: 'Demo Administrator', email: 'admin@demo.invalid', role: 'Admin', companyId: 'c-bim' },
  { id: 'u-bimm', name: 'Lina Haddad (Demo)', email: 'bim.manager@demo.invalid', role: 'BIM Manager', companyId: 'c-bim' },
  { id: 'u-bimc', name: 'Omar Farouk (Demo)', email: 'bim.coord@demo.invalid', role: 'BIM Coordinator', companyId: 'c-bim' },
  { id: 'u-arc', name: 'Claire Dubois (Demo)', email: 'arc.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-lead', discipline: 'ARC' },
  { id: 'u-str', name: 'Rahul Mehta (Demo)', email: 'str.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-str', discipline: 'STR' },
  { id: 'u-mec', name: 'James Okafor (Demo)', email: 'mec.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-mep', discipline: 'MEC' },
  { id: 'u-ele', name: 'Mei Lin (Demo)', email: 'ele.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-mep', discipline: 'ELE' },
  { id: 'u-plb', name: 'Tomás García (Demo)', email: 'plb.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-mep', discipline: 'PLB' },
  { id: 'u-ff', name: 'Aisha Bello (Demo)', email: 'ff.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-ffsc', discipline: 'FF' },
  { id: 'u-hvac', name: 'Erik Lindqvist (Demo)', email: 'hvac.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-mepsc', discipline: 'HVAC' },
  { id: 'u-mepsc', name: 'Karim Nassar (Demo)', email: 'mep.coord@demo.invalid', role: 'BIM Coordinator', companyId: 'c-mepsc', discipline: 'MEC' },
  { id: 'u-inf', name: 'Priya Nair (Demo)', email: 'inf.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-inf', discipline: 'INF' },
  { id: 'u-civ', name: 'Daniel Brooks (Demo)', email: 'civ.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-mc', discipline: 'CIV' },
  { id: 'u-lnd', name: 'Sofia Rossi (Demo)', email: 'lnd.lead@demo.invalid', role: 'Discipline Lead', companyId: 'c-lnd', discipline: 'LND' },
  { id: 'u-mc', name: 'Yusuf Demir (Demo)', email: 'mc.bim@demo.invalid', role: 'BIM Coordinator', companyId: 'c-mc', discipline: 'STR' },
  { id: 'u-pmc', name: 'Grace Kim (Demo)', email: 'pmc@demo.invalid', role: 'Viewer', companyId: 'c-pmc' },
  { id: 'u-client', name: 'Client Representative (Demo)', email: 'client@demo.invalid', role: 'Viewer', companyId: 'c-client' },
];

const ELEMENTS: Record<DisciplineCode, string[]> = {
  ARC: ['ceiling grid', 'partition wall', 'door frame', 'façade mullion', 'stair landing', 'raised access floor', 'blockwork wall', 'curtain wall bracket'],
  STR: ['transfer beam', 'RC column', 'post-tensioned slab', 'core wall', 'steel secondary beam', 'shear wall', 'pile cap', 'down-stand beam'],
  MEC: ['chilled water pipe DN150', 'condenser water pipe DN200', 'pump skid', 'expansion vessel', 'mechanical riser', 'refrigerant line'],
  ELE: ['cable tray 600mm', 'busbar trunking', 'containment ladder', 'distribution board', 'lighting trunking', 'LV cable ladder'],
  PLB: ['drainage pipe DN100', 'soil stack', 'domestic water riser', 'rainwater pipe', 'grease interceptor', 'vent pipe'],
  FF: ['sprinkler main DN100', 'sprinkler branch line', 'fire hydrant riser', 'deluge valve set', 'gas suppression pipework', 'sprinkler head'],
  HVAC: ['supply air duct 1200x600', 'return air duct', 'fan coil unit', 'AHU maintenance zone', 'VAV box', 'kitchen exhaust duct'],
  INF: ['storm water culvert', 'sewer manhole', 'utility duct bank', 'water main 300mm', 'telecom chamber'],
  LND: ['tree pit', 'planter wall', 'irrigation main', 'paving build-up', 'podium soil zone'],
  CIV: ['road sub-base', 'retaining wall', 'kerb line', 'car park ramp', 'ground beam'],
};

// Pair weights: which discipline combinations clash most on a building like this
const BUILDING_PAIRS: [DisciplineCode, DisciplineCode, number][] = [
  ['MEC', 'STR', 16], ['HVAC', 'STR', 14], ['PLB', 'STR', 10], ['ELE', 'MEC', 8], ['HVAC', 'ARC', 9],
  ['FF', 'HVAC', 9], ['FF', 'ELE', 6], ['MEC', 'HVAC', 7], ['PLB', 'ARC', 5], ['ARC', 'STR', 6],
  ['ELE', 'STR', 6], ['FF', 'STR', 6], ['FF', 'PLB', 4], ['ELE', 'HVAC', 6], ['MEC', 'PLB', 4],
  ['MEC', 'MEC', 3], ['HVAC', 'HVAC', 2], ['ELE', 'ARC', 3], ['FF', 'ARC', 3], ['MEC', 'ARC', 3], ['ELE', 'PLB', 2],
];
const SITE_PAIRS: [DisciplineCode, DisciplineCode, number][] = [
  ['INF', 'CIV', 8], ['LND', 'INF', 6], ['CIV', 'STR', 5], ['LND', 'CIV', 3], ['INF', 'STR', 4],
  ['PLB', 'INF', 4], ['LND', 'ARC', 2], ['ELE', 'INF', 3], ['INF', 'INF', 1],
];
// Which discipline is normally asked to move (lower index moves first)
const MOVE_ORDER: DisciplineCode[] = ['PLB', 'ELE', 'FF', 'HVAC', 'MEC', 'LND', 'INF', 'ARC', 'CIV', 'STR'];

const ROLE_CODE: Record<DisciplineCode, string> = {
  ARC: 'A', STR: 'S', MEC: 'M', ELE: 'E', PLB: 'P', FF: 'F', HVAC: 'H', INF: 'I', LND: 'L', CIV: 'C',
};
const DISC_COMPANY: Record<DisciplineCode, string> = {
  ARC: 'c-lead', STR: 'c-str', MEC: 'c-mep', ELE: 'c-mep', PLB: 'c-mep', FF: 'c-ffsc', HVAC: 'c-mepsc', INF: 'c-inf', LND: 'c-lnd', CIV: 'c-mc',
};

function responsibleFor(d: DisciplineCode, pkg: string, rng: Rng): { company: string; user: string } {
  // During construction-stage packages MEP coordination sits with the MEP subcontractor.
  if (['MEC', 'ELE', 'PLB', 'HVAC'].includes(d) && pkg.startsWith('MEP') && rng.chance(0.55)) return { company: 'c-mepsc', user: d === 'HVAC' ? 'u-hvac' : 'u-mepsc' };
  if ((d === 'STR' || d === 'ARC') && rng.chance(0.3)) return { company: 'c-mc', user: 'u-mc' };
  const user = USERS.find((u) => u.discipline === d)?.id ?? 'u-bimc';
  return { company: DISC_COMPANY[d], user };
}

function describe(a: DisciplineCode, b: DisciplineCode, type: ClashType, rng: Rng) {
  const ea = rng.pick(ELEMENTS[a]);
  const eb = rng.pick(ELEMENTS[b]);
  const tag = `${rng.pick(['TB', 'C', 'S', 'W', 'R', 'D'])}-${rng.int(1, 99)}`;
  if (type === 'Hard') return `${cap(ea)} intersects ${eb} ${tag}`;
  if (type === 'Soft') return `${cap(ea)} obstructs maintenance / access zone of ${eb} ${tag}`;
  return `${cap(ea)} within ${rng.pick([25, 50, 75, 100, 150])}mm of ${eb} ${tag} (min. clearance not met)`;
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function buildClashes(rng: Rng, models: BimModel[]) {
  const clashes: Clash[] = [];
  const history: ClashHistory[] = [];
  const firstRun = '2026-05-06';
  const groups: { key: string; a: DisciplineCode; b: DisciplineCode; bld: string }[] = [];
  const N = 264;
  for (let i = 0; i < N; i++) {
    const site = rng.chance(0.13);
    const bld = site ? BUILDINGS[3] : rng.weighted<Building>([[BUILDINGS[0], 5], [BUILDINGS[1], 4], [BUILDINGS[2], 3]]);
    let [a, b] = rng.weighted((site ? SITE_PAIRS : BUILDING_PAIRS).map(([x, y, w]) => [[x, y] as [DisciplineCode, DisciplineCode], w]));
    // normalise pair order by discipline order (A <= B) so no combination is stored twice
    const oa = DISCIPLINES.find((d) => d.code === a)!.order, ob = DISCIPLINES.find((d) => d.code === b)!.order;
    if (oa > ob) [a, b] = [b, a];
    // detection runs every Wednesday; later runs find more clashes as models mature
    const weekIdx = Math.floor(Math.pow(rng.next(), 0.75) * 28);
    const identified = addDays(firstRun, weekIdx * 7);
    if (diffDays(identified, DEMO_ANCHOR) > -2) continue;
    const type = rng.weighted<ClashType>([['Hard', 62], ['Clearance', 24], ['Soft', 14]]);
    const sevBase = type === 'Hard' ? [['Critical', 14], ['High', 30], ['Medium', 36], ['Low', 20]] : [['Critical', 4], ['High', 18], ['Medium', 42], ['Low', 36]];
    const severity = rng.weighted<Severity>(sevBase as [Severity, number][]);
    const priority = severity === 'Critical' ? 'P1' : severity === 'High' ? 'P2' : severity === 'Medium' ? 'P3' : 'P4';
    const level = rng.pick(bld.levels);
    const zone = rng.pick(bld.zones);
    const pkg = site ? 'External Works' : ['ARC', 'STR'].includes(a) && ['ARC', 'STR'].includes(b)
      ? rng.pick(['Substructure', 'Superstructure', 'Façade'])
      : bld.code === 'T1' ? 'MEP Package A (T1)' : rng.chance(0.85) ? 'MEP Package B (T2/PD)' : 'Fit-out';
    const mover = MOVE_ORDER.indexOf(a) <= MOVE_ORDER.indexOf(b) ? a : b;
    const resp = responsibleFor(mover, pkg, rng);
    const due = addDays(identified, SEVERITY_SLA[severity] + rng.int(-2, 5));
    const age = diffDays(DEMO_ANCHOR, identified);
    // probability of being resolved grows with age; critical items are pushed harder
    const speed = severity === 'Critical' ? 1.0 : severity === 'High' ? 1.05 : severity === 'Low' ? 0.75 : 0.9;
    const pResolved = age < 5 ? 0.06 : Math.min(0.94, (age / 100) * speed + (age > 28 ? 0.2 : 0.06));
    let status: ClashStatus;
    let dateResolved: string | undefined;
    let occurrences = 1;
    let clashGroup: string | undefined;
    // ~10% belong to a repeated-clash group (same problem re-detected in successive runs)
    if (rng.chance(0.1) && groups.length < 14) {
      clashGroup = `RG-${String(groups.length + 1).padStart(2, '0')}`;
      groups.push({ key: clashGroup, a, b, bld: bld.code });
      occurrences = rng.int(2, 5);
    } else if (groups.length && rng.chance(0.06)) {
      const g = rng.pick(groups);
      if (g.a === a && g.b === b) { clashGroup = g.key; occurrences = rng.int(2, 4); }
    }
    if (rng.chance(pResolved)) {
      const window = Math.max(2, Math.min(age - 1, Math.round(SEVERITY_SLA[severity] * (0.4 + rng.next() * 1.1))));
      dateResolved = addDays(identified, rng.int(2, window));
      if (diffDays(dateResolved, DEMO_ANCHOR) > 0) dateResolved = addDays(DEMO_ANCHOR, -1);
      status = diffDays(DEMO_ANCHOR, dateResolved) > 10 ? 'Closed' : 'Resolved';
    } else if (occurrences > 2 && rng.chance(0.5)) {
      status = 'Reopened';
    } else if (age < 7) {
      status = rng.weighted([['New', 6], ['Active', 2], ['Assigned', 2]]);
    } else {
      status = rng.weighted([['Active', 2], ['Assigned', 3], ['In Progress', 5], ['Pending Review', 3]]);
    }
    const model = models.find((m) => m.discipline === a && m.building === bld.code) ?? models.find((m) => m.discipline === a);
    const id = `CLH-${String(clashes.length + 1).padStart(4, '0')}`;
    const gx = String.fromCharCode(65 + rng.int(0, 11));
    const c: Clash = {
      id, projectId: PROJECT_ID, description: describe(a, b, type, rng), type, disciplineA: a, disciplineB: b,
      building: bld.code, zone, level, package: pkg, gridRef: `${gx}-${rng.int(1, 18)}`,
      modelRef: model?.name ?? '—',
      position: `${(rng.next() * 180).toFixed(2)}, ${(rng.next() * 120).toFixed(2)}, ${(rng.next() * 60).toFixed(2)}`,
      severity, priority, status, assignedTo: resp.user, assignedDiscipline: mover, responsibleCompanyId: resp.company,
      dateIdentified: identified, dueDate: due, dateResolved,
      resolutionNotes: dateResolved ? rng.pick([
        'Services re-routed below beam soffit; verified in federated model.',
        'Duct resized and offset 150mm; coordination signed off at weekly meeting.',
        'Structural opening approved by structural engineer; sleeve added to model.',
        'Ceiling level adjusted by architect; clearance now achieved.',
        'Element moved to adjacent bay; checked in next detection run.',
        'Accepted as construction tolerance — approved by PMC.',
      ]) : '',
      clashGroup, occurrences, testName: `${a} vs ${b} — ${bld.code}`, source: 'Demo',
    };
    clashes.push(c);
    // history trail
    const h = (ts: string, action: ClashHistory['action'], extra: Partial<ClashHistory>) =>
      history.push({ id: `h-${history.length + 1}`, clashId: id, timestamp: ts + 'T09:00:00Z', userId: 'u-bimc', action, ...extra });
    h(identified, 'Created', { comment: `Detected in clash run ${identified}` });
    if (status !== 'New') h(addDays(identified, 1), 'Assigned', { field: 'assignedTo', to: USERS.find((u) => u.id === resp.user)?.name, userId: 'u-bimm' });
    if (dateResolved) {
      h(dateResolved, 'Status Change', { field: 'status', from: 'In Progress', to: 'Resolved', userId: resp.user });
      if (status === 'Closed') h(addDays(dateResolved, 7), 'Status Change', { field: 'status', from: 'Resolved', to: 'Closed', userId: 'u-bimm' });
    } else if (['In Progress', 'Pending Review', 'Reopened'].includes(status)) {
      h(addDays(identified, 3), 'Status Change', { field: 'status', from: 'Assigned', to: status, userId: resp.user });
    }
  }
  return { clashes, history };
}

function buildModels(rng: Rng) {
  const models: BimModel[] = [];
  const submissions: ModelSubmission[] = [];
  const combos: [string, DisciplineCode][] = [];
  for (const b of ['T1', 'T2', 'PD']) for (const d of ['ARC', 'STR', 'MEC', 'ELE', 'PLB', 'FF', 'HVAC'] as DisciplineCode[]) combos.push([b, d]);
  combos.push(['SW', 'INF'], ['SW', 'CIV'], ['SW', 'LND'], ['SW', 'STR']);
  combos.forEach(([b, d], i) => {
    const company = COMPANIES.find((c) => c.id === DISC_COMPANY[d])!;
    // A handful of files deliberately break the ISO 19650 naming pattern so the naming check has something to find
    const badName = i % 9 === 4;
    const name = badName
      ? `${b}_${d}_model_${rng.pick(['v3_final', 'latest', 'rev2 (copy)'])}.rvt`
      : `HMD-${company.shortName}-${b}-ZZ-M3-${ROLE_CODE[d]}-${String(1 + (i % 7)).padStart(4, '0')}.rvt`;
    const start = addDays('2026-04-01', rng.int(0, 35));
    const nRev = Math.max(2, Math.floor(diffDays(DEMO_ANCHOR, start) / rng.int(18, 30)));
    let progress = rng.int(8, 18);
    const ceiling = d === 'LND' || d === 'FF' ? rng.int(48, 62) : rng.int(60, 84);
    let last: ModelSubmission | undefined;
    const id = `mdl-${b}-${d}`.toLowerCase();
    for (let r = 0; r < nRev; r++) {
      const date = addDays(start, Math.round((r * diffDays(DEMO_ANCHOR, start)) / nRev) + rng.int(0, 4));
      if (diffDays(date, DEMO_ANCHOR) > 0) break;
      progress = Math.min(ceiling, progress + rng.int(4, 11));
      const isLast = r === nRev - 1;
      const status: ModelStatus = isLast
        ? rng.weighted([['Approved', 9], ['Under Review', 5], ['Received', 3], ['Rejected', 2], ['Pending Update', 3]])
        : rng.weighted([['Approved', 7], ['Rejected', 2], ['Pending Update', 1]]);
      const reviewed = status === 'Received' ? undefined : addDays(date, rng.int(2, 6));
      last = {
        id: `sub-${id}-${r + 1}`, modelId: id, revision: `P${String(r + 1).padStart(2, '0')}`, submittedDate: date,
        reviewedDate: reviewed && diffDays(reviewed, DEMO_ANCHOR) <= 0 ? reviewed : undefined, status, progressReported: progress,
        comments: status === 'Rejected' ? rng.pick(['Model not on shared coordinates.', 'Missing parameters for COBie fields.', 'Incorrect level naming; resubmit.']) :
          status === 'Pending Update' ? 'Update required to address clash run comments.' : status === 'Approved' ? 'Accepted for coordination.' : '',
        submittedBy: company.id,
      };
      submissions.push(last);
    }
    models.push({
      id, projectId: PROJECT_ID, name, discipline: d, building: b, companyId: company.id,
      revision: last?.revision ?? 'P01', status: last?.status ?? 'Received', lastUpload: last?.submittedDate ?? start,
      targetLod: d === 'LND' || d === 'CIV' ? 'LOD 300' : 'LOD 350', currentLod: progress > 70 ? (d === 'LND' ? 'LOD 300' : 'LOD 350') : progress > 45 ? 'LOD 300' : 'LOD 200',
      developmentProgress: last?.progressReported ?? progress, federated: last?.status === 'Approved' || (last?.status === 'Under Review' && rng.chance(0.5)),
      sizeMb: rng.int(80, 640),
    });
  });
  return { models, submissions };
}

function buildDeliverables(rng: Rng): Deliverable[] {
  const out: Deliverable[] = [];
  let n = 1;
  const add = (name: string, type: DeliverableType, discipline: Deliverable['discipline'], company: string, planned: string) => {
    const due = diffDays(DEMO_ANCHOR, planned);
    let actual: string | undefined;
    if (due > 0) {
      // past planned date: most submitted, some late, a few still outstanding
      if (due > 45 || rng.chance(0.8)) actual = addDays(planned, rng.weighted([[rng.int(-4, 0), 10], [rng.int(1, 9), 4], [rng.int(10, 24), 1]]));
      if (actual && diffDays(actual, DEMO_ANCHOR) > 0) actual = undefined;
    } else if (due > -10 && rng.chance(0.25)) actual = addDays(planned, -rng.int(1, 3));
    if (actual && diffDays(actual, DEMO_ANCHOR) > 0) actual = undefined;
    const ageSinceSub = actual ? diffDays(DEMO_ANCHOR, actual) : 0;
    const approval = !actual ? 'Pending' : ageSinceSub < 6 ? 'Pending' :
      rng.weighted<Deliverable['approvalStatus']>([['Approved', 6], ['Approved with Comments', 3], ['Rejected', 1]]);
    const rev = approval === 'Rejected' ? 'C01' : rng.chance(0.3) && actual ? 'C02' : actual ? 'C01' : 'P01';
    out.push({
      id: `DLV-${String(n++).padStart(3, '0')}`, projectId: PROJECT_ID, name, type, discipline, responsibleCompanyId: company,
      plannedDate: planned, actualDate: actual, revision: rev,
      status: !actual ? (due > 0 ? 'Overdue' : due > -21 ? 'In Progress' : 'Not Started') : rev === 'C02' ? 'Resubmitted' : 'Submitted',
      approvalStatus: approval,
      reviewedDate: actual && approval !== 'Pending' ? addDays(actual, Math.min(ageSinceSub - 1, rng.int(4, 10))) : undefined,
      reviewComments: approval === 'Rejected' ? 'Does not meet EIR requirements; resubmit with corrections.' :
        approval === 'Approved with Comments' ? 'Minor comments — address in next revision.' : approval === 'Approved' ? 'No comments.' : '',
    });
  };
  add('Pre-Contract BIM Execution Plan', 'Pre-Contract BEP', 'ALL', 'c-lead', '2026-03-16');
  add('Post-Contract BIM Execution Plan', 'Post-Contract BEP', 'ALL', 'c-mc', '2026-04-20');
  add('BEP Addendum — Construction Stage', 'BEP', 'ALL', 'c-mc', '2026-09-14');
  add('Master Information Delivery Plan', 'MIDP', 'ALL', 'c-mc', '2026-05-04');
  add('MIDP Update — Q4', 'MIDP', 'ALL', 'c-mc', '2026-10-05');
  for (const c of ['c-lead', 'c-str', 'c-mep', 'c-inf', 'c-lnd', 'c-mepsc', 'c-ffsc'])
    add(`Task Information Delivery Plan — ${COMPANIES.find((x) => x.id === c)!.shortName}`, 'TIDP', DISCIPLINES.find((d) => COMPANIES.find((x) => x.id === c)!.disciplines.includes(d.code))?.code ?? 'ALL', c, addDays('2026-04-27', rng.int(0, 14)));
  for (const d of DISCIPLINES) add(`Stage 4 Coordinated Model — ${d.name}`, 'Model Delivery', d.code, DISC_COMPANY[d.code], addDays('2026-09-28', d.order * 4 + rng.int(0, 6)));
  for (const d of DISCIPLINES.slice(0, 7)) add(`Construction Issue Model — ${d.name}`, 'Model Delivery', d.code, d.code === 'ARC' || d.code === 'STR' ? 'c-mc' : 'c-mepsc', addDays('2026-12-07', d.order * 3));
  for (const m of ['2026-06-30', '2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30'])
    add(`Monthly BIM Coordination Report — ${toDate(m).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`, 'Coordination Report', 'ALL', 'c-bim', addDays(m, 3));
  for (let w = 0; w < 12; w++) add(`Fortnightly Clash Report #${String(w + 1).padStart(2, '0')}`, 'Clash Report', 'ALL', 'c-bim', addDays('2026-06-10', w * 14));
  add('4D Simulation — Substructure', '4D Simulation', 'ALL', 'c-mc', '2026-08-17');
  add('4D Simulation — T1 Superstructure', '4D Simulation', 'ALL', 'c-mc', '2026-11-09');
  add('4D Simulation — T2 & Podium', '4D Simulation', 'ALL', 'c-mc', '2027-01-18');
  add('COBie Data Drop 1 — Design', 'COBie / Asset Information', 'ALL', 'c-mep', '2026-10-19');
  add('COBie Data Drop 2 — Construction', 'COBie / Asset Information', 'ALL', 'c-mepsc', '2027-04-12');
  add('As-Built Models — Substructure', 'As-Built Model', 'STR', 'c-mc', '2027-02-15');
  add('As-Built Models — Full Project', 'As-Built Model', 'ALL', 'c-mc', '2027-09-30');
  add('O&M Manuals — MEP Systems', 'O&M Documentation', 'MEC', 'c-mepsc', '2027-08-30');
  return out;
}

function buildIssues(rng: Rng, clashes: Clash[]): CoordinationIssue[] {
  const titles: Record<IssueType, string[]> = {
    'Design Coordination': ['Ceiling void depth insufficient for services', 'Riser shaft size conflict between ARC and MEP', 'Plant room layout not aligned with structure', 'Transfer level service routing strategy'],
    'Missing Information': ['Equipment data missing from MEP model', 'Fire rating parameters not populated', 'Door hardware schedule not linked', 'Structural openings not modelled', 'Asset tags missing for COBie'],
    'Consultant Comment': ['PMC comment on façade interface', 'Lead consultant comment on core layout', 'Client comment on retail fit-out zones', 'Structural engineer comment on sleeve locations'],
    RFI: ['Clarify slab edge detail at podium', 'Confirm sprinkler coverage in atrium', 'Confirm invert levels at site boundary', 'Clarify plant weight for roof structure'],
    'Design Dependency': ['Awaiting final AHU selection', 'Awaiting utility authority approval', 'Awaiting façade bracket design', 'Awaiting lift supplier shaft data'],
  };
  const out: CoordinationIssue[] = [];
  for (let i = 0; i < 48; i++) {
    const type = rng.weighted<IssueType>([['Design Coordination', 4], ['Missing Information', 4], ['Consultant Comment', 3], ['RFI', 3], ['Design Dependency', 2]]);
    const d = rng.pick(DISCIPLINES).code;
    const raised = addDays('2026-05-11', rng.int(0, 180));
    if (diffDays(raised, DEMO_ANCHOR) > 0) continue;
    const age = diffDays(DEMO_ANCHOR, raised);
    const closed = rng.chance(Math.min(0.85, age / 120)) ? addDays(raised, rng.int(3, Math.max(4, Math.min(age, 40)))) : undefined;
    const status: IssueStatus = closed && diffDays(closed, DEMO_ANCHOR) <= 0 ? 'Closed' : rng.pick(['Open', 'In Progress', 'Awaiting Response']);
    const related = clashes.filter((c) => c.disciplineA === d || c.disciplineB === d);
    out.push({
      id: `CI-${String(out.length + 1).padStart(3, '0')}`, projectId: PROJECT_ID, title: rng.pick(titles[type]), type, discipline: d,
      building: rng.pick(BUILDINGS).code, priority: rng.weighted<Severity>([['Critical', 1], ['High', 3], ['Medium', 4], ['Low', 2]]), status,
      raisedBy: rng.pick(['c-bim', 'c-pmc', 'c-lead', 'c-client', 'c-mc']), ownerCompanyId: DISC_COMPANY[d],
      raisedDate: raised, dueDate: addDays(raised, rng.int(10, 28)), closedDate: status === 'Closed' ? closed : undefined,
      linkedClashIds: related.length && rng.chance(0.5) ? [rng.pick(related).id] : [],
    });
  }
  return out;
}

function buildRisks(): Risk[] {
  const r = (id: number, title: string, category: Risk['category'], description: string, l: Risk['likelihood'], i: Risk['impact'], owner: string, mitigation: string, target: string, status: Risk['status'], raised: string): Risk =>
    ({ id: `RSK-${String(id).padStart(3, '0')}`, projectId: PROJECT_ID, title, category, description, likelihood: l, impact: i, ownerCompanyId: owner, mitigation, targetDate: target, status, raisedDate: raised });
  return [
    r(1, 'T1 transfer level services congestion', 'Coordination', 'High density of MEP and structural clashes at T1 L03 transfer level threatens slab pour sequence.', 4, 5, 'c-mepsc', 'Dedicated coordination workshop; agree service zones; prioritise P1 clashes before pour.', '2026-11-27', 'Mitigating', '2026-08-12'),
    r(2, 'Repeated HVAC vs STR clashes in T2 core', 'Repeated Clashes', 'Same duct/beam clashes re-detected across multiple runs indicating model update discipline issue.', 4, 4, 'c-mepsc', 'Root-cause review with HVAC modeller; enforce model update before each run.', '2026-11-30', 'Open', '2026-09-23'),
    r(3, 'Late submission of FF construction model', 'Model Submission', 'Fire protection subcontractor model submitted late for two cycles.', 3, 4, 'c-ffsc', 'Weekly submission tracking; escalate to Main Contractor.', '2026-11-20', 'Open', '2026-10-07'),
    r(4, 'Missing COBie parameters in MEP models', 'Information Quality', 'Asset parameters missing, risking COBie drop compliance.', 4, 3, 'c-mep', 'Issue parameter template; automated model checker each submission.', '2026-12-11', 'Mitigating', '2026-09-30'),
    r(5, 'AHU selection pending — plant room design frozen', 'Design Dependency', 'Plant room coordination cannot close until AHU supplier is confirmed.', 3, 4, 'c-mc', 'Procurement to confirm selection; model provisional envelope.', '2026-12-04', 'Open', '2026-10-14'),
    r(6, 'Outstanding PMC comments on BEP addendum', 'Consultant Comments', 'Comments on construction-stage BEP addendum remain open.', 2, 3, 'c-mc', 'Comment response sheet; review meeting with PMC.', '2026-11-25', 'Open', '2026-10-21'),
    r(7, 'Shared coordinates mismatch — site models', 'Information Quality', 'Infrastructure model found offset from project base point.', 3, 4, 'c-inf', 'Re-issue coordinate setup file; validation check on next upload.', '2026-11-18', 'Mitigating', '2026-10-28'),
    r(8, 'Utility authority approval for diversions', 'Design Dependency', 'Diversion route approval could change INF/CIV layout.', 3, 5, 'c-inf', 'Engage authority early; hold alternative route.', '2027-01-15', 'Open', '2026-09-02'),
    r(9, 'Ceiling void depth in retail podium', 'Coordination', 'Clear height targets compromised by services.', 3, 3, 'c-lead', 'Agree reduced ceiling zones with client.', '2026-10-30', 'Closed', '2026-07-15'),
    r(10, 'Model naming non-compliance', 'Information Quality', 'Several files do not follow ISO 19650 naming convention.', 3, 2, 'c-bim', 'Reject non-compliant uploads; naming check automated in dashboard.', '2026-11-30', 'Open', '2026-10-05'),
    r(11, 'Façade bracket interface with slab edge', 'Design Dependency', 'Bracket design pending from façade specialist.', 2, 4, 'c-lead', 'Provisional zone reserved; track RFI.', '2026-12-18', 'Open', '2026-10-19'),
    r(12, 'Sprinkler coverage in T1 atrium', 'Coordination', 'Atrium coverage strategy unresolved between ARC and FF.', 2, 3, 'c-ffsc', 'Fire engineer to confirm strategy.', '2026-09-30', 'Closed', '2026-07-01'),
  ];
}

function buildCompliance(rng: Rng, models: BimModel[]): ComplianceCheck[] {
  const out: ComplianceCheck[] = [];
  const add = (category: ComplianceCategory, checkName: string, discipline: ComplianceCheck['discipline'], result: ComplianceCheck['result'], date: string, observation: string, modelId?: string, evidence = '') =>
    out.push({ id: `CHK-${String(out.length + 1).padStart(3, '0')}`, projectId: PROJECT_ID, category, checkName, modelId, discipline, result, checkedDate: date, checkedBy: 'u-bimc', evidence: evidence || `Audit sheet AUD-${String(out.length + 1).padStart(3, '0')} (demo)`, observation, observationClosed: result === 'Pass' ? true : rng.chance(0.35) });
  // ISO 19650 — information management process checks
  add('ISO 19650', 'Information protocol included in appointments', 'ALL', 'Pass', '2026-05-04', '');
  add('ISO 19650', 'CDE workflow states (WIP/Shared/Published/Archived) in use', 'ALL', 'Pass', '2026-06-01', '');
  add('ISO 19650', 'Suitability codes applied to shared containers', 'ALL', 'Observation', '2026-10-12', 'S-codes missing on 14 shared containers.');
  add('ISO 19650', 'Information container metadata complete', 'ALL', 'Fail', '2026-10-26', 'Revision and status metadata missing for MEP subcontractor uploads.');
  add('ISO 19650', 'TIDPs aggregated into MIDP', 'ALL', 'Pass', '2026-10-05', '');
  // BEP compliance
  for (const d of ['ARC', 'STR', 'MEC', 'ELE', 'FF', 'HVAC', 'INF'] as DisciplineCode[])
    add('BEP Compliance', `BEP software & version requirements — ${d}`, d, rng.weighted([['Pass', 7], ['Observation', 2], ['Fail', 1]]), addDays('2026-10-01', rng.int(0, 40)), 'Modelling standard deviation noted in audit.');
  // Federation, coordinates, audit, health per model (only for models that have been audited)
  for (const m of models) {
    if (rng.chance(0.82)) add('Shared Coordinates', `Survey point / project base point check`, m.discipline, m.discipline === 'INF' ? 'Fail' : rng.weighted([['Pass', 9], ['Fail', 1]]), addDays(m.lastUpload, 2), 'Model offset from shared coordinates.', m.id);
    if (rng.chance(0.75)) add('Model Audit', 'Warnings, purge, worksets & linked files audit', m.discipline, rng.weighted([['Pass', 5], ['Observation', 4], ['Fail', 1]]), addDays(m.lastUpload, 3), `${rng.int(40, 400)} warnings outstanding; unused families not purged.`, m.id);
    if (rng.chance(0.7)) add('Model Health', 'File size, element count & performance check', m.discipline, m.sizeMb > 520 ? 'Observation' : 'Pass', addDays(m.lastUpload, 3), 'File size above 500 MB threshold — split recommended.', m.id);
    if (rng.chance(0.6)) add('LOD / LOI', `LOD/LOI against MIDP target (${m.targetLod})`, m.discipline, m.currentLod === m.targetLod ? 'Pass' : rng.weighted([['Observation', 3], ['Fail', 2]]), addDays(m.lastUpload, 4), `Current ${m.currentLod} vs target ${m.targetLod}.`, m.id);
    if (rng.chance(0.55)) add('Information Quality', 'Mandatory parameters populated (classification, asset tags)', m.discipline, rng.weighted([['Pass', 5], ['Observation', 3], ['Fail', 2]]), addDays(m.lastUpload, 4), 'Uniclass classification missing on part of the elements.', m.id);
    if (m.federated) add('Model Federation', 'Model loaded into federated coordination model', m.discipline, 'Pass', addDays(m.lastUpload, 1), '', m.id);
  }
  // NOTE: deliberately no 'IFC Export' checks — the dashboard must show this category as "Not verified".
  return out;
}

function buildPeriods(first: string, anchor: string): ReportingPeriod[] {
  const out: ReportingPeriod[] = [];
  let ws = weekStart(first);
  while (diffDays(ws, anchor) <= 0) {
    const we = addDays(ws, 6);
    const wk = Math.ceil((diffDays(ws, '2025-12-29') + 1) / 7);
    out.push({ id: `wk-${ws}`, projectId: PROJECT_ID, type: 'Weekly', label: `Week ${wk} · ${ws.slice(8)} ${toDate(ws).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })} – ${we.slice(8)} ${toDate(we).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`, start: ws, end: we });
    ws = addDays(ws, 7);
  }
  let ms = monthStart(first);
  while (diffDays(ms, anchor) <= 0) {
    const me = monthEnd(ms);
    out.push({ id: `mo-${ms.slice(0, 7)}`, projectId: PROJECT_ID, type: 'Monthly', label: `${toDate(ms).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}${diffDays(me, anchor) > 0 ? ' (to date)' : ''}`, start: ms, end: me });
    ms = monthStart(addDays(me, 1));
  }
  return out;
}

const DATE_KEY = /^(date|dueDate|dateIdentified|dateResolved|lastUpload|submittedDate|reviewedDate|plannedDate|actualDate|raisedDate|closedDate|targetDate|checkedDate|startDate|start|end)$/;
/** Shift every ISO date in the dataset by `days` so the demo always ends "today". */
function shiftDates<T>(obj: T, days: number): T {
  if (Array.isArray(obj)) return obj.map((o) => shiftDates(o, days)) as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === 'string' && DATE_KEY.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[k] = addDays(v, days);
      else if (k === 'timestamp' && typeof v === 'string') out[k] = addDays(v.slice(0, 10), days) + v.slice(10);
      else out[k] = shiftDates(v, days);
    }
    return out as T;
  }
  return obj;
}

/**
 * @param anchor the "data cut-off" date. Defaults to today so the demo never looks stale;
 *               tests pass DEMO_ANCHOR for fully deterministic output.
 */
export function generateDemoDataset(anchor: string = new Date().toISOString().slice(0, 10)): Dataset {
  const rng = createRng(19650);
  const project: Project = {
    id: PROJECT_ID, code: 'DEMO-HMD', name: 'DEMO — Harbourfront Mixed-Use Development', client: 'Demo Client Holdings (fictional)',
    location: 'Demo City (fictional)', stage: 'Stage 4 — Technical Design & Construction Coordination', isDemo: true,
    buildings: BUILDINGS, packages: PACKAGES, startDate: '2026-03-02',
  };
  const { models, submissions } = buildModels(rng);
  const { clashes, history } = buildClashes(rng, models);
  const base = {
    projects: [project], models, submissions, clashes, clashHistory: history, deliverables: buildDeliverables(rng),
    issues: buildIssues(rng, clashes), risks: buildRisks(), compliance: buildCompliance(rng, models),
  };
  const offset = diffDays(anchor, DEMO_ANCHOR);
  const shifted = offset === 0 ? base : shiftDates(base, offset);
  if (offset !== 0) {
    // keep month names in report titles consistent with their shifted dates
    for (const d of shifted.deliverables) if (d.type === 'Coordination Report')
      d.name = `Monthly BIM Coordination Report — ${toDate(addDays(d.plannedDate, -3)).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
  }
  return {
    version: DATA_VERSION, isDemo: true, generatedAt: new Date().toISOString(),
    disciplines: DISCIPLINES, companies: COMPANIES, users: USERS,
    periods: buildPeriods(addDays('2026-06-01', offset), anchor), ...shifted,
  };
}

/** An empty dataset (for loading real project data via import), keeping reference tables. */
export function emptyDataset(project?: Partial<Project>): Dataset {
  const p: Project = {
    id: 'prj-001', code: 'PRJ-001', name: 'New Project', client: '', location: '', stage: '', isDemo: false,
    buildings: [{ code: 'B1', name: 'Building 1', zones: ['Z1'], levels: ['GF'] }], packages: ['General'], startDate: new Date().toISOString().slice(0, 10),
    ...project,
  };
  const today = new Date().toISOString().slice(0, 10);
  const periods: ReportingPeriod[] = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(weekStart(today), -7 * i);
    periods.push({ id: `wk-${ws}`, projectId: p.id, type: 'Weekly', label: `Week of ${ws}`, start: ws, end: addDays(ws, 6) });
  }
  return {
    version: DATA_VERSION, isDemo: false, generatedAt: new Date().toISOString(), projects: [p], disciplines: DISCIPLINES,
    companies: [], users: [{ id: 'u-admin', name: 'Administrator', email: '', role: 'Admin', companyId: '' }], periods,
    models: [], submissions: [], clashes: [], clashHistory: [], deliverables: [], issues: [], risks: [], compliance: [],
  };
}
