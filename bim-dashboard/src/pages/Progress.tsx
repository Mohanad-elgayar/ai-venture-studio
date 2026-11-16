import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, ProgressBar, Tabs } from '../components/ui';
import { ChartBox, Legend, useChartTheme } from '../components/charts';
import { disciplineContribution, isApprovedAsOf, monthlySeries, progressAsOf, PROGRESS_WEIGHTS, weeklySeries } from '../lib/metrics';
import { DISCIPLINES } from '../lib/constants';
import { addDays, fmtDate } from '../lib/dates';
import { pct, ratio } from '../lib/format';
import { cls } from '../lib/format';

const COMPONENTS = [
  { key: 'model', label: 'Model development', help: 'Average author-reported development % of latest submissions' },
  { key: 'coordination', label: 'Model coordination', help: 'Models approved ÷ models registered' },
  { key: 'clash', label: 'Clash resolution', help: 'Clashes closed ÷ clashes identified' },
  { key: 'deliverables', label: 'Deliverables', help: 'Deliverables approved ÷ deliverables in MIDP' },
] as const;

export default function Progress() {
  const { ds, filters, scope } = useStore();
  const d = useData();
  const t = useChartTheme();
  const [gran, setGran] = useState<'weekly' | 'monthly'>('weekly');
  const asOf = scope.asOf;
  const prevAsOf = addDays(scope.periodStart, -1);
  const now = progressAsOf(ds, filters, asOf);
  const prev = progressAsOf(ds, filters, prevAsOf);
  const weekly = useMemo(() => weeklySeries(ds, filters, asOf, 16), [ds, filters, asOf]);
  const monthly = useMemo(() => monthlySeries(ds, filters, asOf, 6), [ds, filters, asOf]);

  const perDisc = useMemo(() => {
    const contrib = disciplineContribution(d.clashes, scope);
    return DISCIPLINES.map((x) => {
      const st = d.modelStates.filter((s) => s.model.discipline === x.code);
      const dl = d.deliverables.filter((q) => q.discipline === x.code);
      const c = contrib.find((q) => q.code === x.code)!;
      return {
        code: x.code, name: x.name,
        model: st.length ? +(st.reduce((a, s) => a + s.progress, 0) / st.length).toFixed(1) : null,
        coordination: st.length ? +ratio(st.filter((s) => s.status === 'Approved').length, st.length).toFixed(1) : null,
        clash: c.involved ? +c.resolutionRate.toFixed(1) : null,
        deliverables: dl.length ? +ratio(dl.filter((q) => isApprovedAsOf(q, asOf)).length, dl.length).toFixed(1) : null,
      };
    }).filter((r) => r.model !== null || r.clash !== null || r.deliverables !== null);
  }, [d, scope, asOf]);

  const series = gran === 'weekly' ? weekly : monthly;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="card p-4 xl:col-span-1">
          <div className="label">Overall BIM progress</div>
          <div className="text-4xl font-semibold text-accent mt-1 tabular-nums">{pct(now.overall, 1)}</div>
          <Delta v={now.overall - prev.overall} />
          <ProgressBar value={now.overall} height={8} />
          <div className="text-[11px] text-muted mt-2">Weighted: {COMPONENTS.map((c) => `${c.label} ${PROGRESS_WEIGHTS[c.key] * 100}%`).join(' · ')}</div>
        </div>
        {COMPONENTS.map((c, i) => (
          <div key={c.key} className="card p-4" title={c.help}>
            <div className="label">{c.label}</div>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{pct(now[c.key], 1)}</div>
            <Delta v={now[c.key] - prev[c.key]} />
            <ProgressBar value={now[c.key]} color={t.series[[0, 6, 2, 3][i]]} />
            <div className="text-[11px] text-muted mt-2">{c.help}</div>
          </div>
        ))}
      </div>

      <Card title="Progress trend" subtitle={`Each point is recomputed as at the end of the ${gran === 'weekly' ? 'week' : 'month'} from the underlying records`}
        actions={<><Legend items={[{ label: 'Overall', color: t.series[0] }, { label: 'Model dev.', color: t.series[6], dashed: true }, { label: 'Clash resolution', color: t.series[2] }, { label: 'Coordination', color: t.series[4], dashed: true }, { label: 'Deliverables', color: t.series[3] }]} /><Tabs value={gran} onChange={setGran} tabs={[{ id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }]} /></>}>
        <ChartBox height={300}>
          <LineChart data={series} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" tick={t.tick} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} unit="%" tick={t.tick} axisLine={false} tickLine={false} />
            <Tooltip {...t.tooltip} formatter={(v: number) => `${v}%`} />
            <Line dataKey="overall" name="Overall" stroke={t.series[0]} strokeWidth={2.5} dot={gran === 'monthly'} />
            {gran === 'weekly' && <Line dataKey="model" name="Model development" stroke={t.series[6]} strokeDasharray="5 3" strokeWidth={2} dot={false} />}
            <Line dataKey="resolutionRate" name="Clash resolution" stroke={t.series[2]} strokeWidth={2} dot={gran === 'monthly'} />
            {gran === 'weekly' && <Line dataKey="coordination" name="Model coordination" stroke={t.series[4]} strokeDasharray="5 3" strokeWidth={2} dot={false} />}
            {gran === 'weekly' && <Line dataKey="deliverables" name="Deliverables" stroke={t.series[3]} strokeWidth={2} dot={false} />}
          </LineChart>
        </ChartBox>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
        <Card title="Progress per discipline" subtitle="Comparison of the four progress components by discipline" actions={<Legend items={COMPONENTS.map((c, i) => ({ label: c.label, color: t.series[[0, 6, 2, 3][i]] }))} />}>
          <ChartBox height={300}>
            <BarChart data={perDisc} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={1}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="code" tick={t.tick} axisLine={false} tickLine={false} interval={0} />
              <YAxis domain={[0, 100]} unit="%" tick={t.tick} axisLine={false} tickLine={false} />
              <Tooltip {...t.tooltip} formatter={(v: number) => (v === null ? 'n/a' : `${v}%`)} labelFormatter={(l) => DISCIPLINES.find((x) => x.code === l)?.name ?? l} />
              {COMPONENTS.map((c, i) => <Bar key={c.key} dataKey={c.key} name={c.label} fill={t.series[[0, 6, 2, 3][i]]} radius={[3, 3, 0, 0]} maxBarSize={10} />)}
            </BarChart>
          </ChartBox>
        </Card>
        <Card title="Monthly performance" subtitle="Calendar months to the reporting date">
          <table className="tbl w-full">
            <thead><tr><th>Month</th><th className="!text-right">New clashes</th><th className="!text-right">Resolved</th><th className="!text-right">Open at end</th><th className="!text-right">Resolution</th><th className="!text-right">Deliv. submitted</th><th className="!text-right">Overall</th></tr></thead>
            <tbody>{monthly.map((m, i) => (
              <tr key={m.label}><td className="font-semibold whitespace-nowrap">{m.label}</td>
                <td className="text-right tabular-nums">{m.newClashes}</td><td className="text-right tabular-nums">{m.resolved}</td>
                <td className="text-right tabular-nums">{m.open}</td><td className="text-right tabular-nums">{m.resolutionRate}%</td>
                <td className="text-right tabular-nums">{m.deliverablesSubmitted}</td>
                <td className="text-right tabular-nums">{m.overall}%{i > 0 && <span className={cls('ml-1 text-[10px]', m.overall >= monthly[i - 1].overall ? 'text-ok' : 'text-crit')}>{m.overall >= monthly[i - 1].overall ? '▲' : '▼'}</span>}</td>
              </tr>))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Discipline progress detail" subtitle={`As at ${fmtDate(asOf)} · n/a = no records for this discipline`}>
        <div className="overflow-auto">
          <table className="tbl w-full">
            <thead><tr><th>Discipline</th>{COMPONENTS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>{perDisc.map((r) => (
              <tr key={r.code}><td className="font-semibold whitespace-nowrap">{r.code} <span className="text-muted font-normal">{r.name}</span></td>
                {COMPONENTS.map((c, i) => { const v = r[c.key]; return <td key={c.key}>{v === null ? <span className="text-muted">n/a</span> : <div className="flex items-center gap-2 min-w-[140px]"><ProgressBar value={v} color={t.series[[0, 6, 2, 3][i]]} /><span className="tabular-nums text-xs w-12 text-right">{v}%</span></div>}</td>; })}
              </tr>))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Delta({ v }: { v: number }) {
  return <div className={cls('text-[11px] mb-2 font-semibold', v > 0.05 ? 'text-ok' : v < -0.05 ? 'text-crit' : 'text-muted')}>{v > 0.05 ? '▲' : v < -0.05 ? '▼' : '■'} {Math.abs(v) < 0.05 ? '0.0' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`} pts vs previous period</div>;
}
