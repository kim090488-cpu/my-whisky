-- ────────────────────────────────────────────────
-- 컨텐츠 숨김 컬럼: tastings · tasting_comments
-- ────────────────────────────────────────────────
alter table public.tastings
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_by     uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text;

alter table public.tasting_comments
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_by     uuid references auth.users(id) on delete set null,
  add column if not exists hidden_reason text;

-- ────────────────────────────────────────────────
-- 사용자 정지 컬럼: profiles
-- ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists suspended_until    timestamptz,
  add column if not exists suspended_at       timestamptz,
  add column if not exists suspension_reason  text;

-- ────────────────────────────────────────────────
-- admin_actions 로그
-- ────────────────────────────────────────────────
create type admin_action_type as enum (
  'hide_tasting', 'unhide_tasting',
  'hide_comment', 'unhide_comment',
  'suspend_user', 'unsuspend_user'
);

create table public.admin_actions (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references auth.users(id) on delete cascade,
  action        admin_action_type not null,
  target_table  text,
  target_id     uuid,
  related_report_id uuid references public.reports(id) on delete set null,
  reason        text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index admin_actions_admin_idx  on public.admin_actions (admin_id, created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_table, target_id, created_at desc);
create index admin_actions_action_idx on public.admin_actions (action, created_at desc);

alter table public.admin_actions enable row level security;

create policy "admin_actions read admin"
  on public.admin_actions for select using (public.is_admin());

create policy "admin_actions insert admin"
  on public.admin_actions for insert
  with check (public.is_admin() and auth.uid() = admin_id);

-- ────────────────────────────────────────────────
-- helper: 현재 사용자 정지 상태인가?
-- ────────────────────────────────────────────────
create or replace function public.is_user_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select suspended_until > now() from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ────────────────────────────────────────────────
-- tastings RLS 갱신: hidden 노트는 작성자·admin만 read
-- ────────────────────────────────────────────────
drop policy if exists "tastings read with follow" on public.tastings;

create policy "tastings read with follow and hide"
  on public.tastings for select
  using (
    auth.uid() = user_id
    or public.is_admin()
    or (
      hidden_at is null
      and (
        visibility = 'public'
        or (
          visibility = 'followers'
          and auth.uid() is not null
          and exists (
            select 1 from public.follows
            where follower_id = auth.uid() and followee_id = tastings.user_id
          )
        )
      )
    )
  );

-- tasting_comments RLS 갱신: hidden 댓글은 작성자·admin만
drop policy if exists "tasting_comments read all" on public.tasting_comments;

create policy "tasting_comments read with hide"
  on public.tasting_comments for select
  using (
    hidden_at is null
    or auth.uid() = user_id
    or public.is_admin()
  );

-- ────────────────────────────────────────────────
-- 정지된 사용자 write 차단 — 각 insert RLS에 not is_user_suspended() 추가
-- ────────────────────────────────────────────────
drop policy if exists "tastings insert self" on public.tastings;
create policy "tastings insert self not suspended"
  on public.tastings for insert
  with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "tasting_comments insert authed" on public.tasting_comments;
create policy "tasting_comments insert authed not suspended"
  on public.tasting_comments for insert
  with check (
    auth.uid() is not null and auth.uid() = user_id
    and not public.is_user_suspended()
  );

drop policy if exists "tasting_likes insert self" on public.tasting_likes;
create policy "tasting_likes insert self not suspended"
  on public.tasting_likes for insert
  with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "follows insert self" on public.follows;
create policy "follows insert self not suspended"
  on public.follows for insert
  with check (auth.uid() = follower_id and not public.is_user_suspended());

drop policy if exists "distilleries insert authed" on public.distilleries;
create policy "distilleries insert authed not suspended"
  on public.distilleries for insert
  with check (
    auth.uid() is not null and auth.uid() = created_by
    and not public.is_user_suspended()
  );

drop policy if exists "bottlings insert authed" on public.bottlings;
create policy "bottlings insert authed not suspended"
  on public.bottlings for insert
  with check (
    auth.uid() is not null and auth.uid() = created_by
    and not public.is_user_suspended()
  );

drop policy if exists "price_records insert authed" on public.price_records;
create policy "price_records insert authed not suspended"
  on public.price_records for insert
  with check (
    auth.uid() is not null and auth.uid() = user_id
    and not public.is_user_suspended()
  );

drop policy if exists "bottling_images insert authed" on public.bottling_images;
create policy "bottling_images insert authed not suspended"
  on public.bottling_images for insert
  with check (
    auth.uid() is not null and auth.uid() = uploaded_by
    and not public.is_user_suspended()
  );

-- 신고는 정지 사용자도 가능 (자신의 안전을 위해)
