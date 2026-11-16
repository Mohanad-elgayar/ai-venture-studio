import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown, FileSpreadsheet, Printer, RotateCcw, Download, Loader2 } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, Field } from '../components/ui';
import { buildReport, defaultActions, REPORT_TYPES, type ReportSettings, type ReportType } from '../lib/report';
import { generatePdf } from '../lib/pdf';
import { clashRows, downloadCSV, downloadXlsx, stamp } from '../lib/export';
import { fmtDate, todayISO } from '../lib/dates';
import { cls } from '../lib/format';
import { isOpenAsOf } from '../lib/metrics';

export const REPORT_KEY = 'bimcc.report';

export default function Reports() {
  const { ds, filters, scope, period, user, notify } = useStore();
  const d = useData();
  const [params] = useSearchParams();
  const [type, setType] = useState<ReportType>((params.get('type') as ReportType) || 'executive');
  const [busy, setBusy] = useState<string | null>(null);
  const data = useMemo(() => buildReport(ds, filters, scope), [ds, filters, scope]);
  const autoObs = data.observations.join('\n');
  const autoActs = useMemo(() => defaultActions(ds, filters, scope, (id) => d.companyName(id)).join('\n'), [ds, filters, scope, d]);
  const [st, setSt] = useState<ReportSettings>({ preparedBy: user ? `${user.name} — ${user.role}` : '', issueDate: todayISO(), observations: autoObs, actions: autoActs });
  // refresh auto-generated text when scope changes (user edits are kept until scope changes)
  useEffect(() => setSt((s) => ({ ...s, observations: autoObs, actions: autoActs })), [autoObs, autoActs]);
  const meta = { projectName: d.project.name, projectCode: d.project.code, periodLabel: period?.label ?? '', asOf: scope.asOf, isDemo: ds.isDemo, companyName: (id: string) => d.companyName(id) };
  const fileBase = `${d.project.code}-${type}-report-${scope.asOf}`;

  const pdf = async () => {
    setBusy('pdf');
    try { const doc = await generatePdf(type, data, st, meta); doc.save(`${fileBase}.pdf`); notify('success', 'PDF report generated'); }
    catch (e) { notify('error', `PDF generation failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  };
  const print = () => {
    try { localStorage.setItem(REPORT_KEY, JSON.stringify({ type, settings: st })); } catch { /* print view falls back to auto-generated text */ }
    window.open(`${location.pathname}#/report/${type}`, '_blank');
  };
  const excel = async () => {
    setBusy('xlsx');
    try {
      await downloadXlsx([
        { name: 'KPI Summary', rows: data.kpis.map((k) => ({ KPI: k.label, Value: k.value, 'Previous period': k.prev ?? '' })) },
        { name: 'Weekly Trend', rows: data.weekly.map((w) => ({ 'Week ending': w.end, 'New clashes': w.newClashes, Resolved: w.resolved, Open: w.open, Closed: w.closed, Overdue: w.overdue, 'Resolution %': w.resolutionRate, 'Overall progress %': w.overall })) },
        { name: 'Monthly Trend', rows: data.monthly.map((m) => ({ Month: m.label, 'New clashes': m.newClashes, Resolved: m.resolved, Open: m.open, 'Resolution %': m.resolutionRate, 'Deliverables submitted': m.deliverablesSubmitted, 'Deliverables approved': m.deliverablesApproved, 'Overall %': m.overall })) },
        { name: 'Open Clash Matrix', rows: [...data.matrices.open.cells.values()].map((c) => ({ 'Discipline A': c.a, 'Discipline B': c.b, Open: c.count, Critical: c.bySeverity.Critical, High: c.bySeverity.High, Medium: c.bySeverity.Medium, Low: c.bySeverity.Low, Score: c.score })) },
        { name: 'Open Clashes', rows: clashRows(d.clashes.filter((c) => isOpenAsOf(c, scope.asOf)), scope.asOf, d) },
        { name: 'Observations & Actions', rows: [...st.observations.split('\n').filter(Boolean).map((o) => ({ Type: 'Observation', Text: o })), ...st.actions.split('\n').filter(Boolean).map((o) => ({ Type: 'Action', Text: o }))] },
      ], `${fileBase}.xlsx`, { Report: REPORT_TYPES.find((t) => t.id === type)!.title, Project: d.project.name, 'Reporting period': period?.label ?? '', 'Reporting date': scope.asOf, 'Prepared by': st.preparedBy, 'Issue date': st.issueDate, Data: ds.isDemo ? 'DEMO DATA — not actual project performance' : 'Project data' });
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {REPORT_TYPES.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} className={cls('card p-4 text-left transition', type === t.id ? 'border-accent ring-1 ring-accent' : 'hover:border-muted')}>
            <div className="font-semibold">{t.title}</div><div className="text-xs text-muted mt-1">{t.desc}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        <Card title="Report content" subtitle={`${d.project.name} · ${period?.label ?? ''} · as at ${fmtDate(scope.asOf)} · global filters apply`}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prepared by"><input className="input" value={st.preparedBy} onChange={(e) => setSt({ ...st, preparedBy: e.target.value })} /></Field>
            <Field label="Issue date"><input type="date" className="input" value={st.issueDate} onChange={(e) => setSt({ ...st, issueDate: e.target.value })} /></Field>
            <Field label="Key observations (one per line — auto-generated from data, editable)" className="col-span-2"><textarea className="input font-mono text-xs" rows={8} value={st.observations} onChange={(e) => setSt({ ...st, observations: e.target.value })} /></Field>
            <Field label="Action items (one per line — derived from overdue/critical clashes, risks and late deliverables)" className="col-span-2"><textarea className="input font-mono text-xs" rows={7} value={st.actions} onChange={(e) => setSt({ ...st, actions: e.target.value })} /></Field>
          </div>
          <button className="btn-ghost mt-3 text-xs" onClick={() => setSt({ ...st, observations: autoObs, actions: autoActs })}><RotateCcw size={13} /> Regenerate from data</button>
        </Card>
        <div className="space-y-4">
          <Card title="Generate">
            <div className="flex flex-col gap-2">
              <button className="btn-primary justify-center" onClick={pdf} disabled={!!busy}>{busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Download PDF report</button>
              <button className="btn-ghost justify-center" onClick={print}><Printer size={14} /> Open print-friendly report</button>
              <button className="btn-ghost justify-center" onClick={excel} disabled={!!busy}>{busy === 'xlsx' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel report pack</button>
              <button className="btn-ghost justify-center" onClick={() => downloadCSV(data.kpis.map((k) => ({ KPI: k.label, Value: k.value, 'Previous period': k.prev ?? '', 'Reporting date': scope.asOf })), `${fileBase}-kpis.csv`)}><Download size={14} /> KPI summary CSV</button>
            </div>
            <p className="text-[11px] text-muted mt-3">Every report includes: project name, reporting period, prepared by, issue date, KPI summary, charts, outstanding issues, key observations and action items.{ds.isDemo && ' Reports generated from demo data are labelled DEMO DATA on every page.'}</p>
          </Card>
          <Card title="Data exports">
            <div className="flex flex-col gap-2 text-sm">
              <button className="btn-ghost justify-center" onClick={() => downloadXlsx([{ name: 'Clash Register', rows: clashRows(d.clashes, scope.asOf, d) }], `clash-register-${stamp()}.xlsx`, { Project: d.project.name, 'Reporting date': scope.asOf })}><FileSpreadsheet size={14} /> Full clash register (Excel)</button>
              <button className="btn-ghost justify-center" onClick={() => downloadCSV(clashRows(d.clashes, scope.asOf, d), `clash-register-${stamp()}.csv`)}><Download size={14} /> Full clash register (CSV)</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
