-- Classement organique relevé pour le mot-clé principal : titres, descriptions
-- et domaines du top N. Sert d'entrée à la rédaction (angles concurrents) et de
-- point de comparaison avec la position réelle du client.
alter table public.categories
  add column serp_data jsonb not null default '{}'::jsonb,
  add column serp_fetched_at timestamptz;

comment on column public.categories.serp_data is
  'Analyse SERP DataForSEO : {keyword, fetchedAt, results:[{rank,title,description,url,domain}], ownRank}.';
