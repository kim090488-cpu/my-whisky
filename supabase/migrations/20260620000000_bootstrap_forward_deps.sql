-- Bootstrap stub functions to satisfy forward references from later migrations.
-- Real implementations are provided by moderation / admin migrations.
-- Idempotent: uses create or replace so real definitions overwrite cleanly.

create or replace function public.is_user_suspended()
returns boolean
language sql
stable
as $$ select false $$;
