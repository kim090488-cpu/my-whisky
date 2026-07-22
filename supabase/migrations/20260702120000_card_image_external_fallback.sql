-- ────────────────────────────────────────────────────────────────────
-- bottling_card_stats: 라벨 이미지 fallback 체인에 외부 리뷰 사진 추가
-- ────────────────────────────────────────────────────────────────────
-- 우선순위:
--   1) 사용자 업로드 (bottling_images)
--   2) 수동 등록 라벨 (bottlings.label_image_url)
--   3) 외부 전문 리뷰 사진 (bottling_external_reviews.image_url, source='whisky_edition')
-- ────────────────────────────────────────────────────────────────────

create or replace view public.bottling_card_stats
with (security_invoker = true)
as
select
  b.id,
  b.distillery_id,
  b.name,
  b.name_kr,
  b.age_years,
  b.abv,
  b.cask_type,
  b.bottler,
  coalesce(
    -- 1. 사용자 업로드 사진 (커뮤니티 우선)
    (
      select storage_path from public.bottling_images bi
      where bi.bottling_id = b.id
      order by bi.sort_order, bi.created_at
      limit 1
    ),
    -- 2. 수동 등록 라벨
    b.label_image_url,
    -- 3. 외부 리뷰 사진 (whisky_edition)
    (
      select er.image_url from public.bottling_external_reviews er
      where er.bottling_id = b.id and er.source = 'whisky_edition'
        and er.image_url is not null
      limit 1
    )
  ) as label_image_url,
  b.created_at,
  d.name      as distillery_name,
  d.name_kr   as distillery_name_kr,
  d.country   as country,
  d.region    as region,
  d.status    as distillery_status,
  (
    select round(avg(t.score)::numeric, 1)
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public' and t.score is not null
  ) as avg_score,
  (
    select count(*)::int
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
  ) as tasting_count,
  (
    select round(avg(t.value_for_money)::numeric, 2)
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public' and t.value_for_money is not null
  ) as avg_value_for_money,
  (
    select
      case
        when count(*) filter (where t.would_buy_again is not null) = 0 then null
        else round(
          100.0 * count(*) filter (where t.would_buy_again = true)
          / nullif(count(*) filter (where t.would_buy_again is not null), 0)
        )::int
      end
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
  ) as buy_again_pct
from public.bottlings b
left join public.distilleries d on d.id = b.distillery_id;
