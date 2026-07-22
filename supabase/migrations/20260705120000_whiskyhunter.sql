-- ────────────────────────────────────────────────
-- whiskyhunter.net 옥션 데이터 연동
--   1) distilleries.whiskyhunter_slug — /api/distillery_data/<slug>/ 호출용
--   2) distillery_auction_stats — 월별 옥션 집계 캐시 (외부 API hammering 회피)
--
-- 데이터는 *증류소 단위 월별 평균*. 개별 보틀링 가격이 아님 — UI에서 라벨 명확화 필수.
-- 시드는 service_role 스크립트에서 채움 (scripts/seed-whiskyhunter-*.ts).
-- ────────────────────────────────────────────────

alter table public.distilleries
  add column if not exists whiskyhunter_slug text;

create unique index if not exists distilleries_whiskyhunter_slug_uniq
  on public.distilleries (whiskyhunter_slug)
  where whiskyhunter_slug is not null;

-- ────────────────────────────────────────────────
-- distillery_auction_stats: 한 행 = (증류소, 월)
--   winning_bid_* / trading_volume 단위는 whiskyhunter 출처 표기값 그대로 저장.
--   API 응답에 통화 필드가 없어 변환·정규화 안 함 — UI에서 출처 명시.
-- ────────────────────────────────────────────────
create table public.distillery_auction_stats (
  distillery_id     uuid not null references public.distilleries(id) on delete cascade,
  dt                date not null,                  -- 월 시작일 (예: 2024-06-01)
  source            text not null default 'whiskyhunter',
  winning_bid_mean  numeric(14, 2),
  winning_bid_min   numeric(14, 2),
  winning_bid_max   numeric(14, 2),
  trading_volume    numeric(16, 2),
  lots_count        integer,
  fetched_at        timestamptz not null default now(),
  primary key (distillery_id, dt, source)
);

create index distillery_auction_stats_dt_idx
  on public.distillery_auction_stats (distillery_id, dt desc);

alter table public.distillery_auction_stats enable row level security;

-- 누구나 읽기 (공개 옥션 집계). 쓰기는 service_role만 (정책 없음 = 차단).
create policy "auction_stats read all"
  on public.distillery_auction_stats for select using (true);
