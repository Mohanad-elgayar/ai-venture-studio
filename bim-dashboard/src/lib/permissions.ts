import type { Clash, User, UserRole } from '../types';

export type Action =
  | 'clash.create' | 'clash.edit' | 'clash.delete' | 'register.edit' | 'register.delete'
  | 'import' | 'data.admin' | 'export';

const MATRIX: Record<UserRole, Action[]> = {
  Admin: ['clash.create', 'clash.edit', 'clash.delete', 'register.edit', 'register.delete', 'import', 'data.admin', 'export'],
  'BIM Manager': ['clash.create', 'clash.edit', 'clash.delete', 'register.edit', 'register.delete', 'import', 'data.admin', 'export'],
  'BIM Coordinator': ['clash.create', 'clash.edit', 'register.edit', 'import', 'export'],
  'Discipline Lead': ['clash.edit', 'export'],
  Viewer: ['export'],
};

/** Role-based permission check. Discipline Leads may only edit clashes assigned to them or their discipline. */
export function can(user: User | undefined, action: Action, clash?: Clash): boolean {
  if (!user) return false;
  if (!MATRIX[user.role].includes(action)) return false;
  if (action === 'clash.edit' && user.role === 'Discipline Lead' && clash)
    return clash.assignedTo === user.id || (!!user.discipline && clash.assignedDiscipline === user.discipline);
  return true;
}
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  Admin: 'Full access including data administration',
  'BIM Manager': 'Full access: create, edit, delete, import, reset data',
  'BIM Coordinator': 'Create & edit clashes and registers, import data; cannot delete',
  'Discipline Lead': 'Update status/notes on clashes assigned to own discipline',
  Viewer: 'Read-only dashboards and exports (Client, PMC)',
};
