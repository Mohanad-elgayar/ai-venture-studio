import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { Download, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, ConfirmButton, DataTable, Field, Modal, MultiSelect, Pill, type Column } from '../components/ui';
import { Kpi } from '../components/Kpi';
import { ChartBox, Legend, useChartTheme } from '../components/charts';
import { deliverableKpis, isApprovedAsOf, isDeliverableOverdue, isSubmittedAsOf } from '../lib/metrics';
import { APPROVAL_STATUSES, DELIVERABLE_STATUSES, DELIVERABLE_TYPES, DISCIPLINES } from '../lib/constants';
import { addDays, diffDays, fmtDate, fmtShort, isValidISODate, todayISO } from '../lib/dates';
import { downloadCSV, downloadXlsx, stamp } from '../lib/export';
import { cls, pct } from '../lib/format';
import type { ApprovalStatus, Deliverable } from '../types';

const APPROVAL_COLOR: Record<ApprovalStatus, string> = { Pending: '#8c9db8', Approved: '#0ca30c', 'Approved with Comments': '#199e70', Rejected: '#d03b3b', 'N/A': '#64748b' };

/** Status shown at the reporting date (derived from dates, so it is consistent with KPIs). */
export function deliverableStatusAsOf(dl: Deliverable, asOf: string) {
  if (isSubmittedAsOf(dl, asOf)) return dl.revision.startsWith('C0') && dl.revision !== 'C01' ? 'Resubmitted' : 'Submitted';
  if (isDeliverableOverdue(dl, asOf)) return 'Overdue';
  return diffDays(dl.plannedDate, asOf) <= 21 ? 'In Progress' : 'Not Started';
}
export function approvalAsOf(dl: Deliverable, asOf: string): ApprovalStatus {
  if (!isSubmittedAsOf(dl, asOf)) return 'Pending';
  if ((dl.reviewedDate ?? dl.actualDate!) > asOf) return 'Pending';
  return dl.approvalStatus;
}

export default function Deliverables() {
  const { scope, ds, can, user } = useStore();
  const d = useData();
  const t = useChartTheme();
  const asOf = scope.asOf;
  const [types, setTypes] = useState<string[]>([]);
  const [edit, setEdit] = useState<Deliverable | 'new' | null>(null);
  const rowsAll = d.deliverables;
  const rows = useMemo(() => rowsAll.filter((x) => !types.length || types.includes(x.type)), [rowsAll, types]);
  const k = deliverableKpis(rows, asOf);

  // planned vs actual cumulative (weekly), from project start to 12 weeks after as-of
  const curve = useMemo(() => {
    if (!rows.length) return [];
    const first = rows.reduce((m, x) => (x.plannedDate < m ? x.plannedDate : m), rows[0].plannedDate);
    const last = addDays(asOf, 84);
    const out = [];
    for (let w = first; w <= last; w = addDays(w, 7)) {
      out.push({
        label: fmtShort(w), date: w,
        planned: rows.filter((x) => x.plannedDate <= w).length,
        submitted: w <= asOf ? rows.filter((x) => isSubmittedAsOf(x, w)).length : null,
        approved: w <= asOf ? rows.filter((x) => isApprovedAsOf(x, w)).length : null,
      });
    }
    return out;
  }, [rows, asOf]);
  const asOfLabel = curve.filter((c) => c.date <= asOf).slice(-1)[0]?.label;

  const byType = useMemo(() => DELIVERABLE_TYPES.map((ty) => {
    const r = rows.filter((x) => x.type === ty);
    return { type: ty, Planned: r.filter((x) => x.plannedDate <= asOf).length, Submitted: r.filter((x) => isSubmittedAsOf(x, asOf)).length, Approved: r.filter((x) => isApprovedAsOf(x, asOf)).length, total: r.length };
  }).filter((x) => x.total), [rows, asOf]);

  const exportRows = rows.map((x) => ({
    'Deliverable ID': x.id, 'Deliverable Name': x.name, Type: x.type, Discipline: x.discipline, 'Responsible Party': d.companyName(x.responsibleCompanyId),
    'Planned Submission Date': x.plannedDate, 'Actual Submission Date': isSubmittedAsOf(x, asOf) ? x.actualDate : '', 'Variance (days)': x.actualDate && isSubmittedAsOf(x, asOf) ? diffDays(x.actualDate, x.plannedDate) : '',
    Revision: x.revision, Status: deliverableStatusAsOf(x, asOf), 'Approval Status': approvalAsOf(x, asOf), 'Review Comments': x.reviewComments,
  }));

  const columns: Column<Deliverable>[] = [
    { key: 'id', header: 'ID', render: (x) => <span className="font-mono text-xs">{x.id}</span> },
    { key: 'name', header: 'Deliverable', render: (x) => <span className="block max-w-[300px] truncate" title={x.name}>{x.name}</span> },
    { key: 'type', header: 'Type' },
    { key: 'discipline', header: 'Disc.' },
    { key: 'resp', header: 'Responsible', value: (x) => d.companyShort(x.responsibleCompanyId) },
    { key: 'plannedDate', header: 'Planned', render: (x) => <span className="whitespace-nowrap">{fmtDate(x.plannedDate)}</span> },
    { key: 'actualDate', header: 'Actual', value: (x) => (isSubmittedAsOf(x, asOf) ? x.actualDate : ''), render: (x) => <span className="whitespace-nowrap">{isSubmittedAsOf(x, asOf) ? fmtDate(x.actualDate) : '—'}</span> },
    { key: 'var', header: 'Var. (d)', align: 'right', value: (x) => (isSubmittedAsOf(x, asOf) ? diffDays(x.actualDate!, x.plannedDate) : isDeliverableOverdue(x, asOf) ? diffDays(asOf, x.plannedDate) : ''),
      render: (x) => { const v = isSubmittedAsOf(x, asOf) ? diffDays(x.actualDate!, x.plannedDate) : isDeliverableOverdue(x, asOf) ? diffDays(asOf, x.plannedDate) : null; return v === null ? '—' : <span className={cls('tabular-nums', v > 0 ? 'text-crit' : 'text-ok')}>{v > 0 ? `+${v}` : v}</span>; } },
    { key: 'revision', header: 'Rev' },
    { key: 'status', header: 'Status', value: (x) => deliverableStatusAsOf(x, asOf), render: (x) => { const s = deliverableStatusAsOf(x, asOf); return <Pill color={s === 'Overdue' ? '#d03b3b' : s === 'Submitted' || s === 'Resubmitted' ? '#3987e5' : '#8c9db8'}>{s}</Pill>; } },
    { key: 'approval', header: 'Approval', value: (x) => approvalAsOf(x, asOf), render: (x) => <Pill color={APPROVAL_COLOR[approvalAsOf(x, asOf)]}>{approvalAsOf(x, asOf)}</Pill> },
    { key: 'reviewComments', header: 'Review comments', render: (x) => <span className="block max-w-[220px] truncate text-muted" title={x.reviewComments}>{x.reviewComments || '—'}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Kpi label="Deliverables in plan" value={k.total} sub="MIDP scope" />
        <Kpi label="Due to date" value={k.due} sub="planned on/before reporting date" />
        <Kpi label="Submitted" value={k.submitted} tone="accent" sub={`${pct(k.submissionRate)} of due`} />
        <Kpi label="Approved" value={k.approved} tone="ok" sub={`${pct(k.progress)} of plan`} />
        <Kpi label="Pending review" value={k.pendingReview} tone="med" />
        <Kpi label="Rejected" value={k.rejected} tone={k.rejected ? 'crit' : undefined} />
        <Kpi label="Overdue" value={k.overdue} tone={k.overdue ? 'crit' : 'ok'} sub="past planned, not submitted" />
        <Kpi label="On-time submission" value={pct(k.onTimeRate)} tone={k.onTimeRate >= 80 ? 'ok' : k.onTimeRate >= 60 ? 'med' : 'crit'} sub={`avg delay ${k.avgDelayDays.toFixed(1)}d when late`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <Card title="Planned vs actual submission performance" subtitle="Cumulative deliverables — planned (dashed) vs actually submitted and approved" actions={<Legend items={[{ label: 'Planned', color: t.axis, dashed: true }, { label: 'Submitted', color: t.series[0] }, { label: 'Approved', color: t.series[2] }]} />}>
          <ChartBox height={280}>
            <LineChart data={curve} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={t.tick} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...t.tooltip} />
              {asOfLabel && <ReferenceLine x={asOfLabel} stroke={t.axis} strokeDasharray="2 3" label={{ value: 'Reporting date', fill: t.axis, fontSize: 10, position: 'insideTopRight' }} />}
              <Line type="stepAfter" dataKey="planned" name="Planned" stroke={t.axis} strokeDasharray="5 4" strokeWidth={2} dot={false} />
              <Line type="stepAfter" dataKey="submitted" name="Submitted" stroke={t.series[0]} strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="stepAfter" dataKey="approved" name="Approved" stroke={t.series[2]} strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart>
          </ChartBox>
        </Card>
        <Card title="Status by deliverable type" subtitle="Due to date vs submitted vs approved" actions={<Legend items={[{ label: 'Due', color: t.axis }, { label: 'Submitted', color: t.series[0] }, { label: 'Approved', color: t.series[2] }]} />}>
          <ChartBox height={Math.max(280, byType.length * 30)}>
            <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={1}>
              <CartesianGrid stroke={t.grid} horizontal={false} />
              <XAxis type="number" tick={t.tick} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="type" tick={{ ...t.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={150} interval={0} />
              <Tooltip {...t.tooltip} />
              <Bar dataKey="Planned" name="Due" fill={t.axis} radius={[0, 3, 3, 0]} maxBarSize={6} />
              <Bar dataKey="Submitted" fill={t.series[0]} radius={[0, 3, 3, 0]} maxBarSize={7} />
              <Bar dataKey="Approved" fill={t.series[2]} radius={[0, 3, 3, 0]} maxBarSize={7} />
            </BarChart>
          </ChartBox>
        </Card>
      </div>

      <Card title="Deliverables register" subtitle={`Statuses derived as at ${fmtDate(asOf)} from planned/actual/review dates`}>
        <DataTable rows={rows} columns={columns} rowKey={(x) => x.id} onRowClick={can('register.edit') ? setEdit : undefined} initialSort={{ key: 'plannedDate', dir: 'asc' }}
          toolbar={<>
            <div className="w-56"><MultiSelect label="Type" value={types} onChange={setTypes} options={DELIVERABLE_TYPES.map((x) => ({ value: x, label: x }))} width="w-64" /></div>
            <button className="btn-ghost" onClick={() => downloadCSV(exportRows, `deliverables-${stamp()}.csv`)}><Download size={14} /> CSV</button>
            <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Deliverables', rows: exportRows }], `deliverables-${stamp()}.xlsx`, { Project: d.project.name, 'Reporting date': asOf, Data: ds.isDemo ? 'DEMO DATA' : 'Project data', 'Exported by': user?.name ?? '' })}><FileSpreadsheet size={14} /> Excel</button>
            {can('register.edit') && <button className="btn-primary" onClick={() => setEdit('new')}><Plus size={14} /> Add deliverable</button>}
          </>} />
      </Card>
      <DeliverableEditor item={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function DeliverableEditor({ item, onClose }: { item: Deliverable | 'new' | null; onClose: () => void }) {
  const { ds, filters, upsert, remove, can } = useStore();
  const isNew = item === 'new';
  const nextId = () => `DLV-${String(Math.max(0, ...ds.deliverables.map((x) => +(/\d+$/.exec(x.id)?.[0] ?? 0))) + 1).padStart(3, '0')}`;
  const init = (): Deliverable => isNew || !item ? { id: nextId(), projectId: filters.projectId, name: '', type: 'Model Delivery', discipline: 'ALL', responsibleCompanyId: ds.companies[0]?.id ?? '', plannedDate: addDays(todayISO(), 14), revision: 'P01', status: 'Not Started', approvalStatus: 'Pending', reviewComments: '' } : { ...item };
  const [f, setF] = useState<Deliverable>(init);
  const [key, setKey] = useState<unknown>(null);
  if (key !== item) { setKey(item); setF(init()); }
  const [err, setErr] = useState<Record<string, string>>({});
  if (!item) return null;
  const set = <K extends keyof Deliverable>(k: K, v: Deliverable[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Required';
    if (!isValidISODate(f.plannedDate)) e.plannedDate = 'Valid date required';
    if (f.actualDate && !isValidISODate(f.actualDate)) e.actualDate = 'Invalid date';
    if (f.reviewedDate && f.actualDate && f.reviewedDate < f.actualDate) e.reviewedDate = 'Cannot precede submission';
    if (f.approvalStatus !== 'Pending' && f.approvalStatus !== 'N/A' && !f.actualDate) e.approvalStatus = 'Cannot approve/reject before submission';
    if (isNew && ds.deliverables.some((x) => x.id === f.id)) e.id = 'ID already exists';
    setErr(e);
    if (Object.keys(e).length) return;
    const status: Deliverable['status'] = f.actualDate ? (f.revision !== 'C01' && f.revision.startsWith('C') ? 'Resubmitted' : 'Submitted') : f.plannedDate < todayISO() ? 'Overdue' : f.status === 'Overdue' ? 'In Progress' : f.status;
    if (await upsert('deliverables', [{ ...f, status, reviewedDate: f.approvalStatus !== 'Pending' ? f.reviewedDate ?? f.actualDate : undefined }])) onClose();
  };
  return (
    <Modal open onClose={onClose} wide title={isNew ? 'New deliverable' : `Deliverable ${f.id}`} footer={<>
      {!isNew && can('register.delete') && <ConfirmButton className="btn-danger mr-auto" onConfirm={async () => { if (await remove('deliverables', [f.id])) onClose(); }}><Trash2 size={14} /> Delete</ConfirmButton>}
      <button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Deliverable ID" error={err.id}><input className="input font-mono" disabled={!isNew} value={f.id} onChange={(e) => set('id', e.target.value)} /></Field>
        <Field label="Deliverable name" required error={err.name} className="col-span-3"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={(e) => set('type', e.target.value as Deliverable['type'])}>{DELIVERABLE_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Discipline"><select className="input" value={f.discipline} onChange={(e) => set('discipline', e.target.value as Deliverable['discipline'])}><option value="ALL">ALL (project-wide)</option>{DISCIPLINES.map((x) => <option key={x.code} value={x.code}>{x.code}</option>)}</select></Field>
        <Field label="Responsible party" className="col-span-2"><select className="input" value={f.responsibleCompanyId} onChange={(e) => set('responsibleCompanyId', e.target.value)}>{ds.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Planned submission" required error={err.plannedDate}><input type="date" className="input" value={f.plannedDate} onChange={(e) => set('plannedDate', e.target.value)} /></Field>
        <Field label="Actual submission" error={err.actualDate}><input type="date" className="input" value={f.actualDate ?? ''} onChange={(e) => set('actualDate', e.target.value || undefined)} /></Field>
        <Field label="Revision"><input className="input" value={f.revision} onChange={(e) => set('revision', e.target.value)} /></Field>
        <Field label="Work status"><select className="input" value={f.status} onChange={(e) => set('status', e.target.value as Deliverable['status'])}>{DELIVERABLE_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Approval status" error={err.approvalStatus}><select className="input" value={f.approvalStatus} onChange={(e) => set('approvalStatus', e.target.value as ApprovalStatus)}>{APPROVAL_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Review date" error={err.reviewedDate}><input type="date" className="input" value={f.reviewedDate ?? ''} onChange={(e) => set('reviewedDate', e.target.value || undefined)} /></Field>
        <Field label="Review comments" className="col-span-2"><input className="input" value={f.reviewComments} onChange={(e) => set('reviewComments', e.target.value)} /></Field>
      </div>
      <p className="text-xs text-muted mt-3">Work status is derived on save from the dates (Submitted / Resubmitted / Overdue).</p>
    </Modal>
  );
}
