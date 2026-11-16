import { useEffect, useMemo, useState } from 'react';
import { History, Lock, Trash2 } from 'lucide-react';
import type { Clash, DisciplineCode } from '../types';
import { useStore } from '../data/store';
import { Field, Modal, Tabs, ConfirmButton, StatusBadge } from './ui';
import { CLASH_STATUSES, CLASH_TYPES, CLOSED_STATUSES, DISCIPLINES, PRIORITIES, SEVERITIES, SEVERITY_SLA } from '../lib/constants';
import { addDays, diffDays, isValidISODate, todayISO } from '../lib/dates';
import { normalisePair, daysOpen } from '../lib/metrics';

export function nextClashId(existing: Clash[]) {
  const nums = existing.map((c) => /^CLH-(\d+)$/.exec(c.id)?.[1]).filter(Boolean).map(Number);
  return `CLH-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
}

export function validateClash(c: Clash, all: Clash[], isNew: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!c.id.trim()) e.id = 'Clash ID is required';
  else if (isNew && all.some((x) => x.id === c.id && x.projectId === c.projectId)) e.id = 'Clash ID already exists';
  if (!c.description.trim()) e.description = 'Description is required';
  if (!c.building) e.building = 'Required';
  if (!c.level) e.level = 'Required';
  if (!isValidISODate(c.dateIdentified)) e.dateIdentified = 'Valid date required';
  if (!isValidISODate(c.dueDate)) e.dueDate = 'Valid date required';
  else if (c.dueDate < c.dateIdentified) e.dueDate = 'Due date cannot be before date identified';
  if (c.dateResolved && !isValidISODate(c.dateResolved)) e.dateResolved = 'Invalid date';
  if (c.dateResolved && c.dateResolved < c.dateIdentified) e.dateResolved = 'Cannot be before date identified';
  if (CLOSED_STATUSES.includes(c.status) && !c.resolutionNotes.trim()) e.resolutionNotes = 'Resolution notes are required when resolving/closing';
  if (!c.assignedTo) e.assignedTo = 'Assign a responsible person';
  return e;
}

export function ClashEditor({ clash, open, onClose }: { clash: Clash | 'new' | null; open: boolean; onClose: () => void }) {
  const { ds, filters, saveClash, remove, can, user } = useStore();
  const project = ds.projects.find((p) => p.id === filters.projectId)!;
  const isNew = clash === 'new';
  const blank = (): Clash => {
    const today = todayISO();
    return {
      id: nextClashId(ds.clashes), projectId: project.id, description: '', type: 'Hard', disciplineA: 'ARC', disciplineB: 'STR',
      building: project.buildings[0]?.code ?? '', zone: project.buildings[0]?.zones[0] ?? '', level: project.buildings[0]?.levels[0] ?? '',
      package: project.packages[0] ?? '', gridRef: '', modelRef: '', position: '', severity: 'Medium', priority: 'P3', status: 'New',
      assignedTo: '', assignedDiscipline: 'ARC', responsibleCompanyId: '', dateIdentified: today, dueDate: addDays(today, SEVERITY_SLA.Medium),
      resolutionNotes: '', occurrences: 1, source: 'Manual',
    };
  };
  const [form, setForm] = useState<Clash>(blank);
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setForm(clash === 'new' || !clash ? blank() : { ...clash });
    setComment(''); setErrors({}); setTab('details');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clash]);

  const fullEdit = isNew ? can('clash.create') : can('clash.edit', form) && user?.role !== 'Discipline Lead';
  const statusEdit = isNew ? can('clash.create') : can('clash.edit', clash as Clash);
  const bld = project.buildings.find((b) => b.code === form.building);
  const set = <K extends keyof Clash>(k: K, v: Clash[K]) => setForm((f) => ({ ...f, [k]: v }));
  const history = useMemo(() => (isNew || !clash ? [] : ds.clashHistory.filter((h) => h.clashId === (clash as Clash).id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))), [ds.clashHistory, clash, isNew]);
  const userName = (id: string) => ds.users.find((u) => u.id === id)?.name ?? id;

  const submit = async () => {
    const [a, b] = normalisePair(form.disciplineA, form.disciplineB);
    const c = { ...form, disciplineA: a, disciplineB: b, id: form.id.trim() };
    const e = validateClash(c, ds.clashes, isNew);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (await saveClash(c, comment)) onClose();
  };

  const dis = !fullEdit;
  const disciplineOpts = DISCIPLINES.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>);
  return (
    <Modal open={open} onClose={onClose} wide title={<span className="flex items-center gap-2">{isNew ? 'New clash' : <>Clash <span className="font-mono">{form.id}</span> <StatusBadge s={form.status} /></>}</span>}
      footer={<>
        {!isNew && can('clash.delete') && <ConfirmButton className="btn-danger mr-auto" message={`Delete clash ${form.id} and its history?`} onConfirm={async () => { if (await remove('clashes', [form.id])) onClose(); }}><Trash2 size={14} /> Delete</ConfirmButton>}
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        {(fullEdit || statusEdit) && <button className="btn-primary" onClick={submit}>{isNew ? 'Create clash' : 'Save changes'}</button>}
      </>}>
      {!isNew && <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'details', label: 'Details' }, { id: 'history', label: <span className="inline-flex items-center gap-1"><History size={12} />History ({history.length})</span> }]} /></div>}
      {!fullEdit && statusEdit && <div className="mb-3 text-xs text-med flex items-center gap-1.5"><Lock size={12} /> Your role ({user?.role}) can update status, resolution notes and comments only.</div>}
      {!statusEdit && <div className="mb-3 text-xs text-muted flex items-center gap-1.5"><Lock size={12} /> Read-only — your role ({user?.role}) cannot edit this clash.</div>}
      {tab === 'details' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Clash ID" required error={errors.id}><input className="input font-mono" value={form.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} /></Field>
          <Field label="Clash type"><select className="input" disabled={dis} value={form.type} onChange={(e) => set('type', e.target.value as Clash['type'])}>{CLASH_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Discipline A"><select className="input" disabled={dis} value={form.disciplineA} onChange={(e) => set('disciplineA', e.target.value as DisciplineCode)}>{disciplineOpts}</select></Field>
          <Field label="Discipline B"><select className="input" disabled={dis} value={form.disciplineB} onChange={(e) => set('disciplineB', e.target.value as DisciplineCode)}>{disciplineOpts}</select></Field>
          <Field label="Clash description" required error={errors.description} className="col-span-2 md:col-span-4"><input className="input" disabled={dis} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Supply air duct 1200x600 intersects transfer beam TB-12" /></Field>
          <Field label="Building" required error={errors.building}><select className="input" disabled={dis} value={form.building} onChange={(e) => { const b = project.buildings.find((x) => x.code === e.target.value); setForm((f) => ({ ...f, building: e.target.value, zone: b?.zones[0] ?? '', level: b?.levels[0] ?? '' })); }}>{project.buildings.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}</select></Field>
          <Field label="Zone"><select className="input" disabled={dis} value={form.zone} onChange={(e) => set('zone', e.target.value)}>{(bld?.zones ?? []).map((z) => <option key={z}>{z}</option>)}</select></Field>
          <Field label="Level" required error={errors.level}><select className="input" disabled={dis} value={form.level} onChange={(e) => set('level', e.target.value)}>{(bld?.levels ?? []).map((z) => <option key={z}>{z}</option>)}</select></Field>
          <Field label="Package"><select className="input" disabled={dis} value={form.package} onChange={(e) => set('package', e.target.value)}>{project.packages.map((z) => <option key={z}>{z}</option>)}</select></Field>
          <Field label="Grid reference"><input className="input" disabled={dis} value={form.gridRef} onChange={(e) => set('gridRef', e.target.value)} placeholder="C-4" /></Field>
          <Field label="Model reference" className="col-span-2"><input className="input" disabled={dis} list="model-refs" value={form.modelRef} onChange={(e) => set('modelRef', e.target.value)} /><datalist id="model-refs">{ds.models.map((m) => <option key={m.id} value={m.name} />)}</datalist></Field>
          <Field label="Clash position (x, y, z)"><input className="input" disabled={dis} value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="102.40, 55.10, 12.85" /></Field>
          <Field label="Severity"><select className="input" disabled={dis} value={form.severity} onChange={(e) => { const s = e.target.value as Clash['severity']; setForm((f) => ({ ...f, severity: s, priority: (['P1', 'P2', 'P3', 'P4'] as const)[SEVERITIES.indexOf(s)], dueDate: isNew ? addDays(f.dateIdentified, SEVERITY_SLA[s]) : f.dueDate })); }}>{SEVERITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Priority"><select className="input" disabled={dis} value={form.priority} onChange={(e) => set('priority', e.target.value as Clash['priority'])}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Status"><select className="input" disabled={!statusEdit} value={form.status} onChange={(e) => set('status', e.target.value as Clash['status'])}>{CLASH_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Assigned to" required error={errors.assignedTo}><select className="input" disabled={dis} value={form.assignedTo} onChange={(e) => { const u = ds.users.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, assignedTo: e.target.value, responsibleCompanyId: u?.companyId || f.responsibleCompanyId, assignedDiscipline: u?.discipline ?? f.assignedDiscipline })); }}>
            <option value="">— select —</option>{ds.users.filter((u) => u.role !== 'Viewer').map((u) => <option key={u.id} value={u.id}>{u.name}{u.discipline ? ` (${u.discipline})` : ''}</option>)}</select></Field>
          <Field label="Assigned discipline"><select className="input" disabled={dis} value={form.assignedDiscipline} onChange={(e) => set('assignedDiscipline', e.target.value as DisciplineCode)}>{disciplineOpts}</select></Field>
          <Field label="Responsible company" className="col-span-2"><select className="input" disabled={dis} value={form.responsibleCompanyId} onChange={(e) => set('responsibleCompanyId', e.target.value)}><option value="">— select —</option>{ds.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Date identified" required error={errors.dateIdentified}><input type="date" className="input" disabled={dis} value={form.dateIdentified} onChange={(e) => set('dateIdentified', e.target.value)} /></Field>
          <Field label="Due date" required error={errors.dueDate}><input type="date" className="input" disabled={dis} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
          <Field label="Date resolved" error={errors.dateResolved}><input type="date" className="input" disabled={!statusEdit || !CLOSED_STATUSES.includes(form.status)} value={form.dateResolved ?? ''} onChange={(e) => set('dateResolved', e.target.value || undefined)} title="Set automatically to today when resolving, editable" /></Field>
          <Field label="Days open"><div className="input bg-transparent tabular-nums">{isNew ? 0 : daysOpen(form, todayISO())} {form.dueDate < todayISO() && !CLOSED_STATUSES.includes(form.status) && <span className="text-crit font-semibold ml-1">· overdue {diffDays(todayISO(), form.dueDate)}d</span>}</div></Field>
          <Field label="Resolution notes" error={errors.resolutionNotes} className="col-span-2 md:col-span-4"><textarea rows={2} className="input" disabled={!statusEdit} value={form.resolutionNotes} onChange={(e) => set('resolutionNotes', e.target.value)} placeholder="How was the clash resolved / agreed?" /></Field>
          {statusEdit && <Field label="Add comment to history (optional)" className="col-span-2 md:col-span-4"><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Discussed at coordination meeting #24 — HVAC to re-route by Friday" /></Field>}
          {form.occurrences > 1 && <div className="col-span-2 md:col-span-4 text-xs text-high">Repeat detection: re-appeared in {form.occurrences} clash runs{form.clashGroup ? ` (group ${form.clashGroup})` : ''}.</div>}
        </div>
      ) : (
        <ol className="relative border-l border-line ml-2 space-y-4">
          {history.map((h) => (
            <li key={h.id} className="ml-4">
              <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-accent" />
              <div className="text-xs text-muted">{new Date(h.timestamp).toLocaleString('en-GB')} · {userName(h.userId)}</div>
              <div className="text-sm"><b>{h.action}</b>{h.field && <> — {h.field}: <span className="text-muted line-through">{h.from || '∅'}</span> → <span>{h.to || '∅'}</span></>}</div>
              {h.comment && <div className="text-sm text-ink/80 mt-0.5">“{h.comment}”</div>}
            </li>
          ))}
          {!history.length && <li className="ml-4 text-sm text-muted">No history recorded.</li>}
        </ol>
      )}
    </Modal>
  );
}
