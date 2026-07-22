-- ────────────────────────────────────────────────
-- profiles.is_admin
--   service_role 만 변경 가능 (트리거로 강제).
--   첫 admin 승격은 Supabase Dashboard SQL Editor에서 직접:
--     update public.profiles set is_admin = true where username = 'your_username';
-- ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 자가승격 차단 트리거 — service_role(auth.uid() IS NULL)만 통과
create or replace function public.prevent_self_admin_promotion()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
    if auth.uid() is not null then
      raise exception 'is_admin은 service_role만 변경할 수 있어요.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_admin_promotion on public.profiles;
create trigger profiles_prevent_admin_promotion
  before update on public.profiles
  for each row execute function public.prevent_self_admin_promotion();

-- ────────────────────────────────────────────────
-- public.is_admin() — RLS·뷰에서 재사용할 helper
-- ────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;
