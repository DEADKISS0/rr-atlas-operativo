-- RR Atlas 4.0 generic data foundation.
-- Staging-only migration draft. Do not apply to production until the workspace,
-- roles, Drive scopes and retention decisions are approved.

create extension if not exists pgcrypto;

create table if not exists public.atlas_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  name text not null check (length(trim(name)) between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_memberships (
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'commenter', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.atlas_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  entity_type text not null check (length(trim(entity_type)) between 1 and 100),
  title text not null check (length(trim(title)) between 1 and 1000),
  description text not null default '',
  attributes jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atlas_entities_workspace_idx
  on public.atlas_entities(workspace_id, archived_at);

create table if not exists public.atlas_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  source_entity_id uuid not null references public.atlas_entities(id) on delete cascade,
  target_entity_id uuid not null references public.atlas_entities(id) on delete cascade,
  relation_type text not null check (length(trim(relation_type)) between 1 and 100),
  attributes jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, source_entity_id, target_entity_id, relation_type),
  check (source_entity_id <> target_entity_id)
);

create index if not exists atlas_relations_workspace_idx
  on public.atlas_relations(workspace_id);

create table if not exists public.atlas_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  view_type text not null default 'map' check (view_type in ('map', 'org', 'clients', 'processes', 'projects')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atlas_view_nodes (
  view_id uuid not null references public.atlas_views(id) on delete cascade,
  entity_id uuid not null references public.atlas_entities(id) on delete cascade,
  x numeric not null default 0,
  y numeric not null default 0,
  scale numeric not null default 1 check (scale > 0 and scale <= 10),
  visible boolean not null default true,
  style jsonb not null default '{}'::jsonb,
  primary key (view_id, entity_id)
);

create table if not exists public.atlas_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  entity_id uuid not null references public.atlas_entities(id) on delete cascade,
  drive_file_id text not null check (length(trim(drive_file_id)) between 1 and 500),
  name text not null check (length(trim(name)) between 1 and 500),
  mime_type text,
  web_url text not null check (web_url ~ '^https://(drive|docs)\\.google\\.com(/|$)'),
  drive_modified_at timestamptz,
  permission_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_id, drive_file_id)
);

create index if not exists atlas_documents_workspace_idx
  on public.atlas_documents(workspace_id, entity_id);

create table if not exists public.atlas_audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.atlas_workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(trim(action)) between 1 and 100),
  resource_type text not null check (length(trim(resource_type)) between 1 and 100),
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists atlas_audit_workspace_time_idx
  on public.atlas_audit_events(workspace_id, created_at desc);

create or replace function public.atlas_is_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.atlas_memberships
    where workspace_id = target_workspace
      and user_id = auth.uid()
  );
$$;

create or replace function public.atlas_can_edit(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.atlas_memberships
    where workspace_id = target_workspace
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.atlas_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

 drop trigger if exists atlas_workspaces_touch on public.atlas_workspaces;
create trigger atlas_workspaces_touch
before update on public.atlas_workspaces
for each row execute function public.atlas_touch_updated_at();

drop trigger if exists atlas_entities_touch on public.atlas_entities;
create trigger atlas_entities_touch
before update on public.atlas_entities
for each row execute function public.atlas_touch_updated_at();

drop trigger if exists atlas_views_touch on public.atlas_views;
create trigger atlas_views_touch
before update on public.atlas_views
for each row execute function public.atlas_touch_updated_at();

alter table public.atlas_workspaces enable row level security;
alter table public.atlas_memberships enable row level security;
alter table public.atlas_entities enable row level security;
alter table public.atlas_relations enable row level security;
alter table public.atlas_views enable row level security;
alter table public.atlas_view_nodes enable row level security;
alter table public.atlas_documents enable row level security;
alter table public.atlas_audit_events enable row level security;

-- Membership is readable only by members of the same workspace.
drop policy if exists atlas_memberships_select on public.atlas_memberships;
create policy atlas_memberships_select on public.atlas_memberships
for select using (public.atlas_is_member(workspace_id));

-- Workspace metadata is readable by members; creation and membership management
-- are intentionally left to the server-side onboarding flow.
drop policy if exists atlas_workspaces_select on public.atlas_workspaces;
create policy atlas_workspaces_select on public.atlas_workspaces
for select using (public.atlas_is_member(id));

drop policy if exists atlas_entities_select on public.atlas_entities;
create policy atlas_entities_select on public.atlas_entities
for select using (public.atlas_is_member(workspace_id));

drop policy if exists atlas_entities_write on public.atlas_entities;
create policy atlas_entities_write on public.atlas_entities
for all using (public.atlas_can_edit(workspace_id))
with check (public.atlas_can_edit(workspace_id));

drop policy if exists atlas_relations_select on public.atlas_relations;
create policy atlas_relations_select on public.atlas_relations
for select using (public.atlas_is_member(workspace_id));

drop policy if exists atlas_relations_write on public.atlas_relations;
create policy atlas_relations_write on public.atlas_relations
for all using (public.atlas_can_edit(workspace_id))
with check (public.atlas_can_edit(workspace_id));

drop policy if exists atlas_views_select on public.atlas_views;
create policy atlas_views_select on public.atlas_views
for select using (public.atlas_is_member(workspace_id));

drop policy if exists atlas_views_write on public.atlas_views;
create policy atlas_views_write on public.atlas_views
for all using (public.atlas_can_edit(workspace_id))
with check (public.atlas_can_edit(workspace_id));

drop policy if exists atlas_view_nodes_select on public.atlas_view_nodes;
create policy atlas_view_nodes_select on public.atlas_view_nodes
for select using (
  exists (
    select 1 from public.atlas_views v
    where v.id = view_id and public.atlas_is_member(v.workspace_id)
  )
);

drop policy if exists atlas_view_nodes_write on public.atlas_view_nodes;
create policy atlas_view_nodes_write on public.atlas_view_nodes
for all using (
  exists (
    select 1 from public.atlas_views v
    where v.id = view_id and public.atlas_can_edit(v.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.atlas_views v
    where v.id = view_id and public.atlas_can_edit(v.workspace_id)
  )
);

drop policy if exists atlas_documents_select on public.atlas_documents;
create policy atlas_documents_select on public.atlas_documents
for select using (public.atlas_is_member(workspace_id));

drop policy if exists atlas_documents_write on public.atlas_documents;
create policy atlas_documents_write on public.atlas_documents
for all using (public.atlas_can_edit(workspace_id))
with check (public.atlas_can_edit(workspace_id));

drop policy if exists atlas_audit_select on public.atlas_audit_events;
create policy atlas_audit_select on public.atlas_audit_events
for select using (public.atlas_is_member(workspace_id));

comment on table public.atlas_documents is 'Drive references only; OAuth, ACL checks and token storage stay server-side.';
comment on table public.atlas_audit_events is 'Append-only application audit trail; inserts should use trusted server paths.';
