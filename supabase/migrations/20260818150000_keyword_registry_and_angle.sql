-- Registre des mots-clés : un mot-clé principal ne peut être attribué qu'à une
-- seule catégorie d'un projet. C'est ce qui rend la cannibalisation impossible
-- par construction, plutôt que de compter sur une consigne au modèle.
create unique index categories_project_keyword_key
  on public.categories (project_id, lower(target_keyword))
  where target_keyword is not null and target_keyword <> '';

-- Angle éditorial retenu pour chaque version générée. Sert à imposer un angle
-- différent aux catégories suivantes du même projet.
alter table public.optimizations
  add column editorial_angle text;
