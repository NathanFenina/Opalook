-- Mots-clés secondaires et fan queries validés à la main à partir des données GSC,
-- brief opérationnel propre à la catégorie, et données GSC brutes de l'URL.
alter table public.categories
  add column secondary_keywords text[] not null default '{}',
  add column fan_queries text[] not null default '{}',
  add column brief text,
  add column gsc_data jsonb not null default '{}'::jsonb,
  add column gsc_fetched_at timestamptz;

comment on column public.categories.brief is
  'Consignes opérationnelles à faire apparaître dans le texte : arguments, contraintes, éléments commerciaux.';
comment on column public.categories.gsc_data is
  'Requêtes GSC de cette URL : [{query, clicks, impressions, ctr, position}]. Alimente la sélection des mots-clés.';
