-- ────────────────────────────────────────────────
-- push_subscriptions: Expo Push Token 저장
--   같은 사용자가 여러 기기 (UQ user_id + token)
--   본인 토큰만 read/insert/update/delete
-- ────────────────────────────────────────────────
create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform        text check (platform in ('ios', 'android', 'web')),
  device_label    text,
  enabled         boolean not null default true,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id) where enabled;

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions self read"
  on public.push_subscriptions for select using (auth.uid() = user_id);

create policy "push_subscriptions self insert"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions self update"
  on public.push_subscriptions for update using (auth.uid() = user_id);

create policy "push_subscriptions self delete"
  on public.push_subscriptions for delete using (auth.uid() = user_id);
