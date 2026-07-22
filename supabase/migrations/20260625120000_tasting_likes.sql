-- ────────────────────────────────────────────────
-- tastings.like_count: denormalized counter (트리거로 갱신)
-- ────────────────────────────────────────────────
alter table public.tastings
  add column if not exists like_count int not null default 0;

-- ────────────────────────────────────────────────
-- tasting_likes
-- ────────────────────────────────────────────────
create table public.tasting_likes (
  id          uuid primary key default gen_random_uuid(),
  tasting_id  uuid not null references public.tastings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (tasting_id, user_id)
);

create index tasting_likes_tasting_idx on public.tasting_likes (tasting_id);
create index tasting_likes_user_idx    on public.tasting_likes (user_id, created_at desc);

alter table public.tasting_likes enable row level security;

create policy "tasting_likes read all"
  on public.tasting_likes for select using (true);

create policy "tasting_likes insert self"
  on public.tasting_likes for insert
  with check (auth.uid() = user_id);

create policy "tasting_likes delete self"
  on public.tasting_likes for delete
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────
-- 카운터 트리거
--   security definer로 tastings update를 RLS 우회 — 사용자가 like 토글하면
--   업데이트 권한 없는 다른 사람 노트의 like_count도 갱신돼야 하므로.
-- ────────────────────────────────────────────────
create or replace function public.update_tasting_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.tastings
      set like_count = like_count + 1
      where id = new.tasting_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.tastings
      set like_count = greatest(0, like_count - 1)
      where id = old.tasting_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger tasting_likes_count_trigger
  after insert or delete on public.tasting_likes
  for each row execute function public.update_tasting_like_count();

-- 기존 데이터에 대한 백필 (현재 0이지만 안전하게)
update public.tastings t
  set like_count = (
    select count(*) from public.tasting_likes l where l.tasting_id = t.id
  );
