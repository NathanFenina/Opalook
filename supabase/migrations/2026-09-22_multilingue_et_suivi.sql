-- Multilingue, longueur cible, priorité et boucle de correction.
--
-- Jusqu'ici une ligne de `categories` valait une catégorie ET une langue. Le
-- site en compte dix : le mot-clé, son volume, le texte, le statut et la date
-- de publication sont propres à chacune. Un mot-clé ne se traduit pas — « bijou
-- ambre femme » et son équivalent allemand n'ont ni le même volume ni la même
-- concurrence — et un texte non plus, il se rédige dans sa langue à partir de
-- son propre mot-clé.
--
-- D'où cette table : `categories` garde ce qui est commun à toutes les langues
-- (l'identifiant PrestaShop, l'arborescence, le nombre de produits), et
-- `category_locales` porte tout ce qui varie.
--
-- Le faire maintenant plutôt qu'après coup n'est pas un luxe : rétrofitter dix
-- langues sur des textes déjà écrits coûterait bien plus que de poser la
-- structure avant d'en générer un seul.
--
-- À jouer dans le SQL Editor. Rejouable sans casse.

/* ------------------------------------------------ une ligne par langue --- */

create table if not exists public.category_locales (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale text not null,

  -- `project_id` est dérivé de la catégorie, et dupliqué à dessein : l'index
  -- d'unicité des mots-clés et les politiques RLS en ont besoin sur la ligne
  -- elle-même, sans jointure.
  project_id uuid not null references public.projects (id) on delete cascade,

  name text not null,
  url text,
  link_rewrite text,

  target_keyword text,
  keyword_volume integer,
  keyword_difficulty integer,
  keyword_intent text,
  keyword_data_at timestamptz,
  secondary_keywords text[] not null default '{}'::text[],
  fan_queries text[] not null default '{}'::text[],

  -- Longueur visée, déduite du top 10 de la SERP sur le mot-clé de CETTE
  -- langue. Ni valeur fixe ni improvisation : une donnée de la catégorie.
  target_length integer,
  target_length_source jsonb not null default '{}'::jsonb,

  brief text,
  catalog_short_description text,
  catalog_long_description text,

  -- Première phase du travail : les balises et l'URL. Elles se valident, se
  -- corrigent à la main et se regénèrent SANS toucher au texte — c'est
  -- exactement la demande : « pouvoir retravailler les liens sans regénérer les
  -- descriptions ». Elles vivent donc ici, sur la catégorie, et non dans
  -- `optimizations` qui est un journal figé de rédactions.
  title text,
  meta_description text,
  h1 text,
  metadata_generated_at timestamptz,
  metadata_engine text,
  metadata_approved boolean not null default false,

  gsc_data jsonb not null default '{}'::jsonb,
  gsc_fetched_at timestamptz,
  serp_data jsonb not null default '{}'::jsonb,
  serp_fetched_at timestamptz,

  status public.category_status not null default 'todo',

  -- Sans cette date, impossible de mesurer si la réécriture a servi à quelque
  -- chose : on ne saurait pas à partir de quand comparer.
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, locale)
);

comment on table public.category_locales is
  'Tout ce qui varie d''une langue à l''autre. `categories` ne garde que ce qui est commun : identifiant PrestaShop, arborescence, nombre de produits.';
comment on column public.category_locales.target_length is
  'Longueur visée en caractères, déduite du top 10 de la SERP sur le mot-clé de cette langue.';
comment on column public.category_locales.published_at is
  'Date de mise en ligne. Sert de repère pour mesurer l''effet de la réécriture.';
comment on column public.category_locales.link_rewrite is
  'Segment d''URL PrestaShop. Retravaillable seul, sans regénérer les descriptions.';
comment on column public.category_locales.metadata_approved is
  'Balises et URL validées à la main. La rédaction les reprend telles quelles au lieu d''en inventer d''autres.';

drop trigger if exists category_locales_set_updated_at on public.category_locales;
create trigger category_locales_set_updated_at
  before update on public.category_locales
  for each row execute function public.set_updated_at();

create index if not exists category_locales_project_idx
  on public.category_locales (project_id, locale);
create index if not exists category_locales_status_idx
  on public.category_locales (project_id, locale, status);

-- Le registre des mots-clés devient propre à chaque langue : « collier ambre »
-- en français et son équivalent anglais sont deux cibles distinctes, chacune
-- réservée à une seule page.
create unique index if not exists category_locales_keyword_key
  on public.category_locales (project_id, locale, lower(target_keyword))
  where target_keyword is not null and target_keyword <> '';

create unique index if not exists category_locales_url_key
  on public.category_locales (project_id, locale, url)
  where url is not null;

/* --------------------------------------- reprise de l'existant en `fr` --- */
--
-- Les colonnes de `categories` deviennent la ligne française. On ne les
-- supprime pas : d'autres écrans les lisent encore, et une migration qui casse
-- l'application en cours de route n'en est pas une.

insert into public.category_locales (
  category_id, locale, project_id, name, url,
  target_keyword, keyword_volume, keyword_difficulty, keyword_intent, keyword_data_at,
  secondary_keywords, fan_queries, brief,
  catalog_short_description, catalog_long_description,
  gsc_data, gsc_fetched_at, serp_data, serp_fetched_at, status
)
select
  c.id, 'fr', c.project_id, c.name, c.url,
  c.target_keyword, c.keyword_volume, c.keyword_difficulty, c.keyword_intent, c.keyword_data_at,
  c.secondary_keywords, c.fan_queries, c.brief,
  c.catalog_short_description, c.catalog_long_description,
  c.gsc_data, c.gsc_fetched_at, c.serp_data, c.serp_fetched_at, c.status
from public.categories c
on conflict (category_id, locale) do nothing;

/* ------------------------------------------- textes rattachés à une langue */

alter table public.optimizations
  add column if not exists locale text not null default 'fr';

comment on column public.optimizations.locale is
  'Langue du texte. Un même mot-clé n''existe pas d''une langue à l''autre, un même texte non plus.';

-- Le numéro de version se compte désormais par langue : la v1 anglaise n'a rien
-- à voir avec la v3 française.
drop index if exists public.optimizations_category_version_key;
create unique index if not exists optimizations_category_locale_version_key
  on public.optimizations (category_id, locale, version);

-- La fonction qui numérote les versions par langue est dans le fichier suivant,
-- `2026-09-22b_numerotation_par_langue.sql`, et pas ici. La raison est
-- pratiquement idiote et coûte pourtant une erreur : dès qu'un script contient
-- un `create table`, l'éditeur SQL du dashboard y injecte ses propres lignes
-- (« Added by Supabase: enable Row Level Security »), et cette réécriture casse
-- les corps de fonction délimités par des dollars — « unterminated
-- dollar-quoted string ». Séparer les deux est la seule façon fiable de jouer
-- les deux depuis le dashboard.
--
-- Ce fichier-ci est sûr sans l'autre : l'ancienne fonction compte le maximum sur
-- toute la catégorie, donc elle attribue des numéros plus hauts que nécessaire
-- pour une nouvelle langue, mais jamais deux fois le même. L'index d'unicité
-- ci-dessus tient.

/* ----------------------------------------------- boucle de correction ---- */
--
-- Quand un texte est repris à la main, la raison du refus vaut plus que la
-- correction elle-même : corrigée une fois dans les règles métier, elle ne se
-- représente pas sur les 181 catégories suivantes.

alter table public.optimizations
  add column if not exists rejection_reason text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users (id) on delete set null;

comment on column public.optimizations.rejection_reason is
  'Pourquoi ce texte a été refusé. Se relit en bloc pour nourrir les règles métier du projet.';

/* --------------------------------------------------------------- RLS ----- */

alter table public.category_locales enable row level security;

drop policy if exists category_locales_select on public.category_locales;
create policy category_locales_select on public.category_locales
  for select using (public.can_read_project(project_id));

drop policy if exists category_locales_insert on public.category_locales;
create policy category_locales_insert on public.category_locales
  for insert with check (public.can_write_project(project_id));

drop policy if exists category_locales_update on public.category_locales;
create policy category_locales_update on public.category_locales
  for update using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists category_locales_delete on public.category_locales;
create policy category_locales_delete on public.category_locales
  for delete using (public.can_write_project(project_id));

-- Les optimisations se modifient désormais sur un point : consigner un refus.
-- Le texte lui-même reste intouchable, une nouvelle rédaction crée une version.
drop policy if exists optimizations_update_own on public.optimizations;
create policy optimizations_update_own on public.optimizations
  for update using (exists (
    select 1 from public.categories c
    where c.id = optimizations.category_id and public.can_write_project(c.project_id)
  )) with check (exists (
    select 1 from public.categories c
    where c.id = optimizations.category_id and public.can_write_project(c.project_id)
  ));
