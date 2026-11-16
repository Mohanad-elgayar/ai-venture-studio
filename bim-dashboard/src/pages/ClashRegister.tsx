import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, FileSpreadsheet, Trash2, X, Repeat } from 'lucide-react';
import { useStore } from '../data/store';
import { useData } from '../data/useData';
import { Card, ConfirmButton, DataTable, MultiSelect, SeverityBadge, StatusBadge, Tabs, Modal, Field, type Column } from '../components/ui';
import { ClashEditor } from '../components/ClashEditor';
import { daysOpen, isClosedAsOf, isInScope, isOpenAsOf, isOverdueAsOf, statusAsOf } from '../lib/metrics';
import { CLASH_STATUSES, CLASH_TYPES, CLOSED_STATUSES, DISCIPLINES, PRIORITIES, SEVERITIES } from '../lib/constants';
import { fmtDate, todayISO } from '../lib/dates';
import { cls } from '../lib/format';
import { clashRows, downloadCSV, downloadXlsx, stamp } from '../lib/export';
import type { Clash, ClashStatus } from '../types';

type State = 'all' | 'open' | 'closed' | 'overdue';

export default function ClashRegister() {
  const { scope, can, saveClash, remove, ds, user } = useStore();
  const d = useData();
  const [params, setParams] = useSearchParams();
  const asOf = scope.asOf;
  const list = (k: string) => (params.get(k) ? params.get(k)!.split(',') : []);
  const [state, setState] = useState<State>((params.get('state') as State) || (params.get('id') ? 'all' : 'open'));
  const [sev, setSev] = useState<string[]>(list('severity'));
  const [pri, setPri] = useState<string[]>(list('priority'));
  const [status, setStatus] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [disc, setDisc] = useState<string[]>(list('discipline'));
  const [company, setCompany] = useState<string[]>([]);
  const [pair, setPair] = useState<string | null>(params.get('pair'));
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [editing, setEditing] = useState<Clash | 'new' | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);

  // deep-link: ?id=CLH-0001 opens the editor
  useEffect(() => {
    const id = params.get('id');
    if (id) { const c = ds.clashes.find((x) => x.id === id); if (c) setEditing(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeEditor = () => { setEditing(null); if (params.get('id')) { params.delete('id'); setParams(params, { replace: true }); } };

  const rows = useMemo(() => d.clashes.filter((c) => {
    if (!isInScope(c, asOf)) return false;
    if (state === 'open' && !isOpenAsOf(c, asOf)) return false;
    if (state === 'closed' && !isClosedAsOf(c, asOf)) return false;
    if (state === 'overdue' && !isOverdueAsOf(c, asOf)) return false;
    if (sev.length && !sev.includes(c.severity)) return false;
    if (pri.length && !pri.includes(c.priority)) return false;
    if (status.length && !status.includes(statusAsOf(c, asOf))) return false;
    if (types.length && !types.includes(c.type)) return false;
    if (disc.length && !disc.includes(c.disciplineA) && !disc.includes(c.disciplineB)) return false;
    if (company.length && !company.includes(c.responsibleCompanyId)) return false;
    if (pair) { const [a, b] = pair.split('|'); if (!((c.disciplineA === a && c.disciplineB === b) || (c.disciplineA === b && c.disciplineB === a))) return false; }
    if (repeatOnly && c.occurrences < 2) return false;
    return true;
  }), [d.clashes, asOf, state, sev, pri, status, types, disc, company, pair, repeatOnly]);

  const counts = useMemo(() => ({
    all: d.clashes.filter((c) => isInScope(c, asOf)).length,
    open: d.clashes.filter((c) => isOpenAsOf(c, asOf)).length,
    closed: d.clashes.filter((c) => isClosedAsOf(c, asOf)).length,
    overdue: d.clashes.filter((c) => isOverdueAsOf(c, asOf)).length,
  }), [d.clashes, asOf]);

  const columns: Column<Clash>[] = [
    { key: 'id', header: 'Clash ID', render: (c) => <span className="font-mono text-xs whitespace-nowrap">{c.id}{c.occurrences > 1 && <Repeat size={11} className="inline ml-1 text-high" aria-label="repeat detection" />}</span> },
    { key: 'description', header: 'Description', render: (c) => <span className="block max-w-[300px] truncate" title={c.description}>{c.description}</span> },
    { key: 'type', header: 'Type' },
    { key: 'pair', header: 'Disc. A / B', value: (c) => `${c.disciplineA}/${c.disciplineB}` },
    { key: 'building', header: 'Bldg' },
    { key: 'zone', header: 'Zone' },
    { key: 'level', header: 'Level' },
    { key: 'gridRef', header: 'Grid' },
    { key: 'severity', header: 'Severity', value: (c) => SEVERITIES.indexOf(c.severity), render: (c) => <SeverityBadge s={c.severity} /> },
    { key: 'priority', header: 'Pri.' },
    { key: 'status', header: 'Status', value: (c) => statusAsOf(c, asOf), render: (c) => <StatusBadge s={statusAsOf(c, asOf)} /> },
    { key: 'assignedTo', header: 'Assigned to', value: (c) => d.userName(c.assignedTo), render: (c) => <span className="whitespace-nowrap">{d.userName(c.assignedTo)}</span> },
    { key: 'company', header: 'Company', value: (c) => d.companyShort(c.responsibleCompanyId) },
    { key: 'dateIdentified', header: 'Identified', render: (c) => <span className="whitespace-nowrap">{fmtDate(c.dateIdentified)}</span> },
    { key: 'dueDate', header: 'Due', render: (c) => <span className={cls('whitespace-nowrap', isOverdueAsOf(c, asOf) && 'text-crit font-semibold')}>{fmtDate(c.dueDate)}</span> },
    { key: 'dateResolved', header: 'Resolved', value: (c) => (isClosedAsOf(c, asOf) ? c.dateResolved : ''), render: (c) => <span className="whitespace-nowrap">{isClosedAsOf(c, asOf) ? fmtDate(c.dateResolved) : '—'}</span> },
    { key: 'days', header: 'Days open', align: 'right', value: (c) => daysOpen(c, asOf) },
  ];

  const anyFilter = sev.length + pri.length + status.length + types.length + disc.length + company.length > 0 || !!pair || repeatOnly;
  const clearAll = () => { setSev([]); setPri([]); setStatus([]); setTypes([]); setDisc([]); setCompany([]); setPair(null); setRepeatOnly(false); setParams({}, { replace: true }); };
  const editableSelected = rows.filter((c) => selected.includes(c.id) && can('clash.edit', c));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={state} onChange={setState} tabs={[
            { id: 'all', label: `All (${counts.all})` }, { id: 'open', label: `Open (${counts.open})` },
            { id: 'closed', label: `Closed (${counts.closed})` }, { id: 'overdue', label: `Overdue (${counts.overdue})` },
          ]} />
          <div className="w-40"><MultiSelect label="Severity" value={sev} onChange={setSev} options={SEVERITIES.map((x) => ({ value: x, label: x }))} /></div>
          <div className="w-36"><MultiSelect label="Priority" value={pri} onChange={setPri} options={PRIORITIES.map((x) => ({ value: x, label: x }))} /></div>
          <div className="w-44"><MultiSelect label="Status" value={status} onChange={setStatus} options={CLASH_STATUSES.map((x) => ({ value: x, label: x }))} /></div>
          <div className="w-36"><MultiSelect label="Type" value={types} onChange={setTypes} options={CLASH_TYPES.map((x) => ({ value: x, label: x }))} /></div>
          <div className="w-44"><MultiSelect label="Discipline" value={disc} onChange={setDisc} options={DISCIPLINES.map((x) => ({ value: x.code, label: `${x.code} — ${x.name}` }))} /></div>
          <div className="w-52"><MultiSelect label="Company" value={company} onChange={setCompany} options={ds.companies.map((x) => ({ value: x.id, label: x.name }))} width="w-72" /></div>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={repeatOnly} onChange={(e) => setRepeatOnly(e.target.checked)} />Repeat clashes only</label>
          {pair && <span className="chip bg-accent/20 text-ink">Pair {pair.replace('|', ' vs ')}<button onClick={() => setPair(null)} aria-label="Remove pair filter"><X size={11} /></button></span>}
          {anyFilter && <button className="text-xs text-accent" onClick={clearAll}>Clear filters</button>}
        </div>
      </Card>

      <Card title="Clash register" subtitle={`Statuses shown as at the reporting date ${fmtDate(asOf)}. Global filters apply. Click a row to view, edit, assign or see history.`}>
        <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={setEditing} initialSort={{ key: 'dueDate', dir: 'asc' }} pageSize={15} dense
          selectable={can('clash.edit') || can('clash.delete')} selected={selected} onSelect={setSelected}
          toolbar={<>
            {selected.length > 0 && <>
              {can('clash.edit') && <button className="btn-ghost" onClick={() => setBulk(true)} disabled={!editableSelected.length}>Bulk update ({editableSelected.length})</button>}
              {can('clash.delete') && <ConfirmButton message={`Delete ${selected.length} selected clash records and their history?`} onConfirm={async () => { if (await remove('clashes', selected)) setSelected([]); }}><Trash2 size={14} /> Delete ({selected.length})</ConfirmButton>}
            </>}
            <button className="btn-ghost" onClick={() => downloadCSV(clashRows(rows, asOf, d), `clash-register-${stamp()}.csv`)}><Download size={14} /> CSV</button>
            <button className="btn-ghost" onClick={() => downloadXlsx([{ name: 'Clash Register', rows: clashRows(rows, asOf, d) }], `clash-register-${stamp()}.xlsx`, { Project: d.project.name, 'Reporting date': asOf, 'Records': String(rows.length), Data: ds.isDemo ? 'DEMO DATA — not actual project performance' : 'Project data', 'Exported by': user?.name ?? '' })}><FileSpreadsheet size={14} /> Excel</button>
            {can('clash.create') && <button className="btn-primary" onClick={() => setEditing('new')}><Plus size={14} /> New clash</button>}
          </>} />
      </Card>

      <ClashEditor open={!!editing} clash={editing} onClose={closeEditor} />
      <BulkUpdate open={bulk} onClose={() => setBulk(false)} clashes={editableSelected} onApply={async (patch, comment) => {
        let ok = true;
        for (const c of editableSelected) {
          const next = { ...c, ...patch };
          if (CLOSED_STATUSES.includes(next.status) && !next.resolutionNotes.trim()) next.resolutionNotes = comment || 'Bulk closed';
          if (CLOSED_STATUSES.includes(next.status) && !next.dateResolved) next.dateResolved = todayISO();
          ok = (await saveClash(next, comment)) && ok;
        }
        if (ok) { setSelected([]); setBulk(false); }
      }} />
    </div>
  );
}

function BulkUpdate({ open, onClose, clashes, onApply }: { open: boolean; onClose: () => void; clashes: Clash[]; onApply: (p: Partial<Clash>, comment: string) => void }) {
  const { ds, user } = useStore();
  const [st, setSt] = useState<ClashStatus | ''>('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [comment, setComment] = useState('');
  const lead = user?.role === 'Discipline Lead';
  const patch: Partial<Clash> = {};
  if (st) patch.status = st;
  if (assignee) { const u = ds.users.find((x) => x.id === assignee); patch.assignedTo = assignee; if (u?.companyId) patch.responsibleCompanyId = u.companyId; if (u?.discipline) patch.assignedDiscipline = u.discipline; }
  if (due) patch.dueDate = due;
  return (
    <Modal open={open} onClose={onClose} title={`Bulk update ${clashes.length} clashes`} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={!Object.keys(patch).length} onClick={() => onApply(patch, comment)}>Apply</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Change status to"><select className="input" value={st} onChange={(e) => setSt(e.target.value as ClashStatus)}><option value="">— no change —</option>{CLASH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        {!lead && <Field label="Reassign to"><select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">— no change —</option>{ds.users.filter((u) => u.role !== 'Viewer').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>}
        {!lead && <Field label="New due date"><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>}
        <Field label="Comment / resolution note" className="col-span-2"><input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Recorded in each clash's history" /></Field>
      </div>
      <p className="text-xs text-muted mt-3">Each change is recorded in the clash history. When resolving/closing, the comment is used as the resolution note where none exists.</p>
    </Modal>
  );
}
