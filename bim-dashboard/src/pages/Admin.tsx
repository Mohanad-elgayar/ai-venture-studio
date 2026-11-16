import { useRef, useState } from 'react';
import { Database, Download, FlaskConical, Lock, Plus, RefreshCw, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useStore } from '../data/store';
import { Card, ConfirmButton, Field, Modal, Pill } from '../components/ui';
import { ROLE_DESCRIPTIONS } from '../lib/permissions';
import { DISCIPLINES, USER_ROLES } from '../lib/constants';
import { addDays, diffDays, monthEnd, monthStart, todayISO, toDate, weekStart } from '../lib/dates';
import { downloadBlob } from '../lib/export';
import { uid } from '../lib/format';
import { DATA_VERSION } from '../data/demo';
import type { Company, CompanyRole, Dataset, DisciplineCode, Project, ReportingPeriod, User, UserRole } from '../types';

const ACTIONS: [string, UserRole[]][] = [
  ['View dashboards, matrices & reports', ['Admin', 'BIM Manager', 'BIM Coordinator', 'Discipline Lead', 'Viewer']],
  ['Export (PDF / Excel / CSV)', ['Admin', 'BIM Manager', 'BIM Coordinator', 'Discipline Lead', 'Viewer']],
  ['Update status / notes on own-discipline clashes', ['Admin', 'BIM Manager', 'BIM Coordinator', 'Discipline Lead']],
  ['Create & fully edit clashes', ['Admin', 'BIM Manager', 'BIM Coordinator']],
  ['Edit registers (models, deliverables, risks, issues, compliance)', ['Admin', 'BIM Manager', 'BIM Coordinator']],
  ['Import data', ['Admin', 'BIM Manager', 'BIM Coordinator']],
  ['Delete records', ['Admin', 'BIM Manager']],
  ['Project setup, users, reset / restore data', ['Admin', 'BIM Manager']],
];

export default function Admin() {
  const { ds, filters, can, upsert, remove, resetDemo, startBlank, repoKind, notify } = useStore();
  const project = ds.projects.find((p) => p.id === filters.projectId)!;
  const admin = can('data.admin');
  const [p, setP] = useState<Project>(project);
  const [blankName, setBlankName] = useState('');
  const [editUser, setEditUser] = useState<User | 'new' | null>(null);
  const [editCompany, setEditCompany] = useState<Company | 'new' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveProject = async () => {
    if (!p.name.trim() || !p.code.trim()) return notify('error', 'Project name and code are required');
    if (!p.buildings.length || p.buildings.some((b) => !b.code.trim() || !b.levels.length)) return notify('error', 'Each building needs a code and at least one level');
    await upsert('projects', [p]);
  };
  const generatePeriods = async () => {
    const start = p.startDate || addDays(todayISO(), -84);
    const today = todayISO();
    const out: ReportingPeriod[] = [];
    for (let ws = weekStart(start); ws <= today; ws = addDays(ws, 7)) {
      const we = addDays(ws, 6);
      out.push({ id: `wk-${ws}`, projectId: project.id, type: 'Weekly', label: `Week of ${toDate(ws).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`, start: ws, end: we });
    }
    for (let ms = monthStart(start); ms <= today; ms = addDays(monthEnd(ms), 1)) {
      out.push({ id: `mo-${ms.slice(0, 7)}`, projectId: project.id, type: 'Monthly', label: toDate(ms).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) + (monthEnd(ms) > today ? ' (to date)' : ''), start: ms, end: monthEnd(ms) });
    }
    const keep = ds.periods.filter((x) => !out.some((o) => o.id === x.id));
    await upsert('periods', out);
    notify('info', `${out.length} reporting periods generated (${keep.length} other periods kept).`);
  };
  const backup = () => downloadBlob(new Blob([JSON.stringify(ds, null, 1)], { type: 'application/json' }), `bim-dataset-backup-${todayISO()}.json`);
  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as Dataset;
      if (data.version !== DATA_VERSION || !Array.isArray(data.clashes) || !Array.isArray(data.projects)) throw new Error('Not a compatible dataset backup');
      for (const k of ['companies', 'users', 'periods', 'models', 'submissions', 'clashes', 'clashHistory', 'deliverables', 'issues', 'risks', 'compliance', 'projects'] as const) {
        const ids = ds[k].map((x) => x.id);
        if (ids.length) await remove(k, ids);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((data as any)[k].length) await upsert(k, (data as any)[k]);
      }
      notify('success', 'Backup restored — reload the page to refresh all views.');
    } catch (e) { notify('error', (e as Error).message); }
  };

  return (
    <div className="space-y-4">
      {!admin && <div className="card p-3 text-sm text-muted flex items-center gap-2"><Lock size={14} /> Read-only: project setup and data administration require the Admin or BIM Manager role.</div>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Project setup" subtitle="Buildings, zones, levels and packages drive the global filters and data validation" actions={admin && <button className="btn-primary" onClick={saveProject}><Save size={14} /> Save</button>}>
          <fieldset disabled={!admin} className="grid grid-cols-2 gap-3">
            <Field label="Project name" required><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
            <Field label="Project code" required><input className="input" value={p.code} onChange={(e) => setP({ ...p, code: e.target.value })} /></Field>
            <Field label="Client"><input className="input" value={p.client} onChange={(e) => setP({ ...p, client: e.target.value })} /></Field>
            <Field label="Location"><input className="input" value={p.location} onChange={(e) => setP({ ...p, location: e.target.value })} /></Field>
            <Field label="Stage"><input className="input" value={p.stage} onChange={(e) => setP({ ...p, stage: e.target.value })} /></Field>
            <Field label="Project start date"><input type="date" className="input" value={p.startDate} onChange={(e) => setP({ ...p, startDate: e.target.value })} /></Field>
            <Field label="Packages (comma separated)" className="col-span-2"><input className="input" value={p.packages.join(', ')} onChange={(e) => setP({ ...p, packages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
            <div className="col-span-2">
              <div className="label mb-1">Buildings</div>
              <table className="tbl w-full"><thead><tr><th>Code</th><th>Name</th><th>Zones (comma sep.)</th><th>Levels (comma sep., bottom → top)</th><th /></tr></thead>
                <tbody>{p.buildings.map((b, i) => (
                  <tr key={i}>
                    <td><input className="input !w-16" value={b.code} onChange={(e) => setP({ ...p, buildings: p.buildings.map((x, j) => j === i ? { ...x, code: e.target.value } : x) })} /></td>
                    <td><input className="input" value={b.name} onChange={(e) => setP({ ...p, buildings: p.buildings.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} /></td>
                    <td><input className="input" value={b.zones.join(', ')} onChange={(e) => setP({ ...p, buildings: p.buildings.map((x, j) => j === i ? { ...x, zones: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x) })} /></td>
                    <td><input className="input" value={b.levels.join(', ')} onChange={(e) => setP({ ...p, buildings: p.buildings.map((x, j) => j === i ? { ...x, levels: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x) })} /></td>
                    <td><button className="text-muted hover:text-crit" aria-label="Remove building" onClick={() => setP({ ...p, buildings: p.buildings.filter((_, j) => j !== i) })}><Trash2 size={14} /></button></td>
                  </tr>))}
                </tbody>
              </table>
              <button className="btn-ghost mt-2 text-xs" onClick={() => setP({ ...p, buildings: [...p.buildings, { code: `B${p.buildings.length + 1}`, name: '', zones: ['Z1'], levels: ['GF'] }] })}><Plus size={13} /> Add building</button>
            </div>
          </fieldset>
        </Card>

        <div className="space-y-4">
          <Card title="Data source & management" subtitle={repoKind === 'local' ? 'Local workspace — data is stored in this browser only' : 'Connected to Supabase'}>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2"><Database size={14} className="text-accent" /> Mode: <b>{repoKind === 'local' ? 'Local (browser storage)' : 'Supabase'}</b> · {ds.isDemo ? <Pill color="#fab219">DEMO DATA loaded</Pill> : <Pill color="#0ca30c">Project data</Pill>}</div>
              <p className="text-xs text-muted">Records: {ds.clashes.length} clashes · {ds.models.length} models · {ds.deliverables.length} deliverables · {ds.issues.length} issues · {ds.risks.length} risks · {ds.compliance.length} compliance checks · {ds.clashHistory.length} history entries.</p>
              {repoKind === 'local' && <p className="text-xs text-muted">To share data across users with authentication and row-level security, configure Supabase (see README → “Connecting Supabase”).</p>}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-ghost" onClick={backup}><Download size={14} /> Backup dataset (JSON)</button>
              {admin && <><button className="btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> Restore backup</button><input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></>}
              {admin && <button className="btn-ghost" onClick={generatePeriods}><RefreshCw size={14} /> Generate reporting periods</button>}
            </div>
            {admin && <div className="mt-4 pt-4 border-t border-line grid md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5"><FlaskConical size={14} className="text-med" /> Restore demo dataset</div>
                <p className="text-xs text-muted my-1">Replaces all data with the fictional demo project.</p>
                <ConfirmButton className="btn-ghost" message="Replace ALL current data with the demo dataset? Export a backup first if needed." onConfirm={resetDemo}>Reset to demo data</ConfirmButton>
              </div>
              <div>
                <div className="text-sm font-semibold">Start a blank project</div>
                <p className="text-xs text-muted my-1">Removes demo data so only real imported data is reported.</p>
                <div className="flex gap-2"><input className="input" placeholder="Project name" value={blankName} onChange={(e) => setBlankName(e.target.value)} />
                  <ConfirmButton disabled={!blankName.trim()} className="btn-danger" message={`Delete ALL current data and start "${blankName}"? Export a backup first if needed.`} onConfirm={() => startBlank(blankName.trim())}>Start</ConfirmButton></div>
              </div>
            </div>}
          </Card>
          <Card title="Role-based permissions" subtitle={repoKind === 'local' ? 'Local mode: use “Acting as” in the top bar to preview each role' : 'Enforced in the UI and by Supabase Row Level Security'}>
            <table className="tbl w-full"><thead><tr><th>Permission</th>{USER_ROLES.map((r) => <th key={r} className="!text-center !text-[10px]">{r}</th>)}</tr></thead>
              <tbody>{ACTIONS.map(([a, roles]) => <tr key={a}><td className="text-xs">{a}</td>{USER_ROLES.map((r) => <td key={r} className="!text-center">{roles.includes(r) ? <ShieldCheck size={14} className="inline text-ok" /> : <span className="text-muted/50">—</span>}</td>)}</tr>)}</tbody>
            </table>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Users & roles" actions={admin && <button className="btn-primary" onClick={() => setEditUser('new')}><Plus size={14} /> Add user</button>}>
          <table className="tbl w-full"><thead><tr><th>Name</th><th>Role</th><th>Company</th><th>Discipline</th></tr></thead>
            <tbody>{ds.users.map((u) => <tr key={u.id} className={admin ? 'cursor-pointer' : ''} onClick={() => admin && setEditUser(u)}><td>{u.name}<div className="text-[11px] text-muted">{u.email}</div></td><td><span title={ROLE_DESCRIPTIONS[u.role]}>{u.role}</span></td><td>{ds.companies.find((c) => c.id === u.companyId)?.shortName ?? '—'}</td><td>{u.discipline ?? '—'}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Companies" actions={admin && <button className="btn-primary" onClick={() => setEditCompany('new')}><Plus size={14} /> Add company</button>}>
          <table className="tbl w-full"><thead><tr><th>Company</th><th>Short</th><th>Role</th><th>Disciplines</th></tr></thead>
            <tbody>{ds.companies.map((c) => <tr key={c.id} className={admin ? 'cursor-pointer' : ''} onClick={() => admin && setEditCompany(c)}><td>{c.name}</td><td>{c.shortName}</td><td>{c.role}</td><td className="text-xs">{c.disciplines.join(', ') || '—'}</td></tr>)}</tbody>
          </table>
        </Card>
      </div>
      {editUser && <UserEditor item={editUser} onClose={() => setEditUser(null)} />}
      {editCompany && <CompanyEditor item={editCompany} onClose={() => setEditCompany(null)} />}
      <p className="text-[11px] text-muted">Data reporting periods: {ds.periods.length} ({ds.periods.filter((x) => x.type === 'Weekly').length} weekly). Latest: {ds.periods.slice().sort((a, b) => b.end.localeCompare(a.end))[0]?.label ?? '—'}{ds.periods.length && diffDays(todayISO(), ds.periods.slice().sort((a, b) => b.end.localeCompare(a.end))[0].end) > 0 ? ' — generate periods to add the current week.' : ''}</p>
    </div>
  );
}

function UserEditor({ item, onClose }: { item: User | 'new'; onClose: () => void }) {
  const { ds, upsert, remove } = useStore();
  const [f, setF] = useState<User>(item === 'new' ? { id: uid('u-'), name: '', email: '', role: 'Viewer', companyId: ds.companies[0]?.id ?? '' } : { ...item });
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f.name.trim()) return setErr('Name is required');
    if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setErr('Invalid email');
    if (f.role === 'Discipline Lead' && !f.discipline) return setErr('Discipline Leads need a discipline');
    if (await upsert('users', [f])) onClose();
  };
  return (
    <Modal open onClose={onClose} title={item === 'new' ? 'Add user' : `Edit ${f.name}`} footer={<>
      {item !== 'new' && <ConfirmButton className="btn-danger mr-auto" disabled={ds.clashes.some((c) => c.assignedTo === f.id)} message="Delete this user?" onConfirm={async () => { if (await remove('users', [f.id])) onClose(); }}><Trash2 size={14} /> Delete</ConfirmButton>}
      <button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" required><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as UserRole })}>{USER_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Company"><select className="input" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}><option value="">—</option>{ds.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Discipline"><select className="input" value={f.discipline ?? ''} onChange={(e) => setF({ ...f, discipline: (e.target.value || undefined) as DisciplineCode })}><option value="">—</option>{DISCIPLINES.map((d) => <option key={d.code}>{d.code}</option>)}</select></Field>
        <p className="col-span-2 text-xs text-muted">{ROLE_DESCRIPTIONS[f.role]}</p>
      </div>
      {err && <p className="text-xs text-crit mt-2">{err}</p>}
      {item !== 'new' && ds.clashes.some((c) => c.assignedTo === f.id) && <p className="text-xs text-muted mt-2">Users with assigned clashes cannot be deleted — reassign their clashes first.</p>}
    </Modal>
  );
}

function CompanyEditor({ item, onClose }: { item: Company | 'new'; onClose: () => void }) {
  const { ds, upsert, remove } = useStore();
  const [f, setF] = useState<Company>(item === 'new' ? { id: uid('c-'), name: '', shortName: '', role: 'Design Consultant', disciplines: [] } : { ...item });
  const [err, setErr] = useState('');
  const inUse = item !== 'new' && (ds.clashes.some((c) => c.responsibleCompanyId === f.id) || ds.models.some((m) => m.companyId === f.id) || ds.users.some((u) => u.companyId === f.id));
  const save = async () => {
    if (!f.name.trim() || !f.shortName.trim()) return setErr('Name and short name are required');
    if (await upsert('companies', [f])) onClose();
  };
  const roles: CompanyRole[] = ['Client', 'PMC', 'Lead Consultant', 'Design Consultant', 'Main Contractor', 'Subcontractor', 'BIM Management'];
  return (
    <Modal open onClose={onClose} title={item === 'new' ? 'Add company' : `Edit ${f.name}`} footer={<>
      {item !== 'new' && <ConfirmButton className="btn-danger mr-auto" disabled={inUse} message="Delete this company?" onConfirm={async () => { if (await remove('companies', [f.id])) onClose(); }}><Trash2 size={14} /> Delete</ConfirmButton>}
      <button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company name" required><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Short name / originator code" required><input className="input" value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} /></Field>
        <Field label="Role"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as CompanyRole })}>{roles.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Disciplines"><div className="flex flex-wrap gap-1">{DISCIPLINES.map((d) => { const on = f.disciplines.includes(d.code); return <button type="button" key={d.code} className={`chip border ${on ? 'border-accent bg-accent/20' : 'border-line text-muted'}`} onClick={() => setF({ ...f, disciplines: on ? f.disciplines.filter((x) => x !== d.code) : [...f.disciplines, d.code] })}>{d.code}</button>; })}</div></Field>
      </div>
      {err && <p className="text-xs text-crit mt-2">{err}</p>}
      {inUse && <p className="text-xs text-muted mt-2">This company is referenced by clashes, models or users and cannot be deleted.</p>}
    </Modal>
  );
}
