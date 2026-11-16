import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';
import { ShieldAlert, ShieldCheck, ShieldQuestion, Plus, Download, FileSpreadsheet, Cpu } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, DataTable, Field, Modal, Pill, ProgressBar, Tabs, type Column } from '../components/ui';
import { Kpi } from '../components/Kpi';
import { ChartBox, useChartTheme } from '../components/charts';
import { complianceScores, overallCompliance, NAMING_PATTERN_LABEL, type ComplianceRow } from '../lib/metrics';
import { COMPLIANCE_CATEGORIES, DISCIPLINES, GOOD } from '../lib/constants';
import { fmtDate, todayISO } from '../lib/dates';
import { downloadCSV, downloadXlsx, stamp } from '../lib/export';
import { pct, uid } from '../lib/format';
import type { CheckResult, ComplianceCategory, ComplianceCheck } from '../types';

const RES_COLOR: Record<CheckResult, string> = { Pass: '#0ca30c', Observation: '#fab219', Fail: '#d03b3b' };
const scoreColor = (v: number) => (v >= 85 ? GOOD : v >= 65 ? '#fab219' : '#d03b3b');

export default function Compliance() {
  const { ds, can, upsert, scope } = useStore();
  const d = useData();
  const t = useChartTheme();
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const [add, setAdd] = useState(false);
  const rows = d.complianceRows;
  const scores = useMemo(() => complianceScores(rows), [rows]);
  const overall = overallCompliance(scores);
  const openObs = rows.filter((r) => r.result !== 'Pass' && !r.observationClosed);
  const verifiedScores = scores.filter((s) => s.verified).map((s) => ({ name: s.category, score: +(s.score ?? 0).toFixed(1) }));

  const discMatrix = useMemo(() => DISCIPLINES.map((dd) => {
    const r: Record<string, number | string | null> = { code: dd.code };
    for (const c of COMPLIANCE_CATEGORIES) {
      const x = rows.filter((q) => q.category === c && q.discipline === dd.code);
      r[c] = x.length ? ((x.filter((q) => q.result === 'Pass').length + 0.5 * x.filter((q) => q.result === 'Observation').length) / x.length) * 100 : null;
    }
    return r;
  }), [rows]);

  const closeObs = async (r: ComplianceRow) => {
    const c = ds.compliance.find((x) => x.id === r.id);
    if (c) await upsert('compliance', [{ ...c, observationClosed: true }]);
  };
  const exp = (list: ComplianceRow[]) => list.map((r) => ({ Category: r.category, Check: r.checkName, Discipline: r.discipline, Model: r.modelId ? d.modelName(r.modelId) : '', Result: r.result, 'Checked date': r.date, Evidence: r.evidence, Observation: r.observation, 'Observation status': r.result === 'Pass' ? '' : r.observationClosed ? 'Closed' : 'Open', Source: r.automated ? 'Automated (dashboard)' : 'Recorded audit' }));

  const columns: Column<ComplianceRow>[] = [
    { key: 'category', header: 'Category' },
    { key: 'checkName', header: 'Check', render: (r) => <span className="inline-flex items-center gap-1">{r.automated && <Cpu size={12} className="text-accent2" aria-label="automated" />}{r.checkName}</span> },
    { key: 'discipline', header: 'Disc.' },
    { key: 'model', header: 'Model', value: (r) => (r.modelId ? d.modelName(r.modelId) : '—'), render: (r) => <span className="font-mono text-[11px] block max-w-[220px] truncate" title={r.modelId ? d.modelName(r.modelId) : ''}>{r.modelId ? d.modelName(r.modelId) : '—'}</span> },
    { key: 'result', header: 'Result', render: (r) => <Pill color={RES_COLOR[r.result]}>{r.result}</Pill> },
    { key: 'date', header: 'Checked', render: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
    { key: 'observation', header: 'Observation', render: (r) => <span className="block max-w-[320px] truncate text-muted" title={r.observation}>{r.observation || '—'}</span> },
    { key: 'evidence', header: 'Evidence', render: (r) => <span className="text-[11px] text-muted">{r.evidence}</span> },
    { key: 'act', header: '', sortable: false, render: (r) => r.result !== 'Pass' && !r.observationClosed && !r.automated && can('register.edit') ? <button className="btn-ghost !py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); closeObs(r); }}>Close</button> : r.result !== 'Pass' && r.observationClosed ? <span className="text-xs text-ok">Closed</span> : null },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Overall compliance score" value={overall.score === null ? 'Not verified' : pct(overall.score, 1)} tone={overall.score === null ? undefined : overall.score >= 85 ? 'ok' : overall.score >= 65 ? 'med' : 'crit'} sub={`average of ${overall.verified} verified categories`} help="Score per category = (Pass + 0.5 × Observation) ÷ checks. Categories with no recorded checks are NOT included and shown as Not verified." />
        <Kpi label="Categories verified" value={`${overall.verified}/${overall.total}`} tone={overall.verified < overall.total ? 'med' : 'ok'} sub={`${overall.total - overall.verified} without supporting audit data`} />
        <Kpi label="Checks on record" value={rows.length} sub={`${rows.filter((r) => r.automated).length} automated · ${rows.filter((r) => !r.automated).length} recorded audits`} />
        <Kpi label="Outstanding observations" value={openObs.length} tone={openObs.length ? 'high' : 'ok'} sub={`${openObs.filter((r) => r.result === 'Fail').length} failures · ${openObs.filter((r) => r.result === 'Observation').length} observations`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {scores.map((s) => (
          <div key={s.category} className="card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold truncate">{s.category}</span>
              {!s.verified ? <ShieldQuestion size={16} className="text-muted" /> : (s.score ?? 0) >= 85 ? <ShieldCheck size={16} className="text-ok" /> : <ShieldAlert size={16} className="text-high" />}
            </div>
            {s.verified ? <>
              <div className="text-2xl font-semibold tabular-nums mt-1" style={{ color: scoreColor(s.score ?? 0) }}>{pct(s.score ?? 0)}</div>
              <ProgressBar value={s.score ?? 0} color={scoreColor(s.score ?? 0)} height={4} />
              <div className="text-[11px] text-muted mt-1.5">{s.pass} pass · {s.observation} obs · {s.fail} fail · <b className={s.openObservations ? 'text-high' : ''}>{s.openObservations} open</b></div>
            </> : <>
              <div className="mt-1.5"><span className="chip border border-dashed border-muted/60 text-muted">NOT VERIFIED</span></div>
              <div className="text-[11px] text-muted mt-1.5">No audit evidence recorded up to the reporting date. Compliance is not assumed.</div>
            </>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Compliance score by category" subtitle="Verified categories only">
          <ChartBox height={280}>
            <BarChart data={verifiedScores} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={t.tick} axisLine={false} tickLine={false} unit="%" />
              <YAxis type="category" dataKey="name" tick={t.tick} axisLine={false} tickLine={false} width={130} interval={0} />
              <Tooltip {...t.tooltip} formatter={(v: number) => `${v}%`} />
              <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]} maxBarSize={14}>
                {verifiedScores.map((s) => <Cell key={s.name} fill={t.series[0]} />)}
                <LabelList dataKey="score" position="right" fill={t.axis} fontSize={11} formatter={(v: number) => `${v}%`} />
              </Bar>
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Compliance by discipline" subtitle="Score per discipline and category · — = no checks recorded">
          <div className="overflow-auto">
            <table className="tbl w-full">
              <thead><tr><th>Disc.</th>{COMPLIANCE_CATEGORIES.map((c) => <th key={c} className="!text-center !text-[9px] !normal-case !tracking-normal" title={c}>{c.replace(' Compliance', '').replace('Convention', 'Conv.').replace('Information', 'Info.')}</th>)}</tr></thead>
              <tbody>{discMatrix.map((r) => (
                <tr key={r.code as string}><td className="font-semibold">{r.code}</td>
                  {COMPLIANCE_CATEGORIES.map((c) => { const v = r[c] as number | null; return <td key={c} className="!text-center tabular-nums text-xs" style={v === null ? undefined : { color: scoreColor(v) }}>{v === null ? <span className="text-muted/50">—</span> : Math.round(v)}</td>; })}
                </tr>))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Compliance checks & outstanding observations" subtitle={<>Latest result per check as at {fmtDate(scope.asOf)}. <Cpu size={11} className="inline text-accent2" /> = automated naming check computed by this dashboard against {NAMING_PATTERN_LABEL}.</>}>
        <DataTable rows={tab === 'open' ? openObs : rows} columns={columns} rowKey={(r) => r.id} initialSort={{ key: 'result', dir: 'asc' }}
          toolbar={<>
            <Tabs value={tab} onChange={setTab} tabs={[{ id: 'open', label: `Outstanding (${openObs.length})` }, { id: 'all', label: `All checks (${rows.length})` }]} />
            <button className="btn-ghost" onClick={() => downloadCSV(exp(tab === 'open' ? openObs : rows), `compliance-${stamp()}.csv`)}><Download size={14} /> CSV</button>
            <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Category scores', rows: scores.map((s) => ({ Category: s.category, Verified: s.verified ? 'Yes' : 'NOT VERIFIED', 'Score %': s.score === null ? '' : +s.score.toFixed(1), Checks: s.checks, Pass: s.pass, Observation: s.observation, Fail: s.fail, 'Open observations': s.openObservations })) }, { name: 'Checks', rows: exp(rows) }], `compliance-${stamp()}.xlsx`, { Project: d.project.name, 'Reporting date': scope.asOf, Data: ds.isDemo ? 'DEMO DATA' : 'Project data' })}><FileSpreadsheet size={14} /> Excel</button>
            {can('register.edit') && <button className="btn-primary" onClick={() => setAdd(true)}><Plus size={14} /> Record check</button>}
          </>} />
      </Card>
      <RecordCheck open={add} onClose={() => setAdd(false)} />
    </div>
  );
}

function RecordCheck({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ds, filters, upsert, user } = useStore();
  const [f, setF] = useState({ category: 'IFC Export' as ComplianceCategory, checkName: '', modelId: '', discipline: 'ALL', result: 'Pass' as CheckResult, checkedDate: todayISO(), evidence: '', observation: '' });
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f.checkName.trim()) return setErr('Check name is required');
    if (!f.evidence.trim()) return setErr('Evidence reference is required — compliance is only recorded with supporting evidence');
    const model = ds.models.find((m) => m.id === f.modelId);
    const c: ComplianceCheck = { id: uid('CHK-'), projectId: filters.projectId, category: f.category, checkName: f.checkName.trim(), modelId: f.modelId || undefined, discipline: (model?.discipline ?? f.discipline) as ComplianceCheck['discipline'], result: f.result, checkedDate: f.checkedDate, checkedBy: user?.id ?? '', evidence: f.evidence.trim(), observation: f.observation, observationClosed: f.result === 'Pass' };
    if (await upsert('compliance', [c])) { setErr(''); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Record compliance check" footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save check</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category"><select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ComplianceCategory })}>{COMPLIANCE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Result"><select className="input" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value as CheckResult })}>{(['Pass', 'Observation', 'Fail'] as const).map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Check name" required className="col-span-2"><input className="input" value={f.checkName} onChange={(e) => setF({ ...f, checkName: e.target.value })} placeholder="e.g. IFC 4 export validated against MVD" /></Field>
        <Field label="Model (optional)"><select className="input" value={f.modelId} onChange={(e) => setF({ ...f, modelId: e.target.value })}><option value="">— project-wide —</option>{ds.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Discipline"><select className="input" value={f.discipline} disabled={!!f.modelId} onChange={(e) => setF({ ...f, discipline: e.target.value })}><option value="ALL">ALL</option>{DISCIPLINES.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</select></Field>
        <Field label="Checked date"><input type="date" className="input" value={f.checkedDate} onChange={(e) => setF({ ...f, checkedDate: e.target.value })} /></Field>
        <Field label="Evidence reference" required><input className="input" value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} placeholder="Audit report no. / checker output" /></Field>
        <Field label="Observation" className="col-span-2"><textarea className="input" rows={2} value={f.observation} onChange={(e) => setF({ ...f, observation: e.target.value })} /></Field>
      </div>
      {err && <p className="text-xs text-crit mt-2">{err}</p>}
    </Modal>
  );
}
