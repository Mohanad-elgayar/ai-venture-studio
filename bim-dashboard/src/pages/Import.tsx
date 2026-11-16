import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, FileUp, Lock, RotateCcw, Upload, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useStore } from '../data/store';
import { Card, DataTable, Field, Pill, Spinner, Tabs, type Column } from '../components/ui';
import { parseFile, type ParsedFile } from '../importers/parse';
import { autoMap, FIELDS, type Target } from '../importers/fields';
import { buildRecords, requiredMissing, type ImportOptions, type RowResult } from '../importers/validate';
import { DISCIPLINES, SEVERITIES } from '../lib/constants';
import { downloadBlob, downloadCSV, stamp } from '../lib/export';
// Sample files are bundled (not fetched) so they also work in the single-file HTML build.
import sampleXml from '../../public/samples/sample-navisworks-clash-report.xml?raw';
import sampleClashCsv from '../../public/samples/sample-clash-register.csv?raw';
import sampleIssuesCsv from '../../public/samples/sample-coordination-issues.csv?raw';
const saveSample = (text: string, name: string, type: string) => downloadBlob(new Blob([text], { type }), name);
import { cls } from '../lib/format';
import type { Clash, CoordinationIssue, Deliverable, DisciplineCode, Severity } from '../types';

const TARGETS: { id: Target; label: string; desc: string }[] = [
  { id: 'clashes', label: 'Clash records', desc: 'Excel / CSV clash registers, Navisworks Clash Detective XML or HTML (Tabular) reports' },
  { id: 'issues', label: 'Coordination issues', desc: 'BIM coordination issue exports (BCF-style registers, issue trackers) as Excel / CSV' },
  { id: 'deliverables', label: 'BIM deliverables', desc: 'MIDP / TIDP deliverable registers as Excel / CSV' },
];
const STATE_COLOR: Record<string, string> = { new: '#0ca30c', update: '#3987e5', skip: '#8c9db8', error: '#d03b3b' };

export default function Import() {
  const { ds, filters, can, importClashes, upsert, notify } = useStore();
  const nav = useNavigate();
  const project = ds.projects.find((p) => p.id === filters.projectId)!;
  const [target, setTarget] = useState<Target>('clashes');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [show, setShow] = useState<'all' | 'error' | 'warning'>('all');
  const [done, setDone] = useState<{ n: number; target: Target } | null>(null);
  const [opt, setOpt] = useState<ImportOptions>({
    duplicatePolicy: 'skip', inferDisciplines: true, severityFromDistance: true, source: 'Import',
    defaults: { building: project.buildings[0]?.code ?? '', zone: project.buildings[0]?.zones[0] ?? '', level: project.buildings[0]?.levels[0] ?? '', package: project.packages[0] ?? '', severity: 'Medium' },
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async (f: File, sheet?: string) => {
    setBusy(true); setError(''); setDone(null);
    try {
      const p = await parseFile(f, sheet);
      if (!p.rows.length) throw new Error('The file contains a header but no data rows.');
      setFile(f); setParsed(p); setMapping(autoMap(target, p.headers));
      setOpt((o) => ({ ...o, source: p.format === 'navisworks-xml' || p.format === 'html' ? 'Navisworks' : 'Import' }));
      setStep(2);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const result = useMemo(() => (parsed && step >= 3 ? buildRecords(target, parsed.rows, mapping, opt, ds, project.id) : null), [parsed, step, target, mapping, opt, ds, project.id]);
  const missing = requiredMissing(target, mapping);

  const commit = async () => {
    if (!result || !parsed) return;
    const recs = result.records;
    if (!recs.length) return notify('error', 'No valid records to import.');
    setBusy(true);
    const ok = target === 'clashes' ? await importClashes(recs as Clash[], parsed.fileName)
      : target === 'issues' ? await upsert('issues', recs as CoordinationIssue[]) : await upsert('deliverables', recs as Deliverable[]);
    setBusy(false);
    if (ok) { setDone({ n: recs.length, target }); setStep(4); }
  };
  const reset = () => { setStep(1); setFile(null); setParsed(null); setMapping({}); setError(''); setDone(null); if (inputRef.current) inputRef.current.value = ''; };

  if (!can('import')) return <Card><div className="flex items-center gap-2 text-sm text-muted py-8 justify-center"><Lock size={16} /> Your role cannot import data. Ask a BIM Manager or BIM Coordinator.</div></Card>;

  const rowCols: Column<RowResult>[] = [
    { key: 'index', header: 'Row', align: 'right', value: (r) => r.index + 2 },
    { key: 'id', header: 'Record ID', render: (r) => <span className="font-mono text-xs">{r.id || '—'}</span> },
    { key: 'state', header: 'Result', render: (r) => <Pill color={STATE_COLOR[r.state]}>{r.state === 'new' ? 'New' : r.state === 'update' ? 'Update' : r.state === 'skip' ? 'Skip (exists)' : 'Error'}</Pill> },
    { key: 'msg', header: 'Messages', sortable: false, value: (r) => [...r.errors, ...r.warnings].join(' · '), render: (r) => <div className="text-xs space-y-0.5">{r.errors.map((e) => <div key={e} className="text-crit flex gap-1"><XCircle size={12} className="mt-0.5 shrink-0" />{e}</div>)}{r.warnings.map((w) => <div key={w} className="text-med flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</div>)}{!r.errors.length && !r.warnings.length && <span className="text-muted">OK</span>}</div> },
  ];
  const sample = (h: string) => parsed?.rows.slice(0, 3).map((r) => r[h]).filter((v) => v !== null && v !== '').map(String).join(' · ').slice(0, 80);

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2 text-xs">
        {['Upload file', 'Map columns', 'Validate', 'Done'].map((s, i) => (
          <li key={s} className={cls('flex items-center gap-2 rounded-full px-3 py-1 border', step === i + 1 ? 'border-accent bg-accent/15 text-ink' : step > i + 1 ? 'border-ok/50 text-ok' : 'border-line text-muted')}>
            <span className="font-semibold">{i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
          <Card title="What are you importing?">
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              {TARGETS.map((t) => (
                <button key={t.id} onClick={() => setTarget(t.id)} className={cls('text-left rounded-lg border p-3 transition', target === t.id ? 'border-accent bg-accent/10' : 'border-line hover:border-muted')}>
                  <div className="font-semibold text-sm">{t.label}</div><div className="text-xs text-muted mt-1">{t.desc}</div>
                </button>
              ))}
            </div>
            <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line hover:border-accent p-10 cursor-pointer text-center">
              {busy ? <Spinner text="Reading file…" /> : <>
                <FileUp size={30} className="text-accent" />
                <div className="font-semibold">Drop a file here or click to browse</div>
                <div className="text-xs text-muted">.xlsx · .csv · Navisworks .xml · Navisworks .html (Tabular) — max 25 MB. Files are processed locally in your browser.</div>
              </>}
              <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.csv,.txt,.xml,.html,.htm" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); }} />
            </label>
            {error && <div className="mt-3 text-sm text-crit flex items-start gap-2"><XCircle size={16} className="mt-0.5" />{error}</div>}
          </Card>
          <Card title="Templates & samples" subtitle="DEMO sample files to try the import workflow">
            <ul className="space-y-2 text-sm">
              <li><button className="text-accent hover:underline inline-flex items-center gap-1" onClick={() => downloadCSV([], `${target}-import-template.csv`, FIELDS[target].map((f) => f.label))}><Download size={13} /> Blank {TARGETS.find((t) => t.id === target)!.label.toLowerCase()} template (.csv)</button></li>
              <li><button className="text-accent hover:underline inline-flex items-center gap-1" onClick={() => saveSample(sampleXml, 'sample-navisworks-clash-report.xml', 'application/xml')}><Download size={13} /> Sample Navisworks Clash Detective XML</button></li>
              <li><button className="text-accent hover:underline inline-flex items-center gap-1" onClick={() => saveSample(sampleClashCsv, 'sample-clash-register.csv', 'text/csv')}><Download size={13} /> Sample clash register CSV (includes deliberate errors)</button></li>
              <li><button className="text-accent hover:underline inline-flex items-center gap-1" onClick={() => saveSample(sampleIssuesCsv, 'sample-coordination-issues.csv', 'text/csv')}><Download size={13} /> Sample coordination issues CSV</button></li>
            </ul>
            <div className="mt-4 text-xs text-muted space-y-2">
              <p><b className="text-ink">Navisworks support:</b> Clash Detective <i>Report → XML</i> and <i>HTML (Tabular)</i>. Mapped fields: clash name/GUID, test name, status (New/Active/Reviewed/Approved/Resolved), description (Hard/Clearance/Duplicates), distance, grid location, clash point, date found/approved, item layers/names/source files, comments.</p>
              <p>Disciplines are inferred from test names (e.g. “MEC vs STR”) or item source/layer names when not mapped. This is a <b className="text-ink">file-based import</b> — there is no live connection to Navisworks or Autodesk Construction Cloud.</p>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && parsed && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <Card title={`Map columns — ${parsed.fileName}`} subtitle={`${parsed.rows.length} rows · ${parsed.headers.length} columns · format: ${parsed.format}${parsed.notes.length ? ' · ' + parsed.notes.slice(0, 3).join(' · ') : ''}`}
            actions={parsed.sheets && parsed.sheets.length > 1 ? <select className="input !w-auto" value={parsed.sheet} onChange={(e) => file && load(file, e.target.value)} aria-label="Worksheet">{parsed.sheets.map((s) => <option key={s}>{s}</option>)}</select> : undefined}>
            <div className="overflow-auto max-h-[60vh] rounded-lg border border-line">
              <table className="tbl w-full">
                <thead><tr><th>Source column</th><th>Sample values</th><th>Dashboard field</th></tr></thead>
                <tbody>{parsed.headers.map((h) => (
                  <tr key={h}>
                    <td className="font-semibold whitespace-nowrap">{h}</td>
                    <td className="text-xs text-muted max-w-[280px] truncate" title={sample(h)}>{sample(h) || '—'}</td>
                    <td>
                      <select className={cls('input', mapping[h] && '!border-accent/60')} value={mapping[h] ?? ''} onChange={(e) => {
                        const v = e.target.value;
                        setMapping((m) => { const n = { ...m }; for (const k of Object.keys(n)) if (v && n[k] === v) delete n[k]; if (v) n[h] = v; else delete n[h]; return n; });
                      }} aria-label={`Map ${h}`}>
                        <option value="">— ignore —</option>
                        {FIELDS[target].map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                      </select>
                    </td>
                  </tr>))}
                </tbody>
              </table>
            </div>
            {missing.length > 0 && <div className="mt-3 text-sm text-crit">Required fields not mapped: {missing.join(', ')}</div>}
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost" onClick={reset}><ArrowLeft size={14} /> Back</button>
              <button className="btn-ghost" onClick={() => setMapping(autoMap(target, parsed.headers))}><RotateCcw size={14} /> Re-run auto-mapping</button>
              <div className="flex-1" />
              <button className="btn-primary" disabled={missing.length > 0} onClick={() => setStep(3)}>Validate <ArrowRight size={14} /></button>
            </div>
          </Card>
          <Card title="Import options" subtitle="Applied where the file has no value">
            <div className="space-y-3">
              <Field label="Existing records with the same ID">
                <Tabs value={opt.duplicatePolicy} onChange={(v) => setOpt({ ...opt, duplicatePolicy: v })} tabs={[{ id: 'skip', label: 'Skip (keep existing)' }, { id: 'update', label: 'Update existing' }]} />
              </Field>
              {target === 'clashes' && <>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={opt.inferDisciplines} onChange={(e) => setOpt({ ...opt, inferDisciplines: e.target.checked })} /> Infer disciplines from test / item names</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={opt.severityFromDistance} onChange={(e) => setOpt({ ...opt, severityFromDistance: e.target.checked })} /> Derive severity from penetration depth (≥100mm High, ≥30mm Medium)</label>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Default discipline A"><select className="input" value={opt.defaults.disciplineA ?? ''} onChange={(e) => setOpt({ ...opt, defaults: { ...opt.defaults, disciplineA: (e.target.value || undefined) as DisciplineCode } })}><option value="">— none —</option>{DISCIPLINES.map((d) => <option key={d.code}>{d.code}</option>)}</select></Field>
                  <Field label="Default discipline B"><select className="input" value={opt.defaults.disciplineB ?? ''} onChange={(e) => setOpt({ ...opt, defaults: { ...opt.defaults, disciplineB: (e.target.value || undefined) as DisciplineCode } })}><option value="">— none —</option>{DISCIPLINES.map((d) => <option key={d.code}>{d.code}</option>)}</select></Field>
                  <Field label="Default building"><select className="input" value={opt.defaults.building} onChange={(e) => { const b = project.buildings.find((x) => x.code === e.target.value); setOpt({ ...opt, defaults: { ...opt.defaults, building: e.target.value, zone: b?.zones[0] ?? '', level: b?.levels[0] ?? '' } }); }}>{project.buildings.map((b) => <option key={b.code}>{b.code}</option>)}</select></Field>
                  <Field label="Default zone"><select className="input" value={opt.defaults.zone} onChange={(e) => setOpt({ ...opt, defaults: { ...opt.defaults, zone: e.target.value } })}>{project.buildings.find((b) => b.code === opt.defaults.building)?.zones.map((z) => <option key={z}>{z}</option>)}</select></Field>
                  <Field label="Default level"><select className="input" value={opt.defaults.level} onChange={(e) => setOpt({ ...opt, defaults: { ...opt.defaults, level: e.target.value } })}>{project.buildings.find((b) => b.code === opt.defaults.building)?.levels.map((z) => <option key={z}>{z}</option>)}</select></Field>
                  <Field label="Default severity"><select className="input" value={opt.defaults.severity} onChange={(e) => setOpt({ ...opt, defaults: { ...opt.defaults, severity: e.target.value as Severity } })}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                  <Field label="Default package" className="col-span-2"><select className="input" value={opt.defaults.package} onChange={(e) => setOpt({ ...opt, defaults: { ...opt.defaults, package: e.target.value } })}>{project.packages.map((p) => <option key={p}>{p}</option>)}</select></Field>
                </div>
              </>}
              {target !== 'clashes' && <Field label="Default discipline"><select className="input" value={opt.defaults.disciplineA ?? ''} onChange={(e) => setOpt({ ...opt, defaults: { ...opt.defaults, disciplineA: (e.target.value || undefined) as DisciplineCode } })}><option value="">— none —</option>{DISCIPLINES.map((d) => <option key={d.code}>{d.code}</option>)}</select></Field>}
            </div>
          </Card>
        </div>
      )}

      {step === 3 && result && parsed && (
        <Card title="Validation preview" subtitle="Nothing is saved until you confirm. Rows with errors are excluded.">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Stat label="Rows in file" v={parsed.rows.length} />
            <Stat label="New records" v={result.counts.new} color="text-ok" />
            <Stat label="Updates" v={result.counts.update} color="text-accent" />
            <Stat label="Skipped (duplicates)" v={result.counts.skip} color="text-muted" />
            <Stat label="Errors (excluded)" v={result.counts.error} color={result.counts.error ? 'text-crit' : ''} />
          </div>
          <DataTable rows={result.rows.filter((r) => show === 'all' || (show === 'error' ? r.state === 'error' : r.warnings.length > 0))} columns={rowCols} rowKey={(r) => String(r.index)} pageSize={10}
            toolbar={<>
              <Tabs value={show} onChange={setShow} tabs={[{ id: 'all', label: 'All rows' }, { id: 'error', label: `Errors (${result.counts.error})` }, { id: 'warning', label: `Warnings (${result.rows.filter((r) => r.warnings.length).length})` }]} />
              <button className="btn-ghost" onClick={() => downloadCSV(result.rows.map((r) => ({ Row: r.index + 2, ID: r.id, Result: r.state, Errors: r.errors.join('; '), Warnings: r.warnings.join('; ') })), `import-validation-${stamp()}.csv`)}><Download size={14} /> Validation report</button>
            </>} />
          <div className="mt-4 flex gap-2">
            <button className="btn-ghost" onClick={() => setStep(2)}><ArrowLeft size={14} /> Back to mapping</button>
            <div className="flex-1" />
            <button className="btn-primary" disabled={busy || result.records.length === 0} onClick={commit}><Upload size={14} /> Import {result.records.length} valid record{result.records.length === 1 ? '' : 's'}</button>
          </div>
        </Card>
      )}

      {step === 4 && done && (
        <Card>
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <CheckCircle2 size={40} className="text-ok" />
            <div className="text-lg font-semibold">{done.n} records imported</div>
            <div className="text-sm text-muted">All dashboards, matrices and KPIs now include the imported data. {ds.isDemo && 'Note: the workspace still contains DEMO data — use Project & Access → Start blank project to work with real data only.'}</div>
            <div className="flex gap-2 mt-2">
              <button className="btn-ghost" onClick={reset}>Import another file</button>
              <button className="btn-primary" onClick={() => nav(done.target === 'clashes' ? '/clashes' : done.target === 'issues' ? '/risks' : '/deliverables')}>View records</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
const Stat = ({ label, v, color = '' }: { label: string; v: number; color?: string }) => <div className="card p-3"><div className="label">{label}</div><div className={cls('text-2xl font-semibold tabular-nums', color)}>{v}</div></div>;
