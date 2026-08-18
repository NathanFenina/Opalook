-- Opalook — schéma initial : moulinette d'optimisation de catégories e-commerce.
create extension if not exists pgcrypto;

-- Helper: maintient updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.category_status as enum ('todo', 'in_progress', 'optimized', 'published');

-- Un projet = un site e-commerce client
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  domain text,
  locale text not null default 'fr-FR',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une page catégorie à passer à la moulinette
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  name text not null,
  target_keyword text,
  status public.category_status not null default 'todo',
  source_title text,
  source_meta_description text,
  source_h1 text,
  source_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_project_url_key unique (project_id, url)
);

-- Un passage de moulinette = une version optimisée, versionnée et conservée
create table public.optimizations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  version integer not null,
  title text,
  meta_description text,
  h1 text,
  content text,
  score integer check (score between 0 and 100),
  engine text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint optimizations_category_version_key unique (category_id, version)
);

create index projects_owner_id_idx on public.projects (owner_id);
create index categories_project_id_idx on public.categories (project_id);
create index categories_status_idx on public.categories (project_id, status);
create index optimizations_category_id_idx on public.optimizations (category_id, version desc);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- Attribue automatiquement le numéro de version suivant pour une catégorie
create or replace function public.set_optimization_version()
returns trigger
language plpgsql
as $$
begin
  if new.version is null or new.version = 0 then
    select coalesce(max(version), 0) + 1
      into new.version
      from public.optimizations
     where category_id = new.category_id;
  end if;
  return new;
end;
$$;

create trigger optimizations_set_version
  before insert on public.optimizations
  for each row execute function public.set_optimization_version();

-- ---------------------------------------------------------------------------
-- RLS : chaque utilisateur ne voit que les projets qu'il possède.
-- Pour passer en mode "toute l'équipe voit tout", remplacer les USING/WITH CHECK
-- par `auth.role() = 'authenticated'`.
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.categories enable row level security;
alter table public.optimizations enable row level security;

create policy projects_select_own on public.projects
  for select to authenticated using (owner_id = (select auth.uid()));
create policy projects_insert_own on public.projects
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_update_own on public.projects
  for update to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy projects_delete_own on public.projects
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy categories_select_own on public.categories
  for select to authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );
create policy categories_insert_own on public.categories
  for insert to authenticated with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );
create policy categories_update_own on public.categories
  for update to authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );
create policy categories_delete_own on public.categories
  for delete to authenticated using (
    exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

create policy optimizations_select_own on public.optimizations
  for select to authenticated using (
    exists (
      select 1 from public.categories c
      join public.projects p on p.id = c.project_id
      where c.id = category_id and p.owner_id = (select auth.uid())
    )
  );
create policy optimizations_insert_own on public.optimizations
  for insert to authenticated with check (
    exists (
      select 1 from public.categories c
      join public.projects p on p.id = c.project_id
      where c.id = category_id and p.owner_id = (select auth.uid())
    )
  );
create policy optimizations_delete_own on public.optimizations
  for delete to authenticated using (
    exists (
      select 1 from public.categories c
      join public.projects p on p.id = c.project_id
      where c.id = category_id and p.owner_id = (select auth.uid())
    )
  );
