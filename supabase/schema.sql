-- Schéma complet d'Opalook, rejouable sur un projet Supabase vierge.
--
-- Les migrations vivaient jusqu'ici dans l'historique du projet Supabase, ce qui
-- suffit tant qu'on ne travaille que sur celui-là. Dès qu'il faut monter la base
-- ailleurs — chez le client, sur un projet de test — cet historique n'est pas
-- transportable. Ce fichier l'est : il se colle tel quel dans l'éditeur SQL de
-- n'importe quel projet et reconstruit tout.
--
-- Il est écrit pour être rejouable sans casse : chaque objet est créé s'il
-- n'existe pas, les politiques sont supprimées avant d'être recréées. Le relancer
-- sur une base déjà en place ne détruit aucune donnée.
--
-- À exécuter dans Supabase : SQL Editor → New query → coller → Run.

/* ------------------------------------------------------------ types ------ */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'category_status') then
    create type public.category_status as enum ('todo', 'in_progress', 'optimized', 'published');
  end if;
end
$$;

/* -------------------------------------------------------- fonctions ------ */

-- `search_path` est vidé volontairement : sans ça, une fonction SECURITY DEFINER
-- peut être détournée en plaçant un objet homonyme dans un schéma que l'appelant
-- contrôle. C'est le durcissement que réclame l'analyseur Supabase.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Le numéro de version s'attribue en base plutôt que dans l'application : deux
-- rédactions lancées en même temps sur la même catégorie ne peuvent pas se voir
-- attribuer le même numéro.
create or replace function public.set_optimization_version()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
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

/* ----------------------------------------------------------- projets ----- */

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  domain text,
  locale text not null default 'fr-FR',
  notes text,
  business_rules text,
  market text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects drop constraint if exists projects_market_check;
alter table public.projects
  add constraint projects_market_check
  check (market is null or market in ('b2b', 'b2c'));

comment on column public.projects.notes is
  'Brief éditorial : contexte et priorités du moment. Oriente la rédaction.';
comment on column public.projects.business_rules is
  'Règles métier du site, éditables dans l''outil : qui parle, pool d''arguments autorisés, interdits, terminologie. Injectées intégralement dans le prompt de rédaction, avec autorité sur les consignes générales.';
comment on column public.projects.market is
  'b2b (revendeurs) ou b2c (client final). Change le registre et le vocabulaire autorisé.';

create index if not exists projects_owner_id_idx on public.projects (owner_id);

/* -------------------------------------------------------- catégories ----- */

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  url text not null,
  name text not null,
  target_keyword text,
  status public.category_status not null default 'todo',

  -- Arborescence PrestaShop. Sans elle, impossible de savoir de quelles pages
  -- un texte doit se démarquer.
  external_id integer,
  parent_external_id integer,
  products_count integer,
  catalog_short_description text,
  catalog_long_description text,

  -- Relevé de la page en ligne : c'est la source de vérité de la rédaction.
  source_title text,
  source_meta_description text,
  source_h1 text,
  source_content text,
  source_data jsonb not null default '{}'::jsonb,
  source_fetched_at timestamptz,

  -- Champ sémantique validé.
  secondary_keywords text[] not null default '{}'::text[],
  fan_queries text[] not null default '{}'::text[],
  brief text,

  -- Données externes.
  gsc_data jsonb not null default '{}'::jsonb,
  gsc_fetched_at timestamptz,
  keyword_volume integer,
  keyword_difficulty integer,
  keyword_cpc numeric,
  keyword_intent text,
  keyword_data_at timestamptz,
  serp_data jsonb not null default '{}'::jsonb,
  serp_fetched_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.categories.external_id is 'id_category PrestaShop.';
comment on column public.categories.parent_external_id is
  'id_parent PrestaShop, ramené à null pour une catégorie racine — PrestaShop rattache les racines à elles-mêmes, ce qui en ferait leur propre mère.';
comment on column public.categories.products_count is
  'Nombre de produits au moment de l''import. Indicatif et périssable : jamais écrit dans un texte publié.';
comment on column public.categories.brief is
  'Consignes opérationnelles propres à cette catégorie.';

create index if not exists categories_project_id_idx on public.categories (project_id);
create index if not exists categories_status_idx on public.categories (project_id, status);
create unique index if not exists categories_project_url_key
  on public.categories (project_id, url);
create unique index if not exists categories_project_external_key
  on public.categories (project_id, external_id) where external_id is not null;

-- Le registre des mots-clés. Un mot-clé ne peut cibler qu'une seule page du
-- site : la cannibalisation devient impossible par construction, pas par
-- vigilance.
create unique index if not exists categories_project_keyword_key
  on public.categories (project_id, lower(target_keyword))
  where target_keyword is not null and target_keyword <> '';

/* ------------------------------------------------------ optimisations ---- */

create table if not exists public.optimizations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  version integer not null default 0,
  title text,
  meta_description text,
  h1 text,
  short_description text,
  content text,
  score integer check (score >= 0 and score <= 100),
  engine text,
  editorial_angle text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on column public.optimizations.short_description is
  'Description COURTE (haut de page), HTML prêt à coller. `content` porte la description LONGUE (bas de page).';

create unique index if not exists optimizations_category_version_key
  on public.optimizations (category_id, version);
create index if not exists optimizations_category_id_idx
  on public.optimizations (category_id, version desc);

/* ---------------------------------------------------------- triggers ----- */

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists optimizations_set_version on public.optimizations;
create trigger optimizations_set_version
  before insert on public.optimizations
  for each row execute function public.set_optimization_version();

/* --------------------------------------------------------------- RLS ----- */
--
-- Tout est cloisonné par propriétaire de projet. La clé publishable utilisée par
-- le navigateur est publique par conception : c'est la RLS, et elle seule, qui
-- empêche un visiteur de lire les données d'un autre.
--
-- `(select auth.uid())` plutôt que `auth.uid()` : la sous-requête est évaluée une
-- fois par requête au lieu d'une fois par ligne.

alter table public.projects enable row level security;
alter table public.categories enable row level security;
alter table public.optimizations enable row level security;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select using (owner_id = (select auth.uid()));

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert with check (owner_id = (select auth.uid()));

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete using (owner_id = (select auth.uid()));

drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories
  for select using (exists (
    select 1 from public.projects p
    where p.id = categories.project_id and p.owner_id = (select auth.uid())
  ));

drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories
  for insert with check (exists (
    select 1 from public.projects p
    where p.id = categories.project_id and p.owner_id = (select auth.uid())
  ));

drop policy if exists categories_update_own on public.categories;
create policy categories_update_own on public.categories
  for update using (exists (
    select 1 from public.projects p
    where p.id = categories.project_id and p.owner_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.projects p
    where p.id = categories.project_id and p.owner_id = (select auth.uid())
  ));

drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories
  for delete using (exists (
    select 1 from public.projects p
    where p.id = categories.project_id and p.owner_id = (select auth.uid())
  ));

drop policy if exists optimizations_select_own on public.optimizations;
create policy optimizations_select_own on public.optimizations
  for select using (exists (
    select 1 from public.categories c
    join public.projects p on p.id = c.project_id
    where c.id = optimizations.category_id and p.owner_id = (select auth.uid())
  ));

drop policy if exists optimizations_insert_own on public.optimizations;
create policy optimizations_insert_own on public.optimizations
  for insert with check (exists (
    select 1 from public.categories c
    join public.projects p on p.id = c.project_id
    where c.id = optimizations.category_id and p.owner_id = (select auth.uid())
  ));

drop policy if exists optimizations_delete_own on public.optimizations;
create policy optimizations_delete_own on public.optimizations
  for delete using (exists (
    select 1 from public.categories c
    join public.projects p on p.id = c.project_id
    where c.id = optimizations.category_id and p.owner_id = (select auth.uid())
  ));

-- Les optimisations ne se modifient pas : une nouvelle rédaction crée une
-- version. Pas de politique UPDATE, donc pas de réécriture de l'historique.
