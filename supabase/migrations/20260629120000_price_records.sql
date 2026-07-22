-- ────────────────────────────────────────────────
-- price_records: 사용자 시세 제보
--   가격 트래킹은 데이터 소스 확보 어려워서, 일단 사용자가 직접 입력.
--   currency는 char(3) — 일단 KRW 위주, 추후 USD/EUR도.
-- ────────────────────────────────────────────────
create type price_source as enum ('retail', 'auction', 'secondhand', 'duty_free');

create table public.price_records (
  id           uuid primary key default gen_random_uuid(),
  bottling_id  uuid not null references public.bottlings(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  price        numeric(12, 2) not null check (price > 0),
  currency     char(3) not null default 'KRW',
  source       price_source not null default 'retail',
  source_url   text,
  place        text,
  recorded_at  date not null default current_date,
  created_at   timestamptz not null default now()
);

create index price_records_bottling_idx on public.price_records (bottling_id, recorded_at desc);
create index price_records_user_idx     on public.price_records (user_id, created_at desc);

alter table public.price_records enable row level security;

create policy "price_records read all"
  on public.price_records for select using (true);

create policy "price_records insert authed"
  on public.price_records for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- 본인 제보, 24시간 이내만 수정 가능 (실수 정정용)
create policy "price_records update own 24h"
  on public.price_records for update
  using (auth.uid() = user_id and created_at > now() - interval '24 hours');

create policy "price_records delete own"
  on public.price_records for delete
  using (auth.uid() = user_id);
