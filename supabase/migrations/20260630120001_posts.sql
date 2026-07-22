-- ────────────────────────────────────────────────────────────────────
-- Posts (인스타식 라이트 모먼트)
-- ────────────────────────────────────────────────────────────────────
-- tastings 가 "정식 후기"라면 posts 는 "마신 순간/바 방문/선물 받은 사진"
-- 사진 중심 + 캡션 + 옵셔널 보틀 태그. 점수·플레이버 X.
-- ────────────────────────────────────────────────────────────────────

-- 1) ENUM
do $$ begin
  create type post_visibility as enum ('public', 'followers', 'private');
exception when duplicate_object then null;
end $$;

-- 2) posts 테이블
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  body          text check (body is null or length(body) <= 2000),
  photos        text[] not null default '{}'
                check (
                  array_length(photos, 1) is null
                  or array_length(photos, 1) between 1 and 10
                ),
  visibility    post_visibility not null default 'public',
  bottling_id   uuid references public.bottlings(id) on delete set null,
  location_name text check (location_name is null or length(location_name) <= 100),
  like_count    int not null default 0,
  comment_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists posts_user_idx     on public.posts (user_id, created_at desc);
create index if not exists posts_bottling_idx on public.posts (bottling_id) where bottling_id is not null;
create index if not exists posts_public_idx   on public.posts (created_at desc) where visibility = 'public';

-- updated_at 자동 갱신
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- RLS
alter table public.posts enable row level security;

drop policy if exists "posts read by visibility" on public.posts;
create policy "posts read by visibility" on public.posts
  for select using (
    visibility = 'public'
    or auth.uid() = user_id
    or (
      visibility = 'followers'
      and exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.followee_id = user_id
      )
    )
  );

drop policy if exists "posts insert self" on public.posts;
create policy "posts insert self" on public.posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "posts update self" on public.posts;
create policy "posts update self" on public.posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "posts delete self" on public.posts;
create policy "posts delete self" on public.posts
  for delete using (auth.uid() = user_id);

-- 3) post_likes
create table if not exists public.post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists post_likes_post_idx on public.post_likes (post_id);
create index if not exists post_likes_user_idx on public.post_likes (user_id, created_at desc);

alter table public.post_likes enable row level security;

drop policy if exists "post_likes read all" on public.post_likes;
create policy "post_likes read all" on public.post_likes
  for select using (true);

drop policy if exists "post_likes insert self" on public.post_likes;
create policy "post_likes insert self" on public.post_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "post_likes delete self" on public.post_likes;
create policy "post_likes delete self" on public.post_likes
  for delete using (auth.uid() = user_id);

-- like_count 트리거 (tastings 패턴 미러)
create or replace function public.update_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_likes_count_trigger on public.post_likes;
create trigger post_likes_count_trigger
  after insert or delete on public.post_likes
  for each row execute function public.update_post_like_count();

-- 4) post_comments (대댓글 1단계)
create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  parent_id  uuid references public.post_comments(id) on delete cascade,
  body       text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx   on public.post_comments (post_id, created_at);
create index if not exists post_comments_parent_idx on public.post_comments (parent_id) where parent_id is not null;

alter table public.post_comments enable row level security;

drop policy if exists "post_comments read all" on public.post_comments;
create policy "post_comments read all" on public.post_comments
  for select using (true);

drop policy if exists "post_comments insert authed" on public.post_comments;
create policy "post_comments insert authed" on public.post_comments
  for insert with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "post_comments update own" on public.post_comments;
create policy "post_comments update own" on public.post_comments
  for update using (auth.uid() = user_id);

drop policy if exists "post_comments delete own" on public.post_comments;
create policy "post_comments delete own" on public.post_comments
  for delete using (auth.uid() = user_id);

drop trigger if exists post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
  before update on public.post_comments
  for each row execute function public.set_updated_at();

create or replace function public.update_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists post_comments_count_trigger on public.post_comments;
create trigger post_comments_count_trigger
  after insert or delete on public.post_comments
  for each row execute function public.update_post_comment_count();
