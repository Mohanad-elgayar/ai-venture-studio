/**
 * Persistence layer.
 *  - LocalRepository   : default. Stores the dataset in the browser (localStorage). No server required.
 *  - SupabaseRepository: enabled when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set. Reads/writes the
 *                        tables defined in /supabase/migrations; Row Level Security enforces roles server-side.
 */
import type { Dataset } from '../types';
import { DATA_VERSION } from './demo';

export type EntityKey =
  | 'projects' | 'companies' | 'users' | 'periods' | 'models' | 'submissions' | 'clashes' | 'clashHistory'
  | 'deliverables' | 'issues' | 'risks' | 'compliance';

export interface Change { table: EntityKey; upsert?: { id: string }[]; remove?: string[] }

export interface Repository {
  readonly kind: 'local' | 'supabase';
  load(): Promise<Dataset | null>;
  persist(ds: Dataset, changes: Change[]): Promise<void>;
  replaceAll(ds: Dataset): Promise<void>;
}

const KEY = 'bimcc.dataset';

export class LocalRepository implements Repository {
  readonly kind = 'local' as const;
  async load(): Promise<Dataset | null> {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const ds = JSON.parse(raw) as Dataset;
    if (ds.version !== DATA_VERSION) return null; // schema changed -> regenerate
    return ds;
  }
  async persist(ds: Dataset): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(ds));
    } catch (e) {
      throw new Error('Browser storage is full — export your data and clear older records. (' + (e as Error).message + ')');
    }
  }
  async replaceAll(ds: Dataset) { await this.persist(ds); }
}

// ------------------------------------------------------------------ Supabase
export const TABLES: Record<EntityKey, string> = {
  projects: 'projects', companies: 'companies', users: 'profiles', periods: 'reporting_periods', models: 'bim_models',
  submissions: 'model_submissions', clashes: 'clash_records', clashHistory: 'clash_history', deliverables: 'bim_deliverables',
  issues: 'coordination_issues', risks: 'risk_register', compliance: 'compliance_checks',
};
/** Tables keyed by (project_id, id); the others use a global id. */
const PROJECT_SCOPED: EntityKey[] = ['periods', 'models', 'submissions', 'clashes', 'clashHistory', 'deliverables', 'issues', 'risks', 'compliance'];

const snake = (s: string) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export function toRow(obj: Record<string, unknown>, projectId?: string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[snake(k)] = v === undefined ? null : v;
  if (projectId && !('project_id' in out)) out.project_id = projectId;
  return out;
}
export function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null && k !== 'created_at' && k !== 'updated_at') out[camel(k)] = v;
  return out as T;
}

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public readonly client: any, private base: () => Dataset) {}

  async load(): Promise<Dataset | null> {
    const ds = this.base();
    const out: Dataset = { ...ds, isDemo: false };
    for (const key of Object.keys(TABLES) as EntityKey[]) {
      const { data, error } = await this.client.from(TABLES[key]).select('*');
      if (error) throw new Error(`Supabase: failed to load ${TABLES[key]} — ${error.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[key] = (data ?? []).map((r: Record<string, unknown>) => fromRow(r));
    }
    if (!out.projects.length) return null;
    out.isDemo = out.projects.every((p) => p.isDemo);
    return out;
  }
  async persist(ds: Dataset, changes: Change[]): Promise<void> {
    const projectId = ds.projects[0]?.id;
    for (const ch of changes) {
      const table = TABLES[ch.table];
      const scoped = PROJECT_SCOPED.includes(ch.table);
      if (ch.upsert?.length) {
        const rows = ch.upsert.map((r) => toRow(r as unknown as Record<string, unknown>, scoped ? projectId : undefined));
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await this.client.from(table).upsert(rows.slice(i, i + 500), { onConflict: scoped ? 'project_id,id' : 'id' });
          if (error) throw new Error(`Supabase: save to ${table} failed — ${error.message}`);
        }
      }
      if (ch.remove?.length) {
        let q = this.client.from(table).delete().in('id', ch.remove);
        if (scoped) q = q.eq('project_id', projectId);
        const { error } = await q;
        if (error) throw new Error(`Supabase: delete from ${table} failed — ${error.message}`);
      }
    }
  }
  async replaceAll(ds: Dataset): Promise<void> {
    const order: EntityKey[] = ['projects', 'companies', 'users', 'periods', 'models', 'submissions', 'clashes', 'clashHistory', 'deliverables', 'issues', 'risks', 'compliance'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.persist(ds, order.map((t) => ({ table: t, upsert: (ds as any)[t] })));
  }
}

export async function createRepository(base: () => Dataset): Promise<Repository> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) {
    const { createClient } = await import('@supabase/supabase-js');
    return new SupabaseRepository(createClient(url, key), base);
  }
  return new LocalRepository();
}
