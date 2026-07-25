-- ────────────────────────────────────────────────
-- 커뮤니티 게시판 (자유 스타일 카페형)
--   위스키 관련 질문·추천·팁·잡담. tastings(리뷰)·posts(모먼트)와 별개.
-- ────────────────────────────────────────────────

do $$ begin
  create type community_category as enum ('question', 'recommendation', 'tip', 'free');
exception when duplicate_object then null;
end $$;

create table if not exists public.community_posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      community_category not null default 'free',
  title         text not null check (length(title) between 1 and 200),
  body          text not null check (length(body) between 1 and 10000),
  like_count    int not null default 0,
  comment_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists community_posts_recent_idx
  on public.community_posts (created_at desc);
create index if not exists community_posts_category_idx
  on public.community_posts (category, created_at desc);
create index if not exists community_posts_user_idx
  on public.community_posts (user_id, created_at desc);

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;

drop policy if exists "community_posts read all" on public.community_posts;
create policy "community_posts read all" on public.community_posts
  for select using (true);

drop policy if exists "community_posts insert self" on public.community_posts;
create policy "community_posts insert self" on public.community_posts
  for insert with check (
    auth.uid() = user_id and not public.is_user_suspended()
  );

drop policy if exists "community_posts update self" on public.community_posts;
create policy "community_posts update self" on public.community_posts
  for update
  using (auth.uid() = user_id and not public.is_user_suspended())
  with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "community_posts delete self" on public.community_posts;
create policy "community_posts delete self" on public.community_posts
  for delete using (auth.uid() = user_id);

-- ── 댓글 ──
create table if not exists public.community_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_post_comments_post_idx
  on public.community_post_comments (post_id, created_at);
create index if not exists community_post_comments_user_idx
  on public.community_post_comments (user_id, created_at desc);

drop trigger if exists community_post_comments_set_updated_at on public.community_post_comments;
create trigger community_post_comments_set_updated_at
  before update on public.community_post_comments
  for each row execute function public.set_updated_at();

alter table public.community_post_comments enable row level security;

drop policy if exists "community_post_comments read all" on public.community_post_comments;
create policy "community_post_comments read all" on public.community_post_comments
  for select using (true);

drop policy if exists "community_post_comments insert authed" on public.community_post_comments;
create policy "community_post_comments insert authed" on public.community_post_comments
  for insert with check (
    auth.uid() = user_id and not public.is_user_suspended()
  );

drop policy if exists "community_post_comments update own" on public.community_post_comments;
create policy "community_post_comments update own" on public.community_post_comments
  for update
  using (auth.uid() = user_id and not public.is_user_suspended())
  with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "community_post_comments delete own" on public.community_post_comments;
create policy "community_post_comments delete own" on public.community_post_comments
  for delete using (auth.uid() = user_id);

-- 댓글 카운트 트리거
create or replace function public.update_community_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_post_comments_count on public.community_post_comments;
create trigger community_post_comments_count
  after insert or delete on public.community_post_comments
  for each row execute function public.update_community_post_comment_count();

-- ── 좋아요 ──
create table if not exists public.community_post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists community_post_likes_post_idx
  on public.community_post_likes (post_id);

alter table public.community_post_likes enable row level security;

drop policy if exists "community_post_likes read all" on public.community_post_likes;
create policy "community_post_likes read all" on public.community_post_likes
  for select using (true);

drop policy if exists "community_post_likes insert self" on public.community_post_likes;
create policy "community_post_likes insert self" on public.community_post_likes
  for insert with check (
    auth.uid() = user_id and not public.is_user_suspended()
  );

drop policy if exists "community_post_likes delete self" on public.community_post_likes;
create policy "community_post_likes delete self" on public.community_post_likes
  for delete using (auth.uid() = user_id);

-- 좋아요 카운트 트리거
create or replace function public.update_community_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_post_likes_count on public.community_post_likes;
create trigger community_post_likes_count
  after insert or delete on public.community_post_likes
  for each row execute function public.update_community_post_like_count();
