-- ────────────────────────────────────────────────
-- 유저 차단
--   blocker가 blocked의 노트·모먼트·게시글·댓글을 안 보이게
--   차단은 blocker만 확인 가능
-- ────────────────────────────────────────────────

create table if not exists public.user_blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx on public.user_blocks (blocker_id);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- 본인의 차단 목록만 read/write
drop policy if exists "user_blocks read own" on public.user_blocks;
create policy "user_blocks read own" on public.user_blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists "user_blocks insert own" on public.user_blocks;
create policy "user_blocks insert own" on public.user_blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "user_blocks delete own" on public.user_blocks;
create policy "user_blocks delete own" on public.user_blocks
  for delete using (auth.uid() = blocker_id);
