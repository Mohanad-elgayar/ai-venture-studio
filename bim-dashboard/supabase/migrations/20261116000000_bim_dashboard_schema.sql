-- =====================================================================================
-- BIM Coordination Center — Supabase schema
-- Column names are the snake_case form of the TypeScript fields in src/types.ts
-- (the app maps camelCase <-> snake_case automatically in src/data/repository.ts).
-- Run with: supabase db push   (or paste into the Supabase SQL editor)
-- =====================================================================================

-- ---------------------------------------------------------------- reference tables
create table if not exists public.disciplines (
  code text primary key check (code in ('ARC','STR','MEC','ELE','PLB','FF','HVAC','INF','LND','CIV')),
  name text not null,
  color text not null default '#64748b',
  "order" int not null default 0
);
insert into public.disciplines (code, name, color, "order") values
  ('ARC','Architectural','#60a5fa',0),('STR','Structural','#a78bfa',1),('MEC','Mechanical','#f472b6',2),
  ('ELE','Electrical','#fbbf24',3),('PLB','Plumbing','#34d399',4),('FF','Fire Fighting','#f87171',5),
  ('HVAC','HVAC','#22d3ee',6),('INF','Infrastructure','#94a3b8',7),('LND','Landscape','#86efac',8),('CIV','Civil','#fb923c',9)
on conflict (code) do nothing;

create table if not exists public.companies (
  id text primary key,
  name text not null,
  short_name text not null,
  role text not null check (role in ('Client','PMC','Lead Consultant','Design Consultant','Main Contractor','Subcontractor','BIM Management')),
  disciplines text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users: one profile per Supabase auth user (id = auth.users.id as text)
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  email text not null default '',
  role text not null default 'Viewer' check (role in ('Admin','BIM Manager','BIM Coordinator','Discipline Lead','Viewer')),
  company_id text references public.companies(id) on delete set null,
  discipline text references public.disciplines(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_has_discipline check (role <> 'Discipline Lead' or discipline is not null)
);

create table if not exists public.projects (
  id text primary key,
  code text not null unique,
  name text not null,
  client text not null default '',
  location text not null default '',
  stage text not null default '',
  is_demo boolean not null default false,
  buildings jsonb not null default '[]'::jsonb,   -- [{code,name,zones[],levels[]}]
  packages text[] not null default '{}',
  start_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reporting_periods (
  project_id text not null references public.projects(id) on delete cascade,
  id text not null,
  label text not null,
  type text not null check (type in ('Weekly','Monthly')),
  start date not null,
  "end" date not null,
  primary key (project_id, id),
  check ("end" >= start)
);

-- ---------------------------------------------------------------- models
create table if not exists public.bim_models (
  project_id text not null references public.projects(id) on delete cascade,
  id text not null,
  name text not null,
  discipline text not null references public.disciplines(code),
  building text not null,
  company_id text references public.companies(id),
  revision text not null default 'P01',
  status text not null check (status in ('Received','Under Review','Approved','Rejected','Pending Update')),
  last_upload date not null,
  target_lod text not null default 'LOD 350',
  current_lod text not null default 'LOD 100',
  development_progress numeric not null default 0 check (development_progress between 0 and 100),
  federated boolean not null default false,
  size_mb numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, id),
  unique (project_id, name)
);

create table if not exists public.model_submissions (
  project_id text not null,
  id text not null,
  model_id text not null,
  revision text not null,
  submitted_date date not null,
  reviewed_date date,
  status text not null check (status in ('Received','Under Review','Approved','Rejected','Pending Update')),
  progress_reported numeric not null default 0 check (progress_reported between 0 and 100),
  comments text not null default '',
  submitted_by text references public.companies(id),
  primary key (project_id, id),
  foreign key (project_id, model_id) references public.bim_models(project_id, id) on delete cascade,
  check (reviewed_date is null or reviewed_date >= submitted_date)
);

-- ---------------------------------------------------------------- clashes
create table if not exists public.clash_records (
  project_id text not null references public.projects(id) on delete cascade,
  id text not null,                                   -- Clash ID, unique per project (prevents duplicates)
  description text not null,
  type text not null check (type in ('Hard','Soft','Clearance')),
  discipline_a text not null references public.disciplines(code),
  discipline_b text not null references public.disciplines(code),
  building text not null,
  zone text not null default '',
  level text not null,
  package text not null default '',
  grid_ref text not null default '',
  model_ref text not null default '',
  position text not null default '',
  severity text not null check (severity in ('Critical','High','Medium','Low')),
  priority text not null check (priority in ('P1','P2','P3','P4')),
  status text not null check (status in ('New','Active','Assigned','In Progress','Pending Review','Resolved','Closed','Reopened')),
  assigned_to text references public.profiles(id) on delete set null,
  assigned_discipline text not null references public.disciplines(code),
  responsible_company_id text references public.companies(id) on delete set null,
  date_identified date not null,
  due_date date not null,
  date_resolved date,
  resolution_notes text not null default '',
  clash_group text,
  occurrences int not null default 1 check (occurrences >= 1),
  test_name text,
  source text not null default 'Manual' check (source in ('Manual','Demo','Import','Navisworks')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, id),
  check (due_date >= date_identified),
  check (date_resolved is null or date_resolved >= date_identified),
  check ((status in ('Resolved','Closed')) = (date_resolved is not null))
);
create index if not exists clash_records_pair_idx on public.clash_records (project_id, discipline_a, discipline_b);
create index if not exists clash_records_status_idx on public.clash_records (project_id, status, due_date);
create index if not exists clash_records_location_idx on public.clash_records (project_id, building, zone, level);

create table if not exists public.clash_history (
  project_id text not null,
  id text not null,
  clash_id text not null,
  timestamp timestamptz not null default now(),
  user_id text,
  action text not null check (action in ('Created','Updated','Status Change','Assigned','Comment','Imported')),
  field text, "from" text, "to" text, comment text,
  primary key (project_id, id),
  foreign key (project_id, clash_id) references public.clash_records(project_id, id) on delete cascade
);
create index if not exists clash_history_clash_idx on public.clash_history (project_id, clash_id, timestamp desc);

-- ---------------------------------------------------------------- registers
create table if not exists public.bim_deliverables (
  project_id text not null references public.projects(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('Pre-Contract BEP','Post-Contract BEP','BEP','MIDP','TIDP','Model Delivery','Coordination Report','Clash Report','4D Simulation','COBie / Asset Information','As-Built Model','O&M Documentation')),
  discipline text not null check (discipline in ('ALL','ARC','STR','MEC','ELE','PLB','FF','HVAC','INF','LND','CIV')),
  responsible_company_id text references public.companies(id),
  planned_date date not null,
  actual_date date,
  revision text not null default 'P01',
  status text not null check (status in ('Not Started','In Progress','Submitted','Resubmitted','Overdue')),
  approval_status text not null default 'Pending' check (approval_status in ('Pending','Approved','Approved with Comments','Rejected','N/A')),
  reviewed_date date,
  review_comments text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, id),
  check (approval_status in ('Pending','N/A') or actual_date is not null),
  check (reviewed_date is null or actual_date is null or reviewed_date >= actual_date)
);

create table if not exists public.coordination_issues (
  project_id text not null references public.projects(id) on delete cascade,
  id text not null,
  title text not null,
  type text not null check (type in ('Design Coordination','Missing Information','Consultant Comment','RFI','Design Dependency')),
  discipline text not null references public.disciplines(code),
  building text not null default '',
  priority text not null check (priority in ('Critical','High','Medium','Low')),
  status text not null check (status in ('Open','In Progress','Awaiting Response','Closed')),
  raised_by text references public.companies(id),
  owner_company_id text references public.companies(id),
  raised_date date not null,
  due_date date not null,
  closed_date date,
  linked_clash_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, id),
  check (due_date >= raised_date)
);

create table if not exists public.risk_register (
  project_id text not null references public.projects(id) on delete cascade,
  id text not null,
  title text not null,
  category text not null check (category in ('Coordination','Repeated Clashes','Model Submission','Information Quality','Design Dependency','Consultant Comments')),
  description text not null default '',
  likelihood int not null check (likelihood between 1 and 5),
  impact int not null check (impact between 1 and 5),
  owner_company_id text references public.companies(id),
  mitigation text not null,
  target_date date not null,
  status text not null check (status in ('Open','Mitigating','Closed')),
  raised_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, id)
);

create table if not exists public.compliance_checks (
  project_id text not null references public.projects(id) on delete cascade,
  id text not null,
  category text not null check (category in ('ISO 19650','BEP Compliance','Naming Convention','Model Federation','Information Quality','LOD / LOI','Shared Coordinates','Model Audit','IFC Export','Model Health')),
  check_name text not null,
  model_id text,
  discipline text not null,
  result text not null check (result in ('Pass','Fail','Observation')),
  checked_date date not null,
  checked_by text references public.profiles(id) on delete set null,
  evidence text not null check (length(evidence) > 0),    -- compliance is never recorded without evidence
  observation text not null default '',
  observation_closed boolean not null default false,
  primary key (project_id, id)
);

-- ---------------------------------------------------------------- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['companies','profiles','projects','bim_models','clash_records','bim_deliverables','coordination_issues','risk_register'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s; create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- role helpers
create or replace function public.app_role() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()::text
$$;
create or replace function public.app_discipline() returns text language sql stable security definer set search_path = public as $$
  select discipline from public.profiles where id = auth.uid()::text
$$;
create or replace function public.is_manager() returns boolean language sql stable as $$ select public.app_role() in ('Admin','BIM Manager') $$;
create or replace function public.is_editor() returns boolean language sql stable as $$ select public.app_role() in ('Admin','BIM Manager','BIM Coordinator') $$;

-- Discipline Leads may only change status / resolution fields on clashes assigned to them or their discipline
create or replace function public.enforce_lead_clash_edit() returns trigger language plpgsql as $$
begin
  if public.app_role() = 'Discipline Lead' then
    if (to_jsonb(new) - array['status','resolution_notes','date_resolved','updated_at'])
       is distinct from (to_jsonb(old) - array['status','resolution_notes','date_resolved','updated_at']) then
      raise exception 'Discipline Leads may only update status and resolution notes';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists lead_clash_edit on public.clash_records;
create trigger lead_clash_edit before update on public.clash_records for each row execute function public.enforce_lead_clash_edit();

-- ---------------------------------------------------------------- Row Level Security
alter table public.disciplines enable row level security;
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.reporting_periods enable row level security;
alter table public.bim_models enable row level security;
alter table public.model_submissions enable row level security;
alter table public.clash_records enable row level security;
alter table public.clash_history enable row level security;
alter table public.bim_deliverables enable row level security;
alter table public.coordination_issues enable row level security;
alter table public.risk_register enable row level security;
alter table public.compliance_checks enable row level security;

-- Read: any signed-in user with a profile (single-organisation deployment)
do $$ declare t text; begin
  foreach t in array array['disciplines','companies','profiles','projects','reporting_periods','bim_models','model_submissions','clash_records','clash_history','bim_deliverables','coordination_issues','risk_register','compliance_checks'] loop
    execute format('drop policy if exists read_%1$s on public.%1$s; create policy read_%1$s on public.%1$s for select to authenticated using (public.app_role() is not null);', t);
  end loop;
end $$;

-- Project setup, companies, users, periods: Admin / BIM Manager
do $$ declare t text; begin
  foreach t in array array['companies','profiles','projects','reporting_periods'] loop
    execute format('drop policy if exists write_%1$s on public.%1$s; create policy write_%1$s on public.%1$s for all to authenticated using (public.is_manager()) with check (public.is_manager());', t);
  end loop;
end $$;

-- Registers: create/update by editors, delete by managers
do $$ declare t text; begin
  foreach t in array array['bim_models','model_submissions','bim_deliverables','coordination_issues','risk_register','compliance_checks'] loop
    execute format('drop policy if exists ins_%1$s on public.%1$s; create policy ins_%1$s on public.%1$s for insert to authenticated with check (public.is_editor());', t);
    execute format('drop policy if exists upd_%1$s on public.%1$s; create policy upd_%1$s on public.%1$s for update to authenticated using (public.is_editor()) with check (public.is_editor());', t);
    execute format('drop policy if exists del_%1$s on public.%1$s; create policy del_%1$s on public.%1$s for delete to authenticated using (public.is_manager());', t);
  end loop;
end $$;

-- Clashes
drop policy if exists ins_clash on public.clash_records;
create policy ins_clash on public.clash_records for insert to authenticated with check (public.is_editor());
drop policy if exists upd_clash on public.clash_records;
create policy upd_clash on public.clash_records for update to authenticated
  using (public.is_editor() or (public.app_role() = 'Discipline Lead' and (assigned_to = auth.uid()::text or assigned_discipline = public.app_discipline())))
  with check (public.is_editor() or (public.app_role() = 'Discipline Lead' and (assigned_to = auth.uid()::text or assigned_discipline = public.app_discipline())));
drop policy if exists del_clash on public.clash_records;
create policy del_clash on public.clash_records for delete to authenticated using (public.is_manager());

-- Clash history: append-only audit trail (anyone who can edit clashes may append; only managers delete)
drop policy if exists ins_hist on public.clash_history;
create policy ins_hist on public.clash_history for insert to authenticated
  with check (public.app_role() in ('Admin','BIM Manager','BIM Coordinator','Discipline Lead') and user_id = auth.uid()::text);
drop policy if exists del_hist on public.clash_history;
create policy del_hist on public.clash_history for delete to authenticated using (public.is_manager());

-- New auth users get a Viewer profile automatically
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role) values (new.id::text, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, 'Viewer')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
