import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, Cell, LabelList } from 'recharts';
import { Activity, AlertOctagon, Boxes, CheckCircle2, CircleDot, Clock, FileCheck2, FileUp, Flame, Gauge, Layers, Percent } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, Empty, ProgressBar, SeverityBadge, StatusBadge, InfoTip } from '../components/ui';
import { Kpi } from '../components/Kpi';
import { ChartBox, Legend, useChartTheme } from '../components/charts';
import {
  bimHealth, buildMatrix, clashKpis, deliverableKpis, disciplineContribution, isIssueOverdueAsOf, isOverdueAsOf, isOpenAsOf, modelKpis,
  modelStates, progressAsOf, severityDistribution, weeklySeries, daysOpen, PROGRESS_WEIGHTS,
} from '../lib/metrics';
import { SEVERITY_COLOR, GOOD } from '../lib/constants';
import { addDays, fmtDate } from '../lib/dates';
import { pct } from '../lib/format';

export default function Overview() {
  const { ds, filters, scope } = useStore();
  const d = useData();
  const nav = useNavigate();
  const t = useChartTheme();
  const asOf = scope.asOf;
  const prevAsOf = addDays(scope.periodStart, -1);

  const m = useMemo(() => {
    const ck = clashKpis(d.clashes, scope);
    const pk = clashKpis(d.clashes, { asOf: prevAsOf, periodStart: addDays(prevAsOf, -6) });
    const mk = modelKpis(d.modelStates);
    const pmk = modelKpis(modelStates(d.models, ds.submissions, prevAsOf));
    const dk = deliverableKpis(d.deliverables, asOf);
    const pdk = deliverableKpis(d.deliverables, prevAsOf);
    const overdueIssues = d.issues.filter((i) => isIssueOverdueAsOf(i, asOf)).length;
    const prevOverdueIssues = d.issues.filter((i) => isIssueOverdueAsOf(i, prevAsOf)).length;
    const prog = progressAsOf(ds, filters, asOf);
    const pprog = progressAsOf(ds, filters, prevAsOf);
    return {
      ck, pk, mk, pmk, dk, pdk, overdueIssues, prevOverdueIssues, prog, pprog,
      health: bimHealth(ds, filters, scope),
      weekly: weeklySeries(ds, filters, asOf, 12),
      sev: severityDistribution(d.clashes, scope),
      disc: disciplineContribution(d.clashes, scope).filter((x) => x.involved > 0).sort((a, b) => b.open - a.open),
      hotspots: [...buildMatrix(d.clashes, 'open', asOf).cells.values()].sort((a, b) => b.score - a.score).slice(0, 6),
      critical: d.clashes.filter((c) => isOpenAsOf(c, asOf) && (c.severity === 'Critical' || (c.severity === 'High' && isOverdueAsOf(c, asOf))))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8),
    };
  }, [d, ds, filters, scope, asOf, prevAsOf]);

  if (!d.clashes.length && !d.models.length && !d.deliverables.length)
    return <Card><Empty title="No data in scope" text="No records match the current project and filters. Adjust the filters or import data." action={<button className="btn-primary" onClick={() => nav('/import')}><FileUp size={14} /> Import data</button>} /></Card>;

  const { ck, pk, mk, pmk, dk, pdk } = m;
  const health = m.health;
  const healthColor = health.score === null ? '#8c9db8' : health.score >= 75 ? GOOD : health.score >= 55 ? '#fab219' : '#d03b3b';
  const go = (q: string) => nav(`/clashes?${q}`);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4">
        {/* Health indicator */}
        <section className="card p-4 flex flex-col">
          <div className="flex items-center gap-1.5 label"><Gauge size={13} />Overall project BIM health<InfoTip text="Weighted composite of clash resolution, overdue exposure, open critical clashes, deliverable on-time rate and verified compliance. Components without data are excluded from the weighting." /></div>
          <div className="flex items-center gap-4 mt-3">
            <HealthRing value={health.score} color={healthColor} />
            <div>
              <div className="text-xl font-semibold" style={{ color: healthColor }}>{health.rating}</div>
              <div className="text-xs text-muted mt-1">≥75 On Track · 55–75 Needs Attention · &lt;55 At Risk</div>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {health.components.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs"><span className="text-ink/90">{c.label} <span className="text-muted">({Math.round(c.weight * 100)}%)</span></span><span className="tabular-nums font-semibold">{pct(c.value)}</span></div>
                <ProgressBar value={c.value} color={c.value >= 75 ? GOOD : c.value >= 55 ? '#fab219' : '#d03b3b'} height={4} />
                <div className="text-[10px] text-muted mt-0.5">{c.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 content-start">
          <Kpi icon={<Boxes size={13} />} label="Total models" value={mk.received} sub={`${mk.total} registered · ${mk.federated} federated`} delta={mk.received - pmk.received} deltaGoodWhen="up" help="Models with at least one submission on or before the reporting date." onClick={() => nav('/models')} />
          <Kpi icon={<Layers size={13} />} label="Total clashes" value={ck.total} sub={`+${ck.newInPeriod} new this period`} delta={ck.total - pk.total} help="All clashes identified up to the reporting date (current filters)." onClick={() => go('state=all')} />
          <Kpi icon={<CircleDot size={13} />} label="Open clashes" value={ck.open} tone="accent" sub={`${ck.repeated} repeat detections`} delta={ck.open - pk.open} help="Not Resolved/Closed as of the reporting date." onClick={() => go('state=open')} />
          <Kpi icon={<CheckCircle2 size={13} />} label="Closed clashes" value={ck.closed} tone="ok" sub={`${ck.resolvedInPeriod} resolved this period`} delta={ck.closed - pk.closed} deltaGoodWhen="up" help="Resolved or Closed with a resolution date on/before the reporting date." onClick={() => go('state=closed')} />
          <Kpi icon={<Flame size={13} />} label="Critical clashes" value={ck.critical} tone={ck.critical ? 'crit' : 'ok'} sub={`open · ${ck.criticalTotal} identified in total`} delta={ck.critical - pk.critical} help="Open clashes with Critical severity." onClick={() => go('state=open&severity=Critical')} />
          <Kpi icon={<AlertOctagon size={13} />} label="High priority clashes" value={ck.high} tone={ck.high ? 'high' : 'ok'} sub="open · priority P1 + P2" delta={ck.high - pk.high} help="Open clashes with priority P1 or P2." onClick={() => go('state=open&priority=P1,P2')} />
          <Kpi icon={<Percent size={13} />} label="Clash resolution rate" value={pct(ck.resolutionRate, 1)} tone={ck.resolutionRate >= 75 ? 'ok' : ck.resolutionRate >= 55 ? 'med' : 'crit'} sub={`avg ${ck.avgDaysToResolve.toFixed(1)} days to resolve`} delta={+(ck.resolutionRate - pk.resolutionRate).toFixed(1)} deltaGoodWhen="up" help="Closed ÷ total clashes identified to date." />
          <Kpi icon={<Clock size={13} />} label="Overdue issues" value={ck.overdue + m.overdueIssues} tone={ck.overdue + m.overdueIssues ? 'crit' : 'ok'} sub={`${ck.overdue} clashes · ${m.overdueIssues} coordination issues`} delta={ck.overdue + m.overdueIssues - pk.overdue - m.prevOverdueIssues} help="Open clashes and open coordination issues past their due date." onClick={() => go('state=overdue')} />
          <Kpi icon={<FileUp size={13} />} label="Deliverables submitted" value={`${dk.submitted}/${dk.due}`} sub={`${pct(dk.submissionRate)} of due · ${dk.overdue} overdue`} delta={dk.submitted - pdk.submitted} deltaGoodWhen="up" help="Deliverables submitted on/before the reporting date vs. those planned to be due by then." onClick={() => nav('/deliverables')} />
          <Kpi icon={<FileCheck2 size={13} />} label="Deliverables approved" value={dk.approved} tone="ok" sub={`of ${dk.total} in MIDP · ${dk.rejected} rejected`} delta={dk.approved - pdk.approved} deltaGoodWhen="up" help="Approved or Approved with Comments, review date on/before the reporting date." onClick={() => nav('/deliverables')} />
          <Kpi icon={<Activity size={13} />} label="Overall BIM progress" value={pct(m.prog.overall, 1)} tone="accent" sub="composite — see Progress" delta={+(m.prog.overall - m.pprog.overall).toFixed(1)} deltaGoodWhen="up" help={`Weighted: model development ${PROGRESS_WEIGHTS.model * 100}%, model coordination ${PROGRESS_WEIGHTS.coordination * 100}%, clash resolution ${PROGRESS_WEIGHTS.clash * 100}%, deliverables approved ${PROGRESS_WEIGHTS.deliverables * 100}%.`} onClick={() => nav('/progress')}
            spark={<ProgressBar value={m.prog.overall} height={4} />} />
          <Kpi icon={<Boxes size={13} />} label="Model coordination progress" value={pct(mk.coordinationProgress, 1)} sub={`${mk.approved} of ${mk.total} models approved`} delta={+(mk.coordinationProgress - pmk.coordinationProgress).toFixed(1)} deltaGoodWhen="up" help="Models whose latest submission is Approved ÷ all registered models." onClick={() => nav('/models')}
            spark={<ProgressBar value={mk.coordinationProgress} height={4} color="rgb(var(--accent2))" />} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="BIM performance trend" subtitle="Last 12 weeks · % values computed as at each week end" actions={<Legend items={[{ label: 'Overall progress', color: t.series[0] }, { label: 'Clash resolution rate', color: t.series[2] }, { label: 'Model coordination', color: t.series[6], dashed: true }]} />}>
          <ChartBox height={250}>
            <LineChart data={m.weekly} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip {...t.tooltip} formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="overall" name="Overall progress" stroke={t.series[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="resolutionRate" name="Clash resolution rate" stroke={t.series[2]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="coordination" name="Model coordination" stroke={t.series[6]} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartBox>
        </Card>
        <Card title="Weekly clash resolution" subtitle="New clashes identified vs. clashes resolved per week" actions={<Legend items={[{ label: 'New', color: t.series[1] }, { label: 'Resolved', color: t.series[2] }]} />}>
          <ChartBox height={250}>
            <BarChart data={m.weekly} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...t.tooltip} />
              <Bar dataKey="newClashes" name="New" fill={t.series[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="resolved" name="Resolved" fill={t.series[2]} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ChartBox>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        <Card title="Open vs closed clashes" subtitle="Cumulative position at each week end" actions={<Legend items={[{ label: 'Closed', color: t.series[2] }, { label: 'Open', color: t.series[0] }]} />}>
          <ChartBox height={240}>
            <AreaChart data={m.weekly} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={t.tick} axisLine={false} tickLine={false} />
              <YAxis tick={t.tick} axisLine={false} tickLine={false} />
              <Tooltip {...t.tooltip} />
              <Area type="monotone" dataKey="closed" name="Closed" stackId="1" stroke={t.series[2]} strokeWidth={2} fill={t.series[2]} fillOpacity={0.25} />
              <Area type="monotone" dataKey="open" name="Open" stackId="1" stroke={t.series[0]} strokeWidth={2} fill={t.series[0]} fillOpacity={0.3} />
            </AreaChart>
          </ChartBox>
        </Card>
        <Card title="Clash severity distribution" subtitle={`Open clashes by severity · ${ck.open} total`}>
          <div className="space-y-3 pt-2">
            {m.sev.map((s) => (
              <button key={s.name} className="w-full text-left group" onClick={() => go(`state=open&severity=${s.name}`)}>
                <div className="flex items-center justify-between text-xs mb-1"><SeverityBadge s={s.name as never} /><span className="tabular-nums font-semibold">{s.value} <span className="text-muted font-normal">· {pct(ck.open ? (s.value / ck.open) * 100 : 0)}</span></span></div>
                <div className="h-3 rounded-full bg-surface2 overflow-hidden"><div className="h-full rounded-full group-hover:brightness-110" style={{ width: `${ck.open ? (s.value / Math.max(...m.sev.map((x) => x.value), 1)) * 100 : 0}%`, background: SEVERITY_COLOR[s.name as keyof typeof SEVERITY_COLOR] }} /></div>
              </button>
            ))}
            <div className="text-[11px] text-muted pt-1">Click a severity to open the filtered clash register.</div>
          </div>
        </Card>
        <Card title="Discipline contribution" subtitle="Open clashes involving each discipline (a clash counts for both disciplines)">
          {m.disc.length ? (
            <ChartBox height={Math.max(220, m.disc.length * 24)}>
              <BarChart data={m.disc} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={t.grid} horizontal={false} />
                <XAxis type="number" tick={t.tick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="code" tick={t.tick} axisLine={false} tickLine={false} width={44} interval={0} />
                <Tooltip {...t.tooltip} formatter={(v: number, n: string) => [v, n]} labelFormatter={(l) => m.disc.find((x) => x.code === l)?.name ?? l} />
                <Bar dataKey="open" name="Open clashes" fill={t.series[0]} radius={[0, 4, 4, 0]} maxBarSize={14} onClick={(x: { code?: string }) => x.code && go(`state=open&discipline=${x.code}`)} cursor="pointer">
                  <LabelList dataKey="open" position="right" fill={t.axis} fontSize={11} />
                  {m.disc.map((x) => <Cell key={x.code} fill={t.series[0]} />)}
                </Bar>
              </BarChart>
            </ChartBox>
          ) : <Empty />}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-4">
        <Card title="Coordination hotspots" subtitle="Discipline pairs with the highest severity-weighted open clashes" actions={<button className="btn-ghost text-xs" onClick={() => nav('/matrix')}>Open clash matrix</button>}>
          {m.hotspots.length ? (
            <table className="tbl w-full">
              <thead><tr><th>Pair</th><th className="!text-right">Open</th><th>Severity mix</th><th className="!text-right">Score</th></tr></thead>
              <tbody>{m.hotspots.map((h) => (
                <tr key={h.key} className="cursor-pointer" onClick={() => go(`state=open&pair=${h.a}|${h.b}`)}>
                  <td className="font-semibold">{h.a} <span className="text-muted">vs</span> {h.b}</td>
                  <td className="text-right tabular-nums">{h.count}</td>
                  <td><div className="flex h-2.5 w-40 rounded overflow-hidden gap-[2px]">{(['Critical', 'High', 'Medium', 'Low'] as const).map((s) => h.bySeverity[s] ? <div key={s} title={`${s}: ${h.bySeverity[s]}`} style={{ flex: h.bySeverity[s], background: SEVERITY_COLOR[s] }} /> : null)}</div></td>
                  <td className="text-right tabular-nums">{h.score}</td>
                </tr>))}
              </tbody>
            </table>
          ) : <Empty title="No open clashes" />}
          <div className="text-[11px] text-muted mt-2">Score = Σ severity weights (Critical 8 · High 4 · Medium 2 · Low 1).</div>
        </Card>
        <Card title="Critical & overdue clashes requiring action" subtitle={`As at ${fmtDate(asOf)} · open Critical, and overdue High severity · sorted by due date`} actions={<button className="btn-ghost text-xs" onClick={() => go('state=overdue')}>View all overdue</button>}>
          {m.critical.length ? (
            <div className="overflow-auto">
              <table className="tbl w-full">
                <thead><tr><th>ID</th><th>Description</th><th>Pair</th><th>Location</th><th>Severity</th><th>Status</th><th>Responsible</th><th>Due</th><th className="!text-right">Days open</th></tr></thead>
                <tbody>{m.critical.map((c) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => go(`id=${c.id}`)}>
                    <td className="font-mono text-xs whitespace-nowrap">{c.id}</td>
                    <td className="max-w-[260px] truncate" title={c.description}>{c.description}</td>
                    <td className="whitespace-nowrap">{c.disciplineA}/{c.disciplineB}</td>
                    <td className="whitespace-nowrap">{c.building} · {c.level}</td>
                    <td><SeverityBadge s={c.severity} /></td>
                    <td><StatusBadge s={c.status} /></td>
                    <td className="whitespace-nowrap">{d.companyShort(c.responsibleCompanyId)}</td>
                    <td className={c.dueDate < asOf ? 'text-crit whitespace-nowrap font-semibold' : 'whitespace-nowrap'}>{fmtDate(c.dueDate)}</td>
                    <td className="text-right tabular-nums">{daysOpen(c, asOf)}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          ) : <Empty title="Nothing critical or overdue" text="No Critical/High clashes are open past due." />}
        </Card>
      </div>
    </div>
  );
}

function HealthRing({ value, color }: { value: number | null; color: string }) {
  const r = 42, c = 2 * Math.PI * r, v = value ?? 0;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" role="img" aria-label={`Health score ${value === null ? 'not available' : Math.round(v)}`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="rgb(var(--surface2))" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 55 55)" />
      <text x="55" y="51" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="700" fill="rgb(var(--ink))">{value === null ? '—' : Math.round(v)}</text>
      <text x="55" y="72" textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">of 100</text>
    </svg>
  );
}
