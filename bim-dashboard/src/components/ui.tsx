import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Info, X, Loader2, Inbox, ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cls } from '../lib/format';
import { SEVERITY_COLOR, STATUS_COLOR } from '../lib/constants';
import type { ClashStatus, Severity } from '../types';

export function Card({ title, subtitle, actions, children, className, bodyClass }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cls('card flex flex-col min-w-0', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cls('px-4 pb-4 flex-1 min-h-0', !title && !actions && 'pt-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex">
      <Info size={13} className="text-muted cursor-help" aria-label={text} />
      <span role="tooltip" className="pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 top-5 w-60 rounded-md bg-surface2 border border-line p-2 text-[11px] leading-snug text-ink shadow-xl opacity-0 group-hover:opacity-100 transition-opacity normal-case tracking-normal font-normal">{text}</span>
    </span>
  );
}

export function SeverityBadge({ s }: { s: Severity }) {
  return <span className="chip border" style={{ color: SEVERITY_COLOR[s], borderColor: SEVERITY_COLOR[s] + '66', background: SEVERITY_COLOR[s] + '1a' }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />{s}</span>;
}
export function StatusBadge({ s }: { s: ClashStatus | string }) {
  const c = (STATUS_COLOR as Record<string, string>)[s] ?? '#8c9db8';
  return <span className="chip" style={{ color: c, background: c + '1f' }}>{s}</span>;
}
export function Pill({ children, color = '#8c9db8' }: { children: ReactNode; color?: string }) {
  return <span className="chip" style={{ color, background: color + '1f' }}>{children}</span>;
}

export function ProgressBar({ value, color = 'rgb(var(--accent))', height = 6 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return <div className="w-full rounded-full bg-surface2 overflow-hidden" style={{ height }}>
    <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: color }} />
  </div>;
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cls('card w-full max-h-[90vh] flex flex-col shadow-2xl', wide ? 'max-w-5xl' : 'max-w-2xl')} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h2 className="font-semibold">{title}</h2>
          <button className="text-muted hover:text-ink" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="p-5 overflow-auto">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-line flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, actions }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <div className={cls('fixed inset-0 z-40 transition-all duration-200', open ? 'pointer-events-auto visible' : 'pointer-events-none invisible')} aria-hidden={!open}>
      <div className={cls('absolute inset-0 bg-black/50 transition-opacity', open ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label="Details panel" className={cls('absolute right-0 top-0 h-full w-full max-w-[1100px] bg-bg border-l border-line shadow-2xl flex flex-col transition-transform', open ? 'translate-x-0' : 'translate-x-full')}>
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line bg-surface">
          <div className="min-w-0"><h2 className="font-semibold text-lg">{title}</h2>{subtitle && <div className="text-xs text-muted mt-1">{subtitle}</div>}</div>
          <div className="flex items-center gap-2">{actions}<button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={16} /></button></div>
        </header>
        <div className="flex-1 overflow-auto p-5">{open && children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, children, error, required, className }: { label: string; children: ReactNode; error?: string; required?: boolean; className?: string }) {
  return <label className={cls('block', className)}>
    <span className="label block mb-1">{label}{required && <span className="text-crit"> *</span>}</span>
    {children}
    {error && <span className="text-[11px] text-crit mt-0.5 block">{error}</span>}
  </label>;
}

export function Select<T extends string>({ value, onChange, options, className, ariaLabel }: { value: T; onChange: (v: T) => void; options: (T | { value: T; label: string })[]; className?: string; ariaLabel?: string }) {
  return <select aria-label={ariaLabel} className={cls('input pr-7', className)} value={value} onChange={(e) => onChange(e.target.value as T)}>
    {options.map((o) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}

/** Dropdown with checkboxes. Empty selection means "All". */
export function MultiSelect({ label, options, value, onChange, width = 'w-56' }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const text = value.length === 0 ? 'All' : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? value[0]) : `${value.length} selected`;
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={cls('input flex items-center justify-between gap-2 text-left !py-1', value.length > 0 && '!border-accent/70')} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="truncate"><span className="text-muted text-[11px] mr-1">{label}:</span>{text}</span><ChevronDown size={14} className="text-muted shrink-0" />
      </button>
      {open && (
        <div className={cls('absolute z-40 mt-1 max-h-72 overflow-auto rounded-lg border border-line bg-surface shadow-2xl p-1', width)} role="listbox">
          <button className="w-full text-left px-2 py-1.5 text-xs text-accent hover:bg-surface2 rounded" onClick={() => onChange([])}>Clear (All)</button>
          {options.map((o) => {
            const on = value.includes(o.value);
            return <button key={o.value} role="option" aria-selected={on} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-surface2 rounded text-left"
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}>
              <span className={cls('w-4 h-4 rounded border flex items-center justify-center', on ? 'bg-accent border-accent' : 'border-line')}>{on && <Check size={12} className="text-white" />}</span>
              <span className="truncate">{o.label}</span>
            </button>;
          })}
          {options.length === 0 && <div className="px-2 py-2 text-xs text-muted">No options</div>}
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return <div className="inline-flex rounded-lg border border-line bg-surface2 p-0.5" role="tablist">
    {tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
      className={cls('px-3 py-1 text-xs font-semibold rounded-md transition-colors', value === t.id ? 'bg-accent text-white shadow' : 'text-muted hover:text-ink')}>{t.label}</button>)}
  </div>;
}

export function Empty({ title = 'No data', text, action }: { title?: string; text?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-muted">
    <Inbox size={28} className="mb-2 opacity-70" />
    <div className="text-sm font-semibold text-ink/80">{title}</div>
    {text && <div className="text-xs mt-1 max-w-sm">{text}</div>}
    {action && <div className="mt-3">{action}</div>}
  </div>;
}
export function Spinner({ text = 'Loading…' }: { text?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-muted text-sm"><Loader2 className="animate-spin" size={18} />{text}</div>;
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cls('animate-pulse rounded-lg bg-surface2', className)} />;
}

// ------------------------------------------------------------ DataTable
export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number | undefined; // for sort / search / export
  width?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
}
export function DataTable<T>({ rows, columns, rowKey, onRowClick, pageSize = 15, searchable = true, toolbar, initialSort, emptyText, selectable, selected, onSelect, dense }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; pageSize?: number; searchable?: boolean;
  toolbar?: ReactNode; initialSort?: { key: string; dir: 'asc' | 'desc' }; emptyText?: string;
  selectable?: boolean; selected?: string[]; onSelect?: (ids: string[]) => void; dense?: boolean;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : (r as Record<string, unknown>)[c.key] as string | number | undefined);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = s ? rows.filter((r) => columns.some((c) => String(val(c, r) ?? '').toLowerCase().includes(s))) : rows;
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) out = [...out].sort((a, b) => {
        const va = val(c, a), vb = val(c, b);
        const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true });
        return sort.dir === 'asc' ? r : -r;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);
  useEffect(() => setPage(0), [q, rows.length, size]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages - 1);
  const slice = filtered.slice(cur * size, cur * size + size);
  const allIds = filtered.map(rowKey);
  const allOn = selectable && allIds.length > 0 && allIds.every((id) => selected?.includes(id));

  return (
    <div className="flex flex-col gap-2 min-w-0">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && <div className="relative w-64 max-w-full"><Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
            <input className="input pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search table" /></div>}
          <div className="flex-1" />
          {toolbar}
        </div>
      )}
      <div className="overflow-auto rounded-lg border border-line max-h-[70vh]">
        <table className="tbl w-full border-collapse">
          <thead><tr>
            {selectable && <th className="w-8"><input type="checkbox" aria-label="Select all" checked={!!allOn} onChange={() => onSelect?.(allOn ? [] : allIds)} /></th>}
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
                {c.sortable === false ? c.header : (
                  <button className="inline-flex items-center gap-1 hover:text-ink uppercase" onClick={() => setSort((s) => s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' })}>
                    {c.header}{sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-40" />}
                  </button>
                )}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {slice.map((r) => {
              const id = rowKey(r);
              return <tr key={id} className={cls(onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(r)}>
                {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${id}`} checked={!!selected?.includes(id)} onChange={() => onSelect?.(selected?.includes(id) ? selected.filter((x) => x !== id) : [...(selected ?? []), id])} /></td>}
                {columns.map((c) => <td key={c.key} className={dense ? '!py-1.5' : ''} style={{ textAlign: c.align }}>{c.render ? c.render(r) : String(val(c, r) ?? '—')}</td>)}
              </tr>;
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty title="No matching records" text={emptyText ?? 'Adjust the filters or search term.'} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{filtered.length === 0 ? '0 records' : `${cur * size + 1}–${Math.min(filtered.length, cur * size + size)} of ${filtered.length} records`}{selectable && selected?.length ? ` · ${selected.length} selected` : ''}</span>
        <div className="flex items-center gap-2">
          <select className="input !w-auto !py-0.5 text-xs" value={size} onChange={(e) => setSize(+e.target.value)} aria-label="Rows per page">
            {[10, 15, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button className="btn-ghost !px-2 !py-1" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
          <span>Page {cur + 1} / {pages}</span>
          <button className="btn-ghost !px-2 !py-1" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmButton({ onConfirm, children, className = 'btn-danger', disabled, message = 'Are you sure? This cannot be undone.' }: { onConfirm: () => void; children: ReactNode; className?: string; disabled?: boolean; message?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className={className} disabled={disabled} onClick={() => setOpen(true)}>{children}</button>
    <Modal open={open} onClose={() => setOpen(false)} title="Please confirm" footer={<>
      <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      <button className="btn-danger" onClick={() => { setOpen(false); onConfirm(); }}>Confirm</button></>}>
      <p className="text-sm">{message}</p>
    </Modal>
  </>;
}
