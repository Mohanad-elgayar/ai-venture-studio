import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Download, FileSpreadsheet, Plus, Upload, Link2Off, Link2 } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, DataTable, Empty, Field, Modal, Pill, ProgressBar, type Column } from '../components/ui';
import { Kpi } from '../components/Kpi';
import { ChartBox, Legend, useChartTheme } from '../components/charts';
import { modelKpis, type ModelState } from '../lib/metrics';
import { DISCIPLINES, MODEL_STATUSES, MODEL_STATUS_COLOR } from '../lib/constants';
import { addDays, diffDays, fmtDate, fmtShort, todayISO } from '../lib/dates';
import { downloadCSV, downloadXlsx, stamp } from '../lib/export';
import { uid } from '../lib/format';
import type { BimModel, DisciplineCode, ModelStatus, ModelSubmission } from '../types';

export default function Models() {
  const { scope, ds, can } = useStore();
  const d = useData();
  const t = useChartTheme();
  const asOf = scope.asOf;
  const [hist, setHist] = useState<ModelState | null>(null);
  const [submitFor, setSubmitFor] = useState<BimModel | null>(null);
  const [newModel, setNewModel] = useState(false);
  const k = modelKpis(d.modelStates);

  const perDisc = useMemo(() => DISCIPLINES.map((x) => {
    const st = d.modelStates.filter((s) => s.model.discipline === x.code);
    const row: Record<string, string | number> = { code: x.code, name: x.name, total: st.length, progress: st.length ? Math.round(st.reduce((a, s) => a + s.progress, 0) / st.length) : 0 };
    for (const m of MODEL_STATUSES) row[m] = st.filter((s) => s.status === m).length;
    row['Not received'] = st.filter((s) => s.status === null).length;
    return row;
  }).filter((r) => (r.total as number) > 0), [d.modelStates]);

  const buildings = [...new Set(d.modelStates.map((s) => s.model.building))];
  const fedDiscs = DISCIPLINES.filter((x) => d.modelStates.some((s) => s.model.discipline === x.code));

  // timeline window: last 20 weeks to as-of
  const tlStart = addDays(asOf, -140);
  const span = diffDays(asOf, tlStart);
  const x = (date: string) => `${Math.max(0, Math.min(100, (diffDays(date, tlStart) / span) * 100))}%`;
  const ticks = Array.from({ length: 6 }, (_, i) => addDays(tlStart, Math.round((span / 5) * i)));

  const rows = (states: ModelState[]) => states.map((s) => ({
    'Model': s.model.name, Discipline: s.model.discipline, Building: s.model.building, Company: d.companyName(s.model.companyId),
    Revision: s.revision, Status: s.status ?? 'Not received', 'Last upload': s.lastUpload ?? '', 'Target LOD': s.model.targetLod, 'Current LOD': s.model.currentLod,
    'Development %': s.progress, Federated: s.model.federated ? 'Yes' : 'No', 'Submissions to date': s.submissions.length,
  }));

  const columns: Column<ModelState>[] = [
    { key: 'name', header: 'Model file', value: (s) => s.model.name, render: (s) => <span className="font-mono text-[12px]">{s.model.name}</span> },
    { key: 'disc', header: 'Disc.', value: (s) => s.model.discipline },
    { key: 'bld', header: 'Bldg', value: (s) => s.model.building },
    { key: 'company', header: 'Author', value: (s) => d.companyShort(s.model.companyId) },
    { key: 'rev', header: 'Rev', value: (s) => s.revision },
    { key: 'status', header: 'Status', value: (s) => s.status ?? 'Not received', render: (s) => s.status ? <Pill color={MODEL_STATUS_COLOR[s.status]}>{s.status}</Pill> : <Pill>Not received</Pill> },
    { key: 'upload', header: 'Last upload', value: (s) => s.lastUpload ?? '', render: (s) => <span className={s.lastUpload && diffDays(asOf, s.lastUpload) > 28 ? 'text-high whitespace-nowrap' : 'whitespace-nowrap'}>{fmtDate(s.lastUpload)}{s.lastUpload && <span className="text-muted"> · {diffDays(asOf, s.lastUpload)}d</span>}</span> },
    { key: 'lod', header: 'LOD (cur / target)', value: (s) => s.model.currentLod, render: (s) => <span className={s.model.currentLod !== s.model.targetLod ? 'text-med' : ''}>{s.model.currentLod} / {s.model.targetLod}</span> },
    { key: 'progress', header: 'Development', value: (s) => s.progress, render: (s) => <div className="flex items-center gap-2 w-32"><ProgressBar value={s.progress} /><span className="tabular-nums text-xs w-8">{s.progress}%</span></div> },
    { key: 'fed', header: 'Federated', value: (s) => (s.model.federated ? 1 : 0), render: (s) => s.model.federated ? <Link2 size={15} className="text-ok" aria-label="federated" /> : <Link2Off size={15} className="text-muted" aria-label="not federated" /> },
  ];

  if (!d.models.length) return <Card><Empty title="No models registered" text="Add models or import a model register to track coordination status." action={can('register.edit') ? <button className="btn-primary" onClick={() => setNewModel(true)}><Plus size={14} /> Add model</button> : undefined} /><NewModel open={newModel} onClose={() => setNewModel(false)} /></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi label="Total coordinated models" value={k.federated} sub={`federated of ${k.total}`} help="Models loaded into the federated coordination model." />
        <Kpi label="Models received" value={k.received} sub={`of ${k.total} registered`} />
        <Kpi label="Under review" value={k.underReview} tone="med" sub="received / reviewing" />
        <Kpi label="Approved" value={k.approved} tone="ok" />
        <Kpi label="Rejected" value={k.rejected} tone={k.rejected ? 'crit' : undefined} />
        <Kpi label="Pending update" value={k.pendingUpdate} tone={k.pendingUpdate ? 'high' : undefined} />
        <Kpi label="Avg. development" value={`${k.avgDevelopment.toFixed(0)}%`} sub="author-reported" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Coordination status per discipline" subtitle="Latest submission status at the reporting date" actions={<Legend items={MODEL_STATUSES.map((s) => ({ label: s, color: MODEL_STATUS_COLOR[s] }))} />}>
          <ChartBox height={260}>
            <BarChart data={perDisc} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="code" tick={t.tick} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...t.tooltip} />
              {MODEL_STATUSES.map((s, i) => <Bar key={s} dataKey={s} stackId="a" fill={MODEL_STATUS_COLOR[s]} maxBarSize={36} stroke={t.surface} strokeWidth={1} radius={i === MODEL_STATUSES.length - 1 ? [4, 4, 0, 0] : 0} />)}
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Discipline coordination progress" subtitle="Average author-reported development % per discipline (bar) — labels show approved models">
          <div className="space-y-2.5 pt-1">
            {perDisc.map((r) => (
              <div key={r.code as string} className="grid grid-cols-[52px_1fr_120px] items-center gap-3 text-sm">
                <span className="font-semibold">{r.code}</span>
                <ProgressBar value={r.progress as number} height={10} />
                <span className="text-xs text-muted tabular-nums">{r.progress}% · {r.Approved}/{r.total} approved</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Model federation status" subtitle="Building × discipline. Status of each model's latest submission; link icon = included in federated model.">
        <div className="overflow-auto">
          <table className="tbl">
            <thead><tr><th>Building</th>{fedDiscs.map((x) => <th key={x.code} className="!text-center">{x.code}</th>)}</tr></thead>
            <tbody>{buildings.map((b) => (
              <tr key={b}><td className="font-semibold whitespace-nowrap">{b} <span className="text-muted font-normal text-xs">{d.project.buildings.find((x) => x.code === b)?.name}</span></td>
                {fedDiscs.map((x) => {
                  const s = d.modelStates.find((m) => m.model.building === b && m.model.discipline === x.code);
                  return <td key={x.code} className="!text-center">{s ? (
                    <button className="inline-flex flex-col items-center gap-0.5" onClick={() => setHist(s)} title={`${s.model.name} — ${s.status ?? 'Not received'}`}>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.status ? MODEL_STATUS_COLOR[s.status] : '#64748b' }} />{s.model.federated ? <Link2 size={12} className="text-ok" /> : <Link2Off size={12} className="text-muted" />}</span>
                      <span className="text-[10px] text-muted">{s.revision}</span>
                    </button>) : <span className="text-muted/50">—</span>}</td>;
                })}
              </tr>))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Model coordination timeline" subtitle={`Submissions over the last 20 weeks to ${fmtDate(asOf)} · dot colour = review outcome · click a row for revision history`} actions={<Legend items={MODEL_STATUSES.map((s) => ({ label: s, color: MODEL_STATUS_COLOR[s] }))} />}>
        <div className="overflow-auto">
          <div className="min-w-[760px]">
            <div className="relative h-5 ml-[240px] text-[10px] text-muted">{ticks.map((tk) => <span key={tk} className="absolute -translate-x-1/2" style={{ left: x(tk) }}>{fmtShort(tk)}</span>)}</div>
            {d.modelStates.map((s) => (
              <button key={s.model.id} className="w-full flex items-center h-6 hover:bg-surface2 rounded" onClick={() => setHist(s)}>
                <span className="w-[240px] shrink-0 text-left font-mono text-[11px] truncate pr-2" title={s.model.name}>{s.model.building}-{s.model.discipline} <span className="text-muted">{s.model.name}</span></span>
                <span className="relative flex-1 h-full">
                  <span className="absolute inset-y-1/2 left-0 right-0 h-px bg-line" />
                  {s.submissions.filter((sub) => sub.submittedDate >= tlStart).map((sub) => (
                    <span key={sub.id} title={`${sub.revision} · ${fmtDate(sub.submittedDate)} · ${sub.status}`} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full ring-2 ring-surface" style={{ left: x(sub.submittedDate), background: MODEL_STATUS_COLOR[sub.status] }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Model register" subtitle="Click a model to see its full revision history">
        <DataTable rows={d.modelStates} columns={columns} rowKey={(s) => s.model.id} onRowClick={setHist} initialSort={{ key: 'disc', dir: 'asc' }}
          toolbar={<>
            <button className="btn-ghost" onClick={() => downloadCSV(rows(d.modelStates), `model-register-${stamp()}.csv`)}><Download size={14} /> CSV</button>
            <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Models', rows: rows(d.modelStates) }, { name: 'Submissions', rows: ds.submissions.filter((x) => d.models.some((m) => m.id === x.modelId)).map((x) => ({ Model: d.modelName(x.modelId), Revision: x.revision, Submitted: x.submittedDate, Reviewed: x.reviewedDate ?? '', Status: x.status, 'Progress %': x.progressReported, Comments: x.comments })) }], `model-register-${stamp()}.xlsx`, { Project: d.project.name, 'Reporting date': asOf, Data: ds.isDemo ? 'DEMO DATA' : 'Project data' })}><FileSpreadsheet size={14} /> Excel</button>
            {can('register.edit') && <button className="btn-primary" onClick={() => setNewModel(true)}><Plus size={14} /> Add model</button>}
          </>} />
      </Card>

      <Modal open={!!hist} onClose={() => setHist(null)} wide title={hist ? <span className="font-mono text-sm">{hist.model.name}</span> : ''}
        footer={hist && can('register.edit') ? <button className="btn-primary" onClick={() => { setSubmitFor(hist.model); setHist(null); }}><Upload size={14} /> Record new submission</button> : undefined}>
        {hist && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
            <Info l="Discipline" v={`${hist.model.discipline} · ${hist.model.building}`} /><Info l="Author" v={d.companyName(hist.model.companyId)} />
            <Info l="LOD current / target" v={`${hist.model.currentLod} / ${hist.model.targetLod}`} /><Info l="File size" v={`${hist.model.sizeMb} MB`} />
          </div>
          <table className="tbl w-full">
            <thead><tr><th>Revision</th><th>Submitted</th><th>Reviewed</th><th>Outcome</th><th>Progress</th><th>Comments</th></tr></thead>
            <tbody>{[...ds.submissions.filter((x) => x.modelId === hist.model.id)].sort((a, b) => b.submittedDate.localeCompare(a.submittedDate)).map((x) => (
              <tr key={x.id} className={x.submittedDate > asOf ? 'opacity-50' : ''}>
                <td className="font-mono">{x.revision}</td><td>{fmtDate(x.submittedDate)}</td><td>{fmtDate(x.reviewedDate)}</td>
                <td><Pill color={MODEL_STATUS_COLOR[x.status]}>{x.status}</Pill></td><td className="tabular-nums">{x.progressReported}%</td><td className="text-muted">{x.comments || '—'}</td>
              </tr>))}
            </tbody>
          </table>
        </>}
      </Modal>
      <RecordSubmission model={submitFor} onClose={() => setSubmitFor(null)} />
      <NewModel open={newModel} onClose={() => setNewModel(false)} />
    </div>
  );
}

const Info = ({ l, v }: { l: string; v: string }) => <div><div className="label">{l}</div><div>{v}</div></div>;

function RecordSubmission({ model, onClose }: { model: BimModel | null; onClose: () => void }) {
  const { ds, upsert } = useStore();
  const prev = model ? ds.submissions.filter((s) => s.modelId === model.id).sort((a, b) => a.submittedDate.localeCompare(b.submittedDate)) : [];
  const nextRev = `P${String(prev.length + 1).padStart(2, '0')}`;
  const [f, setF] = useState({ date: todayISO(), status: 'Received' as ModelStatus, progress: 0, comments: '', federated: false });
  if (!model) return null;
  const save = async () => {
    const sub: ModelSubmission = { id: uid('sub-'), modelId: model.id, revision: nextRev, submittedDate: f.date, reviewedDate: f.status === 'Received' ? undefined : f.date, status: f.status, progressReported: f.progress || model.developmentProgress, comments: f.comments, submittedBy: model.companyId };
    const ok = await upsert('submissions', [sub]);
    if (ok) await upsert('models', [{ ...model, revision: nextRev, status: f.status, lastUpload: f.date, developmentProgress: sub.progressReported, federated: f.federated || model.federated }]);
    if (ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Record submission ${nextRev} — ${model.name}`} footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><CheckCircle2 size={14} /> Save submission</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Submission date"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Review status"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ModelStatus })}>{MODEL_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Development progress reported (%)"><input type="number" min={0} max={100} className="input" value={f.progress || model.developmentProgress} onChange={(e) => setF({ ...f, progress: Math.max(0, Math.min(100, +e.target.value)) })} /></Field>
        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={f.federated || model.federated} onChange={(e) => setF({ ...f, federated: e.target.checked })} /> Included in federated model</label>
        <Field label="Review comments" className="col-span-2"><input className="input" value={f.comments} onChange={(e) => setF({ ...f, comments: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function NewModel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ds, filters, upsert } = useStore();
  const project = ds.projects.find((p) => p.id === filters.projectId)!;
  const [f, setF] = useState({ name: '', discipline: 'ARC' as DisciplineCode, building: project.buildings[0]?.code ?? '', companyId: ds.companies[0]?.id ?? '', targetLod: 'LOD 350' });
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f.name.trim()) return setErr('Model file name is required');
    if (ds.models.some((m) => m.name === f.name.trim())) return setErr('A model with this file name already exists');
    const m: BimModel = { id: uid('mdl-'), projectId: project.id, name: f.name.trim(), discipline: f.discipline, building: f.building, companyId: f.companyId, revision: '—', status: 'Received', lastUpload: '9999-12-31', targetLod: f.targetLod, currentLod: 'LOD 100', developmentProgress: 0, federated: false, sizeMb: 0 };
    if (await upsert('models', [m])) { setErr(''); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Register model" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Register</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Model file name (ISO 19650)" required error={err} className="col-span-2"><input className="input font-mono" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="PRJ-ORG-B1-ZZ-M3-A-0001.rvt" /></Field>
        <Field label="Discipline"><select className="input" value={f.discipline} onChange={(e) => setF({ ...f, discipline: e.target.value as DisciplineCode })}>{DISCIPLINES.map((x) => <option key={x.code} value={x.code}>{x.code} — {x.name}</option>)}</select></Field>
        <Field label="Building"><select className="input" value={f.building} onChange={(e) => setF({ ...f, building: e.target.value })}>{project.buildings.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}</select></Field>
        <Field label="Author company"><select className="input" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>{ds.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Target LOD"><select className="input" value={f.targetLod} onChange={(e) => setF({ ...f, targetLod: e.target.value })}>{['LOD 200', 'LOD 300', 'LOD 350', 'LOD 400', 'LOD 500'].map((x) => <option key={x}>{x}</option>)}</select></Field>
      </div>
      <p className="text-xs text-muted mt-3">The model counts as “received” once its first submission is recorded.</p>
    </Modal>
  );
}
