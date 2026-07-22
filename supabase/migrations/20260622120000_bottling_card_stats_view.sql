-- ────────────────────────────────────────────────
-- bottling_card_stats: 카탈로그 카드에 필요한 모든 컬럼을
-- 한 번의 SELECT로 가져오기 위한 view.
-- avg_score · tasting_count 는 public tastings 만 집계.
--
-- security_invoker=true → 호출자 RLS 적용 (PG 15+).
-- 데이터 규모 커지면 materialized view 로 전환 예정.
-- ────────────────────────────────────────────────
create or replace view public.bottling_card_stats
with (security_invoker = true)
as
select
  b.id,
  b.distillery_id,
  b.name,
  b.age_years,
  b.abv,
  b.cask_type,
  b.bottler,
  b.label_image_url,
  b.created_at,
  d.name    as distillery_name,
  d.country as country,
  d.region  as region,
  d.status  as distillery_status,
  (
    select round(avg(t.score)::numeric, 1)
    from public.tastings t
    where t.bottling_id = b.id
      and t.visibility = 'public'
      and t.score is not null
  ) as avg_score,
  (
    select count(*)::int
    from public.tastings t
    where t.bottling_id = b.id
      and t.visibility = 'public'
  ) as tasting_count
from public.bottlings b
join public.distilleries d on d.id = b.distillery_id;

-- 필터·정렬 자주 쓰이는 컬럼 인덱스
create index if not exists bottlings_age_years_idx on public.bottlings (age_years);
create index if not exists bottlings_abv_idx       on public.bottlings (abv);
create index if not exists bottlings_cask_type_idx on public.bottlings (cask_type);
create index if not exists bottlings_created_at_idx on public.bottlings (created_at desc);
