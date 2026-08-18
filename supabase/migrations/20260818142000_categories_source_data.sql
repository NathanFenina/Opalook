-- Matière première extraite de la page : produits, facettes de filtres, structure Hn,
-- fil d'ariane, diagnostics de sélecteurs. C'est ce qui permet de rédiger un texte
-- réellement spécifique à chaque catégorie.
alter table public.categories
  add column source_data jsonb not null default '{}'::jsonb,
  add column source_fetched_at timestamptz;
