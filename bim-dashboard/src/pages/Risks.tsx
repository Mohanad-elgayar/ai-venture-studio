import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, ConfirmButton, DataTable, Field, Modal, Pill, SeverityBadge, Tabs, type Column } from '../components/ui';
import { Kpi } from '../components/Kpi';
import { isIssueOpenAsOf, isIssueOverdueAsOf, isOpenAsOf, isRiskOpenAsOf, riskScore, riskSeverity } from '../lib/metrics';
import { DISCIPLINES, ISSUE_STATUSES, ISSUE_TYPES, RISK_CATEGORIES, SEVERITIES, SEVERITY_COLOR } from '../lib/constants';
import { addDays, diffDays, fmtDate, isValidISODate, todayISO } from '../lib/dates';
import { downloadCSV, downloadXlsx, stamp } from '../lib/export';
import { cls } from '../lib/format';
import type { CoordinationIssue, Risk, Severity } from '../types';

export default function Risks() {
  const { scope, ds, can } = useStore();
  const d = useData();
  const asOf = scope.asOf;
  const [tab, setTab] = useState<'risks' | 'issues'>('risks');
  const [cellFilter, setCellFilter] = useState<{ l: number; i: number } | null>(null);
  const [editRisk, setEditRisk] = useState<Risk | 'new' | null>(null);
  const [editIssue, setEditIssue] = useState<CoordinationIssue | 'new' | null>(null);

  const risks = d.risks.filter((r) => r.raisedDate <= asOf);
  const openRisks = risks.filter((r) => isRiskOpenAsOf(r, asOf));
  const issues = d.issues.filter((i) => i.raisedDate <= asOf);
  const openIssues = issues.filter((i) => isIssueOpenAsOf(i, asOf));

  const ind = useMemo(() => {
    const openClashes = d.clashes.filter((c) => isOpenAsOf(c, asOf));
    const groups = new Set(openClashes.filter((c) => c.occurrences > 1).map((c) => c.clashGroup ?? c.id));
    const delayedModels = d.modelStates.filter((s) => s.status === 'Rejected' || s.status === 'Pending Update' || (s.lastUpload && diffDays(asOf, s.lastUpload) > 28) || s.status === null);
    const infoFails = d.complianceRows.filter((r) => r.category === 'Information Quality' && r.result !== 'Pass' && !r.observationClosed).length;
    const byType = (t: string) => openIssues.filter((i) => i.type === t).length;
    return [
      { label: 'Critical coordination risks', value: openClashes.filter((c) => c.severity === 'Critical').length + openRisks.filter((r) => r.category === 'Coordination' && riskSeverity(r) === 'Critical').length, detail: `${openClashes.filter((c) => c.severity === 'Critical').length} open critical clashes · ${openRisks.filter((r) => r.category === 'Coordination' && riskSeverity(r) === 'Critical').length} critical register risks`, sev: 'Critical' as Severity },
      { label: 'Repeated clashes', value: openClashes.filter((c) => c.occurrences > 1).length, detail: `${groups.size} repeat groups re-detected across runs`, sev: 'High' as Severity },
      { label: 'Overdue coordination issues', value: issues.filter((i) => isIssueOverdueAsOf(i, asOf)).length, detail: `of ${openIssues.length} open issues`, sev: 'High' as Severity },
      { label: 'Delayed model submissions', value: delayedModels.length, detail: 'rejected, pending update, not received or >28 days since upload', sev: 'Medium' as Severity },
      { label: 'Missing model information', value: byType('Missing Information') + infoFails, detail: `${byType('Missing Information')} open issues · ${infoFails} open info-quality findings`, sev: 'Medium' as Severity },
      { label: 'Design coordination dependencies', value: byType('Design Dependency'), detail: 'open design dependency items', sev: 'Medium' as Severity },
      { label: 'Outstanding consultant comments', value: byType('Consultant Comment') + byType('RFI'), detail: `${byType('Consultant Comment')} comments · ${byType('RFI')} RFIs`, sev: 'Low' as Severity },
    ];
  }, [d, asOf, openIssues, openRisks, issues]);

  const heat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of openRisks) m[`${r.likelihood}-${r.impact}`] = (m[`${r.likelihood}-${r.impact}`] ?? 0) + 1;
    return m;
  }, [openRisks]);
  const riskRows = cellFilter ? openRisks.filter((r) => r.likelihood === cellFilter.l && r.impact === cellFilter.i) : risks;

  const riskCols: Column<Risk>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: 'title', header: 'Risk', render: (r) => <div className="max-w-[300px]"><div className="font-semibold truncate" title={r.title}>{r.title}</div><div className="text-[11px] text-muted truncate" title={r.description}>{r.description}</div></div> },
    { key: 'category', header: 'Category' },
    { key: 'score', header: 'L × I', align: 'center', value: (r) => riskScore(r), render: (r) => <span className="tabular-nums">{r.likelihood}×{r.impact}=<b>{riskScore(r)}</b></span> },
    { key: 'sev', header: 'Severity', value: (r) => SEVERITIES.indexOf(riskSeverity(r)), render: (r) => <SeverityBadge s={riskSeverity(r)} /> },
    { key: 'owner', header: 'Owner', value: (r) => d.companyShort(r.ownerCompanyId) },
    { key: 'mitigation', header: 'Mitigation actions', render: (r) => <span className="block max-w-[280px] truncate text-muted" title={r.mitigation}>{r.mitigation}</span> },
    { key: 'targetDate', header: 'Target closure', render: (r) => <span className={cls('whitespace-nowrap', r.status !== 'Closed' && r.targetDate < asOf && 'text-crit font-semibold')}>{fmtDate(r.targetDate)}</span> },
    { key: 'status', header: 'Status', render: (r) => <Pill color={r.status === 'Closed' ? '#0ca30c' : r.status === 'Mitigating' ? '#3987e5' : '#fab219'}>{r.status}</Pill> },
  ];
  const issueCols: Column<CoordinationIssue>[] = [
    { key: 'id', header: 'ID', render: (i) => <span className="font-mono text-xs">{i.id}</span> },
    { key: 'title', header: 'Issue', render: (i) => <span className="block max-w-[280px] truncate" title={i.title}>{i.title}</span> },
    { key: 'type', header: 'Type' },
    { key: 'discipline', header: 'Disc.' },
    { key: 'building', header: 'Bldg' },
    { key: 'priority', header: 'Priority', value: (i) => SEVERITIES.indexOf(i.priority), render: (i) => <SeverityBadge s={i.priority} /> },
    { key: 'owner', header: 'Owner', value: (i) => d.companyShort(i.ownerCompanyId) },
    { key: 'raisedBy', header: 'Raised by', value: (i) => d.companyShort(i.raisedBy) },
    { key: 'raisedDate', header: 'Raised', render: (i) => <span className="whitespace-nowrap">{fmtDate(i.raisedDate)}</span> },
    { key: 'dueDate', header: 'Due', render: (i) => <span className={cls('whitespace-nowrap', isIssueOverdueAsOf(i, asOf) && 'text-crit font-semibold')}>{fmtDate(i.dueDate)}</span> },
    { key: 'status', header: 'Status', value: (i) => (isIssueOpenAsOf(i, asOf) ? (i.status === 'Closed' ? 'In Progress' : i.status) : 'Closed'), render: (i) => { const s = isIssueOpenAsOf(i, asOf) ? (i.status === 'Closed' ? 'In Progress' : i.status) : 'Closed'; return <Pill color={s === 'Closed' ? '#0ca30c' : '#fab219'}>{s}</Pill>; } },
    { key: 'links', header: 'Linked clashes', value: (i) => i.linkedClashIds.join(', '), render: (i) => <span className="font-mono text-[11px]">{i.linkedClashIds.join(', ') || '—'}</span> },
  ];

  const riskExport = () => riskRows.map((r) => ({ 'Risk ID': r.id, Title: r.title, Category: r.category, Description: r.description, Likelihood: r.likelihood, Impact: r.impact, Score: riskScore(r), Severity: riskSeverity(r), Owner: d.companyName(r.ownerCompanyId), Mitigation: r.mitigation, 'Target closure': r.targetDate, Status: r.status, Raised: r.raisedDate }));
  const issueExport = () => issues.map((i) => ({ 'Issue ID': i.id, Title: i.title, Type: i.type, Discipline: i.discipline, Building: i.building, Priority: i.priority, Status: isIssueOpenAsOf(i, asOf) ? i.status : 'Closed', Owner: d.companyName(i.ownerCompanyId), 'Raised by': d.companyName(i.raisedBy), Raised: i.raisedDate, Due: i.dueDate, Closed: i.closedDate ?? '', 'Linked clashes': i.linkedClashIds.join(' ') }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {ind.map((x) => <Kpi key={x.label} label={x.label} value={x.value} sub={x.detail} tone={x.value === 0 ? 'ok' : x.sev === 'Critical' ? 'crit' : x.sev === 'High' ? 'high' : x.sev === 'Medium' ? 'med' : 'accent'} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4">
        <Card title="Risk heat map" subtitle={`${openRisks.length} open risks · likelihood × impact · click a cell to filter`}>
          <div className="flex gap-2">
            <div className="flex flex-col justify-between py-1 text-[10px] text-muted [writing-mode:vertical-rl] rotate-180 text-center">Likelihood →</div>
            <div className="flex-1">
              <div className="grid grid-cols-5 gap-1">
                {[5, 4, 3, 2, 1].map((l) => [1, 2, 3, 4, 5].map((i) => {
                  const s = l * i, n = heat[`${l}-${i}`] ?? 0;
                  const sev: Severity = s >= 15 ? 'Critical' : s >= 10 ? 'High' : s >= 5 ? 'Medium' : 'Low';
                  const active = cellFilter?.l === l && cellFilter?.i === i;
                  return <button key={`${l}-${i}`} disabled={!n} onClick={() => { setCellFilter(active ? null : { l, i }); setTab('risks'); }} title={`L${l} × I${i} = ${s} (${sev}) · ${n} risks`}
                    className={cls('aspect-square rounded-md flex items-center justify-center text-sm font-semibold tabular-nums transition', active && 'ring-2 ring-accent2', n ? 'cursor-pointer hover:brightness-125' : 'cursor-default')}
                    style={{ background: SEVERITY_COLOR[sev] + (n ? 'cc' : '26'), color: n ? '#fff' : undefined }}>{n || ''}</button>;
                }))}
              </div>
              <div className="text-[10px] text-muted text-center mt-1">Impact →</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted">{SEVERITIES.map((s) => <span key={s} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SEVERITY_COLOR[s] }} />{s} {s === 'Critical' ? '≥15' : s === 'High' ? '10–14' : s === 'Medium' ? '5–9' : '<5'}</span>)}</div>
        </Card>

        <Card title={tab === 'risks' ? 'Risk register' : 'Coordination issues'} subtitle={tab === 'risks' ? 'Severity, ownership, mitigation actions and target closure dates' : 'Design coordination, missing information, consultant comments, RFIs and dependencies'}>
          {tab === 'risks' ? (
            <DataTable rows={riskRows} columns={riskCols} rowKey={(r) => r.id} onRowClick={can('register.edit') ? setEditRisk : undefined} initialSort={{ key: 'score', dir: 'desc' }} pageSize={10}
              toolbar={<>
                <Tabs value={tab} onChange={setTab} tabs={[{ id: 'risks', label: `Risks (${openRisks.length} open)` }, { id: 'issues', label: `Issues (${openIssues.length} open)` }]} />
                {cellFilter && <span className="chip bg-accent/20">L{cellFilter.l} × I{cellFilter.i}<button onClick={() => setCellFilter(null)} aria-label="Clear heat map filter"><X size={11} /></button></span>}
                <button className="btn-ghost" onClick={() => downloadCSV(riskExport(), `risk-register-${stamp()}.csv`)}><Download size={14} /> CSV</button>
                <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Risk Register', rows: riskExport() }], `risk-register-${stamp()}.xlsx`, { Project: d.project.name, 'Reporting date': asOf, Data: ds.isDemo ? 'DEMO DATA' : 'Project data' })}><FileSpreadsheet size={14} /> Excel</button>
                {can('register.edit') && <button className="btn-primary" onClick={() => setEditRisk('new')}><Plus size={14} /> Add risk</button>}
              </>} />
          ) : (
            <DataTable rows={issues} columns={issueCols} rowKey={(r) => r.id} onRowClick={can('register.edit') ? setEditIssue : undefined} initialSort={{ key: 'dueDate', dir: 'asc' }} pageSize={10}
              toolbar={<>
                <Tabs value={tab} onChange={setTab} tabs={[{ id: 'risks', label: `Risks (${openRisks.length} open)` }, { id: 'issues', label: `Issues (${openIssues.length} open)` }]} />
                <button className="btn-ghost" onClick={() => downloadCSV(issueExport(), `coordination-issues-${stamp()}.csv`)}><Download size={14} /> CSV</button>
                <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Coordination Issues', rows: issueExport() }], `coordination-issues-${stamp()}.xlsx`, { Project: d.project.name, 'Reporting date': asOf })}><FileSpreadsheet size={14} /> Excel</button>
                {can('register.edit') && <button className="btn-primary" onClick={() => setEditIssue('new')}><Plus size={14} /> Add issue</button>}
              </>} />
          )}
        </Card>
      </div>
      {editRisk && <RiskEditor item={editRisk} onClose={() => setEditRisk(null)} />}
      {editIssue && <IssueEditor item={editIssue} onClose={() => setEditIssue(null)} />}
    </div>
  );
}

function RiskEditor({ item, onClose }: { item: Risk | 'new'; onClose: () => void }) {
  const { ds, filters, upsert, remove, can } = useStore();
  const isNew = item === 'new';
  const [f, setF] = useState<Risk>(() => isNew ? { id: `RSK-${String(Math.max(0, ...ds.risks.map((r) => +(/\d+$/.exec(r.id)?.[0] ?? 0))) + 1).padStart(3, '0')}`, projectId: filters.projectId, title: '', category: 'Coordination', description: '', likelihood: 3, impact: 3, ownerCompanyId: ds.companies[0]?.id ?? '', mitigation: '', targetDate: addDays(todayISO(), 21), status: 'Open', raisedDate: todayISO() } : { ...item });
  const [err, setErr] = useState('');
  const set = <K extends keyof Risk>(k: K, v: Risk[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) return setErr('Title is required');
    if (!f.mitigation.trim()) return setErr('Mitigation actions are required');
    if (!isValidISODate(f.targetDate)) return setErr('Valid target closure date required');
    if (await upsert('risks', [f])) onClose();
  };
  return (
    <Modal open onClose={onClose} wide title={isNew ? 'New risk' : `Risk ${f.id}`} footer={<>
      {!isNew && can('register.delete') && <ConfirmButton className="btn-danger mr-auto" onConfirm={async () => { if (await remove('risks', [f.id])) onClose(); }}><Trash2 size={14} /> Delete</ConfirmButton>}
      <button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Title" required className="col-span-2 md:col-span-3"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => set('category', e.target.value as Risk['category'])}>{RISK_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Description" className="col-span-2 md:col-span-4"><textarea className="input" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Likelihood (1–5)"><select className="input" value={f.likelihood} onChange={(e) => set('likelihood', +e.target.value as Risk['likelihood'])}>{[1, 2, 3, 4, 5].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Impact (1–5)"><select className="input" value={f.impact} onChange={(e) => set('impact', +e.target.value as Risk['impact'])}>{[1, 2, 3, 4, 5].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Score / severity"><div className="input bg-transparent">{riskScore(f)} · {riskSeverity(f)}</div></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={(e) => set('status', e.target.value as Risk['status'])}>{['Open', 'Mitigating', 'Closed'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Owner" className="col-span-2"><select className="input" value={f.ownerCompanyId} onChange={(e) => set('ownerCompanyId', e.target.value)}>{ds.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Target closure date" required><input type="date" className="input" value={f.targetDate} onChange={(e) => set('targetDate', e.target.value)} /></Field>
        <Field label="Date raised"><input type="date" className="input" value={f.raisedDate} onChange={(e) => set('raisedDate', e.target.value)} /></Field>
        <Field label="Mitigation actions" required className="col-span-2 md:col-span-4"><textarea className="input" rows={2} value={f.mitigation} onChange={(e) => set('mitigation', e.target.value)} /></Field>
      </div>
      {err && <p className="text-xs text-crit mt-2">{err}</p>}
    </Modal>
  );
}

function IssueEditor({ item, onClose }: { item: CoordinationIssue | 'new'; onClose: () => void }) {
  const { ds, filters, upsert, remove, can } = useStore();
  const isNew = item === 'new';
  const project = ds.projects.find((p) => p.id === filters.projectId)!;
  const [f, setF] = useState<CoordinationIssue>(() => isNew ? { id: `CI-${String(Math.max(0, ...ds.issues.map((r) => +(/\d+$/.exec(r.id)?.[0] ?? 0))) + 1).padStart(3, '0')}`, projectId: filters.projectId, title: '', type: 'Design Coordination', discipline: 'ARC', building: project.buildings[0]?.code ?? '', priority: 'Medium', status: 'Open', raisedBy: ds.companies[0]?.id ?? '', ownerCompanyId: ds.companies[0]?.id ?? '', raisedDate: todayISO(), dueDate: addDays(todayISO(), 14), linkedClashIds: [] } : { ...item });
  const [err, setErr] = useState('');
  const set = <K extends keyof CoordinationIssue>(k: K, v: CoordinationIssue[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.title.trim()) return setErr('Title is required');
    if (f.dueDate < f.raisedDate) return setErr('Due date cannot be before raised date');
    const bad = f.linkedClashIds.filter((id) => !ds.clashes.some((c) => c.id === id));
    if (bad.length) return setErr(`Unknown clash IDs: ${bad.join(', ')}`);
    const closedDate = f.status === 'Closed' ? f.closedDate ?? todayISO() : undefined;
    if (await upsert('issues', [{ ...f, closedDate }])) onClose();
  };
  return (
    <Modal open onClose={onClose} wide title={isNew ? 'New coordination issue' : `Issue ${f.id}`} footer={<>
      {!isNew && can('register.delete') && <ConfirmButton className="btn-danger mr-auto" onConfirm={async () => { if (await remove('issues', [f.id])) onClose(); }}><Trash2 size={14} /> Delete</ConfirmButton>}
      <button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Title" required className="col-span-2 md:col-span-4"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={(e) => set('type', e.target.value as CoordinationIssue['type'])}>{ISSUE_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Discipline"><select className="input" value={f.discipline} onChange={(e) => set('discipline', e.target.value as CoordinationIssue['discipline'])}>{DISCIPLINES.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</select></Field>
        <Field label="Building"><select className="input" value={f.building} onChange={(e) => set('building', e.target.value)}>{project.buildings.map((b) => <option key={b.code}>{b.code}</option>)}</select></Field>
        <Field label="Priority"><select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value as Severity)}>{SEVERITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={(e) => set('status', e.target.value as CoordinationIssue['status'])}>{ISSUE_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Owner"><select className="input" value={f.ownerCompanyId} onChange={(e) => set('ownerCompanyId', e.target.value)}>{ds.companies.map((c) => <option key={c.id} value={c.id}>{c.shortName} — {c.name}</option>)}</select></Field>
        <Field label="Raised by"><select className="input" value={f.raisedBy} onChange={(e) => set('raisedBy', e.target.value)}>{ds.companies.map((c) => <option key={c.id} value={c.id}>{c.shortName} — {c.name}</option>)}</select></Field>
        <Field label="Raised"><input type="date" className="input" value={f.raisedDate} onChange={(e) => set('raisedDate', e.target.value)} /></Field>
        <Field label="Due"><input type="date" className="input" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
        <Field label="Linked clash IDs (comma separated)" className="col-span-2 md:col-span-3"><input className="input font-mono" value={f.linkedClashIds.join(', ')} onChange={(e) => set('linkedClashIds', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} /></Field>
      </div>
      {err && <p className="text-xs text-crit mt-2">{err}</p>}
    </Modal>
  );
}
