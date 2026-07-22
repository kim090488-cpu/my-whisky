-- ────────────────────────────────────────────────────────────────────
-- 보틀링 수정 이력 좋아요 (community validation)
-- "이 정정이 정확한 정보다" 투표 → 좋아요 많은 수정이 신뢰 신호
-- ────────────────────────────────────────────────────────────────────

alter table public.bottling_edits
  add column if not exists like_count int not null default 0;

create table if not exists public.bottling_edit_likes (
  id         uuid primary key default gen_random_uuid(),
  edit_id    uuid not null references public.bottling_edits(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (edit_id, user_id)
);

create index if not exists bottling_edit_likes_edit_idx on public.bottling_edit_likes (edit_id);
create index if not exists bottling_edit_likes_user_idx on public.bottling_edit_likes (user_id);

alter table public.bottling_edit_likes enable row level security;

drop policy if exists "bottling_edit_likes read all" on public.bottling_edit_likes;
create policy "bottling_edit_likes read all" on public.bottling_edit_likes
  for select using (true);

drop policy if exists "bottling_edit_likes insert self not suspended" on public.bottling_edit_likes;
create policy "bottling_edit_likes insert self not suspended" on public.bottling_edit_likes
  for insert with check (auth.uid() = user_id and not public.is_user_suspended());

drop policy if exists "bottling_edit_likes delete self" on public.bottling_edit_likes;
create policy "bottling_edit_likes delete self" on public.bottling_edit_likes
  for delete using (auth.uid() = user_id);

create or replace function public.update_bottling_edit_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.bottling_edits set like_count = like_count + 1 where id = new.edit_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.bottling_edits set like_count = greatest(0, like_count - 1) where id = old.edit_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists bottling_edit_likes_count on public.bottling_edit_likes;
create trigger bottling_edit_likes_count
  after insert or delete on public.bottling_edit_likes
  for each row execute function public.update_bottling_edit_like_count();
