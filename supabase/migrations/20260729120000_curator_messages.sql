-- ────────────────────────────────────────────────
-- AI 큐레이터 대화 이력 (기기 간 동기화용)
--   이전: AsyncStorage(모바일)/localStorage(웹) 별개 저장
--   현재: Supabase에 저장 → 웹·모바일 어디서 열어도 동일한 대화
-- ────────────────────────────────────────────────

create table if not exists public.curator_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (length(content) between 1 and 20000),
  matches    jsonb,  -- [{ id, name, name_kr }] — assistant 메시지에서만 값 있음
  created_at timestamptz not null default now()
);

create index if not exists curator_messages_user_time_idx
  on public.curator_messages (user_id, created_at);

alter table public.curator_messages enable row level security;

drop policy if exists "curator_messages read own" on public.curator_messages;
create policy "curator_messages read own" on public.curator_messages
  for select using (auth.uid() = user_id);

drop policy if exists "curator_messages insert own" on public.curator_messages;
create policy "curator_messages insert own" on public.curator_messages
  for insert with check (auth.uid() = user_id);

drop policy if exists "curator_messages delete own" on public.curator_messages;
create policy "curator_messages delete own" on public.curator_messages
  for delete using (auth.uid() = user_id);
