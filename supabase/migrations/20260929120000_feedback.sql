-- ────────────────────────────────────────────────
-- 사용자 문의·건의 (관리자 수신함)
--   me 탭 "문의·건의" 폼에서 저장. 관리자는 Supabase Dashboard 또는
--   추후 /admin/feedback 페이지에서 확인·응답.
-- ────────────────────────────────────────────────

do $$ begin
  create type feedback_category as enum ('bug', 'suggestion', 'question', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type feedback_status as enum ('open', 'in_progress', 'resolved');
exception when duplicate_object then null;
end $$;

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     feedback_category not null default 'other',
  subject      text not null check (length(subject) between 1 and 200),
  body         text not null check (length(body) between 1 and 5000),
  status       feedback_status not null default 'open',
  admin_note   text,
  app_version  text,
  platform     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists feedback_recent_idx
  on public.feedback (created_at desc);
create index if not exists feedback_status_idx
  on public.feedback (status, created_at desc);
create index if not exists feedback_user_idx
  on public.feedback (user_id, created_at desc);

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

alter table public.feedback enable row level security;

-- 본인 것만 select
drop policy if exists "feedback read own" on public.feedback;
create policy "feedback read own" on public.feedback
  for select using (auth.uid() = user_id);

-- 관리자는 모두 select
drop policy if exists "feedback read admin" on public.feedback;
create policy "feedback read admin" on public.feedback
  for select using (public.is_admin());

-- 로그인 유저는 본인 명의로 insert. 정지된 유저는 insert 불가.
drop policy if exists "feedback insert self" on public.feedback;
create policy "feedback insert self" on public.feedback
  for insert with check (
    auth.uid() = user_id and not public.is_user_suspended()
  );

-- 관리자만 update (status·admin_note 관리)
drop policy if exists "feedback update admin" on public.feedback;
create policy "feedback update admin" on public.feedback
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- delete는 관리자만
drop policy if exists "feedback delete admin" on public.feedback;
create policy "feedback delete admin" on public.feedback
  for delete using (public.is_admin());

comment on table public.feedback is
  '사용자 문의·건의. me 탭 폼에서 저장. RLS: 본인+관리자 조회, 본인만 insert, 관리자만 update/delete.';
