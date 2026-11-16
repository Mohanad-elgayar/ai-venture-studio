// Core domain model for the BIM Coordination Center.
// Mirrors the Supabase schema in /supabase/migrations (snake_case there, camelCase here).

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

export type DisciplineCode =
  | 'ARC' | 'STR' | 'MEC' | 'ELE' | 'PLB' | 'FF' | 'HVAC' | 'INF' | 'LND' | 'CIV';

export interface Discipline {
  code: DisciplineCode;
  name: string;
  color: string;
  order: number;
}

export type CompanyRole =
  | 'Client' | 'PMC' | 'Lead Consultant' | 'Design Consultant' | 'Main Contractor' | 'Subcontractor' | 'BIM Management';

export interface Company {
  id: string;
  name: string;
  shortName: string;
  role: CompanyRole;
  disciplines: DisciplineCode[];
}

export type UserRole = 'Admin' | 'BIM Manager' | 'BIM Coordinator' | 'Discipline Lead' | 'Viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  discipline?: DisciplineCode;
}

export interface Building {
  code: string;
  name: string;
  zones: string[];
  levels: string[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  location: string;
  stage: string;
  isDemo: boolean;
  buildings: Building[];
  packages: string[];
  startDate: ISODate;
}

export interface ReportingPeriod {
  id: string;
  projectId: string;
  label: string;
  type: 'Weekly' | 'Monthly';
  start: ISODate;
  end: ISODate;
}

export type ModelStatus = 'Received' | 'Under Review' | 'Approved' | 'Rejected' | 'Pending Update';

export interface BimModel {
  id: string;
  projectId: string;
  name: string; // file name, ISO 19650 naming
  discipline: DisciplineCode;
  building: string;
  companyId: string;
  revision: string;
  status: ModelStatus;
  lastUpload: ISODate;
  targetLod: string;
  currentLod: string;
  developmentProgress: number; // 0-100 as last reported by author
  federated: boolean;
  sizeMb: number;
}

export interface ModelSubmission {
  id: string;
  modelId: string;
  revision: string;
  submittedDate: ISODate;
  reviewedDate?: ISODate;
  status: ModelStatus;
  progressReported: number;
  comments: string;
  submittedBy: string;
}

export type ClashType = 'Hard' | 'Soft' | 'Clearance';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type ClashStatus =
  | 'New' | 'Active' | 'Assigned' | 'In Progress' | 'Pending Review' | 'Resolved' | 'Closed' | 'Reopened';

export interface Clash {
  id: string; // Clash ID (unique within project)
  projectId: string;
  description: string;
  type: ClashType;
  disciplineA: DisciplineCode;
  disciplineB: DisciplineCode;
  building: string;
  zone: string;
  level: string;
  package: string;
  gridRef: string;
  modelRef: string;
  position: string; // "x, y, z" in project coordinates
  severity: Severity;
  priority: Priority;
  status: ClashStatus;
  assignedTo: string; // user id
  assignedDiscipline: DisciplineCode;
  responsibleCompanyId: string;
  dateIdentified: ISODate;
  dueDate: ISODate;
  dateResolved?: ISODate;
  resolutionNotes: string;
  clashGroup?: string; // repeated clash grouping key
  occurrences: number; // number of detection runs in which it reappeared
  testName?: string;
  source: 'Manual' | 'Demo' | 'Import' | 'Navisworks';
}

export interface ClashHistory {
  id: string;
  clashId: string;
  timestamp: ISODateTime;
  userId: string;
  action: 'Created' | 'Updated' | 'Status Change' | 'Assigned' | 'Comment' | 'Imported';
  field?: string;
  from?: string;
  to?: string;
  comment?: string;
}

export type DeliverableType =
  | 'Pre-Contract BEP' | 'Post-Contract BEP' | 'BEP' | 'MIDP' | 'TIDP' | 'Model Delivery'
  | 'Coordination Report' | 'Clash Report' | '4D Simulation' | 'COBie / Asset Information'
  | 'As-Built Model' | 'O&M Documentation';

export type DeliverableStatus = 'Not Started' | 'In Progress' | 'Submitted' | 'Resubmitted' | 'Overdue';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Approved with Comments' | 'Rejected' | 'N/A';

export interface Deliverable {
  id: string;
  projectId: string;
  name: string;
  type: DeliverableType;
  discipline: DisciplineCode | 'ALL';
  responsibleCompanyId: string;
  plannedDate: ISODate;
  actualDate?: ISODate;
  revision: string;
  status: DeliverableStatus;
  approvalStatus: ApprovalStatus;
  reviewedDate?: ISODate;
  reviewComments: string;
}

export type IssueType =
  | 'Design Coordination' | 'Missing Information' | 'Consultant Comment' | 'RFI' | 'Design Dependency';
export type IssueStatus = 'Open' | 'In Progress' | 'Awaiting Response' | 'Closed';

export interface CoordinationIssue {
  id: string;
  projectId: string;
  title: string;
  type: IssueType;
  discipline: DisciplineCode;
  building: string;
  priority: Severity;
  status: IssueStatus;
  raisedBy: string; // company id
  ownerCompanyId: string;
  raisedDate: ISODate;
  dueDate: ISODate;
  closedDate?: ISODate;
  linkedClashIds: string[];
}

export type RiskCategory =
  | 'Coordination' | 'Repeated Clashes' | 'Model Submission' | 'Information Quality' | 'Design Dependency' | 'Consultant Comments';
export type RiskStatus = 'Open' | 'Mitigating' | 'Closed';

export interface Risk {
  id: string;
  projectId: string;
  title: string;
  category: RiskCategory;
  description: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  ownerCompanyId: string;
  mitigation: string;
  targetDate: ISODate;
  status: RiskStatus;
  raisedDate: ISODate;
}

export type ComplianceCategory =
  | 'ISO 19650' | 'BEP Compliance' | 'Naming Convention' | 'Model Federation' | 'Information Quality'
  | 'LOD / LOI' | 'Shared Coordinates' | 'Model Audit' | 'IFC Export' | 'Model Health';

export type CheckResult = 'Pass' | 'Fail' | 'Observation';

export interface ComplianceCheck {
  id: string;
  projectId: string;
  category: ComplianceCategory;
  checkName: string;
  modelId?: string;
  discipline: DisciplineCode | 'ALL';
  result: CheckResult;
  checkedDate: ISODate;
  checkedBy: string; // user id
  evidence: string; // reference to audit report / tool output
  observation: string;
  observationClosed: boolean;
}

export interface Dataset {
  version: number;
  isDemo: boolean;
  generatedAt: ISODateTime;
  projects: Project[];
  disciplines: Discipline[];
  companies: Company[];
  users: User[];
  periods: ReportingPeriod[];
  models: BimModel[];
  submissions: ModelSubmission[];
  clashes: Clash[];
  clashHistory: ClashHistory[];
  deliverables: Deliverable[];
  issues: CoordinationIssue[];
  risks: Risk[];
  compliance: ComplianceCheck[];
}

export interface GlobalFilters {
  projectId: string;
  periodId: string; // reporting period -> as-of date is the period end
  disciplines: DisciplineCode[]; // empty = all
  buildings: string[];
  zones: string[];
  levels: string[];
  packages: string[];
}
