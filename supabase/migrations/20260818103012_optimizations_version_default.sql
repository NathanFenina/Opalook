-- 0 est un sentinelle : le trigger set_optimization_version() le remplace par max(version)+1
alter table public.optimizations alter column version set default 0;
