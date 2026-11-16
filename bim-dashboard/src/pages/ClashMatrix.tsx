import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Download, Info } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, DataTable, Drawer, Empty, SeverityBadge, StatusBadge, Tabs, type Column } from '../components/ui';
import { ClashEditor } from '../components/ClashEditor';
import { buildMatrix, daysOpen, MATRIX_VIEWS, matrixPredicate, statusAsOf, type MatrixCell, type MatrixView } from '../lib/metrics';
import { DISCIPLINES, SEVERITIES, SEVERITY_COLOR, SEQ_BLUE, CLASH_TYPES } from '../lib/constants';
import { fmtDate } from '../lib/dates';
import { cls } from '../lib/format';
import { clashRows, downloadCSV, downloadXlsx, stamp } from '../lib/export';
import type { Clash, ClashType, DisciplineCode } from '../types';
import { useNavigate } from 'react-router-dom';

type ColorMode = 'severity' | 'intensity';

export default function ClashMatrix() {
  const { scope, period, ds } = useStore();
  const d = useData();
  const nav = useNavigate();
  const [view, setView] = useState<MatrixView>('open');
  const [types, setTypes] = useState<ClashType[]>([]);
  const [mode, setMode] = useState<ColorMode>('severity');
  const [mirror, setMirror] = useState(false);
  const [sel, setSel] = useState<{ a: DisciplineCode; b: DisciplineCode } | { disc: DisciplineCode } | null>(null);
  const [edit, setEdit] = useState<Clash | null>(null);
  const asOf = scope.asOf;

  const matrix = useMemo(() => buildMatrix(d.clashes, view, asOf, types), [d.clashes, view, asOf, types]);
  const allViews = useMemo(() => Object.fromEntries(MATRIX_VIEWS.map((v) => [v.id, buildMatrix(d.clashes, v.id, asOf, types).grandTotal])), [d.clashes, asOf, types]);
  const discs = DISCIPLINES;
  const cell = (a: DisciplineCode, b: DisciplineCode): MatrixCell | undefined => {
    const [x, y] = DISCIPLINES.find((q) => q.code === a)!.order <= DISCIPLINES.find((q) => q.code === b)!.order ? [a, b] : [b, a];
    return matrix.cells.get(`${x}|${y}`);
  };
  const typeCounts = useMemo(() => {
    const out: Record<string, number> = { Hard: 0, Soft: 0, Clearance: 0 };
    for (const c of matrix.cells.values()) for (const t of CLASH_TYPES) out[t] += c.byType[t];
    return out;
  }, [matrix]);

  const selected = useMemo(() => {
    if (!sel) return [];
    const pred = matrixPredicate(view, asOf);
    return d.clashes.filter((c) => pred(c) && (!types.length || types.includes(c.type)) &&
      ('disc' in sel ? c.disciplineA === sel.disc || c.disciplineB === sel.disc : (c.disciplineA === sel.a && c.disciplineB === sel.b) || (c.disciplineA === sel.b && c.disciplineB === sel.a)));
  }, [sel, d.clashes, view, asOf, types]);

  const bg = (c?: MatrixCell) => {
    if (!c || !c.count) return undefined;
    const r = c.count / Math.max(1, matrix.maxCount);
    if (mode === 'intensity') return SEQ_BLUE[Math.min(SEQ_BLUE.length - 1, 2 + Math.round(r * (SEQ_BLUE.length - 3)))];
    const col = SEVERITY_COLOR[c.worst ?? 'Low'];
    const alpha = Math.round((0.32 + 0.6 * r) * 255).toString(16).padStart(2, '0');
    return col + alpha;
  };
  const fg = (c?: MatrixCell) => (mode === 'intensity' && c && c.count / Math.max(1, matrix.maxCount) > 0.35 ? '#ffffff' : undefined);

  const viewMeta = MATRIX_VIEWS.find((v) => v.id === view)!;
  const exportRows = () => {
    const rows = discs.map((r) => {
      const row: Record<string, string | number> = { Discipline: `${r.code} — ${r.name}` };
      for (const c of discs) {
        const lower = r.order >= c.order;
        row[c.code] = lower || mirror ? cell(r.code, c.code)?.count ?? 0 : '';
      }
      row['Involvement total'] = matrix.disciplineTotals[r.code] ?? 0;
      return row;
    });
    return rows;
  };
  const pairsRows = () => [...matrix.cells.values()].sort((a, b) => b.count - a.count).map((c) => ({
    'Discipline A': c.a, 'Discipline B': c.b, Count: c.count, Critical: c.bySeverity.Critical, High: c.bySeverity.High, Medium: c.bySeverity.Medium, Low: c.bySeverity.Low,
    Hard: c.byType.Hard, Soft: c.byType.Soft, Clearance: c.byType.Clearance, 'Severity score': c.score,
  }));
  const meta = { Project: d.project.name, View: `${viewMeta.label} — ${viewMeta.help}`, 'Clash types': types.length ? types.join(', ') : 'All', 'Reporting date': asOf, Period: period?.label ?? '', 'Unique clashes': String(matrix.grandTotal), 'Data': ds.isDemo ? 'DEMO DATA — not actual project performance' : 'Project data' };

  const columns: Column<Clash>[] = [
    { key: 'id', header: 'Clash ID', render: (c) => <span className="font-mono text-xs">{c.id}</span> },
    { key: 'description', header: 'Description', render: (c) => <span className="block max-w-[320px] truncate" title={c.description}>{c.description}</span> },
    { key: 'type', header: 'Type' },
    { key: 'pair', header: 'Disciplines', value: (c) => `${c.disciplineA}/${c.disciplineB}` },
    { key: 'loc', header: 'Location', value: (c) => `${c.building} · ${c.zone} · ${c.level}`, render: (c) => <span className="whitespace-nowrap">{c.building} · {c.zone} · {c.level}<span className="text-muted"> · {c.gridRef}</span></span> },
    { key: 'severity', header: 'Severity', value: (c) => SEVERITIES.indexOf(c.severity), render: (c) => <SeverityBadge s={c.severity} /> },
    { key: 'status', header: 'Status', value: (c) => statusAsOf(c, asOf), render: (c) => <StatusBadge s={statusAsOf(c, asOf)} /> },
    { key: 'assignedDiscipline', header: 'Assigned disc.' },
    { key: 'resp', header: 'Responsible party', value: (c) => d.companyShort(c.responsibleCompanyId), render: (c) => <span title={d.userName(c.assignedTo)}>{d.companyShort(c.responsibleCompanyId)}</span> },
    { key: 'dueDate', header: 'Due date', render: (c) => <span className={cls('whitespace-nowrap', c.dueDate < asOf && statusAsOf(c, asOf) !== 'Closed' && statusAsOf(c, asOf) !== 'Resolved' && 'text-crit font-semibold')}>{fmtDate(c.dueDate)}</span> },
    { key: 'days', header: 'Days open', align: 'right', value: (c) => daysOpen(c, asOf) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onChange={setView} tabs={MATRIX_VIEWS.map((v) => ({ id: v.id, label: <span>{v.label} <span className="opacity-70 tabular-nums">({allViews[v.id]})</span></span> }))} />
        <div className="inline-flex items-center gap-1 text-xs">
          <span className="text-muted mr-1">Clash type</span>
          {CLASH_TYPES.map((t) => {
            const on = types.includes(t);
            return <button key={t} onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])} className={cls('chip border px-2 py-1', on ? 'border-accent text-ink bg-accent/20' : 'border-line text-muted hover:text-ink')} aria-pressed={on}>{t}</button>;
          })}
          {types.length > 0 && <button className="text-accent ml-1" onClick={() => setTypes([])}>All</button>}
        </div>
        <Tabs value={mode} onChange={setMode} tabs={[{ id: 'severity', label: 'Colour: worst severity' }, { id: 'intensity', label: 'Colour: count intensity' }]} />
        <label className="inline-flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror (full grid)</label>
        <div className="flex-1" />
        <button className="btn-ghost" onClick={() => downloadCSV(exportRows(), `clash-matrix-${view}-${stamp()}.csv`)}><Download size={14} /> CSV</button>
        <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Matrix', rows: exportRows() }, { name: 'Pairs', rows: pairsRows() }, { name: 'Clashes', rows: clashRows(d.clashes.filter((c) => matrixPredicate(view, asOf)(c) && (!types.length || types.includes(c.type))), asOf, d) }], `clash-matrix-${view}-${stamp()}.xlsx`, meta)}><FileSpreadsheet size={14} /> Excel</button>
        <button className="btn-ghost" onClick={() => nav('/reports?type=matrix')}><FileText size={14} /> Matrix report (PDF)</button>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1fr_340px] gap-4">
        <Card title={`Discipline clash matrix — ${viewMeta.label}`} subtitle={<>{viewMeta.help} · as at {fmtDate(asOf)} · <b className="text-ink">{matrix.grandTotal}</b> unique clashes{types.length ? ` · ${types.join(' + ')} only` : ''}. Click any cell to open the clash list.</>}>
          {matrix.grandTotal === 0 && <div className="text-sm text-muted mb-2">No clashes for this view and filter combination.</div>}
          <div className="overflow-auto">
            <table className="border-separate w-full min-w-[820px]" style={{ borderSpacing: 3 }} role="grid" aria-label="Discipline clash matrix">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-surface z-10" />
                  {discs.map((c) => <th key={c.code} className="text-[11px] font-semibold text-muted px-1 pb-1 w-[64px] min-w-[56px]" title={c.name}>
                    <div className="flex flex-col items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: c.color }} />{c.code}</div></th>)}
                  <th className="text-[10px] uppercase tracking-wider text-muted px-2 pb-1 w-[78px]" title="Clashes involving this discipline (a clash counts once for each of its two disciplines)">Involved</th>
                </tr>
              </thead>
              <tbody>
                {discs.map((r) => (
                  <tr key={r.code}>
                    <th scope="row" className="sticky left-0 bg-surface z-10 text-left pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm"><span className="w-2 h-2 rounded-full" style={{ background: r.color }} /><span className="font-semibold w-10">{r.code}</span><span className="text-muted text-xs hidden md:inline">{r.name}</span></div>
                    </th>
                    {discs.map((c) => {
                      const show = mirror || c.order <= r.order;
                      if (!show) return <td key={c.code} />;
                      const x = cell(r.code, c.code);
                      const diag = r.code === c.code;
                      return (
                        <td key={c.code} className="p-0">
                          <button
                            onClick={() => x?.count && setSel({ a: r.code, b: c.code })}
                            disabled={!x?.count}
                            className={cls('group relative w-full h-[60px] min-w-[56px] rounded-md border text-center transition-all',
                              x?.count ? 'border-transparent hover:ring-2 hover:ring-accent2 hover:z-10 cursor-pointer' : 'border-line/50 bg-surface2/40 cursor-default',
                              diag && 'outline outline-1 outline-dashed outline-line')}
                            style={{ background: bg(x), color: fg(x) }}
                            aria-label={`${r.code} vs ${c.code}: ${x?.count ?? 0} clashes`}
                          >
                            <span className="text-[17px] font-semibold tabular-nums">{x?.count ? x.count : <span className="text-muted/50 text-xs">·</span>}</span>
                            {x?.count ? (
                              <span className="absolute left-1.5 right-1.5 bottom-1.5 flex h-[3px] gap-[1px] rounded overflow-hidden opacity-90">
                                {SEVERITIES.map((s) => x.bySeverity[s] ? <span key={s} style={{ flex: x.bySeverity[s], background: mode === 'intensity' ? SEVERITY_COLOR[s] : 'rgb(var(--ink) / .55)' }} /> : null)}
                              </span>
                            ) : null}
                            {x?.count ? (
                              <span role="tooltip" className="pointer-events-none absolute z-30 left-1/2 -translate-x-1/2 top-[64px] w-52 rounded-lg border border-line bg-surface p-2.5 text-left text-[11px] text-ink shadow-2xl opacity-0 group-hover:opacity-100">
                                <b className="text-xs">{x.a} vs {x.b}</b> · {x.count} clashes
                                <span className="block mt-1.5 space-y-0.5">{SEVERITIES.map((s) => <span key={s} className="flex justify-between"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: SEVERITY_COLOR[s] }} />{s}</span><b>{x.bySeverity[s]}</b></span>)}</span>
                                <span className="block mt-1.5 pt-1.5 border-t border-line text-muted">Hard {x.byType.Hard} · Soft {x.byType.Soft} · Clearance {x.byType.Clearance}</span>
                              </span>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                    <td className="p-0">
                      <button className="w-full h-[60px] rounded-md bg-surface2 hover:ring-2 hover:ring-accent text-sm font-semibold tabular-nums disabled:opacity-50" disabled={!matrix.disciplineTotals[r.code]} onClick={() => setSel({ disc: r.code })} aria-label={`All ${r.code} clashes`}>
                        {matrix.disciplineTotals[r.code] ?? 0}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
            {mode === 'severity' ? (
              <span className="inline-flex items-center gap-3">Cell colour = worst severity present, opacity = count:{SEVERITIES.map((s) => <span key={s} className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: SEVERITY_COLOR[s] }} />{s}</span>)}</span>
            ) : (
              <span className="inline-flex items-center gap-2">Fewer<span className="inline-flex">{SEQ_BLUE.slice(2).map((c) => <span key={c} className="w-4 h-3" style={{ background: c }} />)}</span>More (max {matrix.maxCount})</span>
            )}
            <span className="inline-flex items-center gap-1"><Info size={12} /> Each discipline pair is counted once (lower triangle; diagonal = same-discipline clashes). “Involved” counts a clash for both of its disciplines, so its column sums to more than the unique total.</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Matrix summary" subtitle={`${viewMeta.label} view`}>
            <div className="grid grid-cols-3 gap-2 text-center">
              {CLASH_TYPES.map((t) => <div key={t} className="rounded-lg bg-surface2 p-2"><div className="text-lg font-semibold tabular-nums">{typeCounts[t]}</div><div className="text-[11px] text-muted">{t}</div></div>)}
            </div>
            <div className="mt-4 label">Top discipline pairs</div>
            <div className="mt-2 space-y-1.5">
              {[...matrix.cells.values()].sort((a, b) => b.score - a.score).slice(0, 8).map((c) => (
                <button key={c.key} className="w-full flex items-center gap-2 text-sm hover:bg-surface2 rounded px-1 py-0.5" onClick={() => setSel({ a: c.a, b: c.b })}>
                  <span className="w-24 text-left font-semibold">{c.a} / {c.b}</span>
                  <span className="flex-1 flex h-2 rounded overflow-hidden gap-[1px]">{SEVERITIES.map((s) => c.bySeverity[s] ? <span key={s} style={{ flex: c.bySeverity[s], background: SEVERITY_COLOR[s] }} /> : null)}</span>
                  <span className="w-8 text-right tabular-nums">{c.count}</span>
                </button>
              ))}
              {!matrix.cells.size && <Empty title="No clashes in this view" />}
            </div>
          </Card>
          <Card title="View definitions">
            <dl className="space-y-2 text-xs">
              {MATRIX_VIEWS.map((v) => <div key={v.id}><dt className="font-semibold">{v.label} <span className="text-muted tabular-nums">({allViews[v.id]})</span></dt><dd className="text-muted">{v.help}</dd></div>)}
              <div><dt className="font-semibold">Clash types</dt><dd className="text-muted">Hard = physical intersection · Soft = encroachment into access/maintenance or insulation zone · Clearance = minimum distance not met.</dd></div>
            </dl>
          </Card>
        </div>
      </div>

      <Drawer open={!!sel} onClose={() => setSel(null)}
        title={sel ? ('disc' in sel ? `All ${viewMeta.label.toLowerCase()} clashes involving ${sel.disc}` : `${sel.a} vs ${sel.b} — ${viewMeta.label} clashes`) : ''}
        subtitle={<>As at {fmtDate(asOf)} · {selected.length} clashes · global filters applied{types.length ? ` · types: ${types.join(', ')}` : ''} · click a row to view or edit</>}
        actions={<>
          <button className="btn-ghost" onClick={() => downloadCSV(clashRows(selected, asOf, d), `clashes-${sel && ('disc' in sel ? sel.disc : `${sel.a}-${sel.b}`)}-${view}-${stamp()}.csv`)}><Download size={14} /> CSV</button>
          <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Clashes', rows: clashRows(selected, asOf, d) }], `clashes-${sel && ('disc' in sel ? sel.disc : `${sel.a}-${sel.b}`)}-${view}-${stamp()}.xlsx`, meta)}><FileSpreadsheet size={14} /> Excel</button>
        </>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {SEVERITIES.map((s) => <div key={s} className="card p-2.5"><SeverityBadge s={s} /><div className="text-xl font-semibold tabular-nums mt-1">{selected.filter((c) => c.severity === s).length}</div></div>)}
        </div>
        <DataTable rows={selected} columns={columns} rowKey={(c) => c.id} onRowClick={setEdit} initialSort={{ key: 'severity', dir: 'asc' }} pageSize={15} />
      </Drawer>
      <ClashEditor open={!!edit} clash={edit} onClose={() => setEdit(null)} />
    </div>
  );
}
