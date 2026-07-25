-- ────────────────────────────────────────────────
-- 유저 뱃지 (게이미피케이션)
--   조건 만족 시 자동 발급 (트리거). code는 앱에서 label/icon 매핑
-- ────────────────────────────────────────────────

create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  code       text not null,
  earned_at  timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id);

alter table public.user_badges enable row level security;

drop policy if exists "user_badges read all" on public.user_badges;
create policy "user_badges read all" on public.user_badges
  for select using (true);

-- ── 뱃지 발급 트리거들 (SECURITY DEFINER — 유저 대신 insert) ──
-- 노트 (tastings)
create or replace function public.grant_tasting_badges()
returns trigger language plpgsql security definer set search_path = public as $$
declare c int;
begin
  select count(*) into c from public.tastings where user_id = new.user_id;
  if c = 1  then insert into public.user_badges (user_id, code) values (new.user_id, 'first_note')       on conflict do nothing; end if;
  if c = 10 then insert into public.user_badges (user_id, code) values (new.user_id, 'ten_notes')        on conflict do nothing; end if;
  if c = 50 then insert into public.user_badges (user_id, code) values (new.user_id, 'fifty_notes')      on conflict do nothing; end if;
  if c = 100 then insert into public.user_badges (user_id, code) values (new.user_id, 'century_notes')   on conflict do nothing; end if;
  return new;
end;
$$;

drop trigger if exists tastings_grant_badges on public.tastings;
create trigger tastings_grant_badges
  after insert on public.tastings
  for each row execute function public.grant_tasting_badges();

-- 팔로워 (follows) — followee가 첫 팔로워 획득
create or replace function public.grant_follower_badges()
returns trigger language plpgsql security definer set search_path = public as $$
declare c int;
begin
  select count(*) into c from public.follows where followee_id = new.followee_id;
  if c = 1  then insert into public.user_badges (user_id, code) values (new.followee_id, 'first_follower')       on conflict do nothing; end if;
  if c = 10 then insert into public.user_badges (user_id, code) values (new.followee_id, 'ten_followers')        on conflict do nothing; end if;
  return new;
end;
$$;

drop trigger if exists follows_grant_badges on public.follows;
create trigger follows_grant_badges
  after insert on public.follows
  for each row execute function public.grant_follower_badges();

-- 모먼트 (posts)
create or replace function public.grant_post_badges()
returns trigger language plpgsql security definer set search_path = public as $$
declare c int;
begin
  select count(*) into c from public.posts where user_id = new.user_id;
  if c = 1  then insert into public.user_badges (user_id, code) values (new.user_id, 'first_moment')  on conflict do nothing; end if;
  if c = 10 then insert into public.user_badges (user_id, code) values (new.user_id, 'ten_moments')   on conflict do nothing; end if;
  return new;
end;
$$;

drop trigger if exists posts_grant_badges on public.posts;
create trigger posts_grant_badges
  after insert on public.posts
  for each row execute function public.grant_post_badges();

-- 컬렉션
create or replace function public.grant_collection_badges()
returns trigger language plpgsql security definer set search_path = public as $$
declare c int;
begin
  select count(*) into c from public.collection_items where user_id = new.user_id;
  if c = 1  then insert into public.user_badges (user_id, code) values (new.user_id, 'first_collection') on conflict do nothing; end if;
  if c = 10 then insert into public.user_badges (user_id, code) values (new.user_id, 'collector_ten')    on conflict do nothing; end if;
  return new;
end;
$$;

drop trigger if exists collection_grant_badges on public.collection_items;
create trigger collection_grant_badges
  after insert on public.collection_items
  for each row execute function public.grant_collection_badges();

-- 커뮤니티 게시글
create or replace function public.grant_community_badges()
returns trigger language plpgsql security definer set search_path = public as $$
declare c int;
begin
  select count(*) into c from public.community_posts where user_id = new.user_id;
  if c = 1 then insert into public.user_badges (user_id, code) values (new.user_id, 'first_community_post') on conflict do nothing; end if;
  if c = 5 then insert into public.user_badges (user_id, code) values (new.user_id, 'community_regular')    on conflict do nothing; end if;
  return new;
end;
$$;

drop trigger if exists community_grant_badges on public.community_posts;
create trigger community_grant_badges
  after insert on public.community_posts
  for each row execute function public.grant_community_badges();

-- 위스키 편집 (curator)
create or replace function public.grant_curator_badges()
returns trigger language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if new.edited_by is null then return new; end if;
  select count(*) into c from public.bottling_edits where edited_by = new.edited_by;
  if c = 1  then insert into public.user_badges (user_id, code) values (new.edited_by, 'first_edit')  on conflict do nothing; end if;
  if c = 10 then insert into public.user_badges (user_id, code) values (new.edited_by, 'curator_ten') on conflict do nothing; end if;
  return new;
end;
$$;

drop trigger if exists bottling_edits_grant_badges on public.bottling_edits;
create trigger bottling_edits_grant_badges
  after insert on public.bottling_edits
  for each row execute function public.grant_curator_badges();

-- 이전 유저 데이터 기반 backfill (한 번만)
insert into public.user_badges (user_id, code)
select user_id, 'first_note' from public.tastings group by user_id having count(*) >= 1
on conflict do nothing;
insert into public.user_badges (user_id, code)
select user_id, 'ten_notes' from public.tastings group by user_id having count(*) >= 10
on conflict do nothing;
insert into public.user_badges (user_id, code)
select user_id, 'fifty_notes' from public.tastings group by user_id having count(*) >= 50
on conflict do nothing;
insert into public.user_badges (user_id, code)
select user_id, 'first_moment' from public.posts group by user_id having count(*) >= 1
on conflict do nothing;
insert into public.user_badges (user_id, code)
select user_id, 'first_collection' from public.collection_items group by user_id having count(*) >= 1
on conflict do nothing;
insert into public.user_badges (user_id, code)
select followee_id, 'first_follower' from public.follows group by followee_id having count(*) >= 1
on conflict do nothing;
