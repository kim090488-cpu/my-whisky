-- ────────────────────────────────────────────────
-- reports: 사용자 신고 (노트·댓글·사용자 대상)
-- ────────────────────────────────────────────────
create type report_target as enum ('tasting', 'comment', 'user');
create type report_reason as enum ('spam', 'abuse', 'false_info', 'copyright', 'other');
create type report_status as enum ('open', 'in_progress', 'resolved', 'dismissed');

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references auth.users(id) on delete cascade,
  target_table    report_target not null,
  target_id       uuid not null,
  reason          report_reason not null,
  body            text check (length(body) <= 1000),
  status          report_status not null default 'open',
  resolved_by     uuid references auth.users(id) on delete set null,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now()
);

create index reports_open_idx     on public.reports (created_at desc) where status in ('open', 'in_progress');
create index reports_target_idx   on public.reports (target_table, target_id);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

-- 같은 사용자가 같은 대상 중복 신고 차단
create unique index reports_unique_per_reporter
  on public.reports (reporter_id, target_table, target_id);

alter table public.reports enable row level security;

create policy "reports read own or admin"
  on public.reports for select
  using (auth.uid() = reporter_id or public.is_admin());

create policy "reports insert authed"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "reports update admin"
  on public.reports for update
  using (public.is_admin());

-- ────────────────────────────────────────────────
-- 자가 신고 차단 (target table 별로 owner 확인)
-- ────────────────────────────────────────────────
create or replace function public.prevent_self_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if new.target_table = 'user' then
    if new.target_id = new.reporter_id then
      raise exception '본인을 신고할 수 없어요.';
    end if;
  elsif new.target_table = 'tasting' then
    select user_id into owner_id from public.tastings where id = new.target_id;
    if owner_id is null then
      raise exception '신고할 노트를 찾을 수 없어요.';
    end if;
    if owner_id = new.reporter_id then
      raise exception '본인 노트를 신고할 수 없어요.';
    end if;
  elsif new.target_table = 'comment' then
    select user_id into owner_id from public.tasting_comments where id = new.target_id;
    if owner_id is null then
      raise exception '신고할 댓글을 찾을 수 없어요.';
    end if;
    if owner_id = new.reporter_id then
      raise exception '본인 댓글을 신고할 수 없어요.';
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_prevent_self_report
  before insert on public.reports
  for each row execute function public.prevent_self_report();
