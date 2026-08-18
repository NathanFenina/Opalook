-- Corrige l'advisor "function_search_path_mutable" : on fige le search_path.
alter function public.set_updated_at() set search_path = '';
alter function public.set_optimization_version() set search_path = public, pg_temp;
