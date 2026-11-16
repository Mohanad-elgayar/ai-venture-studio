import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Clash, ClashHistory, Dataset, GlobalFilters, ReportingPeriod, User } from '../types';
import { generateDemoDataset, emptyDataset } from './demo';
import { createRepository, SupabaseRepository, type Change, type EntityKey, type Repository } from './repository';
import { scopeFor, type Scope } from '../lib/metrics';
import { can, type Action } from '../lib/permissions';
import { addDays, todayISO } from '../lib/dates';
import { uid } from '../lib/format';

type Theme = 'dark' | 'light';
export interface Toast { id: string; kind: 'success' | 'error' | 'info'; text: string }

interface Store {
  status: 'loading' | 'ready' | 'error' | 'auth';
  error?: string;
  ds: Dataset;
  repoKind: 'local' | 'supabase';
  filters: GlobalFilters;
  setFilters: (p: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  period?: ReportingPeriod;
  periods: ReportingPeriod[]; // includes the virtual "live" period
  scope: Scope;
  user?: User;
  setUserId: (id: string) => void;
  can: (a: Action, clash?: Clash) => boolean;
  theme: Theme;
  toggleTheme: () => void;
  upsert: <K extends EntityKey>(table: K, rows: Dataset[K]) => Promise<boolean>;
  remove: (table: EntityKey, ids: string[]) => Promise<boolean>;
  saveClash: (c: Clash, comment?: string) => Promise<boolean>;
  importClashes: (rows: Clash[], fileName: string) => Promise<boolean>;
  resetDemo: () => Promise<void>;
  startBlank: (name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  toasts: Toast[];
  notify: (kind: Toast['kind'], text: string) => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
};

export const LIVE_PERIOD_ID = 'live';
/** Virtual rolling period (last 7 days to today) so edits made today are reflected immediately. */
export const livePeriod = (projectId: string): ReportingPeriod => {
  const today = todayISO();
  return { id: LIVE_PERIOD_ID, projectId, type: 'Weekly', label: `Live — last 7 days to ${today}`, start: addDays(today, -6), end: today };
};
const defaultFilters = (ds: Dataset): GlobalFilters => {
  const p = ds.projects[0];
  return { projectId: p?.id ?? '', periodId: LIVE_PERIOD_ID, disciplines: [], buildings: [], zones: [], levels: [], packages: [] };
};

const loadPref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const savePref = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const TRACKED: (keyof Clash)[] = ['status', 'severity', 'priority', 'assignedTo', 'responsibleCompanyId', 'dueDate', 'type', 'description', 'assignedDiscipline', 'resolutionNotes'];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ds, setDs] = useState<Dataset>(() => emptyDataset());
  const dsRef = useRef(ds);
  const [status, setStatus] = useState<Store['status']>('loading');
  const [error, setError] = useState<string>();
  const repo = useRef<Repository>();
  const [filters, setFiltersState] = useState<GlobalFilters>(() => defaultFilters(ds));
  const [userId, setUserIdState] = useState<string>(() => loadPref('bimcc.user', 'u-bimm'));
  const [theme, setTheme] = useState<Theme>(() => loadPref('bimcc.theme', 'dark'));
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((kind: Toast['kind'], text: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // ---- load
  const load = useCallback(async () => {
    try {
      setStatus('loading');
      const r = repo.current ?? await createRepository(() => emptyDataset());
      repo.current = r;
      if (r instanceof SupabaseRepository) {
        const { data } = await r.client.auth.getSession();
        if (!data.session) { setStatus('auth'); return; }
        setUserIdState(data.session.user.id);
      }
      let loaded = await r.load();
      if (!loaded) {
        // Local mode starts with the clearly-labelled demo dataset; Supabase starts empty (never seeds demo data silently).
        loaded = r.kind === 'local' ? generateDemoDataset() : emptyDataset();
        try { await r.replaceAll(loaded); } catch (e) { notify('info', `Empty database — an Admin/BIM Manager must initialise the project (${(e as Error).message})`); }
      }
      dsRef.current = loaded;
      setDs(loaded);
      const saved = loadPref<GlobalFilters | null>('bimcc.filters', null);
      const def = defaultFilters(loaded);
      // keep saved dimension filters but always start on the live reporting period
      setFiltersState(saved && saved.projectId === def.projectId ? { ...saved, periodId: LIVE_PERIOD_ID } : def);
      setStatus('ready');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, [notify]);
  useEffect(() => { load(); }, [load]);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = repo.current;
    if (!(r instanceof SupabaseRepository)) return 'Not connected to Supabase';
    const { error: err } = await r.client.auth.signInWithPassword({ email, password });
    if (err) return err.message as string;
    await load();
    return null;
  }, [load]);
  const signOut = useCallback(async () => {
    const r = repo.current;
    if (r instanceof SupabaseRepository) { await r.client.auth.signOut(); setStatus('auth'); }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    savePref('bimcc.theme', theme);
  }, [theme]);
  useEffect(() => { if (status === 'ready') savePref('bimcc.filters', filters); }, [filters, status]);

  // ---- persistence helper: optimistic update, rollback on failure
  const commit = useCallback(async (next: Dataset, changes: Change[], okMsg?: string) => {
    const prev = dsRef.current;
    dsRef.current = next; // update synchronously so sequential writes build on each other
    setDs(next);
    try {
      await repo.current!.persist(next, changes);
      if (okMsg) notify('success', okMsg);
      return true;
    } catch (e) {
      dsRef.current = prev;
      setDs(prev);
      notify('error', (e as Error).message);
      return false;
    }
  }, [notify]);

  const user = ds.users.find((u) => u.id === userId) ?? ds.users[0];
  const canDo = useCallback((a: Action, clash?: Clash) => can(user, a, clash), [user]);

  const upsert = useCallback(async <K extends EntityKey>(table: K, rows: Dataset[K]) => {
    const cur = dsRef.current;
    const list = [...(cur[table] as { id: string }[])];
    for (const r of rows as { id: string }[]) {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r; else list.push(r);
    }
    return commit({ ...cur, [table]: list }, [{ table, upsert: rows as { id: string }[] }], `Saved ${rows.length} record${rows.length === 1 ? '' : 's'}`);
  }, [commit]);

  const remove = useCallback(async (table: EntityKey, ids: string[]) => {
    const cur = dsRef.current;
    const next = { ...cur, [table]: (cur[table] as { id: string }[]).filter((x) => !ids.includes(x.id)) } as Dataset;
    const changes: Change[] = [{ table, remove: ids }];
    if (table === 'clashes') {
      const hist = cur.clashHistory.filter((h) => ids.includes(h.clashId)).map((h) => h.id);
      next.clashHistory = cur.clashHistory.filter((h) => !ids.includes(h.clashId));
      changes.push({ table: 'clashHistory', remove: hist });
    }
    return commit(next, changes, `Deleted ${ids.length} record${ids.length === 1 ? '' : 's'}`);
  }, [commit]);

  /** Create/update a clash and record an audit trail entry for each tracked field change. */
  const saveClash = useCallback(async (c: Clash, comment?: string) => {
    const cur = dsRef.current;
    const prev = cur.clashes.find((x) => x.id === c.id);
    const now = new Date().toISOString();
    const hist: ClashHistory[] = [];
    const h = (x: Partial<ClashHistory> & Pick<ClashHistory, 'action'>) => hist.push({ id: uid('h-'), clashId: c.id, timestamp: now, userId: user?.id ?? '', ...x });
    // keep resolution date consistent with status
    if (['Resolved', 'Closed'].includes(c.status) && !c.dateResolved) c = { ...c, dateResolved: todayISO() };
    if (!['Resolved', 'Closed'].includes(c.status) && c.dateResolved) c = { ...c, dateResolved: undefined };
    if (!prev) h({ action: 'Created', comment: 'Created manually' });
    else for (const f of TRACKED) {
      if (String(prev[f] ?? '') !== String(c[f] ?? ''))
        h({ action: f === 'status' ? 'Status Change' : f === 'assignedTo' ? 'Assigned' : 'Updated', field: f, from: String(prev[f] ?? ''), to: String(c[f] ?? '') });
    }
    if (comment?.trim()) h({ action: 'Comment', comment: comment.trim() });
    const clashes = prev ? cur.clashes.map((x) => (x.id === c.id ? c : x)) : [...cur.clashes, c];
    return commit({ ...cur, clashes, clashHistory: [...cur.clashHistory, ...hist] },
      [{ table: 'clashes', upsert: [c] }, { table: 'clashHistory', upsert: hist }], prev ? `Clash ${c.id} updated` : `Clash ${c.id} created`);
  }, [commit, user]);

  const importClashes = useCallback(async (rows: Clash[], fileName: string) => {
    const cur = dsRef.current;
    const map = new Map(cur.clashes.map((c) => [c.id, c]));
    const now = new Date().toISOString();
    const hist: ClashHistory[] = rows.map((r) => ({ id: uid('h-'), clashId: r.id, timestamp: now, userId: user?.id ?? '', action: 'Imported', comment: `${map.has(r.id) ? 'Updated' : 'Imported'} from ${fileName}` }));
    for (const r of rows) map.set(r.id, r);
    return commit({ ...cur, clashes: [...map.values()], clashHistory: [...cur.clashHistory, ...hist] },
      [{ table: 'clashes', upsert: rows }, { table: 'clashHistory', upsert: hist }], `Imported ${rows.length} clash records`);
  }, [commit, user]);

  const resetDemo = useCallback(async () => {
    const d = generateDemoDataset();
    await repo.current!.replaceAll(d);
    dsRef.current = d;
    setDs(d);
    setFiltersState(defaultFilters(d));
    setUserIdState('u-bimm');
    notify('success', 'Demo dataset restored');
  }, [notify]);

  const startBlank = useCallback(async (name: string) => {
    const d = emptyDataset({ name, code: name.slice(0, 12).toUpperCase().replace(/\s+/g, '-') });
    await repo.current!.replaceAll(d);
    dsRef.current = d;
    setDs(d);
    setFiltersState(defaultFilters(d));
    setUserIdState('u-admin');
    notify('info', 'Started a blank project. Import your clash reports and registers from the Data Import page.');
  }, [notify]);

  const periods = useMemo(() => [livePeriod(filters.projectId), ...ds.periods.filter((p) => p.projectId === filters.projectId)], [ds.periods, filters.projectId]);
  const period = periods.find((p) => p.id === filters.periodId) ?? periods[0];
  const scope = useMemo(() => scopeFor(period), [period]);

  const value: Store = {
    status, error, ds, repoKind: repo.current?.kind ?? 'local', filters,
    setFilters: (p) => setFiltersState((f) => ({ ...f, ...p })),
    resetFilters: () => setFiltersState((f) => ({ ...defaultFilters(dsRef.current), periodId: f.periodId })),
    period, periods, scope, user,
    setUserId: (id) => { setUserIdState(id); savePref('bimcc.user', id); },
    can: canDo, theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    upsert, remove, saveClash, importClashes, resetDemo, startBlank, signIn, signOut, toasts, notify,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
