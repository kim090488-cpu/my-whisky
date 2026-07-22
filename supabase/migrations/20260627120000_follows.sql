-- ────────────────────────────────────────────────
-- follows: 단방향 팔로우 (Twitter 모델)
-- ────────────────────────────────────────────────
create table public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references auth.users(id) on delete cascade,
  followee_id  uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_follower_idx on public.follows (follower_id, created_at desc);
create index follows_followee_idx on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;

create policy "follows read all"
  on public.follows for select using (true);

create policy "follows insert self"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "follows delete self"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ────────────────────────────────────────────────
-- profiles 카운터
-- ────────────────────────────────────────────────
alter table public.profiles
  add column if not exists follower_count int not null default 0,
  add column if not exists following_count int not null default 0;

create or replace function public.update_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set follower_count  = follower_count  + 1 where id = new.followee_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.profiles set following_count = greatest(0, following_count - 1) where id = old.follower_id;
    update public.profiles set follower_count  = greatest(0, follower_count  - 1) where id = old.followee_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger follows_count_trigger
  after insert or delete on public.follows
  for each row execute function public.update_follow_counts();

-- 백필
update public.profiles p
  set follower_count  = (select count(*) from public.follows where followee_id = p.id),
      following_count = (select count(*) from public.follows where follower_id = p.id);

-- ────────────────────────────────────────────────
-- tastings RLS 정책 갱신: 'followers' visibility 활성화
--   public / 본인 / followers + 내가 팔로우 한 경우 셋 다 표시
-- ────────────────────────────────────────────────
drop policy if exists "tastings read public" on public.tastings;

create policy "tastings read with follow"
  on public.tastings for select
  using (
    visibility = 'public'
    or auth.uid() = user_id
    or (
      visibility = 'followers'
      and auth.uid() is not null
      and exists (
        select 1 from public.follows
        where follower_id = auth.uid() and followee_id = tastings.user_id
      )
    )
  );
