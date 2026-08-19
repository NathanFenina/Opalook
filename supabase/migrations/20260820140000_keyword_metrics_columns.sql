-- Données de marché du mot-clé principal (volume, difficulté, intention).
-- Colonnes dédiées plutôt que jsonb : ce sont des critères de tri du tableau.
alter table public.categories
  add column keyword_volume integer,
  add column keyword_difficulty integer,
  add column keyword_cpc numeric(10, 2),
  add column keyword_intent text,
  add column keyword_data_at timestamptz;

comment on column public.categories.keyword_difficulty is
  'SEO difficulty 0-100 du mot-clé principal.';
