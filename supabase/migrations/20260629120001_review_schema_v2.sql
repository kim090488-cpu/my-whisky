-- ────────────────────────────────────────────────────────────────────
-- Review schema v2: "Should I buy this?" verdict 시스템
-- ────────────────────────────────────────────────────────────────────
-- 필수 5축 — would_buy_again, value_for_money, recommended_for, score, notes
-- 옵션 — flavor wheel 7축, 구매 메타, 페어링
-- 기존 nose/palate/finish/overall → notes 로 통합 후 제거
-- ────────────────────────────────────────────────────────────────────

-- 1) ENUM: 누구에게 추천하나
do $$ begin
  create type recommended_for_kind as enum ('beginner', 'intermediate', 'expert', 'gift');
exception when duplicate_object then null;
end $$;

-- 2) tastings: 새 컬럼 추가 (모두 NULLABLE — 기존 행 보호)
alter table public.tastings
  add column if not exists notes                  text,
  add column if not exists would_buy_again        boolean,
  add column if not exists value_for_money        smallint check (value_for_money between 1 and 5),
  add column if not exists recommended_for        recommended_for_kind[],

  -- flavor wheel (1-10)
  add column if not exists sweetness              smallint check (sweetness between 1 and 10),
  add column if not exists smokiness              smallint check (smokiness between 1 and 10),
  add column if not exists fruitiness             smallint check (fruitiness between 1 and 10),
  add column if not exists spiciness              smallint check (spiciness between 1 and 10),
  add column if not exists smoothness             smallint check (smoothness between 1 and 10),
  add column if not exists complexity             smallint check (complexity between 1 and 10),
  add column if not exists finish_length          smallint check (finish_length between 1 and 10),

  -- 구매 메타
  add column if not exists purchase_price         numeric(10, 2) check (purchase_price >= 0),
  add column if not exists purchase_currency      text check (purchase_currency ~ '^[A-Z]{3}$'),
  add column if not exists purchase_country       text,
  add column if not exists purchased_at_place     text,
  add column if not exists bottle_owned_verified  boolean not null default false,
  add column if not exists food_pairing           text;

-- 3) 기존 nose/palate/finish/overall → notes 통합 (notes 비어있을 때만)
update public.tastings
set notes = nullif(trim(both E' \n\t' from concat_ws(E'\n\n',
      case when nullif(trim(coalesce(nose,    '')), '') is not null then '향: '   || nose    end,
      case when nullif(trim(coalesce(palate,  '')), '') is not null then '맛: '   || palate  end,
      case when nullif(trim(coalesce(finish,  '')), '') is not null then '여운: ' || finish  end,
      case when nullif(trim(coalesce(overall, '')), '') is not null then '총평: ' || overall end
    )), '')
where notes is null
  and (
    nullif(trim(coalesce(nose,    '')), '') is not null or
    nullif(trim(coalesce(palate,  '')), '') is not null or
    nullif(trim(coalesce(finish,  '')), '') is not null or
    nullif(trim(coalesce(overall, '')), '') is not null
  );

-- 4) 의존 view 드롭 (overall 등을 참조 중)
drop view if exists public.trending_tastings;
drop view if exists public.bottling_card_stats;

-- 5) 통합된 옛 컬럼 제거 (color는 보존 — 짧은 메타라 부담 X)
alter table public.tastings
  drop column if exists nose,
  drop column if exists palate,
  drop column if exists finish,
  drop column if exists overall;

-- 6) bottling_card_stats 재생성 — 새 verdict 신호 일부 노출
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
  coalesce(
    b.label_image_url,
    (
      select storage_path from public.bottling_images bi
      where bi.bottling_id = b.id
      order by bi.sort_order, bi.created_at
      limit 1
    )
  ) as label_image_url,
  b.created_at,
  d.name    as distillery_name,
  d.country as country,
  d.region  as region,
  d.status  as distillery_status,
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
  -- v2: 카드에 노출할 신호
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

-- 7) verdict 전용 view — 보틀 상세에 필요한 모든 집계
create or replace view public.bottling_verdict_stats
with (security_invoker = true)
as
with t as (
  select * from public.tastings
  where visibility = 'public'
)
select
  b.id as bottling_id,
  -- 후기 수
  (select count(*)::int from t where t.bottling_id = b.id) as total_reviews,

  -- 다시 살래요 (응답한 사람들 중 %)
  (select (count(*) filter (where would_buy_again is not null))::int
     from t where t.bottling_id = b.id) as buy_again_responses,
  (select (count(*) filter (where would_buy_again = true))::int
     from t where t.bottling_id = b.id) as buy_again_yes,

  -- 가성비 (1-5 평균)
  (select round(avg(value_for_money)::numeric, 2)
     from t where t.bottling_id = b.id and value_for_money is not null) as avg_value_for_money,

  -- 추천 대상 카운트 (jsonb)
  (select jsonb_build_object(
     'beginner',     count(*) filter (where 'beginner'::recommended_for_kind     = any(recommended_for)),
     'intermediate', count(*) filter (where 'intermediate'::recommended_for_kind = any(recommended_for)),
     'expert',       count(*) filter (where 'expert'::recommended_for_kind       = any(recommended_for)),
     'gift',         count(*) filter (where 'gift'::recommended_for_kind         = any(recommended_for))
   ) from t where t.bottling_id = b.id and recommended_for is not null) as recommended_for_counts,

  -- flavor profile 평균
  (select round(avg(sweetness)::numeric, 1)     from t where t.bottling_id = b.id and sweetness is not null)     as avg_sweetness,
  (select round(avg(smokiness)::numeric, 1)     from t where t.bottling_id = b.id and smokiness is not null)     as avg_smokiness,
  (select round(avg(fruitiness)::numeric, 1)    from t where t.bottling_id = b.id and fruitiness is not null)    as avg_fruitiness,
  (select round(avg(spiciness)::numeric, 1)     from t where t.bottling_id = b.id and spiciness is not null)     as avg_spiciness,
  (select round(avg(smoothness)::numeric, 1)    from t where t.bottling_id = b.id and smoothness is not null)    as avg_smoothness,
  (select round(avg(complexity)::numeric, 1)    from t where t.bottling_id = b.id and complexity is not null)    as avg_complexity,
  (select round(avg(finish_length)::numeric, 1) from t where t.bottling_id = b.id and finish_length is not null) as avg_finish_length,

  -- 시세 (KRW 가정 — currency 섞이면 부정확. 추후 fx_rates 환산 필요)
  (select round(percentile_cont(0.5) within group (order by purchase_price)::numeric, 0)
     from t where t.bottling_id = b.id and purchase_price is not null
       and (purchase_currency = 'KRW' or purchase_currency is null)) as median_price_krw,
  (select count(*)::int from t where t.bottling_id = b.id and purchase_price is not null
       and (purchase_currency = 'KRW' or purchase_currency is null)) as price_data_count,

  -- 종합점수 (카탈로그와 동일 계산)
  (select round(avg(score)::numeric, 1) from t where t.bottling_id = b.id and score is not null) as avg_score
from public.bottlings b;

-- 8) trending_tastings 재생성 — overall 빠지고 notes 사용
create or replace view public.trending_tastings
with (security_invoker = true)
as
select
  t.id, t.bottling_id, t.user_id, t.score, t.tasted_at,
  t.like_count, t.comment_count, t.notes, t.visibility,
  coalesce((
    select count(*)::int
    from public.tasting_likes l
    where l.tasting_id = t.id
      and l.created_at > now() - interval '7 days'
  ), 0) as recent_likes
from public.tastings t
where t.visibility = 'public';

-- 9) verdict 집계에 자주 쓰일 부분 인덱스 (옵션 컬럼이라 NULL 많을 거라 partial 권장)
create index if not exists tastings_buy_again_idx
  on public.tastings (bottling_id) where visibility = 'public' and would_buy_again is not null;

create index if not exists tastings_value_idx
  on public.tastings (bottling_id) where visibility = 'public' and value_for_money is not null;

create index if not exists tastings_price_idx
  on public.tastings (bottling_id) where visibility = 'public' and purchase_price is not null;
