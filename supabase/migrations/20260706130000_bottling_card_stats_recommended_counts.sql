-- ────────────────────────────────────────────────────────────────────
-- bottling_card_stats: recommended_for 카테고리별 카운트 4개 추가
-- /picks 컨텍스트 큐레이션(초보자/중급/전문가/선물용)에서 정렬·필터 활용
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
    (
      select storage_path from public.bottling_images bi
      where bi.bottling_id = b.id
      order by bi.sort_order, bi.created_at
      limit 1
    ),
    b.label_image_url,
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
  ) as buy_again_pct,
  -- recommended_for 카테고리별 카운트 (multi-select 칼럼)
  (
    select count(*)::int from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
      and 'beginner'::recommended_for_kind = any(t.recommended_for)
  ) as beginner_count,
  (
    select count(*)::int from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
      and 'intermediate'::recommended_for_kind = any(t.recommended_for)
  ) as intermediate_count,
  (
    select count(*)::int from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
      and 'expert'::recommended_for_kind = any(t.recommended_for)
  ) as expert_count,
  (
    select count(*)::int from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
      and 'gift'::recommended_for_kind = any(t.recommended_for)
  ) as gift_count
from public.bottlings b
left join public.distilleries d on d.id = b.distillery_id;
