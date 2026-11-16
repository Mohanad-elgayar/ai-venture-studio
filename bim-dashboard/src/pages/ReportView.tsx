import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Printer } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { buildReport, defaultActions, REPORT_TYPES, type ReportSettings, type ReportType } from '../lib/report';
import { DISCIPLINES, SEVERITIES, SEVERITY_COLOR, SERIES } from '../lib/constants';
import { fmtDate, todayISO } from '../lib/dates';
import type { ClashMatrix } from '../lib/metrics';

const C = SERIES.light;

/** Print-friendly report (light, A4 landscape). Use the browser's Print → Save as PDF. */
export default function ReportView() {
  const { type = 'executive' } = useParams<{ type: ReportType }>();
  const { ds, filters, scope, period, user } = useStore();
  const d = useData();
  const r = useMemo(() => buildReport(ds, filters, scope), [ds, filters, scope]);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('bimcc.report') ?? 'null') as { type: string; settings: ReportSettings } | null; } catch { return null; } })();
  const st: ReportSettings = saved?.settings ?? { preparedBy: user?.name ?? '', issueDate: todayISO(), observations: r.observations.join('\n'), actions: defaultActions(ds, filters, scope, d.companyName).join('\n') };
  const title = REPORT_TYPES.find((t) => t.id === type)?.title ?? 'BIM Report';
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="print-area bg-white text-slate-900 min-h-full" style={{ colorScheme: 'light' }}>
      <div className="no-print sticky top-0 z-10 bg-slate-100 border-b border-slate-300 px-6 py-2 flex items-center gap-3 text-sm">
        <span className="font-semibold">Print preview</span><span className="text-slate-500">A4 landscape · use Print → “Save as PDF” for a PDF copy</span>
        <div className="flex-1" /><button className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 text-white px-3 py-1.5" onClick={() => window.print()}><Printer size={14} /> Print</button>
      </div>
      <div className="max-w-[1120px] mx-auto p-8 space-y-6 text-[13px]">
        <header className="rounded-lg overflow-hidden border border-slate-300">
          <div className="bg-[#0e1728] text-white px-5 py-4 flex justify-between gap-6">
            <div><div className="text-xl font-bold">{title}</div><div className="text-slate-300 text-sm mt-0.5">{d.project.name} · {d.project.code}</div></div>
            <div className="text-right text-xs text-slate-300 leading-5">
              <div>Reporting period: <b className="text-white">{period?.label}</b></div><div>As at: <b className="text-white">{fmtDate(scope.asOf)}</b></div>
              <div>Prepared by: <b className="text-white">{st.preparedBy || '—'}</b></div><div>Issue date: <b className="text-white">{fmtDate(st.issueDate)}</b></div>
            </div>
          </div>
          {ds.isDemo && <div className="bg-amber-400 text-slate-900 text-center text-xs font-bold py-1">DEMO DATA — fictional project and records generated for demonstration. Figures do not represent actual project performance.</div>}
        </header>

        {type !== 'matrix' && <Section title="KPI summary">
          <div className="grid grid-cols-6 gap-2">{r.kpis.map((k) => <div key={k.label} className="border border-slate-200 rounded-md p-2 bg-slate-50"><div className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold leading-tight h-6">{k.label}</div><div className="text-lg font-bold">{k.value}</div>{k.prev !== undefined && <div className="text-[9px] text-slate-500">prev. {k.prev}</div>}</div>)}</div>
          <div className="mt-2 text-xs"><b>Overall BIM health: {r.health.score === null ? 'n/a' : Math.round(r.health.score)} / 100 — {r.health.rating}</b> <span className="text-slate-500">({r.health.components.map((c) => `${c.label} ${c.value.toFixed(0)}%`).join(' · ')})</span></div>
        </Section>}

        {(type === 'executive' || type === 'weekly') && <div className="grid grid-cols-2 gap-6 break-inside-avoid">
          <Section title="Weekly clash resolution"><BarChart width={520} height={210} data={r.weekly} margin={{ left: -18, right: 6 }}><CartesianGrid stroke="#e4e9f1" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#58677f' }} /><YAxis tick={{ fontSize: 10, fill: '#58677f' }} allowDecimals={false} /><Bar dataKey="newClashes" name="New" fill={C[1]} isAnimationActive={false} radius={[3, 3, 0, 0]} /><Bar dataKey="resolved" name="Resolved" fill={C[2]} isAnimationActive={false} radius={[3, 3, 0, 0]} /></BarChart><Leg items={[['New', C[1]], ['Resolved', C[2]]]} /></Section>
          <Section title="BIM performance trend"><LineChart width={520} height={210} data={r.weekly} margin={{ left: -12, right: 6 }}><CartesianGrid stroke="#e4e9f1" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#58677f' }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#58677f' }} /><Line dataKey="overall" stroke={C[0]} strokeWidth={2} dot={false} isAnimationActive={false} /><Line dataKey="resolutionRate" stroke={C[2]} strokeWidth={2} dot={false} isAnimationActive={false} /><Line dataKey="coordination" stroke={C[6]} strokeDasharray="5 3" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart><Leg items={[['Overall progress', C[0]], ['Resolution rate', C[2]], ['Model coordination', C[6]]]} /></Section>
        </div>}

        {type === 'weekly' && <Section title="Movement this period">
          <table className="w-full border-collapse text-xs"><thead><tr className="bg-[#0e1728] text-white"><th className="p-1.5 text-left">Metric</th><th className="p-1.5 text-right">Start</th><th className="p-1.5 text-right">End</th><th className="p-1.5 text-right">Change</th></tr></thead>
            <tbody>{[['Open clashes', r.pk.open, r.ck.open], ['Closed clashes', r.pk.closed, r.ck.closed], ['Critical (open)', r.pk.critical, r.ck.critical], ['Overdue clashes', r.pk.overdue, r.ck.overdue]].map(([l, a, b]) => <tr key={l as string} className="border-b border-slate-200"><td className="p-1.5">{l}</td><td className="p-1.5 text-right">{a}</td><td className="p-1.5 text-right font-semibold">{b}</td><td className="p-1.5 text-right">{(b as number) - (a as number) > 0 ? '+' : ''}{(b as number) - (a as number)}</td></tr>)}
              <tr className="border-b border-slate-200"><td className="p-1.5">New / resolved in period</td><td /><td className="p-1.5 text-right font-semibold">{r.ck.newInPeriod} / {r.ck.resolvedInPeriod}</td><td /></tr></tbody></table>
        </Section>}

        {type === 'monthly' && <>
          <div className="grid grid-cols-2 gap-6 break-inside-avoid">
            <Section title="Monthly clash flow"><BarChart width={520} height={210} data={r.monthly} margin={{ left: -18 }}><CartesianGrid stroke="#e4e9f1" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Bar dataKey="newClashes" fill={C[1]} isAnimationActive={false} /><Bar dataKey="resolved" fill={C[2]} isAnimationActive={false} /></BarChart><Leg items={[['New', C[1]], ['Resolved', C[2]]]} /></Section>
            <Section title="Monthly performance trend"><LineChart width={520} height={210} data={r.monthly} margin={{ left: -12 }}><CartesianGrid stroke="#e4e9f1" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} /><Line dataKey="overall" stroke={C[0]} strokeWidth={2} isAnimationActive={false} /><Line dataKey="resolutionRate" stroke={C[2]} strokeWidth={2} isAnimationActive={false} /></LineChart><Leg items={[['Overall progress', C[0]], ['Resolution rate', C[2]]]} /></Section>
          </div>
          <Section title={`Compliance & quality — ${r.compOverall.score === null ? 'not verified' : r.compOverall.score.toFixed(1) + '%'} (${r.compOverall.verified}/${r.compOverall.total} categories verified)`}>
            <div className="grid grid-cols-5 gap-2">{r.comp.map((c) => <div key={c.category} className="border border-slate-200 rounded p-2"><div className="text-[10px] font-semibold">{c.category}</div><div className="font-bold">{c.score === null ? <span className="text-slate-500 text-xs">NOT VERIFIED</span> : `${c.score.toFixed(0)}%`}</div><div className="text-[9px] text-slate-500">{c.checks} checks · {c.openObservations} open obs.</div></div>)}</div>
          </Section>
        </>}

        {type === 'matrix' && <>
          <Section title="Clash matrix summary"><div className="grid grid-cols-5 gap-2">{[['Total', r.matrices.total.grandTotal], ['Open', r.matrices.open.grandTotal], ['Critical (open)', r.matrices.critical.grandTotal], ['Overdue', r.matrices.overdue.grandTotal], ['Resolution rate', `${r.ck.resolutionRate.toFixed(1)}%`]].map(([l, v]) => <div key={l as string} className="border border-slate-200 rounded p-2 bg-slate-50"><div className="text-[10px] uppercase text-slate-500 font-semibold">{l}</div><div className="text-lg font-bold">{v}</div></div>)}</div></Section>
          <div className="grid grid-cols-2 gap-6"><PrintMatrix m={r.matrices.open} title="Open clashes" /><PrintMatrix m={r.matrices.critical} title="Critical open clashes" /></div>
          <div className="grid grid-cols-2 gap-6"><PrintMatrix m={r.matrices.overdue} title="Overdue clashes" /><PrintMatrix m={r.matrices.total} title="All clashes identified" /></div>
          <p className="text-[10px] text-slate-500">Lower triangle — each discipline pair counted once; diagonal = same-discipline clashes. Cell shade = worst severity present ({SEVERITIES.join(' / ')}), intensity = count.</p>
        </>}

        <div className="grid grid-cols-2 gap-6 break-inside-avoid">
          <Section title="Key observations"><ul className="list-disc ml-5 space-y-1">{lines(st.observations).map((o) => <li key={o}>{o}</li>)}</ul></Section>
          <Section title="Action items"><ol className="list-decimal ml-5 space-y-1">{lines(st.actions).map((o) => <li key={o}>{o}</li>)}</ol></Section>
        </div>

        <Section title={`Outstanding issues — critical, high and overdue clashes (${r.outstanding.length} shown of ${r.openCount} open)`}>
          <table className="w-full border-collapse text-[11px]"><thead><tr className="bg-[#0e1728] text-white">{['ID', 'Description', 'Pair', 'Location', 'Severity', 'Status', 'Responsible', 'Due', 'Days'].map((h) => <th key={h} className="p-1.5 text-left">{h}</th>)}</tr></thead>
            <tbody>{r.outstanding.map((o) => <tr key={o.id} className="border-b border-slate-200 break-inside-avoid"><td className="p-1.5 font-mono">{o.id}</td><td className="p-1.5">{o.description}</td><td className="p-1.5">{o.pair}</td><td className="p-1.5 whitespace-nowrap">{o.location}</td><td className="p-1.5"><span className="font-semibold" style={{ color: SEVERITY_COLOR[o.severity] }}>{o.severity}</span></td><td className="p-1.5">{o.status}</td><td className="p-1.5">{d.companyShort(o.responsible)}</td><td className={`p-1.5 whitespace-nowrap ${o.overdue ? 'text-red-600 font-semibold' : ''}`}>{fmtDate(o.due)}</td><td className="p-1.5 text-right">{o.days}</td></tr>)}</tbody></table>
        </Section>

        {type !== 'matrix' && r.risks.length > 0 && <Section title="Top open risks">
          <table className="w-full border-collapse text-[11px]"><thead><tr className="bg-[#0e1728] text-white">{['ID', 'Risk', 'Severity', 'Score', 'Owner', 'Mitigation', 'Target'].map((h) => <th key={h} className="p-1.5 text-left">{h}</th>)}</tr></thead>
            <tbody>{r.risks.map((k) => <tr key={k.id} className="border-b border-slate-200"><td className="p-1.5 font-mono">{k.id}</td><td className="p-1.5">{k.title}</td><td className="p-1.5 font-semibold" style={{ color: SEVERITY_COLOR[k.severity] }}>{k.severity}</td><td className="p-1.5">{k.score}</td><td className="p-1.5">{d.companyShort(k.owner)}</td><td className="p-1.5">{k.mitigation}</td><td className="p-1.5 whitespace-nowrap">{fmtDate(k.target)}</td></tr>)}</tbody></table>
        </Section>}
        <footer className="text-[10px] text-slate-500 border-t border-slate-200 pt-2">BIM Coordination Center · {title} · generated {new Date().toLocaleString('en-GB')} · all figures calculated from the project dataset at the reporting date.</footer>
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="break-inside-avoid"><h2 className="font-bold text-sm border-b border-slate-300 pb-1 mb-2">{title}</h2>{children}</section>;
const Leg = ({ items }: { items: [string, string][] }) => <div className="flex gap-4 text-[10px] text-slate-600 mt-1">{items.map(([l, c]) => <span key={l} className="inline-flex items-center gap-1"><span className="w-3 h-1.5 rounded" style={{ background: c }} />{l}</span>)}</div>;

function PrintMatrix({ m, title }: { m: ClashMatrix; title: string }) {
  const codes = DISCIPLINES.map((x) => x.code);
  const get = (a: string, b: string) => { const ia = codes.indexOf(a as never), ib = codes.indexOf(b as never); return m.cells.get(ia <= ib ? `${a}|${b}` : `${b}|${a}`); };
  return (
    <Section title={`${title} — ${m.grandTotal}`}>
      <table className="border-collapse text-[10px]"><thead><tr><th />{codes.map((c) => <th key={c} className="px-1 w-9">{c}</th>)}<th className="px-1">Inv.</th></tr></thead>
        <tbody>{codes.map((r, ri) => <tr key={r}><th className="text-left pr-1">{r}</th>{codes.map((c, ci) => {
          const x = ci <= ri ? get(r, c) : undefined;
          const op = x ? 0.25 + 0.65 * (x.count / Math.max(1, m.maxCount)) : 0;
          return <td key={c} className="border border-slate-200 text-center h-6 font-semibold" style={x ? { background: SEVERITY_COLOR[x.worst ?? 'Low'] + Math.round(op * 255).toString(16).padStart(2, '0') } : ci > ri ? { border: 'none' } : undefined}>{x?.count ?? ''}</td>;
        })}<td className="text-center font-semibold bg-slate-100">{m.disciplineTotals[r] ?? 0}</td></tr>)}</tbody></table>
    </Section>
  );
}
