-- Numérotation des versions par langue.
--
-- À jouer APRÈS `2026-09-22_multilingue_et_suivi.sql`, et dans une exécution
-- séparée. Ce n'est pas une coquetterie : l'éditeur SQL du dashboard Supabase
-- ajoute ses propres instructions à tout script contenant un `create table`, et
-- cette réécriture casse les corps de fonction délimités par des dollars. Un
-- fichier sans `create table` ne subit pas l'injection, donc passe.
--
-- Le délimiteur est nommé (`$fn$`) plutôt que nu (`$$`) : un délimiteur nommé
-- résiste aux découpages naïfs sur les points-virgules, dont le corps de cette
-- fonction contient plusieurs.
--
-- Ce que ça change : jusqu'ici le numéro de version se comptait sur la
-- catégorie entière. La première rédaction allemande d'une catégorie qui a déjà
-- trois versions françaises repartait donc en v4, ce qui laisse croire à trois
-- tentatives allemandes qui n'ont jamais existé. On compte désormais par couple
-- catégorie-langue : la v1 allemande est bien une v1.
--
-- Rejouable sans casse.

create or replace function public.set_optimization_version()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $fn$
begin
  if new.version is null or new.version = 0 then
    select coalesce(max(version), 0) + 1
      into new.version
      from public.optimizations
     where category_id = new.category_id
       and locale = new.locale;
  end if;
  return new;
end;
$fn$;

comment on function public.set_optimization_version() is
  'Numérote les versions par couple (catégorie, langue) : la v1 allemande n''a rien à voir avec la v3 française.';
