import { RotateCcw, Filter } from 'lucide-react';
import { useStore } from '../../data/store';
import { MultiSelect } from '../ui';
import { DISCIPLINES } from '../../lib/constants';

export function FilterBar() {
  const { ds, filters, setFilters, resetFilters } = useStore();
  const project = ds.projects.find((p) => p.id === filters.projectId);
  const blds = project?.buildings ?? [];
  const scoped = filters.buildings.length ? blds.filter((b) => filters.buildings.includes(b.code)) : blds;
  const zones = [...new Set(scoped.flatMap((b) => b.zones))];
  const levels = [...new Set(scoped.flatMap((b) => b.levels))];
  const active = filters.disciplines.length + filters.buildings.length + filters.zones.length + filters.levels.length + filters.packages.length;
  return (
    <div className="no-print border-b border-line bg-surface/40 px-4 py-2 flex flex-wrap items-center gap-2">
      <Filter size={14} className="text-muted" />
      <div className="w-48"><MultiSelect label="Discipline" value={filters.disciplines} onChange={(v) => setFilters({ disciplines: v as never })} options={DISCIPLINES.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))} /></div>
      <div className="w-48"><MultiSelect label="Building" value={filters.buildings} onChange={(v) => setFilters({ buildings: v, zones: [], levels: [] })} options={blds.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` }))} width="w-72" /></div>
      <div className="w-40"><MultiSelect label="Zone" value={filters.zones} onChange={(v) => setFilters({ zones: v })} options={zones.map((z) => ({ value: z, label: z }))} /></div>
      <div className="w-40"><MultiSelect label="Level" value={filters.levels} onChange={(v) => setFilters({ levels: v })} options={levels.map((z) => ({ value: z, label: z }))} width="w-44" /></div>
      <div className="w-52"><MultiSelect label="Package" value={filters.packages} onChange={(v) => setFilters({ packages: v })} options={(project?.packages ?? []).map((z) => ({ value: z, label: z }))} width="w-64" /></div>
      {active > 0 && <button className="btn-ghost !py-1 text-xs" onClick={resetFilters}><RotateCcw size={13} /> Reset filters ({active})</button>}
    </div>
  );
}
