-- ────────────────────────────────────────────────────────────────────
-- 보틀링 수정 이력 (audit)
-- 위키식으로 누구나 수정 가능하니, 누가 언제 뭐 바꿨는지 추적
-- 트리거로 자동 기록. before 스냅샷만 (after 는 현재 row).
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.bottling_edits (
  id          uuid primary key default gen_random_uuid(),
  bottling_id uuid not null references public.bottlings(id) on delete cascade,
  edited_by   uuid references auth.users(id) on delete set null,
  edited_at   timestamptz not null default now(),
  before      jsonb not null
);

create index if not exists bottling_edits_bottling_idx
  on public.bottling_edits (bottling_id, edited_at desc);

alter table public.bottling_edits enable row level security;

drop policy if exists "bottling_edits read all" on public.bottling_edits;
create policy "bottling_edits read all" on public.bottling_edits
  for select using (true);

-- 직접 insert/update/delete 차단 (트리거로만 기록)
drop policy if exists "bottling_edits no direct write" on public.bottling_edits;

-- 트리거: bottlings UPDATE 시 before 스냅샷 기록
create or replace function public.log_bottling_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 실제로 의미 있는 컬럼이 바뀌었을 때만 기록
  if (
    old.distillery_id is distinct from new.distillery_id
    or old.name is distinct from new.name
    or old.name_kr is distinct from new.name_kr
    or old.age_years is distinct from new.age_years
    or old.abv is distinct from new.abv
    or old.vintage_year is distinct from new.vintage_year
    or old.bottling_year is distinct from new.bottling_year
    or old.cask_type is distinct from new.cask_type
    or old.bottler is distinct from new.bottler
    or old.bottler_name is distinct from new.bottler_name
    or old.bottle_size_ml is distinct from new.bottle_size_ml
    or old.total_bottles is distinct from new.total_bottles
    or old.notes is distinct from new.notes
  ) then
    insert into public.bottling_edits (bottling_id, edited_by, before)
    values (old.id, auth.uid(), to_jsonb(old));
  end if;
  return new;
end;
$$;

drop trigger if exists bottlings_log_edit on public.bottlings;
create trigger bottlings_log_edit
  before update on public.bottlings
  for each row execute function public.log_bottling_edit();
