-- ────────────────────────────────────────────────
-- 보틀링 편집 신고 (커뮤니티 자정)
--   위키식 편집이 잘못됐다고 다른 유저가 신고
--   report_count 3+ 시 경고 badge + revert 버튼 노출 (UI 처리)
--   auto revert는 스팸 신고 위험으로 미도입 — 반자동 (유저 수동 revert)
-- ────────────────────────────────────────────────

create table if not exists public.bottling_edit_reports (
  id         uuid primary key default gen_random_uuid(),
  edit_id    uuid not null references public.bottling_edits(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text check (reason is null or length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (edit_id, user_id)
);

create index if not exists bottling_edit_reports_edit_idx
  on public.bottling_edit_reports (edit_id);

-- bottling_edits에 report_count 캐시 컬럼
alter table public.bottling_edits
  add column if not exists report_count int not null default 0;

-- 신고 insert/delete 시 report_count 자동 갱신
create or replace function public.update_bottling_edit_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.bottling_edits
      set report_count = report_count + 1
      where id = new.edit_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.bottling_edits
      set report_count = greatest(0, report_count - 1)
      where id = old.edit_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists bottling_edit_reports_count on public.bottling_edit_reports;
create trigger bottling_edit_reports_count
  after insert or delete on public.bottling_edit_reports
  for each row execute function public.update_bottling_edit_report_count();

-- RLS
alter table public.bottling_edit_reports enable row level security;

drop policy if exists "bottling_edit_reports read all" on public.bottling_edit_reports;
create policy "bottling_edit_reports read all"
  on public.bottling_edit_reports for select using (true);

drop policy if exists "bottling_edit_reports insert authed" on public.bottling_edit_reports;
create policy "bottling_edit_reports insert authed"
  on public.bottling_edit_reports for insert
  with check (
    auth.uid() = user_id
    and not public.is_user_suspended()
  );

drop policy if exists "bottling_edit_reports delete own" on public.bottling_edit_reports;
create policy "bottling_edit_reports delete own"
  on public.bottling_edit_reports for delete
  using (auth.uid() = user_id);
