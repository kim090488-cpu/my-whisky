-- ────────────────────────────────────────────────
-- currency_rates: KRW 기준 환율 캐시
--   ECB 일일 환율 (Frankfurter API)을 시드 스크립트로 주기 갱신.
--   - 매 페이지 렌더에서 외부 API 호출하지 않기 위함.
--   - 통화 1개 = ? KRW 형태로 저장 (krw_per_unit)
--   - UI는 fetched_at 함께 표시 (사용자에게 기준일 투명하게)
-- ────────────────────────────────────────────────

create table public.currency_rates (
  code          char(3) primary key,           -- 'EUR', 'USD', 'GBP', 'JPY'
  krw_per_unit  numeric(14, 4) not null,       -- 예: EUR = 1757.1000
  fetched_at    timestamptz not null default now()
);

alter table public.currency_rates enable row level security;

create policy "currency_rates read all"
  on public.currency_rates for select using (true);
-- 쓰기 정책 없음 = service_role 시드 스크립트만 갱신 가능
