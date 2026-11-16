import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Grid3x3, ListChecks, Boxes, FileCheck2, ShieldCheck, TrendingUp, AlertTriangle, FileBarChart,
  Upload, Settings, ChevronsLeft, ChevronsRight, Sun, Moon, Hexagon, FlaskConical, CheckCircle2, XCircle, Info,
} from 'lucide-react';
import { useStore } from '../../data/store';
import { cls } from '../../lib/format';
import { FilterBar } from './FilterBar';
import { fmtDate } from '../../lib/dates';

const NAV = [
  { to: '/', label: 'Executive Overview', icon: LayoutDashboard, end: true },
  { to: '/matrix', label: 'Clash Matrix', icon: Grid3x3 },
  { to: '/clashes', label: 'Clash Management', icon: ListChecks },
  { to: '/models', label: 'Model Coordination', icon: Boxes },
  { to: '/deliverables', label: 'BIM Deliverables', icon: FileCheck2 },
  { to: '/compliance', label: 'Compliance & Quality', icon: ShieldCheck },
  { to: '/progress', label: 'Progress & Performance', icon: TrendingUp },
  { to: '/risks', label: 'Risks & Issues', icon: AlertTriangle },
  { sep: true, label: 'Reporting & data' },
  { to: '/reports', label: 'Reports & Export', icon: FileBarChart },
  { to: '/import', label: 'Data Import', icon: Upload },
  { to: '/admin', label: 'Project & Access', icon: Settings },
] as const;

const TITLES: Record<string, string> = {
  '/': 'Executive BIM Overview', '/matrix': 'Clash Matrix', '/clashes': 'Clash Management', '/models': 'Model Coordination',
  '/deliverables': 'BIM Deliverables Tracker', '/compliance': 'BIM Compliance & Quality', '/progress': 'BIM Progress & Performance',
  '/risks': 'Risk & Issue Dashboard', '/reports': 'Reports & Export', '/import': 'Data Import', '/admin': 'Project & Access',
};

export function Shell() {
  const { ds, filters, setFilters, period, periods, scope, user, setUserId, theme, toggleTheme, toasts, repoKind, signOut } = useStore();
  const [collapsed, setCollapsed] = useState(() => { let pref: string | null = null; try { pref = localStorage.getItem('bimcc.nav'); } catch { /* storage unavailable */ } return pref ? pref === '1' : window.innerWidth < 1200; });
  const loc = useLocation();
  const project = ds.projects.find((p) => p.id === filters.projectId);
  const toggle = () => { setCollapsed((c) => { try { localStorage.setItem('bimcc.nav', c ? '0' : '1'); } catch { /* storage unavailable */ } return !c; }); };

  return (
    <div className="flex h-full">
      <aside className={cls('no-print shrink-0 border-r border-line bg-surface flex flex-col transition-all duration-200', collapsed ? 'w-[64px]' : 'w-[248px]')}>
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-line">
          <Hexagon className="text-accent2 shrink-0" size={24} />
          {!collapsed && <div className="leading-tight min-w-0"><div className="font-semibold text-sm">BIM Coordination</div><div className="text-[10px] text-muted uppercase tracking-widest">Center</div></div>}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Main">
          {NAV.map((n, i) => 'sep' in n ? (
            collapsed ? <div key={i} className="my-2 border-t border-line" /> : <div key={i} className="label px-3 pt-4 pb-1.5">{n.label}</div>
          ) : (
            <NavLink key={n.to} to={n.to} end={'end' in n} title={n.label}
              className={({ isActive }) => cls('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors', isActive ? 'bg-accent/15 text-ink font-semibold shadow-[inset_3px_0_0_rgb(var(--accent2))]' : 'text-muted hover:text-ink hover:bg-surface2')}>
              <n.icon size={17} className="shrink-0" />{!collapsed && <span className="truncate">{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button onClick={toggle} className="m-2 btn-ghost justify-center" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {ds.isDemo && (
          <div className="no-print demo-stripe border-b border-med/40 text-[12px] px-4 py-1 flex items-center gap-2 text-med flex-wrap">
            <FlaskConical size={13} /><b>DEMO DATA</b><span className="text-ink/80">— fictional project, companies and records generated for demonstration. Figures do not represent actual project performance.</span>
          </div>
        )}
        <header className="no-print min-h-14 shrink-0 border-b border-line bg-surface/80 backdrop-blur flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <div className="min-w-[200px] flex-1">
            <h1 className="font-semibold text-[15px] truncate">{TITLES[loc.pathname] ?? 'BIM Coordination Center'}</h1>
            <div className="text-[11px] text-muted truncate">{project?.name} · {project?.stage || 'Stage not set'}</div>
          </div>
          <label className="hidden md:flex items-center gap-2 text-xs text-muted">Project
            <select className="input !w-auto max-w-[220px]" value={filters.projectId} onChange={(e) => setFilters({ projectId: e.target.value })} aria-label="Project">
              {ds.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">Reporting period
            <select className="input !w-auto max-w-[240px] xl:max-w-[300px]" value={filters.periodId} onChange={(e) => setFilters({ periodId: e.target.value })} aria-label="Reporting period">
              <optgroup label="Live">{periods.filter((p) => p.id === 'live').map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
              <optgroup label="Weekly">{periods.filter((p) => p.type === 'Weekly' && p.id !== 'live').slice().reverse().map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
              <optgroup label="Monthly">{periods.filter((p) => p.type === 'Monthly').slice().reverse().map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
            </select>
          </label>
          {repoKind === 'local' && (
            <label className="hidden lg:flex items-center gap-2 text-xs text-muted" title="Local mode: switch user to preview role-based permissions">Acting as
              <select className="input !w-auto max-w-[220px]" value={user?.id} onChange={(e) => setUserId(e.target.value)} aria-label="Acting as user">
                {ds.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
              </select>
            </label>
          )}
          {repoKind === 'supabase' && <button className="btn-ghost text-xs" onClick={signOut} title={`Signed in as ${user?.name ?? ''} (${user?.role ?? ''})`}>Sign out</button>}
          <button className="btn-ghost !px-2" onClick={toggleTheme} aria-label="Toggle light/dark mode" title="Toggle light/dark mode">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        </header>
        <FilterBar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 xl:p-5 max-w-[1880px] mx-auto">
            <div className="no-print text-[11px] text-muted mb-3">
              Reporting date <b className="text-ink">{fmtDate(scope.asOf)}</b>{period && <> · period {fmtDate(period.start)} – {fmtDate(scope.asOf)}</>} · data source: {repoKind === 'local' ? 'local workspace (browser storage)' : 'Supabase'}
            </div>
            <Outlet />
          </div>
        </main>
      </div>

      <div className="fixed bottom-4 right-4 z-[60] space-y-2 no-print" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cls('card flex items-start gap-2 px-3 py-2.5 text-sm shadow-2xl max-w-sm', t.kind === 'error' && 'border-crit/60', t.kind === 'success' && 'border-ok/60')}>
            {t.kind === 'success' ? <CheckCircle2 size={16} className="text-ok mt-0.5" /> : t.kind === 'error' ? <XCircle size={16} className="text-crit mt-0.5" /> : <Info size={16} className="text-accent mt-0.5" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
