-- ────────────────────────────────────────────────
-- tastings.comment_count: denormalized counter
-- ────────────────────────────────────────────────
alter table public.tastings
  add column if not exists comment_count int not null default 0;

-- ────────────────────────────────────────────────
-- tasting_comments — 대댓글 1단계 허용
-- ────────────────────────────────────────────────
create table public.tasting_comments (
  id          uuid primary key default gen_random_uuid(),
  tasting_id  uuid not null references public.tastings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   uuid references public.tasting_comments(id) on delete cascade,
  body        text not null check (length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasting_comments_tasting_idx on public.tasting_comments (tasting_id, created_at);
create index tasting_comments_parent_idx  on public.tasting_comments (parent_id) where parent_id is not null;

alter table public.tasting_comments enable row level security;

create policy "tasting_comments read all"
  on public.tasting_comments for select using (true);

create policy "tasting_comments insert authed"
  on public.tasting_comments for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "tasting_comments update own"
  on public.tasting_comments for update
  using (auth.uid() = user_id);

create policy "tasting_comments delete own"
  on public.tasting_comments for delete
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────
-- 깊이 검증: parent의 parent_id가 null이어야 함 (1단계만)
-- ────────────────────────────────────────────────
create or replace function public.validate_comment_depth()
returns trigger language plpgsql as $$
declare
  parent_parent_id uuid;
begin
  if new.parent_id is null then return new; end if;
  select parent_id into parent_parent_id
    from public.tasting_comments
    where id = new.parent_id;
  if parent_parent_id is not null then
    raise exception '대댓글의 대댓글은 작성할 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger tasting_comments_depth_check
  before insert or update on public.tasting_comments
  for each row execute function public.validate_comment_depth();

-- ────────────────────────────────────────────────
-- 카운터 트리거 (대댓글 포함 전체 카운트)
-- ────────────────────────────────────────────────
create or replace function public.update_tasting_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.tastings
      set comment_count = comment_count + 1
      where id = new.tasting_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.tastings
      set comment_count = greatest(0, comment_count - 1)
      where id = old.tasting_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger tasting_comments_count_trigger
  after insert or delete on public.tasting_comments
  for each row execute function public.update_tasting_comment_count();

create trigger tasting_comments_set_updated_at
  before update on public.tasting_comments
  for each row execute function public.set_updated_at();

-- 백필
update public.tastings t
  set comment_count = (
    select count(*) from public.tasting_comments c where c.tasting_id = t.id
  );
