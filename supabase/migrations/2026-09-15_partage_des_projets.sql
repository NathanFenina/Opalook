-- Partage d'un projet avec d'autres comptes.
--
-- Jusqu'ici un projet appartenait à un seul compte : `owner_id = auth.uid()`
-- dans chaque politique. Le client qui se connecte avec sa propre adresse est
-- donc un inconnu pour Postgres, qui ne lui renvoie rien — d'où un tableau de
-- bord vide, et la tentation de recréer un projet à côté.
--
-- On garde le propriétaire, et on lui adjoint des membres invités par adresse
-- e-mail. Par adresse et non par identifiant, parce qu'on doit pouvoir inviter
-- quelqu'un AVANT qu'il ne se soit jamais connecté : son compte n'existe pas
-- encore au moment de l'invitation.
--
-- À jouer dans le SQL Editor du projet Supabase. Rejouable sans casse.

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

alter table public.project_members drop constraint if exists project_members_role_check;
alter table public.project_members
  add constraint project_members_role_check check (role in ('viewer', 'editor'));

comment on table public.project_members is
  'Comptes autorisés sur un projet en plus de son propriétaire. La clé est l''adresse e-mail : on invite avant que le compte existe.';
comment on column public.project_members.role is
  'viewer : lecture seule. editor : peut aussi modifier et lancer les traitements, donc consommer les crédits d''API.';

-- L'adresse est la clé : on la normalise pour que Nathan@… et nathan@… soient
-- la même personne.
create or replace function public.normalize_member_email()
returns trigger language plpgsql set search_path to '' as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists project_members_normalize_email on public.project_members;
create trigger project_members_normalize_email
  before insert or update on public.project_members
  for each row execute function public.normalize_member_email();

/* ------------------------------------------------------- droits d'accès -- */
--
-- Ces fonctions sont en SECURITY DEFINER, et ce n'est pas un raccourci : sans
-- ça, la politique de `projects` interrogerait `project_members`, dont la
-- politique interrogerait `projects`, et Postgres refuserait la récursion. En
-- lisant les deux tables hors RLS à l'intérieur d'une fonction, on casse le
-- cycle. Le `search_path` vide évite qu'un objet homonyme placé ailleurs
-- détourne l'appel.

create or replace function public.current_email()
returns text language sql stable security definer set search_path to '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.can_read_project(p uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and pr.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.project_members m
    where m.project_id = p and m.email = public.current_email()
  );
$$;

create or replace function public.can_write_project(p uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and pr.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.project_members m
    where m.project_id = p and m.email = public.current_email() and m.role = 'editor'
  );
$$;

-- Seul le propriétaire gère la liste des invités. Un invité, même éditeur, ne
-- peut pas s'ajouter de complices ni se promouvoir.
create or replace function public.owns_project(p uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p and pr.owner_id = (select auth.uid())
  );
$$;

/* ------------------------------------------------------------ politiques -- */

alter table public.project_members enable row level security;

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select using (
    public.owns_project(project_id) or email = public.current_email()
  );

drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members
  for insert with check (public.owns_project(project_id));

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members
  for update using (public.owns_project(project_id))
  with check (public.owns_project(project_id));

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete using (public.owns_project(project_id));

-- Projets : lecture ouverte aux membres, écriture aux éditeurs. La suppression
-- du projet lui-même reste au propriétaire.
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select using (public.can_read_project(id));

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update using (public.can_write_project(id))
  with check (public.can_write_project(id));

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete using (owner_id = (select auth.uid()));

-- Catégories et optimisations suivent l'accès de leur projet.
drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories
  for select using (public.can_read_project(project_id));

drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories
  for insert with check (public.can_write_project(project_id));

drop policy if exists categories_update_own on public.categories;
create policy categories_update_own on public.categories
  for update using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories
  for delete using (public.can_write_project(project_id));

drop policy if exists optimizations_select_own on public.optimizations;
create policy optimizations_select_own on public.optimizations
  for select using (exists (
    select 1 from public.categories c
    where c.id = optimizations.category_id and public.can_read_project(c.project_id)
  ));

drop policy if exists optimizations_insert_own on public.optimizations;
create policy optimizations_insert_own on public.optimizations
  for insert with check (exists (
    select 1 from public.categories c
    where c.id = optimizations.category_id and public.can_write_project(c.project_id)
  ));

drop policy if exists optimizations_delete_own on public.optimizations;
create policy optimizations_delete_own on public.optimizations
  for delete using (exists (
    select 1 from public.categories c
    where c.id = optimizations.category_id and public.can_write_project(c.project_id)
  ));

create index if not exists project_members_email_idx on public.project_members (email);
