-- Export des données Opalook vers un autre projet Supabase.
--
-- Cette requête ne modifie rien : elle LIT la base courante et fabrique le
-- script d'insertion correspondant. On l'exécute sur le projet source, on copie
-- la colonne renvoyée, on la colle dans l'éditeur SQL du projet cible.
--
-- Pourquoi ce détour plutôt qu'un export de fichier : les descriptions de
-- catégorie pèsent quelques centaines de kilo-octets. Les faire transiter à la
-- main, c'est prendre le risque d'en abîmer une sans s'en apercevoir. En
-- laissant Postgres écrire lui-même les littéraux — `quote_nullable` échappe
-- tout — le texte arrive intact, apostrophes et accents compris.
--
-- Marche à suivre :
--   1. projet SOURCE, SQL Editor : coller cette requête, Run
--   2. copier la valeur de la colonne `script` (le bouton de copie de la cellule)
--   3. projet CIBLE : y avoir joué schema.sql, et s'être connecté une fois à
--      l'app pour que le compte existe dans auth.users
--   4. projet CIBLE, SQL Editor : coller le script copié, Run
--
-- Le script produit rattache les projets au PREMIER utilisateur de la base
-- cible. Sur une base neuve qui n'a qu'un compte — le tien — c'est le bon.
--
-- Le script fait environ 600 Ko pour les deux sites. Si l'éditeur SQL peine à
-- l'avaler, décommenter les deux filtres `where` plus bas et exporter un projet
-- à la fois : le script reste rejouable, les insertions ne se marchent pas
-- dessus.

with owner_line as (
  select $$-- Généré par supabase/export.sql. Rejouable : les conflits mettent à jour.
do $do$
declare
  v_owner uuid;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Aucun compte dans auth.users : connecte-toi une fois à l''app avant de rejouer ce script.';
  end if;
$$ as part
),

projets as (
  select string_agg(
    format(
      $$
  insert into public.projects (id, owner_id, name, domain, locale, notes, business_rules, market)
  values (%s::uuid, v_owner, %s, %s, %s, %s, %s, %s)
  on conflict (id) do update set
    name = excluded.name, domain = excluded.domain, locale = excluded.locale,
    notes = excluded.notes, business_rules = excluded.business_rules,
    market = excluded.market;$$,
      quote_literal(p.id), quote_nullable(p.name), quote_nullable(p.domain),
      quote_nullable(p.locale), quote_nullable(p.notes),
      quote_nullable(p.business_rules), quote_nullable(p.market)
    ), E'\n' order by p.created_at
  ) as part
  from public.projects p
  -- where p.id = 'coller-ici-l-identifiant-du-projet'
),

categories as (
  select string_agg(
    format(
      $$
  insert into public.categories (
    id, project_id, url, name, target_keyword, status,
    external_id, parent_external_id, products_count,
    catalog_short_description, catalog_long_description,
    secondary_keywords, fan_queries, brief,
    gsc_data, gsc_fetched_at,
    keyword_volume, keyword_difficulty, keyword_cpc, keyword_intent, keyword_data_at
  ) values (
    %s::uuid, %s::uuid, %s, %s, %s, %s::public.category_status,
    %s, %s, %s, %s, %s,
    %s::text[], %s::text[], %s,
    %s::jsonb, %s::timestamptz,
    %s, %s, %s, %s, %s::timestamptz
  ) on conflict (id) do update set
    name = excluded.name, target_keyword = excluded.target_keyword,
    status = excluded.status, external_id = excluded.external_id,
    parent_external_id = excluded.parent_external_id,
    products_count = excluded.products_count,
    catalog_short_description = excluded.catalog_short_description,
    catalog_long_description = excluded.catalog_long_description,
    secondary_keywords = excluded.secondary_keywords,
    fan_queries = excluded.fan_queries, brief = excluded.brief,
    gsc_data = excluded.gsc_data, gsc_fetched_at = excluded.gsc_fetched_at,
    keyword_volume = excluded.keyword_volume,
    keyword_difficulty = excluded.keyword_difficulty,
    keyword_cpc = excluded.keyword_cpc, keyword_intent = excluded.keyword_intent,
    keyword_data_at = excluded.keyword_data_at;$$,
      quote_literal(c.id), quote_literal(c.project_id), quote_nullable(c.url),
      quote_nullable(c.name), quote_nullable(c.target_keyword), quote_literal(c.status),
      coalesce(c.external_id::text, 'null'),
      coalesce(c.parent_external_id::text, 'null'),
      coalesce(c.products_count::text, 'null'),
      quote_nullable(c.catalog_short_description),
      quote_nullable(c.catalog_long_description),
      quote_literal(c.secondary_keywords::text),
      quote_literal(c.fan_queries::text),
      quote_nullable(c.brief),
      quote_literal(c.gsc_data::text),
      quote_nullable(c.gsc_fetched_at::text),
      coalesce(c.keyword_volume::text, 'null'),
      coalesce(c.keyword_difficulty::text, 'null'),
      coalesce(c.keyword_cpc::text, 'null'),
      quote_nullable(c.keyword_intent),
      quote_nullable(c.keyword_data_at::text)
    ), E'\n' order by c.project_id, c.external_id nulls last, c.url
  ) as part
  from public.categories c
  -- where c.project_id = 'coller-ici-le-meme-identifiant-de-projet'
),

-- Le relevé de page et l'analyse SERP ne sont pas exportés : ce sont des
-- instantanés que l'outil refait à chaque traitement, et ils pèsent lourd.
-- Les optimisations non plus : elles se régénèrent, et repartir d'une base de
-- versions propre évite de traîner des textes écrits sous d'anciennes règles.

fin as (select $$
end
$do$;$$ as part)

select
  (select part from owner_line) ||
  coalesce((select part from projets), '') ||
  coalesce((select part from categories), '') ||
  (select part from fin) as script;
