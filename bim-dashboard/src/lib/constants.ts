import type {
  ClashStatus, ClashType, Discipline, DisciplineCode, Severity, Priority, ModelStatus,
  DeliverableStatus, ApprovalStatus, IssueStatus, IssueType, RiskCategory, ComplianceCategory, DeliverableType, UserRole,
} from '../types';

export const DISCIPLINES: Discipline[] = [
  { code: 'ARC', name: 'Architectural', color: '#60a5fa', order: 0 },
  { code: 'STR', name: 'Structural', color: '#a78bfa', order: 1 },
  { code: 'MEC', name: 'Mechanical', color: '#f472b6', order: 2 },
  { code: 'ELE', name: 'Electrical', color: '#fbbf24', order: 3 },
  { code: 'PLB', name: 'Plumbing', color: '#34d399', order: 4 },
  { code: 'FF', name: 'Fire Fighting', color: '#f87171', order: 5 },
  { code: 'HVAC', name: 'HVAC', color: '#22d3ee', order: 6 },
  { code: 'INF', name: 'Infrastructure', color: '#94a3b8', order: 7 },
  { code: 'LND', name: 'Landscape', color: '#86efac', order: 8 },
  { code: 'CIV', name: 'Civil', color: '#fb923c', order: 9 },
];
export const DISCIPLINE_CODES = DISCIPLINES.map((d) => d.code) as DisciplineCode[];
export const disciplineName = (c: string) => DISCIPLINES.find((d) => d.code === c)?.name ?? c;
export const disciplineColor = (c: string) => DISCIPLINES.find((d) => d.code === c)?.color ?? '#64748b';

export const CLASH_STATUSES: ClashStatus[] = [
  'New', 'Active', 'Assigned', 'In Progress', 'Pending Review', 'Resolved', 'Closed', 'Reopened',
];
export const CLOSED_STATUSES: ClashStatus[] = ['Resolved', 'Closed'];
export const OPEN_STATUSES = CLASH_STATUSES.filter((s) => !CLOSED_STATUSES.includes(s));
export const CLASH_TYPES: ClashType[] = ['Hard', 'Soft', 'Clearance'];
export const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low'];
export const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];
export const SEVERITY_WEIGHT: Record<Severity, number> = { Critical: 8, High: 4, Medium: 2, Low: 1 };
/** Target resolution window in days by severity (used for due-date defaults). */
export const SEVERITY_SLA: Record<Severity, number> = { Critical: 7, High: 14, Medium: 21, Low: 28 };

// Status palette (reserved for state; always shown with a text label, never colour alone)
export const SEVERITY_COLOR: Record<Severity, string> = {
  Critical: '#d03b3b', High: '#ec835a', Medium: '#fab219', Low: '#3987e5',
};
export const GOOD = '#0ca30c';
// Categorical series palette, fixed order (validated light/dark steps)
export const SERIES = {
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
};
// Sequential blue ramp (100 -> 700) for magnitude / heatmap intensity
export const SEQ_BLUE = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
export const STATUS_COLOR: Record<ClashStatus, string> = {
  New: '#38bdf8', Active: '#60a5fa', Assigned: '#818cf8', 'In Progress': '#a78bfa',
  'Pending Review': '#fbbf24', Resolved: '#34d399', Closed: '#10b981', Reopened: '#f87171',
};

export const MODEL_STATUSES: ModelStatus[] = ['Received', 'Under Review', 'Approved', 'Rejected', 'Pending Update'];
export const MODEL_STATUS_COLOR: Record<ModelStatus, string> = {
  Received: '#38bdf8', 'Under Review': '#fbbf24', Approved: '#10b981', Rejected: '#ef4444', 'Pending Update': '#a78bfa',
};
export const DELIVERABLE_TYPES: DeliverableType[] = [
  'Pre-Contract BEP', 'Post-Contract BEP', 'BEP', 'MIDP', 'TIDP', 'Model Delivery', 'Coordination Report',
  'Clash Report', '4D Simulation', 'COBie / Asset Information', 'As-Built Model', 'O&M Documentation',
];
export const DELIVERABLE_STATUSES: DeliverableStatus[] = ['Not Started', 'In Progress', 'Submitted', 'Resubmitted', 'Overdue'];
export const APPROVAL_STATUSES: ApprovalStatus[] = ['Pending', 'Approved', 'Approved with Comments', 'Rejected', 'N/A'];
export const ISSUE_TYPES: IssueType[] = ['Design Coordination', 'Missing Information', 'Consultant Comment', 'RFI', 'Design Dependency'];
export const ISSUE_STATUSES: IssueStatus[] = ['Open', 'In Progress', 'Awaiting Response', 'Closed'];
export const RISK_CATEGORIES: RiskCategory[] = [
  'Coordination', 'Repeated Clashes', 'Model Submission', 'Information Quality', 'Design Dependency', 'Consultant Comments',
];
export const COMPLIANCE_CATEGORIES: ComplianceCategory[] = [
  'ISO 19650', 'BEP Compliance', 'Naming Convention', 'Model Federation', 'Information Quality',
  'LOD / LOI', 'Shared Coordinates', 'Model Audit', 'IFC Export', 'Model Health',
];
export const USER_ROLES: UserRole[] = ['Admin', 'BIM Manager', 'BIM Coordinator', 'Discipline Lead', 'Viewer'];
