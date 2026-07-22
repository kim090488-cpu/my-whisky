-- ────────────────────────────────────────────────
-- bottling_external_reviews: 외부 소스 보틀링 리뷰·메타데이터 저장
--   초기 소스: 'whisky_edition' (thewhiskyedition.com 공개 API)
--   동일 보틀링이 여러 외부 소스에 있을 수 있어 (bottling_id, source) PK.
--   라이선스: 사용 시 출처 링크 노출 필수 — UI에서 source_url 사용.
-- ────────────────────────────────────────────────

create table public.bottling_external_reviews (
  bottling_id        uuid not null references public.bottlings(id) on delete cascade,
  source             text not null,                  -- 'whisky_edition', 추후 다른 소스도
  external_slug      text not null,                  -- 소스 내부 ID (URL slug)
  source_url         text,
  -- 점수 (whisky_edition은 리뷰어 2명, 0-100)
  reviewer_a_name    text,                           -- 'Marcel'
  reviewer_a_score   smallint check (reviewer_a_score between 0 and 100),
  reviewer_b_name    text,                           -- 'Sascha'
  reviewer_b_score   smallint check (reviewer_b_score between 0 and 100),
  -- 테이스팅 노트
  nose               text,
  palate             text,
  finish             text,
  conclusion_a       text,
  conclusion_b       text,
  -- 가격 (소스 표기 그대로. 통화 명시 — whisky_edition은 EUR)
  price_per_liter    numeric(12, 2),
  price_currency     char(3),
  flavour            text,                           -- 자유 텍스트 ("mellow", "spicy" 등)
  image_url          text,
  fetched_at         timestamptz not null default now(),
  primary key (bottling_id, source)
);

create unique index bottling_external_reviews_source_slug_uniq
  on public.bottling_external_reviews (source, external_slug);

create index bottling_external_reviews_source_idx
  on public.bottling_external_reviews (source);

alter table public.bottling_external_reviews enable row level security;

create policy "external_reviews read all"
  on public.bottling_external_reviews for select using (true);
-- 쓰기 정책 없음 = service_role만 가능 (시드 스크립트 전용)
